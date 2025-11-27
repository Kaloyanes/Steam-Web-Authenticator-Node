import { APIClient } from './api.js';

export class ConfirmationsPanel {
  constructor(ui) {
    this.ui = ui;
    this.currentAccount = null;
  }

  render(container, account) {
    container.innerHTML = `
      <div class="collapsible-panel expanded">
        <div class="panel-header">
          <div class="panel-header-title">
            <span>✅</span>
            <span>Confirmations</span>
          </div>
        </div>
        <div class="panel-content">
          <div id="confirmationsContent"></div>
        </div>
      </div>
    `;
  }

  async loadWithRetry(account) {
    try {
      await this.load(account);
    } catch (error) {
      if (error.message === 'LOGIN_REQUIRED' || error.status === 401) {
        throw new Error('LOGIN_REQUIRED');
      }
      throw error;
    }
  }

  async load(account) {
    this.currentAccount = account;
    const container = document.getElementById('confirmationsContent');

    container.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading...</div>';

    try {
      const data = await APIClient.getConfirmations(account.id);
      const confirmations = data.confirmations || [];

      if (confirmations.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">No pending confirmations</div>';
        return;
      }

      let html = '<div class="conf-list">';
      confirmations.forEach(conf => {
        html += `
          <div class="conf-item">
            <input type="checkbox" value="${conf.id}" data-key="${conf.nonce}" class="conf-checkbox">
            <div class="conf-item-content">
              <div class="conf-item-title">${conf.headline || conf.type_name}</div>
              <div class="conf-item-summary">${conf.summary}</div>
              <div class="conf-item-time">${new Date(conf.creation_time * 1000).toLocaleString()}</div>
            </div>
          </div>
        `;
      });
      html += '</div>';

      html += `
        <div class="conf-actions" style="margin-top: 15px;">
          <button id="acceptBtn">✓ Accept Selected</button>
          <button id="declineBtn" class="secondary">✗ Decline Selected</button>
          <button id="refreshBtn" class="secondary" style="flex: 0;">🔄</button>
        </div>
      `;

      container.innerHTML = html;

      document.getElementById('acceptBtn').addEventListener('click', () => this.actOnSelected('allow'));
      document.getElementById('declineBtn').addEventListener('click', () => this.actOnSelected('cancel'));
      document.getElementById('refreshBtn').addEventListener('click', () => this.loadWithRetry(this.currentAccount));
    } catch (error) {
      console.error('[Confirmations] Load error:', error);
      
      if (error.status === 401 || error.message === 'LOGIN_REQUIRED') {
        container.innerHTML = `
          <div class="status-message status-error">
            Session expired.Please refresh the account.
          </div>
        `;
        throw new Error('LOGIN_REQUIRED');
      }
      
      container.innerHTML = `<div class="status-message status-error">${error.message}</div>`;
    }
  }

  async actOnSelected(op) {
    const checks = document.querySelectorAll('.conf-checkbox:checked');
    const confirmations = Array.from(checks).map(c => ({
      id: c.value,
      key: c.getAttribute('data-key')
    }));

    if (confirmations.length === 0) {
      this.ui.showError('Select at least one confirmation');
      return;
    }

    try {
      await APIClient.actOnConfirmations(this.currentAccount.id, op, confirmations);
      this.ui.showSuccess(`${confirmations.length} confirmation(s) ${op === 'allow' ? 'accepted' : 'declined'}`);
      await this.load(this.currentAccount);
    } catch (error) {
      if (error.status === 401 || error.message === 'LOGIN_REQUIRED') {
        this.ui.showError('Session expired.Please refresh the account.');
        throw new Error('LOGIN_REQUIRED');
      }
      this.ui.showError('Error: ' + error.message);
    }
  }
}