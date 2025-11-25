
const axios = require('axios');
const { getAgent } = require('./proxy');

const MARKET_BASE = 'https://steamcommunity.com/market/priceoverview/';
const priceCache = new Map();

function cacheKey(appid, currency, marketHashName) {
  return `${appid}:${currency}:${marketHashName}`;
}

async function fetchMarketPrice(appid, marketHashName, currency = 1) {
  if (!appid || !marketHashName) return null;

  const key = cacheKey(appid, currency, marketHashName);
  if (priceCache.has(key)) {
    return priceCache.get(key);
  }

  try {
    const res = await axios.get(MARKET_BASE, {
      params: {
        appid,
        currency,
        market_hash_name: marketHashName
      },
      httpsAgent: getAgent(),
      headers: {
        Accept: 'application/json, text/javascript; q=0.01',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      validateStatus: () => true
    });

    if (!res.data || res.data.success === false) {
      priceCache.set(key, null);
      return null;
    }

    const result = {
      appid,
      market_hash_name: marketHashName,
      lowest_price: res.data.lowest_price || null,
      median_price: res.data.median_price || null,
      volume: res.data.volume || null,
      raw: res.data
    };

    priceCache.set(key, result);
    return result;
  } catch (e) {
    console.warn('[Market] Failed to fetch price for', appid, marketHashName, e.message || e);
    priceCache.set(key, null);
    return null;
  }
}

module.exports = {
  fetchMarketPrice
};