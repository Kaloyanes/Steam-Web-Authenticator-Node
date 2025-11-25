
import { APIClient } from './api.js';

export class SetupPanel {
  constructor(ui) {
    this.ui = ui;
    this.setupId = null;
    this.currentStep = 1;
  }

  render(container) {
    container.innerHTML = `
      <div class="collapsible-panel expanded">
        <div class="panel-header">
          <div class="panel-header-title">
            <span>➕</span>
            <span>Setup New Account</span>
          </div>
          <div class="panel-toggle">▼</div>
        </div>
        <div class="panel-content">
          <div id="setupContent"></div>
        </div>
      </div>
    `;

    const header = container.querySelector('.panel-header');
    const panel = container.querySelector('.collapsible-panel');
    header.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      panel.classList.toggle('expanded');
    });

    this.showStep1();
  }

  showStep1() {
    this.currentStep = 1;
    const content = document.getElementById('setupContent');
    content.innerHTML = `
      <div class="setup-form">
        <h4 style="margin-top: 0; margin-bottom: 15px;">Step 1: Login to Steam</h4>
        
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="setupUsername" placeholder="Steam username" autocomplete="off">
        </div>

        <div class="form-group">
          <label>Password</label>
          <input type="password" id="setupPassword" placeholder="Steam password" autocomplete="off">
        </div>

        <div id="emailCodeGroup" style="display: none; margin-bottom: 15px;">
          <div class="status-message status-warning" style="margin-bottom: 10px;">
            📧 Steam Guard email verification code sent to your email. Enter it below:
          </div>
          <div class="form-group">
            <label>Email Code</label>
            <input type="text" id="setupEmailCode" placeholder="5-digit code from email" autocomplete="off">
          </div>
        </div>

        <button id="setupLoginBtn" style="width: 100%;">Login to Steam</button>
        <div id="setupLoginStatus" style="margin-top: 10px;"></div>
      </div>
    `;

    const loginBtn = document.getElementById('setupLoginBtn');
    const usernameInput = document.getElementById('setupUsername');
    const passwordInput = document.getElementById('setupPassword');
    const emailCodeInput = document.getElementById('setupEmailCode');
    const emailCodeGroup = document.getElementById('emailCodeGroup');
    const statusDiv = document.getElementById('setupLoginStatus');

    loginBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      const emailCode = emailCodeInput.value.trim();

      if (!username || !password) {
        statusDiv.innerHTML = '<div class="status-message status-error">Username and password required</div>';
        return;
      }

      loginBtn.disabled = true;
      statusDiv.innerHTML = '<div class="status-message status-info">⏳ Logging in...</div>';

      try {
        if (emailCode) {
          const result = await APIClient.submitEmailCode(this.setupId, emailCode);
          this.setupId = result.setupId;
          statusDiv.innerHTML = '<div class="status-message status-success">✓ Email code accepted!</div>';
          emailCodeInput.value = '';
          emailCodeGroup.style.display = 'none';
          setTimeout(() => this.showStep2(), 1500);
        } else {
          const result = await APIClient.setupLogin(username, password);
          
          if (result.status === 'need_email_code') {
            this.setupId = result.setupId;
            statusDiv.innerHTML = '<div class="status-message status-info">Check your email for the Steam Guard code</div>';
            emailCodeGroup.style.display = 'block';
          } else if (result.status === 'success') {
            this.setupId = result.setupId;
            statusDiv.innerHTML = '<div class="status-message status-success">✓ Login successful!</div>';
            setTimeout(() => this.showStep2(), 1500);
          }
        }
      } catch (error) {
        statusDiv.innerHTML = `<div class="status-message status-error">❌ ${error.message}</div>`;
      } finally {
        loginBtn.disabled = false;
      }
    });

    [usernameInput, passwordInput, emailCodeInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
      });
    });
  }

  showStep2() {
    this.currentStep = 2;
    const content = document.getElementById('setupContent');
    content.innerHTML = `
      <div class="setup-form">
        <h4 style="margin-top: 0; margin-bottom: 15px;">Step 2: Add Phone Number</h4>
        
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">
          Enter a phone number with country code (e.g. +15551234567)
        </p>

        <div class="form-group">
          <label>Phone Number</label>
          <input type="tel" id="setupPhone" placeholder="+1 (555) 123-4567" autocomplete="off">
        </div>

        <button id="setupPhoneBtn" style="width: 100%;">Add Phone Number</button>
        <div id="setupPhoneStatus" style="margin-top: 10px;"></div>

        <div id="emailConfirmGroup" style="display: none; margin-top: 15px;">
          <div class="status-message status-info" style="margin-bottom: 10px;">
            📧 A confirmation email was sent. Click the link in your email to verify the phone number.
          </div>
          <button id="phoneEmailDoneBtn" style="width: 100%;">I've Confirmed Email, Send SMS</button>
          <div id="phoneEmailStatus" style="margin-top: 10px;"></div>
        </div>
      </div>
    `;

    const phoneBtn = document.getElementById('setupPhoneBtn');
    const phoneInput = document.getElementById('setupPhone');
    const statusDiv = document.getElementById('setupPhoneStatus');
    const emailConfirmGroup = document.getElementById('emailConfirmGroup');
    const emailDoneBtn = document.getElementById('phoneEmailDoneBtn');
    const emailStatusDiv = document.getElementById('phoneEmailStatus');

    phoneBtn.addEventListener('click', async () => {
      const phone = phoneInput.value.trim();

      if (!phone) {
        statusDiv.innerHTML = '<div class="status-message status-error">Phone number required</div>';
        return;
      }

      phoneBtn.disabled = true;
      statusDiv.innerHTML = '<div class="status-message status-info">⏳ Adding phone number...</div>';

      try {
        const result = await APIClient.addPhone(this.setupId, phone);
        statusDiv.innerHTML = '<div class="status-message status-success">✓ Phone number added</div>';
        phoneInput.disabled = true;
        phoneBtn.disabled = true;
        emailConfirmGroup.style.display = 'block';
      } catch (error) {
        if (error.message.includes('already has a phone')) {
          statusDiv.innerHTML = '<div class="status-message status-success">✓ Phone already verified on this account</div>';
          phoneInput.disabled = true;
          phoneBtn.disabled = true;
          emailConfirmGroup.style.display = 'block';
        } else {
          statusDiv.innerHTML = `<div class="status-message status-error">❌ ${error.message}</div>`;
          phoneBtn.disabled = false;
        }
      }
    });

    emailDoneBtn.addEventListener('click', async () => {
      emailDoneBtn.disabled = true;
      emailStatusDiv.innerHTML = '<div class="status-message status-info">⏳ Requesting SMS...</div>';

      try {
        const result = await APIClient.sendPhoneSMS(this.setupId);
        emailStatusDiv.innerHTML = '<div class="status-message status-success">✓ SMS sent to your phone</div>';
        setTimeout(() => this.showStep3(), 1500);
      } catch (error) {
        emailStatusDiv.innerHTML = `<div class="status-message status-error">❌ ${error.message}</div>`;
        emailDoneBtn.disabled = false;
      }
    });

    phoneInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') phoneBtn.click();
    });
  }

  showStep3() {
    this.currentStep = 3;
    const content = document.getElementById('setupContent');
    content.innerHTML = `
      <div class="setup-form">
        <h4 style="margin-top: 0; margin-bottom: 15px;">Step 3: Verify Phone SMS</h4>
        
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">
          Enter the verification code sent to your phone
        </p>

        <div class="form-group">
          <label>SMS Code</label>
          <input type="text" id="setupPhoneSMS" placeholder="6-digit code" autocomplete="off">
        </div>

        <button id="verifyPhoneBtn" style="width: 100%;">Verify Phone SMS</button>
        <div id="verifyPhoneStatus" style="margin-top: 10px;"></div>
      </div>
    `;

    const verifyBtn = document.getElementById('verifyPhoneBtn');
    const smsInput = document.getElementById('setupPhoneSMS');
    const statusDiv = document.getElementById('verifyPhoneStatus');

    verifyBtn.addEventListener('click', async () => {
      const sms = smsInput.value.trim();

      if (!sms) {
        statusDiv.innerHTML = '<div class="status-message status-error">SMS code required</div>';
        return;
      }

      verifyBtn.disabled = true;
      statusDiv.innerHTML = '<div class="status-message status-info">⏳ Verifying...</div>';

      try {
        const result = await APIClient.verifyPhone(this.setupId, sms);
        statusDiv.innerHTML = '<div class="status-message status-success">✓ Phone verified!</div>';
        smsInput.disabled = true;
        verifyBtn.disabled = true;
        setTimeout(() => this.showStep4(), 1500);
      } catch (error) {
        statusDiv.innerHTML = `<div class="status-message status-error">❌ ${error.message}</div>`;
        verifyBtn.disabled = false;
      }
    });

    smsInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyBtn.click();
    });
  }

  showStep4() {
    this.currentStep = 4;
    const content = document.getElementById('setupContent');
    content.innerHTML = `
      <div class="setup-form">
        <h4 style="margin-top: 0; margin-bottom: 15px;">Step 4: Enable Authenticator</h4>
        
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">
          Enabling 2FA authenticator. An SMS code will be sent to activate it.
        </p>

        <button id="enableAuthBtn" style="width: 100%;">Enable Authenticator</button>
        <div id="enableAuthStatus" style="margin-top: 10px;"></div>
      </div>
    `;

    const enableBtn = document.getElementById('enableAuthBtn');
    const statusDiv = document.getElementById('enableAuthStatus');

    enableBtn.addEventListener('click', async () => {
      enableBtn.disabled = true;
      statusDiv.innerHTML = '<div class="status-message status-info">⏳ Enabling authenticator...</div>';

      try {
        const result = await APIClient.enable2FA(this.setupId);
        statusDiv.innerHTML = '<div class="status-message status-success">✓ Authenticator enabled</div>';
        enableBtn.disabled = true;
        setTimeout(() => this.showStep5(), 1500);
      } catch (error) {
        statusDiv.innerHTML = `<div class="status-message status-error">❌ ${error.message}</div>`;
        enableBtn.disabled = false;
      }
    });
  }

  showStep5() {
    this.currentStep = 5;
    const content = document.getElementById('setupContent');
    content.innerHTML = `
      <div class="setup-form">
        <h4 style="margin-top: 0; margin-bottom: 15px;">Step 5: Confirm Activation Code</h4>
        
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">
          A 2FA activation code was sent to your phone. Enter it to finalize setup.
        </p>

        <div class="form-group">
          <label>Activation Code</label>
          <input type="text" id="setupAuthCode" placeholder="6-digit code" autocomplete="off">
        </div>

        <button id="finalizeBtn" style="width: 100%;">Finalize Setup</button>
        <div id="finalizeStatus" style="margin-top: 10px;"></div>
      </div>
    `;

    const finalizeBtn = document.getElementById('finalizeBtn');
    const codeInput = document.getElementById('setupAuthCode');
    const statusDiv = document.getElementById('finalizeStatus');

    finalizeBtn.addEventListener('click', async () => {
      const code = codeInput.value.trim();

      if (!code) {
        statusDiv.innerHTML = '<div class="status-message status-error">Activation code required</div>';
        return;
      }

      finalizeBtn.disabled = true;
      statusDiv.innerHTML = '<div class="status-message status-info">⏳ Finalizing setup...</div>';

      try {
        const result = await APIClient.finalize2FA(this.setupId, code);
        statusDiv.innerHTML = '<div class="status-message status-success">✓ Setup complete!</div>';
        codeInput.disabled = true;
        finalizeBtn.disabled = true;
        this.showStep6(result.revocation_code);
      } catch (error) {
        statusDiv.innerHTML = `<div class="status-message status-error">❌ ${error.message}</div>`;
        finalizeBtn.disabled = false;
      }
    });

    codeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') finalizeBtn.click();
    });
  }

  showStep6(revocationCode) {
    this.currentStep = 6;
    const content = document.getElementById('setupContent');
    content.innerHTML = `
      <div class="setup-form">
        <h4 style="margin-top: 0; margin-bottom: 15px; color: var(--color-success);">✓ Setup Complete!</h4>
        
        <div class="status-message status-success" style="margin-bottom: 15px;">
          Your authenticator has been successfully set up!
        </div>

        <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 6px; border-left: 3px solid var(--color-warning); margin-bottom: 15px;">
          <h5 style="margin: 0 0 10px 0; color: var(--color-warning);">⚠️ SAVE YOUR REVOCATION CODE</h5>
          <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: var(--text-secondary);">
            This code is needed if you lose access to your phone. Keep it safe!
          </p>
          <div style="background: var(--bg-secondary); padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; font-size: 0.85rem; margin-bottom: 10px; user-select: all;">
            ${revocationCode}
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="copyRevBtn" class="secondary" style="flex: 1;">📋 Copy Code</button>
            <button id="downloadRevBtn" class="secondary" style="flex: 1;">💾 Download Code</button>
          </div>
        </div>

        <p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
          Your account has been added and will appear in the accounts list. Refresh the page to see it.
        </p>

        <button id="resetBtn" style="width: 100%;">Start New Setup</button>
      </div>
    `;

    const copyBtn = document.getElementById('copyRevBtn');
    const downloadBtn = document.getElementById('downloadRevBtn');
    const resetBtn = document.getElementById('resetBtn');

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(revocationCode).then(() => {
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Code';
        }, 2000);
      });
    });

    downloadBtn.addEventListener('click', () => {
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(
        `Steam Account Revocation Code\n\n${revocationCode}\n\nKeep this safe! You need it if you lose your phone.`
      ));
      element.setAttribute('download', 'steam-revocation-code.txt');
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });

    resetBtn.addEventListener('click', () => {
      this.setupId = null;
      this.showStep1();
      window.location.reload();
    });
  }
}