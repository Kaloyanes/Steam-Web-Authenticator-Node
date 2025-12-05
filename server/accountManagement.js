const cheerio = require('cheerio');
const axios = require('axios');
const FormData = require('form-data');
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));
}

const {
  getSessionCookiesForAccount,
  updateSessionLastUsed
} = require('./storage');
const { getAgent } = require('./proxy');

const AUTHORIZED_DEVICES_URL =
  'https://store.steampowered.com/account/authorizeddevices';
const REVOKE_DEVICE_URL =
  'https://store.steampowered.com/twofactor/manage_action';

function buildCookieHeader(session) {
  const parts = [];

  if (session.steamLoginSecure) {
    parts.push(`steamLoginSecure=${session.steamLoginSecure}`);
  }
  if (session.sessionid || session.sessionId) {
    parts.push(`sessionid=${session.sessionid || session.sessionId}`);
  }

  parts.push('Steam_Language=english');

  return parts.join('; ');
}

async function fetchAuthorizedDevicesPage(session) {
  const res = await fetchFn(AUTHORIZED_DEVICES_URL, {
    method: 'GET',
    headers: {
      Cookie: buildCookieHeader(session),
      'User-Agent':
        session.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Failed to load authorized devices page (${res.status} ${res.statusText}) ${text.slice(
        0,
        200
      )}`
    );
  }

  return res.text();
}

function decodeJsonDataAttribute(raw) {
  if (!raw) return null;

  const unescaped = raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");

  try {
    return JSON.parse(unescaped);
  } catch (err) {
    throw new Error(`Failed to parse JSON from data attribute: ${err.message}`);
  }
}

function inferDeviceKind(device) {
  const platformType = device.platform_type;
  const desc = device.token_description || '';

  if (platformType === 1) {
    return {
      kind: 'pc_client',
      platformLabel: 'PC Steam Client',
      icon: 'pc'
    };
  }

  if (platformType === 3) {
    if (/iphone|ios/i.test(desc)) {
      return {
        kind: 'mobile_ios',
        platformLabel: 'Mobile device',
        icon: 'mobile'
      };
    }

    return {
      kind: 'mobile_android',
      platformLabel: 'Mobile device',
      icon: 'mobile'
    };
  }

  return {
    kind: 'web',
    platformLabel: 'Web browser',
    icon: 'web'
  };
}

function buildLocation(device) {
  const lastSeen = device.last_seen || {};

  const city = lastSeen.city || null;
  const country = lastSeen.country || null;

  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;
  return null;
}

function toUnixSeconds(value) {
  if (!value && value !== 0) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeDevice(device, category, requestingTokenId) {
  const base = inferDeviceKind(device);

  const lastSeenTime =
    toUnixSeconds(device.last_seen && device.last_seen.time) ||
    toUnixSeconds(device.time_updated);

  const firstSeenTime =
    toUnixSeconds(device.first_seen && device.first_seen.time) ||
    toUnixSeconds(device.time_updated);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isNew =
    firstSeenTime != null &&
    nowSeconds - firstSeenTime < 14 * 24 * 60 * 60; // 14 days

  const isCurrent =
    requestingTokenId &&
    String(requestingTokenId).replace(/"/g, '') ===
      String(device.token_id).replace(/"/g, '');

  return {
    id: String(device.token_id),
    name: device.token_description || base.platformLabel,
    category,
    kind: base.kind,
    icon: base.icon,
    platformLabel: base.platformLabel,
    location: buildLocation(device),
    lastActiveTime: lastSeenTime,
    firstSeenTime,
    isNew,
    isCurrentDevice: !!isCurrent,
    loggedIn: !!(device.logged_in || device.loggedIn),
    raw: device
  };
}

function getSteamSessionFromAccount(account) {
  const saved = getSessionCookiesForAccount(account.id);

  if (!saved) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  const cookies = saved.cookies || saved;

  const steamLoginSecure =
    cookies.steamLoginSecure ||
    cookies.steamloginsecure ||
    cookies['steamLoginSecure'];

  const sessionid =
    cookies.sessionid ||
    cookies.sessionId ||
    cookies['sessionid'];

  if (!steamLoginSecure || !sessionid) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  return {
    steamLoginSecure,
    sessionid,
    userAgent: saved.userAgent
  };
}

async function getDevicesForAccount(session) {
  const html = await fetchAuthorizedDevicesPage(session);
  const $ = cheerio.load(html);

  const appConfig = $('#application_config');
  if (!appConfig.length) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  const activeAttr = appConfig.attr('data-active_devices');
  const revokedAttr = appConfig.attr('data-revoked_devices');

  if (!activeAttr && !revokedAttr) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  const activeRaw = decodeJsonDataAttribute(activeAttr);
  const revokedRaw = decodeJsonDataAttribute(revokedAttr);
  const requestingTokenId = decodeJsonDataAttribute(
    appConfig.attr('data-requesting_token_id')
  );

  const activeDevices =
    Array.isArray(activeRaw) ? activeRaw : activeRaw ? [activeRaw] : [];
  const revokedDevices =
    Array.isArray(revokedRaw) ? revokedRaw : revokedRaw ? [revokedRaw] : [];

  const normalized = [];

  for (const d of activeDevices) {
    normalized.push(normalizeDevice(d, 'active', requestingTokenId));
  }

  for (const d of revokedDevices) {
    normalized.push(normalizeDevice(d, 'recent', requestingTokenId));
  }

  return normalized;
}

async function getDevicesFromSettings(account) {
  const session = getSteamSessionFromAccount(account);
  const devices = await getDevicesForAccount(session);
  updateSessionLastUsed(account.id);
  return devices;
}

async function revokeSingleDevice(account, deviceId) {
  const err = new Error('DEVICE_REVOKE_UNSUPPORTED');
  err.code = 'DEVICE_REVOKE_UNSUPPORTED';
  throw err;
}

async function signOutEverywhere(account) {
  const saved = getSessionCookiesForAccount(account.id);
  if (!saved?.sessionid || !saved?.steamLoginSecure) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  const cookieHeader = buildCookieHeader({
    steamLoginSecure: saved.steamLoginSecure,
    sessionid: saved.sessionid
  });

  const form = new FormData();
  form.append('action', 'deauthorize');
  form.append('sessionid', saved.sessionid);

  const res = await axios.post(
    'https://store.steampowered.com/twofactor/manage_action',
    form,
    {
      headers: {
        ...form.getHeaders(),
        Cookie: cookieHeader,
        Origin: 'https://store.steampowered.com',
        Referer: AUTHORIZED_DEVICES_URL
      },
      maxRedirects: 0,
      validateStatus: () => true
    }
  );

  updateSessionLastUsed(account.id);

  if (res.status === 302) {
    const location = (res.headers && res.headers.location) || '';
    if (location.includes('/login')) {
      const err = new Error('LOGIN_REQUIRED');
      err.code = 'LOGIN_REQUIRED';
      throw err;
    }
    return { ok: true };
  }

  if (res.status === 200) {
    return { ok: true };
  }

  console.warn('[Steam] signOutEverywhere failed', {
    status: res.status,
    location: res.headers && res.headers.location
  });

  return { ok: false, status: res.status };
}

async function removeDevice(account, deviceId) {
  if (deviceId === 'all') {
    return removeAllDevices(account);
  }
  return revokeSingleDevice(account, deviceId);
}


async function removeAllDevices(account) {
  const result = await signOutEverywhere(account);

  if (!result.ok) {
    return {
      success: false,
      results: [],
      removed: 0,
      failed: 0,
      status: result.status
    };
  }

  const devices = await getDevicesFromSettings(account);

  return {
    success: true,
    results: [],
    removed: 0,
    failed: 0,
    devices
  };
}

async function getSecurityStatus(account) {
  const session = getSteamSessionFromAccount(account);
  const html = await fetchAuthorizedDevicesPage(session);
  const $ = cheerio.load(html);
  const appConfig = $('#application_config');

  if (!appConfig.length) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }

  const twoFactorStatus = decodeJsonDataAttribute(
    appConfig.attr('data-two_factor_status')
  );
  const accountNameAttr = decodeJsonDataAttribute(
    appConfig.attr('data-accountName')
  );
  const emailAttr = decodeJsonDataAttribute(appConfig.attr('data-email'));
  const phoneHintAttr = decodeJsonDataAttribute(appConfig.attr('data-phone_hint'));

  const twoFactorEnabled = !!(twoFactorStatus && twoFactorStatus.state === 1);

  return {
    accountName: accountNameAttr || account.account_name,
    email: emailAttr || null,
    phoneHint: phoneHintAttr || null,
    twoFactor: {
      enabled: twoFactorEnabled,
      raw: twoFactorStatus || null
    }
  };
}

async function removeAuthenticator(account, revocationCode) {
  throw new Error(
    'Removing the authenticator is not implemented in this build. Use the official Steam app / website for now.'
  );
}

async function getBackupCodes(account) {
  throw new Error(
    'Fetching backup codes is not implemented in this build.'
  );
}

module.exports = {
  getDevicesFromSettings,
  removeDevice,
  removeAllDevices,
  removeAuthenticator,
  getSecurityStatus,
  getBackupCodes,

  getDevicesForAccount,
  signOutEverywhere
};
