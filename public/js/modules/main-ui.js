
import { UIManager } from './ui-manager.js';
import { APIClient } from './api.js';

export class MainUI {
  constructor() {
    this.ui = new UIManager();
  }

  buildLayout() {
    const appRoot = document.getElementById('appRoot');
    appRoot.innerHTML = `
      <div class="app-layout">
        <div class="layout-header">
          <h1>🔐 Steam Guard</h1>
          <div class="subtitle">Authenticator Manager</div>
        </div>

        <div class="main-content" id="mainContent"></div>
        <div class="side-content" id="sideContent"></div>
      </div>
    `;
  }

  addAccountsPanel() {
    const main = document.getElementById('mainContent');
    const panel = this.ui.createPanel('accounts', 'Your Accounts', '👤', false);
    main.appendChild(panel);

    this.loadAccounts();
    return panel;
  }

  addSetupPanel() {
    const main = document.getElementById('mainContent');
    const panel = this.ui.createPanel('setup', 'Setup New Account', '➕', true);
    main.appendChild(panel);
    return panel;
  }

  addImportPanel() {
    const main = document.getElementById('mainContent');
    const panel = this.ui.createPanel('import', 'Import Account', '📂', true);
    main.appendChild(panel);

    const content = `
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0;">Paste your maFile JSON content:</p>
      <textarea id="maFileInput" placeholder="Paste maFile JSON..." 
                style="width: 100%; min-height: 120px; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--bg-tertiary); color: var(--text-primary); resize: vertical; font-family: monospace; font-size: 0.85rem;"></textarea>
      <button onclick="window.app.importAccount()" style="width: 100%; margin-top: 10px;">Import Account</button>
      <div id="importStatus" style="margin-top: 10px;"></div>
    `;

    this.ui.setPanelContent('import', content);
    return panel;
  }

  addGuardCodePanel() {
    const side = document.getElementById('sideContent');
    const guardCodeSection = document.createElement('div');
    guardCodeSection.id = 'guardCodeSection';
    side.appendChild(guardCodeSection);
    return guardCodeSection;
  }

  addConfirmationsPanel() {
    const side = document.getElementById('sideContent');
    const panel = this.ui.createPanel('confirmations', 'Confirmations', '✅', true);
    side.appendChild(panel);
    this.ui.showEmpty('confirmations', '⏳', 'Select an Account', 'Choose an account to view confirmations');
    return panel;
  }

  addSecurityPanel() {
    const side = document.getElementById('sideContent');
    const panel = this.ui.createPanel('security', 'Security Settings', '🛡️', true);
    side.appendChild(panel);
    this.ui.showEmpty('security', '🔒', 'Select an Account', 'Choose an account to view security settings');
    return panel;
  }

  async loadAccounts() {
    this.ui.showLoading('accounts');

    try {
      const data = await APIClient.getAccounts();
      const accounts = data.accounts || [];

      if (accounts.length === 0) {
        this.ui.showEmpty('accounts', '👻', 'No Accounts', 'Import or setup an account to get started');
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'accounts-grid';

      accounts.forEach(account => {
        const btn = document.createElement('button');
        btn.className = 'account-btn';
        btn.dataset.accountId = account.id;
        btn.innerHTML = `
          <div class="account-name">${account.account_name || 'Unknown'}</div>
          <div class="account-id">${account.steamid}</div>
        `;
        btn.addEventListener('click', () => {
          window.app.selectAccount(account);
        });
        grid.appendChild(btn);
      });

      this.ui.setPanelContent('accounts', grid);
    } catch (error) {
      this.ui.setPanelContent('accounts', `
        <div class="status-message status-error">
          Failed to load accounts: ${error.message}
        </div>
      `);
    }
  }
}