export class SecurityPanel {
  constructor(ui) {
    this.ui = ui;
    this.root = null;
    this.account = null;

    this.state = {
      loading: false,
      error: null,
      devices: [],
      filter: 'all',
      removingAll: false,
      removingId: null
    };
  }

  render(rootElement, account) {
    this.root = rootElement;
    this.account = account;

    if (!this.root) return;

    this.root.innerHTML = `
      <div class="collapsible-panel expanded security-panel">
        <div class="panel-header">
          <div class="panel-header-title">
            <span>🛡️</span>
            <span>Security & Devices</span>
          </div>
          <div class="panel-header-meta" id="securitySummary"></div>
          <div class="panel-toggle">▼</div>
        </div>

        <div class="panel-content">
          <div class="security-status-bar" id="securityStatusBar">
            Loading devices...
          </div>

          <div class="security-filters">
            <button class="security-filter-btn security-filter-btn--active" data-filter="all">
              All devices
            </button>
            <button class="security-filter-btn" data-filter="active">
              Active now
            </button>
            <button class="security-filter-btn" data-filter="recent">
              Recently seen
            </button>
          </div>

          <div class="security-devices-header">
            <div class="security-devices-header-left">
              <div class="security-devices-title">Signed-in devices</div>
              <div class="security-devices-subtitle" id="securityDevicesSubtitle">
                Loading...
              </div>
            </div>
            <div class="security-devices-header-right">
              <button class="security-signout-all-btn" id="securitySignOutAllBtn">
                Sign out everywhere
              </button>
            </div>
          </div>

          <div class="security-devices-list" id="securityDevicesList">
            <!-- devices go here -->
          </div>
        </div>
      </div>
    `;

    const header = this.root.querySelector('.panel-header');
    header.addEventListener('click', () => {
      const panel = this.root.querySelector('.collapsible-panel');
      panel.classList.toggle('collapsed');
      panel.classList.toggle('expanded');
    });

    this._bindFilterControls();
    this._bindSignOutAll();

  }

  async loadWithRetry(account) {
    const target = account || this.account;
    if (!target) throw new Error('No account provided to SecurityPanel');

    try {
      await this._loadDevices(target);
    } catch (err) {
      if (err.message === 'LOGIN_REQUIRED') {
        throw err;
      }
      this._setError(err.message || 'Failed to load devices');
    }
  }

