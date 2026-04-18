/**
 * PrivaComply Content Script
 * Shows cookie blocking status widget on pages
 */

console.log('PrivaComply: Content script loaded');

interface UserPreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  autoFillEnabled: boolean;
  showWidget: boolean;
}

class PrivaComplyWidget {
  private preferences: UserPreferences | null = null;

  constructor() {
    this.init();
  }

  async init() {
    try {
      await this.loadPreferences();
      this.setupMessageListeners();
      
      // Only show widget in main frame if enabled
      if (window === window.top && this.preferences?.showWidget) {
        this.showActiveStatus();
      }
      
      console.log('PrivaComply: Widget ready');
    } catch (error) {
      console.error('PrivaComply: Init error:', error);
    }
  }

  async loadPreferences(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get('privacomply-preferences');
      const stored = result['privacomply-preferences'];
      this.preferences = stored && typeof stored === 'object' 
        ? stored as UserPreferences 
        : this.getDefaultPreferences();
    } catch (error) {
      console.error('Failed to load preferences:', error);
      this.preferences = this.getDefaultPreferences();
    }
  }

  getDefaultPreferences(): UserPreferences {
    return {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      autoFillEnabled: true,
      showWidget: true
    };
  }

  showActiveStatus() {
    // Don't inject on iframes
    if (window !== window.top) return;

    // Remove existing widget
    const existing = document.getElementById('privacomply-widget');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'privacomply-widget';
    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
      }
      .widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 10px 16px;
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0;
        transform: translateY(10px);
        animation: slideIn 0.3s ease forwards;
      }
      @keyframes slideIn {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .widget:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }
      .icon {
        font-size: 14px;
      }
      .widget.fade-out {
        opacity: 0;
        transform: translateY(10px);
      }
    `;

    const widget = document.createElement('div');
    widget.className = 'widget';
    widget.innerHTML = `<span class="icon">🛡️</span><span>Cookie Protection Active</span>`;

    widget.onclick = () => {
      const prefs = this.preferences;
      const blocked = [];
      if (!prefs?.functional) blocked.push('Functional');
      if (!prefs?.analytics) blocked.push('Analytics');
      if (!prefs?.marketing) blocked.push('Marketing');
      
      alert(
        'PrivaComply Cookie Protection\n\n' +
        '✓ Necessary cookies: Allowed\n' +
        (blocked.length > 0 
          ? `✗ Blocked categories: ${blocked.join(', ')}\n\n`
          : '✓ All categories allowed\n\n') +
        'CookieBlock ML is actively classifying and blocking unwanted cookies.\n\n' +
        'Configure in extension popup.'
      );
    };

    shadow.appendChild(style);
    shadow.appendChild(widget);
    
    // Wait for body to be available
    if (document.body) {
      document.body.appendChild(container);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(container);
      });
    }

    // Auto-hide after 3 seconds
    setTimeout(() => {
      widget.classList.add('fade-out');
      setTimeout(() => container.remove(), 300);
    }, 3000);
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'PREFERENCES_CHANGED') {
        this.preferences = message.data.preferences;
        console.log('PrivaComply: Preferences updated');
      }
      sendResponse({ success: true });
    });
  }
}

// Initialize
new PrivaComplyWidget();
