
const { HttpsProxyAgent } = require('https-proxy-agent');

const PROXY_URL = null; 

function getAgent() {
  if (PROXY_URL) {
    console.log(`[Network] Using Proxy: ${PROXY_URL}`);
    return new HttpsProxyAgent(PROXY_URL);
  }
  return null;
}

module.exports = { getAgent };