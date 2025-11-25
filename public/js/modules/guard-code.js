
import { APIClient } from './api.js';

export class GuardCodeDisplay {
  constructor() {
    this.interval = null;
    this.currentAccount = null;
  }

  render(container, account) {
    container.innerHTML = `
      <div class="collapsible-panel expanded">
        <div class="panel-header">
          <div class="panel-header-title">
            <span>🔐</span>
            <span>Steam Guard Code</span>
          </div>
        </div>
        <div class="panel-content">
          <div class="guard-code-container">
            <div class="guard-code-display" id="guardCodeDisplay">-----</div>
            <div class="guard-code-timer">
              <div class="timer-circle" id="timerCircle">30</div>
              <div class="timer-text">
                <span class="timer-label">Next code in</span>
                <span class="timer-time" id="timerText">30 seconds</span>
              </div>
            </div>
            <div class="code-actions">
              <button class="copy-btn" id="copyCodeBtn">📋 Copy Code</button>
            </div>
            <div class="guard-code-meta">Account: <strong>${account.account_name}</strong></div>
          </div>
        </div>
      </div>
    `;

    const codeEl = document.getElementById('guardCodeDisplay');
    const copyBtn = document.getElementById('copyCodeBtn');

    copyBtn.addEventListener('click', () => {
      const code = codeEl.textContent;
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Code';
        }, 2000);
      });
    });

    codeEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  async start(account) {
    this.stop();
    this.currentAccount = account;
    this.fetchCode();
    this.interval = setInterval(() => this.fetchCode(), 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async fetchCode() {
    if (!this.currentAccount) return;

    try {
      const data = await APIClient.getGuardCode(this.currentAccount.id);
      const codeEl = document.getElementById('guardCodeDisplay');
      const timerCircle = document.getElementById('timerCircle');
      const timerText = document.getElementById('timerText');

      if (codeEl) codeEl.textContent = data.code;
      if (timerCircle) {
        timerCircle.textContent = data.valid_for_seconds;
        timerCircle.classList.toggle('warning', data.valid_for_seconds <= 5);
      }
      if (timerText) {
        timerText.textContent = `${data.valid_for_seconds} second${data.valid_for_seconds !== 1 ? 's' : ''}`;
      }
    } catch (error) {
      console.error('[GuardCode] Fetch failed:', error);
    }
  }
}