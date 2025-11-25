
const crypto = require('crypto');
const axios = require('axios'); 
const { getSessionCookiesForAccount, updateSessionLastUsed } = require('./storage');
const { getAgent } = require('./proxy');

let timeOffset = 0;
let isTimeAligned = false;

const STEAM_HEADERS = {
  'Accept': 'application/json, text/javascript; q=0.01',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 6P Build/MDA89D) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36',
  'X-Requested-With': 'com.valvesoftware.android.steam.community', 
  'Referer': 'https://steamcommunity.com/mobileconf/',
  'Host': 'steamcommunity.com'
};

async function alignTime() {
  if (isTimeAligned) return;
  try {
    const agent = getAgent();
    const res = await axios.post('https://steamcommunity.com/mobileconf/gettime', null, {
      headers: { 'Content-Length': '0' },
      httpsAgent: agent,
      validateStatus: () => true
    });
    if (res.data?.response?.server_time) {
      const serverTime = parseInt(res.data.response.server_time, 10);
      const localTime = Math.floor(Date.now() / 1000);
      timeOffset = serverTime - localTime;
      isTimeAligned = true;
      console.log(`[Time] Synced with Steam. Offset: ${timeOffset}s`);
    }
  } catch (e) { 
    console.warn('[Time] Sync failed:', e.message); 
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
  params.set('p', account.device_id);
  params.set('a', account.steamid);
  params.set('k', key);
  params.set('t', time);
  params.set('m', 'android');
  params.set('tag', tag);
  return params.toString();
}

function getSessionCookieHeader(account) {
  const saved = getSessionCookiesForAccount(account.id);
  
  let sessionid = saved?.sessionid || account.raw_mafile?.Session?.SessionID;
  let token = saved?.steamLoginSecure || account.raw_mafile?.Session?.SteamLoginSecure || account.raw_mafile?.Session?.AccessToken;

  if (!sessionid || !token) throw new Error('LOGIN_REQUIRED');
  
  return `sessionid=${sessionid}; steamLoginSecure=${token}`;
}

async function fetchConfirmations(account) {
  await alignTime();
  try {
    const cookie = getSessionCookieHeader(account);
    const qs = generateConfirmationQueryParams(account, 'conf');
    const url = `https://steamcommunity.com/mobileconf/conf?${qs}`;

    console.log(`[Confirmations] Querying for ${account.account_name}...`);
    
    const res = await axios.get(url, {
      headers: { ...STEAM_HEADERS, 'Cookie': cookie },
      httpsAgent: getAgent(),
      responseType: 'json',
      validateStatus: () => true
    });

    updateSessionLastUsed(account.id);

    if (res.status === 401 || res.status === 403) {
      throw new Error('LOGIN_REQUIRED');
    }

    if (res.data.success === false) {
       if (res.data.message === 'Oh nooooooes!') throw new Error('Steam Rejected Signature (Oh nooooooes!)');
       if (res.data.needauth) throw new Error('LOGIN_REQUIRED');
       throw new Error(res.data.message || 'Success=False');
    }
    return res.data;
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
        throw new Error('LOGIN_REQUIRED');
    }
    throw e;
  }
}

async function actOnConfirmations(account, op, confirmations) {
  await alignTime();
  try {
      const cookie = getSessionCookieHeader(account);
      const qs = generateConfirmationQueryParams(account, op);
      const params = new URLSearchParams(qs);
      
      params.set('op', op);
      confirmations.forEach(c => {
          params.append('cid[]', c.id);
          params.append('ck[]', c.key);
      });

      const res = await axios.post('https://steamcommunity.com/mobileconf/ajaxop', params.toString(), {
        headers: { 
            ...STEAM_HEADERS, 
            'Cookie': cookie,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        httpsAgent: getAgent(),
        validateStatus: () => true
      });

      updateSessionLastUsed(account.id);

      if (res.status === 401 || res.status === 403) {
        throw new Error('LOGIN_REQUIRED');
      }

      if (!res.data.success) throw new Error(res.data.message || 'Operation Failed');
      return res.data;
  } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) throw new Error('LOGIN_REQUIRED');
      throw e;
  }
}

module.exports = { fetchConfirmations, actOnConfirmations };