  async _loadDevices(account) {
    if (!this.root) return;

    const steamid = account.steamid;
    if (!steamid) {
      throw new Error('Missing steamid for account');
    }

    this.state.loading = true;
    this._updateStatusBar('Loading devices...', 'info');
    this._updateSubtitle('Fetching latest device activity...');

    try {
      const res = await fetch(`/api/security/${encodeURIComponent(steamid)}/devices`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 && data.error === 'LOGIN_REQUIRED') {
          throw new Error('LOGIN_REQUIRED');
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const devices = Array.isArray(data.devices) ? data.devices : [];
      this.state.devices = devices;
      this.state.error = null;

      this._renderDevices();
      this._updateSummary();
    } finally {
      this.state.loading = false;
    }
  }

  _bindFilterControls() {
    const buttons = this.root.querySelectorAll('.security-filter-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter || 'all';
        this.state.filter = filter;

        buttons.forEach(b => b.classList.remove('security-filter-btn--active'));
        btn.classList.add('security-filter-btn--active');

        this._renderDevices();
      });
    });
  }

  _bindSignOutAll() {
    const btn = this.root.querySelector('#securitySignOutAllBtn');
    if (!btn) return;

    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (this.state.removingAll || !this.account) return;

      const confirmed = window.confirm(
        'Sign out of Steam on all devices?\n\nYou will need to log in again on all devices.'
      );
      if (!confirmed) return;

      try {
        this.state.removingAll = true;
        btn.disabled = true;
        btn.textContent = 'Signing out...';

        await this._removeAllDevices(this.account);

        this.ui && this.ui.showSuccess('Signed out from all devices');
        await this._loadDevices(this.account);
      } catch (err) {
        if (err.message === 'LOGIN_REQUIRED') {
          throw err;
        }
        this.ui && this.ui.showError('Failed to sign out everywhere: ' + err.message);
      } finally {
        this.state.removingAll = false;
        btn.disabled = false;
        btn.textContent = 'Sign out everywhere';
      }
    });
  }

  async _removeAllDevices(account) {
    const steamid = account.steamid;
    const res = await fetch(`/api/security/${encodeURIComponent(steamid)}/devices/all`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && data.error === 'LOGIN_REQUIRED') {
        throw new Error('LOGIN_REQUIRED');
      }
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  }

  async _removeSingleDevice(deviceId) {
    if (!this.account || !deviceId) return;

    const steamid = this.account.steamid;
    const res = await fetch(
      `/api/security/${encodeURIComponent(steamid)}/devices/${encodeURIComponent(deviceId)}`,
      {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && data.error === 'LOGIN_REQUIRED') {
        throw new Error('LOGIN_REQUIRED');
      }
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  }

    _renderDevices() {
    if (!this.root) return;
    const list = this.root.querySelector('#securityDevicesList');
    if (!list) return;

    const devices = this.state.devices || [];
    const filter = this.state.filter;

    if (!devices.length) {
      list.innerHTML = `
        <div class="security-empty-state">
          <div class="security-empty-title">No devices found</div>
          <div class="security-empty-subtitle">
            Once you sign in to Steam on a device, it will show up here.
          </div>
        </div>
      `;
      this._updateSubtitle('No active devices');
      this._updateStatusBar('You are not signed in on any devices.', 'info');
      return;
    }

    const now = Date.now();

    const enriched = devices.map(raw => {
  const lastSeenSeconds =
    raw.lastActiveTime ??
    raw.lastSeenTime ??
    (raw.last_seen && (raw.last_seen.time || raw.last_seen.timestamp)) ??
    null;

  const lastSeenDate = lastSeenSeconds ? new Date(lastSeenSeconds * 1000) : null;

  const deviceId = raw.id || raw.token_id || raw.deviceId;
  const description = raw.name || raw.token_description || 'Unnamed device';

  const loggedIn =
    raw.loggedIn ??
    raw.logged_in ??
    (raw.raw && (raw.raw.logged_in ?? raw.raw.loggedIn)) ??
    raw.isCurrentDevice ??
    false;

  const activeNow = this._isActiveNow(loggedIn, lastSeenDate, now);

  const location =
    raw.location ||
    this._formatLocation({
      city: raw.last_seen && raw.last_seen.city,
      state: raw.last_seen && raw.last_seen.state,
      country: raw.last_seen && raw.last_seen.country
    });

  return {
    raw,
    id: deviceId,
    description,
    lastSeenDate,
    location,
    activeNow
  };
});


    let filtered = enriched;
    if (filter === 'active') {
      filtered = enriched.filter(d => d.activeNow);
    } else if (filter === 'recent') {
      filtered = enriched.filter(d => !d.activeNow && d.lastSeenDate);
    }
    if (!filtered.length) {
      let title = 'No devices found';
      let subtitle = 'There are no devices matching this filter right now.';

      if (filter === 'active') {
        title = 'No active devices';
        subtitle = 'You are not currently active on any devices.';
      } else if (filter === 'recent') {
        title = 'No recently seen devices';
        subtitle = 'No recent activity has been recorded for your devices.';
      }

      list.innerHTML = `
        <div class="security-empty-state">
          <div class="security-empty-title">${this._escape(title)}</div>
          <div class="security-empty-subtitle">
            ${this._escape(subtitle)}
          </div>
        </div>
      `;

      this._updateSubtitle('No devices in this view');
      this._updateStatusBar(title, 'info');
      return;
    }

    filtered.sort((a, b) => {
      if (a.activeNow && !b.activeNow) return -1;
      if (!a.activeNow && b.activeNow) return 1;
      if (!a.lastSeenDate || !b.lastSeenDate) return 0;
      return b.lastSeenDate.getTime() - a.lastSeenDate.getTime();
    });

    list.innerHTML = '';

    filtered.forEach(device => {
      const card = document.createElement('div');
      card.className = 'security-device-card';

      const badgeText = device.activeNow ? 'Active now' : 'Recently seen';
      const badgeClass = device.activeNow
        ? 'security-device-badge--active'
        : 'security-device-badge--recent';

      const lastSeenText = device.lastSeenDate
        ? this._formatRelativeTime(device.lastSeenDate)
        : 'No activity data';

      const location = device.location;

      card.innerHTML = `
        <div class="security-device-main">
          <div class="security-device-icon">
            <div class="security-device-icon-inner">
              💻
            </div>
          </div>
          <div class="security-device-info">
            <div class="security-device-title-row">
              <div class="security-device-name">${this._escape(device.description)}</div>
              <div class="security-device-badge ${badgeClass}">
                ${badgeText}
              </div>
            </div>
            <div class="security-device-meta">
              <span>${lastSeenText}</span>
              ${location ? `<span>• ${this._escape(location)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="security-device-actions">
          <button 
            class="security-device-remove-btn" 
            data-device-id="${device.id || ''}"
          >
            Sign out
          </button>
        </div>
      `;

      const removeBtn = card.querySelector('.security-device-remove-btn');
      if (removeBtn && device.id) {
        removeBtn.addEventListener('click', async e => {
          e.stopPropagation();
          await this._handleRemoveSingle(device);
        });
      } else if (removeBtn) {
        removeBtn.disabled = true;
      }

      list.appendChild(card);
    });

    const total = devices.length;
    const activeCount = enriched.filter(d => d.activeNow).length;

    this._updateSubtitle(`${activeCount} active, ${total} total devices`);
    this._updateStatusBar(
      activeCount === 0 ? 'No active devices.' : `${activeCount} device(s) active now.`,
      'info'
    );
  }


  async _handleRemoveSingle(device) {
  const deviceId = device.id;
  if (!deviceId) return;

  const confirmed = window.confirm(
    `Sign out of Steam on "${device.description}"?\n\nYou may need to sign in again on that device.`
  );
  if (!confirmed) return;

  try {
    this.state.removingId = deviceId;
    await this._removeSingleDevice(deviceId);

    this.ui && this.ui.showSuccess('Device signed out successfully');

    await this._loadDevices(this.account);
  } catch (err) {
    if (err.message === 'LOGIN_REQUIRED') {
      throw err;
    }

    if (err.message === 'DEVICE_REVOKE_UNSUPPORTED') {
      this.ui && this.ui.showError(
        'Steam no longer supports signing out a single device via this method. Use "Sign out everywhere" instead.'
      );
      return;
    }

    this.ui && this.ui.showError('Failed to sign out device: ' + err.message);
  } finally {
    this.state.removingId = null;
  }
}



  _isActiveNow(loggedIn, lastSeenDate, nowMs) {
    if (loggedIn === true || loggedIn === 1) return true;
    if (!lastSeenDate) return false;

    const diffMs = nowMs - lastSeenDate.getTime();
    const minutes = diffMs / 60000;
    return minutes <= 5;
  }

  _formatRelativeTime(date) {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }

  _formatLocation(loc = {}) {
    const parts = [];
    if (loc.city) parts.push(loc.city);
    if (loc.state) parts.push(loc.state);
    if (loc.country) parts.push(loc.country);
    return parts.join(', ');
  }

    _updateSummary() {
  if (!this.root) return;
  const el = this.root.querySelector('#securitySummary');
  if (!el) return;

  const devices = this.state.devices || [];
  const now = Date.now();

  const activeCount = devices.filter(d => {
    const lastSeenSeconds =
      d.lastActiveTime ??
      d.lastSeenTime ??
      (d.last_seen && (d.last_seen.time || d.last_seen.timestamp)) ??
      null;
    const lastSeenDate = lastSeenSeconds ? new Date(lastSeenSeconds * 1000) : null;

    const loggedIn =
      d.loggedIn ??
      d.logged_in ??
      (d.raw && (d.raw.logged_in ?? d.raw.loggedIn)) ??
      d.isCurrentDevice ??
      false;

    return this._isActiveNow(loggedIn, lastSeenDate, now);
  }).length;

  el.textContent =
    devices.length === 0
      ? 'No devices'
      : `${activeCount} active • ${devices.length} total`;
}



  _updateStatusBar(text, type = 'info') {
    if (!this.root) return;
    const bar = this.root.querySelector('#securityStatusBar');
    if (!bar) return;

    bar.textContent = text || '';
    bar.className = 'security-status-bar';

    if (type === 'error') {
      bar.classList.add('security-status-bar--error');
    } else if (type === 'success') {
      bar.classList.add('security-status-bar--success');
    } else {
      bar.classList.add('security-status-bar--info');
    }
  }

  _updateSubtitle(text) {
    if (!this.root) return;
    const el = this.root.querySelector('#securityDevicesSubtitle');
    if (!el) return;
    el.textContent = text || '';
  }

  _setError(message) {
    this.state.error = message;
    this._updateStatusBar(message, 'error');
  }

  _escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
