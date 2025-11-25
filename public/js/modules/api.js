
const API_BASE = '';

export class APIClient {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      let data;
      try {
        data = await response.json();
      } catch {
        data = { error: `HTTP ${response.status}` };
      }

      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (!error.status) {
        error.status = 0;
      }
      throw error;
    }
  }

  static get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  static post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  static getAccounts() {
    return this.get('/api/accounts');
  }

  static importAccount(maFileContent) {
    return this.post('/api/accounts', { maFileContent });
  }

  static getGuardCode(accountId) {
    return this.get(`/api/accounts/${accountId}/code`);
  }

  static getConfirmations(accountId) {
    return this.get(`/api/accounts/${accountId}/confirmations`);
  }

  static actOnConfirmations(accountId, op, confirmations) {
    return this.post(`/api/accounts/${accountId}/confirmations/act`, { op, confirmations });
  }

  static refreshSession(accountId, password) {
    return this.post(`/api/accounts/${accountId}/refresh-session`, { password });
  }

  static async getDevices(steamid) {
    try {
      console.log('[API] Fetching devices for steamid:', steamid);
      
      const response = await fetch(`/api/security/${steamid}/devices`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('[API] getDevices response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[API] getDevices response data:', data);
      console.log('[API] getDevices devices array:', data.devices);
      
      const devices = Array.isArray(data.devices) ? data.devices : [];
      console.log('[API] getDevices returning', devices.length, 'devices');
      
      return devices;
    } catch (error) {
      console.error('[API] getDevices error:', error);
      return [];
    }
  }

  static async removeDevice(steamid, deviceId) {
    try {
      console.log('[API] Removing device:', deviceId);
      
      const response = await fetch(`/api/security/${steamid}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('[API] removeDevice response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[API] removeDevice response:', data);
      
      return data;
    } catch (error) {
      console.error('[API] removeDevice error:', error);
      throw error;
    }
  }

  static async removeAllDevices(steamid) {
    try {
      console.log('[API] Removing all devices');
      
      const response = await fetch(`/api/security/${steamid}/devices/all`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('[API] removeAllDevices response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[API] removeAllDevices response:', data);
      
      return data;
    } catch (error) {
      console.error('[API] removeAllDevices error:', error);
      throw error;
    }
  }

  static setupLogin(username, password) {
    return this.post('/api/setup/login', { username, password });
  }

  static submitEmailCode(setupId, emailCode) {
    return this.post('/api/setup/submit-email-code', { setupId, emailCode });
  }

  static addPhone(setupId, phoneNumber) {
    return this.post('/api/setup/add-phone', { setupId, phoneNumber });
  }

  static sendPhoneSMS(setupId) {
    return this.post('/api/setup/send-phone-sms', { setupId });
  }

  static verifyPhone(setupId, phoneCode) {
    return this.post('/api/setup/verify-phone', { setupId, phoneCode });
  }

  static enable2FA(setupId) {
    return this.post('/api/setup/enable', { setupId });
  }

  static finalize2FA(setupId, smsCode) {
    return this.post('/api/setup/finalize', { setupId, smsCode });
  }
}