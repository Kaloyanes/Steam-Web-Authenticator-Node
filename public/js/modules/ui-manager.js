
export class UIManager {
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `status-message status-${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    if (duration) {
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  }

  showSuccess(message, duration = 3000) {
    return this.showToast(message, 'success', duration);
  }

  showError(message, duration = 5000) {
    return this.showToast(message, 'error', duration);
  }

  showInfo(message, duration = 3000) {
    return this.showToast(message, 'info', duration);
  }

  showWarning(message, duration = 4000) {
    return this.showToast(message, 'warning', duration);
  }
}