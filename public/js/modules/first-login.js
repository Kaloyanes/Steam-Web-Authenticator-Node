
import { APIClient } from './api.js';
import { UIManager } from './ui-manager.js';

export class FirstLoginManager {
  constructor() {
    this.ui = new UIManager();
  }

  async checkAndPromptLogin(account) {
    try {
      const status = await APIClient.getSessionStatus(account.id);
      
      if (!status.hasSession) {
        console.log(`[FirstLogin] No session file found`);
        return { needsLogin: true, status };
      }

      console.log(`[FirstLogin] Session file found, testing validity...`);
      
      try {
        const confResult = await APIClient.getConfirmations(account.id);
        
        console.log(`[FirstLogin] Session is valid`);
        return { needsLogin: false, status };
      } catch (error) {
        if (error.status === 401) {
          console.log(`[FirstLogin] Session is invalid/expired (401)`);
          return { needsLogin: true, status, sessionExpired: true };
        }
        throw error;
      }
    } catch (error) {
      console.log(`[FirstLogin] Session check failed:`, error.message);
      return { needsLogin: true, error: error.message };
    }
  }

  renderLoginForm(account, container) {
    const html = `
      <div style="padding: 20px; background: linear-gradient(135deg, var(--bg-accent) 0%, var(--bg-secondary) 100%); border: 2px solid var(--color-primary); border-radius: 8px;">
        <h3 style="margin: 0 0 15px 0; color: var(--color-primary);">🔐 First-Time Login Required</h3>
        
        <p style="margin: 0 0 15px 0; font-size: 0.95rem; color: var(--text-secondary);">
          This account doesn't have an active session yet. Enter your Steam password to create one:
        </p>

        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid var(--color-primary);">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;">Account</div>
          <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${account.account_name}</div>
          <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">ID: ${account.steamid}</div>
        </div>

        <label style="display: block; margin-bottom: 6px; font-weight: 500; font-size: 0.9rem;">Password</label>
        <input 
          type="password" 
          id="firstLoginPassword" 
          placeholder="Enter your Steam password" 
          autocomplete="current-password"
          style="width: 100%; padding: 10px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); font-size: 0.95rem; margin-bottom: 15px;"
          onkeypress="if(event.key==='Enter') window.app.firstLoginManager.submitFirstLogin('${account.id}')"
        >

        <button 
          onclick="window.app.firstLoginManager.submitFirstLogin('${account.id}')" 
          style="width: 100%; padding: 12px; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.95rem;"
        >
          🔓 Create Session & Continue
        </button>

        <div id="firstLoginStatus" style="margin-top: 12px;"></div>

        <p style="margin: 15px 0 0 0; font-size: 0.8rem; color: var(--text-tertiary); text-align: center; border-top: 1px solid var(--border-primary); padding-top: 12px;">
          Your password is used only to authenticate with Steam and is never stored.
        </p>
      </div>
    `;

    container.innerHTML = html;
  }

  async submitFirstLogin(accountId) {
    const pass = document.getElementById('firstLoginPassword')?.value || '';
    const statusEl = document.getElementById('firstLoginStatus');

    if (!pass) {
      statusEl.innerHTML = '<div class="status-message status-error">Password is required</div>';
      return;
    }

    statusEl.innerHTML = '<div class="status-message status-info">⏳ Creating session...</div>';

    try {
      await APIClient.refreshSession(accountId, pass);
      statusEl.innerHTML = '<div class="status-message status-success">✓ Session created successfully!</div>';
      document.getElementById('firstLoginPassword').value = '';
      
      setTimeout(() => {
        window.app.selectAccount(window.app.currentAccount);
      }, 1500);
    } catch (error) {
      statusEl.innerHTML = `<div class="status-message status-error">❌ Login failed: ${error.message}</div>`;
    }
  }
}