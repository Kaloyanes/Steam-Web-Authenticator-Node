
export class ImportPanel {
  constructor(app) {
    this.app = app;
  }

  render(container) {
    container.innerHTML = `
      <div class="collapsible-panel expanded">
        <div class="panel-header">
          <div class="panel-header-title">
            <span>📂</span>
            <span>Import Account</span>
          </div>
          <div class="panel-toggle">▼</div>
        </div>
        <div class="panel-content">
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0;">Paste your maFile JSON content:</p>
          <textarea 
            id="maFileInput" 
            placeholder="Paste maFile JSON..." 
            style="width: 100%; min-height: 120px; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--bg-tertiary); color: var(--text-primary); resize: vertical; font-family: monospace; font-size: 0.85rem;"
          ></textarea>
          <button id="importBtn" style="width: 100%; margin-top: 10px;">Import Account</button>
          <div id="importStatus" style="margin-top: 10px;"></div>
        </div>
      </div>
    `;

    const header = container.querySelector('.panel-header');
    const panel = container.querySelector('.collapsible-panel');
    header.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      panel.classList.toggle('expanded');
    });

    document.getElementById('importBtn').addEventListener('click', async () => {
      const text = document.getElementById('maFileInput').value.trim();
      const statusDiv = document.getElementById('importStatus');

      if (!text) {
        statusDiv.innerHTML = '<div class="status-message status-error">Please paste maFile content</div>';
        return;
      }

      statusDiv.innerHTML = '<div class="status-message status-info">⏳ Importing...</div>';

      try {
        await this.app.importAccount(text);
        document.getElementById('maFileInput').value = '';
        statusDiv.innerHTML = '<div class="status-message status-success">✓ Import successful! Select the account to login.</div>';
      } catch (error) {
        statusDiv.innerHTML = `<div class="status-message status-error">❌ ${error.message}</div>`;
      }
    });
  }
}