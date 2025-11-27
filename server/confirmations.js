//server-side confirmations.js

const SteamCommunity = require('steamcommunity');
const crypto = require('crypto');
const cheerio = require('cheerio');
const axios = require('axios');

const { getSessionCookiesForAccount, updateSessionLastUsed, isSessionValid } = require('./storage');
const { getAgent } = require('./proxy');

let timeOffset = 0;
let isAligned = false;

const STEAM_HEADERS = {
  Accept: 'application/json, text/javascript; q=0.01',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 6.0; Nexus 6P Build/MDA89D) AppleWebKit/537. 36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36',
  'X-Requested-With': 'com.valvesoftware. android.steam.community',
  Referer: 'https://steamcommunity.com/mobileconf/conf',
  Host: 'steamcommunity.com'
};

async function alignTime() {
  if (isAligned) return;
  try {
    const agent = getAgent();
    const res = await axios.post(
      'https://api.steampowered.com/ITwoFactorService/QueryTime/v0001',
      {},
      {
        headers: { 'Content-Length': '0' },
        httpsAgent: agent,
        validateStatus: () => true
      }
    );
    const st = parseInt(res.data?. response?.server_time, 10);
    if (! Number.isNaN(st)) {
      const lt = Math.floor(Date.now() / 1000);
      timeOffset = st - lt;
      isAligned = true;
    }
  } catch (err) {
    console.warn('[Conf] Time sync failed:', err.message);
  }
}

function getSteamTime() {
  return Math.floor(Date.now() / 1000) + timeOffset;
}

function bufferizeSecret(secret) {
  if (typeof secret === 'string' && secret.match(/^[0-9a-f]{40}$/i)) {
    return Buffer.from(secret, 'hex');
  }
  return Buffer.from(secret, 'base64');
}

function generateConfirmationKey(identitySecret, time, tag) {
  const secretBuf = bufferizeSecret(identitySecret);
  const tagBuf = Buffer.from(tag || '', 'utf8');
  const buf = Buffer.alloc(8 + tagBuf.length);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(time, 4);
  if (tagBuf.length > 0) tagBuf.copy(buf, 8);
  return crypto.createHmac('sha1', secretBuf).update(buf).digest('base64');
}

function generateConfirmationQueryParams(account, tag) {
  const time = getSteamTime();
  const key = generateConfirmationKey(account.identity_secret, time, tag);
  const params = new URLSearchParams();
  params. set('p', account.device_id);
  params.set('a', account.steamid);
  params.set('k', key);
  params.set('t', time);
  params.set('m', 'android');
  params.set('tag', tag);
  return params;
}

function getSessionCookieHeader(account) {
  // UPDATED: Check session validity first
  const validationResult = isSessionValid(account. id);
  
  if (!validationResult.valid) {
    console.error(`[Confirmations] Session validation failed: ${validationResult.reason}`);
    throw new Error('LOGIN_REQUIRED');
  }

  const saved = validationResult.session;
  const sessionid = saved.sessionid;
  const token = saved.steamLoginSecure;

  if (!sessionid || !token) {
    throw new Error('LOGIN_REQUIRED');
  }

  return `sessionid=${sessionid}; steamLoginSecure=${token}`;
}

async function fetchConfirmations(account) {
  await alignTime();

  try {
    const cookie = getSessionCookieHeader(account);
    const params = generateConfirmationQueryParams(account, 'conf');
    const url = `https://steamcommunity.com/mobileconf/getlist? ${params. toString()}`;

    const res = await axios.get(url, {
      headers: { ... STEAM_HEADERS, Cookie: cookie },
      httpsAgent: getAgent(),
      validateStatus: () => true
    });

    if (res.status === 401 || res.status === 403) {
      console.error('[Confirmations] Received 401/403 - session expired');
      throw new Error('LOGIN_REQUIRED');
    }

    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`);
    }

    updateSessionLastUsed(account.id);

    const data = res.data;
    if (!data.success) {
      if (data.message && data.message.includes('login')) {
        throw new Error('LOGIN_REQUIRED');
      }
      throw new Error(data.message || 'Failed to fetch confirmations');
    }

    return data;
  } catch (err) {
    if (err.message === 'LOGIN_REQUIRED') {
      throw err;
    }
    console.error('[Conf] Error:', err.message);
    throw err;
  }
}

async function actOnConfirmations(account, op, confirmations) {
  await alignTime();

  try {
    const cookie = getSessionCookieHeader(account);
    const params = generateConfirmationQueryParams(account, op);

    const formData = new URLSearchParams();
    formData.set('op', op);

    for (const conf of confirmations) {
      formData.append('cid[]', conf.id);
      formData.append('ck[]', conf.key);
    }

    const url = `https://steamcommunity.com/mobileconf/ajaxop?${params.toString()}`;

    const res = await axios.post(url, formData. toString(), {
      headers: {
        ...STEAM_HEADERS,
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      httpsAgent: getAgent(),
      validateStatus: () => true
    });

    if (res.status === 401 || res.status === 403) {
      console.error('[Confirmations] Received 401/403 - session expired');
      throw new Error('LOGIN_REQUIRED');
    }

    updateSessionLastUsed(account.id);

    const data = res.data;
    if (!data.success) {
      if (data.message && data.message.includes('login')) {
        throw new Error('LOGIN_REQUIRED');
      }
      throw new Error(data.message || 'Action failed');
    }

    return data;
  } catch (err) {
    if (err. message === 'LOGIN_REQUIRED') {
      throw err;
    }
    console.error('[ConfAct] Error:', err.message);
    throw err;
  }
}

module.exports = {
  fetchConfirmations,
  actOnConfirmations
};