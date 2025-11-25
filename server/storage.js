
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function parseMaFileSafe(input) {
  if (!input) return {};

  if (typeof input === 'object') return input;

  try {
    let safeString = input;

    safeString = safeString.replace(
      /"(S|s)team(ID|id)"\s*:\s*([0-9]{16,})/g,
      '"$1team$2": "$3"'
    );

    safeString = safeString.replace(
      /"SessionID"\s*:\s*([0-9]{8,})/g,
      '"SessionID": "$1"'
    );

    return JSON.parse(safeString);
  } catch (e) {
    console.error('Safe Parse Failed:', e.message);
    return JSON.parse(input);
  }
}

function loadManifest() {
  ensureDataDir();
  if (!fs.existsSync(MANIFEST_FILE)) {
    return { entries: [] };
  }

  try {
    const raw = fs.readFileSync(MANIFEST_FILE, 'utf8');
    const manifest = parseMaFileSafe(raw) || {};
    if (!Array.isArray(manifest.entries)) {
      manifest.entries = [];
    }
    return manifest;
  } catch {
    return { entries: [] };
  }
}

function saveManifest(manifest) {
  ensureDataDir();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

function getManifestSettings() {
  const manifest = loadManifest();
  return {
    entries: manifest.entries.length,
    hasEncryption: !!manifest.encryption || manifest.entries.some(e => e.encryption_iv || e.encryption_salt)
  };
}

function generateFallbackDeviceID(steamid) {
  const hash = crypto.createHash('sha1').update(String(steamid)).digest('hex');
  return (
    'android:' +
    hash.replace(
      /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12}).*$/,
      '$1-$2-$3-$4-$5'
    )
  );
}

function loadAccounts() {
  ensureDataDir();

  const manifest = loadManifest();
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

  const accounts = [];

  for (const entry of entries) {
    const steamid = String(entry.steamid || '');
    if (!steamid) continue;

    const filename = entry.filename || `${steamid}.maFile`;
    const fullPath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(fullPath)) continue;

    let maFile;
    try {
      maFile = parseMaFileSafe(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      continue;
    }

    const device_id =
      maFile.device_id ||
      maFile.deviceID ||
      maFile.deviceId ||
      generateFallbackDeviceID(steamid);

    accounts.push({
      id: steamid,
      steamid,
      account_name: maFile.account_name || '',
      display_name: maFile.account_name || '',
      shared_secret: maFile.shared_secret || '',
      identity_secret: maFile.identity_secret || '',
      device_id,
      raw_mafile: maFile
    });
  }

  return accounts;
}

function loadSessionStore() {
  ensureDataDir();
  if (!fs.existsSync(SESSIONS_FILE)) return { sessions: {} };

  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return { sessions: {} };
  }
}

function saveSessionStore(store) {
  ensureDataDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
}

function getSessionCookiesForAccount(accountId) {
  const store = loadSessionStore();
  const session = store.sessions && store.sessions[accountId];
  
  if (!session) {
    console.log(`[Sessions] No session found for account ${accountId}`);
    return null;
  }

  console.log(`[Sessions] Loaded session for ${accountId}`);
  return session;
}

function setSessionCookiesForAccount(
  accountId,
  sessionid,
  steamLoginSecure,
  oAuthToken = null
) {
  const store = loadSessionStore();
  if (!store.sessions) store.sessions = {};

  const timestamp = new Date().toISOString();
  
  store.sessions[accountId] = {
    sessionid,
    steamLoginSecure,
    oAuthToken,
    createdAt: timestamp,
    lastUsed: timestamp
  };

  console.log(`[Sessions] Saved session for account ${accountId}`);
  saveSessionStore(store);
}

function updateSessionLastUsed(accountId) {
  const store = loadSessionStore();
  if (store.sessions && store.sessions[accountId]) {
    store.sessions[accountId].lastUsed = new Date().toISOString();
    saveSessionStore(store);
  }
}

function clearSessionForAccount(accountId) {
  const store = loadSessionStore();
  if (store.sessions && store.sessions[accountId]) {
    delete store.sessions[accountId];
    saveSessionStore(store);
    console.log(`[Sessions] Cleared session for account ${accountId}`);
  }
}

function addAccountFromMaFile(input) {
  ensureDataDir();

  let maFile;

  if (typeof input === 'string') {
    maFile = parseMaFileSafe(input);
  } else if (typeof input === 'object' && input !== null) {
    maFile = input;
  } else {
    throw new Error('Invalid maFile input type');
  }

  let steamid = maFile.steamid || (maFile.Session ? maFile.Session.SteamID : null);
  if (!steamid) {
    throw new Error('Invalid maFile: missing SteamID');
  }

  steamid = String(steamid);
  maFile.steamid = steamid;
  if (maFile.Session) {
    maFile.Session.SteamID = steamid;
  }

  if (!maFile.device_id && (maFile.deviceID || maFile.deviceId)) {
    maFile.device_id = maFile.deviceID || maFile.deviceId;
  }

  const filename = `${steamid}.maFile`;
  const fullPath = path.join(DATA_DIR, filename);
  fs.writeFileSync(fullPath, JSON.stringify(maFile, null, 2));

  const manifest = loadManifest();
  if (!manifest.entries) manifest.entries = [];

  let entry = manifest.entries.find(e => String(e.steamid) === steamid);

  if (!entry) {
    entry = {
      encryption_iv: null,
      encryption_salt: null,
      filename,
      steamid,
      auto_confirm_trades: false,
      auto_confirm_market_transactions: false
    };
    manifest.entries.push(entry);
  } else {
    if (!Object.prototype.hasOwnProperty.call(entry, 'filename')) {
      entry.filename = filename;
    }
    if (!Object.prototype.hasOwnProperty.call(entry, 'encryption_iv')) {
      entry.encryption_iv = null;
    }
    if (!Object.prototype.hasOwnProperty.call(entry, 'encryption_salt')) {
      entry.encryption_salt = null;
    }
    if (!Object.prototype.hasOwnProperty.call(entry, 'auto_confirm_trades')) {
      entry.auto_confirm_trades = false;
    }
    if (
      !Object.prototype.hasOwnProperty.call(
        entry,
        'auto_confirm_market_transactions'
      )
    ) {
      entry.auto_confirm_market_transactions = false;
    }

    delete entry.account_name;
    delete entry.display_name;
  }

  saveManifest(manifest);

  if (maFile.Session && (maFile.Session.SteamLoginSecure || maFile.Session.AccessToken)) {
    const token =
      maFile.Session.SteamLoginSecure ||
      maFile.Session.AccessToken;
    if (token) {
      setSessionCookiesForAccount(
        steamid,
        maFile.Session.SessionID || '',
        token,
        maFile.Session.OAuthToken || maFile.Session.RefreshToken || null
      );
    }
  }

  return loadAccounts().find(a => String(a.steamid) === steamid);
}

module.exports = {
  loadAccounts,
  addAccountFromMaFile,
  getSessionCookiesForAccount,
  setSessionCookiesForAccount,
  updateSessionLastUsed,
  clearSessionForAccount,
  getManifestSettings
};