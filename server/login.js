
const SteamCommunity = require('steamcommunity');
const { generateSteamGuardCode } = require('./steamGuard');
const {
  setSessionCookiesForAccount
} = require('./storage');

function loginAccount(account, password) {
  return new Promise((resolve, reject) => {
    if (!account || !account.account_name) {
      return reject(
        new Error(
          'Account is missing account_name. Re-import the maFile or set username.'
        )
      );
    }

    if (!account.shared_secret) {
      return reject(
        new Error(
          'Account is missing shared_secret in maFile. Cannot generate 2FA code.'
        )
      );
    }

    const community = new SteamCommunity();

    const twoFactorCode = generateSteamGuardCode(
      account.shared_secret,
      Date.now()
    );

    const loginDetails = {
      accountName: account.account_name,
      password,
      twoFactorCode,
      disableMobile: false
    };

    console.log(
      `[LoginAccount] Logging in as ${account.account_name} (${account.steamid})`
    );

    community.login(
      loginDetails,
      (err, sessionID, cookies, steamguard, oAuthToken) => {
        if (err) {
          console.error('[LoginAccount] Login error:', err.message || err);
          return reject(new Error(err.message || 'Login failed'));
        }

        console.log('[LoginAccount] Login successful, updating session cookies');

        let steamLoginSecure = null;

        if (Array.isArray(cookies)) {
          for (const cookie of cookies) {
            if (typeof cookie === 'string' && cookie.startsWith('steamLoginSecure=')) {
              steamLoginSecure = cookie.split(';')[0].split('=')[1];
              break;
            }
          }
        }

        if (!steamLoginSecure) {
          console.error(
            '[LoginAccount] Missing steamLoginSecure cookie after login'
          );
          return reject(
            new Error(
              'Login succeeded but missing steamLoginSecure cookie. Steam may have changed its login flow.'
            )
          );
        }

        setSessionCookiesForAccount(
          account.id,
          sessionID,
          steamLoginSecure,
          oAuthToken || null
        );

        console.log(
          '[LoginAccount] Session cookies updated for account',
          account.id
        );
        resolve();
      }
    );
  });
}

module.exports = { loginAccount };