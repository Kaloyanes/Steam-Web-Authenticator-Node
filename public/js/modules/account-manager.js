
import { APIClient } from './api.js';

export class AccountManager {
  constructor(ui) {
    this.ui = ui;
  }

  async loadAccounts() {
    try {
      const data = await APIClient.getAccounts();
      return data.accounts || [];
    } catch (error) {
      console.error('[AccountManager] Failed to load:', error);
      throw error;
    }
  }

  async importAccount(maFileContent) {
    try {
      const result = await APIClient.importAccount(maFileContent);
      return result.account;
    } catch (error) {
      throw new Error(error.data?.error || error.message);
    }
  }
}