/**
 * Cookie Consent Management for Home Gym Guides
 * GDPR and CCPA Compliant Implementation
 */

document.addEventListener('DOMContentLoaded', function() {
  initCookieConsent();
});

function initCookieConsent() {
  // Cookie Consent Banner Elements
  const banner = document.getElementById('cookie-consent-banner');
  const acceptAllBtn = document.getElementById('cookie-accept-all');
  const necessaryOnlyBtn = document.getElementById('cookie-accept-necessary');
  const settingsBtn = document.getElementById('cookie-settings');
  
  // Cookie Settings Modal Elements
  const modal = document.getElementById('cookie-settings-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const saveSettingsBtn = document.getElementById('save-cookie-settings');
  const analyticsCheckbox = document.getElementById('analytics-cookies');
  const preferencesCheckbox = document.getElementById('preference-cookies');
  const marketingCheckbox = document.getElementById('marketing-cookies');
  
  // Check if consent already exists
  const consentStatus = getCookie('cookie_consent_status');
  
  // Show banner if no consent exists
  if (!consentStatus) {
    banner.style.display = 'block';
  }
  
  // Add banner event listeners
  if (acceptAllBtn) {
    acceptAllBtn.addEventListener('click', function() {
      acceptAllCookies();
      hideBanner();
    });
  }
  
  if (necessaryOnlyBtn) {
    necessaryOnlyBtn.addEventListener('click', function() {
      acceptNecessaryCookies();
      hideBanner();
    });
  }
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      showSettingsModal();
    });
  }
  
  // Add modal event listeners
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', function() {
      hideSettingsModal();
    });
  }
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function() {
      saveCustomPreferences();
      hideSettingsModal();
      hideBanner();
    });
  }
  
  // Apply saved preferences to checkboxes if they exist
  const savedPrefs = getConsentPreferences();
  if (savedPrefs) {
    if (analyticsCheckbox) analyticsCheckbox.checked = savedPrefs.analytics;
    if (preferencesCheckbox) preferencesCheckbox.checked = savedPrefs.preferences;
    if (marketingCheckbox) marketingCheckbox.checked = savedPrefs.marketing;
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      hideSettingsModal();
    }
  });
}

function hideBanner() {
  const banner = document.getElementById('cookie-consent-banner');
  banner.style.display = 'none';
}

function showSettingsModal() {
  const modal = document.getElementById('cookie-settings-modal');
  modal.style.display = 'block';
}

function hideSettingsModal() {
  const modal = document.getElementById('cookie-settings-modal');
  modal.style.display = 'none';
}

function acceptAllCookies() {
  const preferences = {
    necessary: true,
    analytics: true,
    preferences: true,
    marketing: true
  };
  
  saveConsentPreferences(preferences);
  enableCookies(preferences);
  
  // Track event
  if (window.gtag) {
    gtag('event', 'cookie_consent', {
      'event_category': 'Cookie Consent',
      'event_label': 'Accept All',
      'consent_type': 'full'
    });
  }
}

function acceptNecessaryCookies() {
  const preferences = {
    necessary: true,
    analytics: false,
    preferences: false,
    marketing: false
  };
  
  saveConsentPreferences(preferences);
  enableCookies(preferences);
  
  // Track event
  if (window.gtag) {
    gtag('event', 'cookie_consent', {
      'event_category': 'Cookie Consent',
      'event_label': 'Necessary Only',
      'consent_type': 'minimal'
    });
  }
}

function saveCustomPreferences() {
  const analyticsCheckbox = document.getElementById('analytics-cookies');
  const preferencesCheckbox = document.getElementById('preference-cookies');
  const marketingCheckbox = document.getElementById('marketing-cookies');
  
  const preferences = {
    necessary: true,
    analytics: analyticsCheckbox ? analyticsCheckbox.checked : false,
    preferences: preferencesCheckbox ? preferencesCheckbox.checked : false,
    marketing: marketingCheckbox ? marketingCheckbox.checked : false
  };
  
  saveConsentPreferences(preferences);
  enableCookies(preferences);
  
  // Track event
  if (window.gtag) {
    gtag('event', 'cookie_consent', {
      'event_category': 'Cookie Consent',
      'event_label': 'Custom Preferences',
      'consent_type': 'custom',
      'analytics_enabled': preferences.analytics,
      'preferences_enabled': preferences.preferences,
      'marketing_enabled': preferences.marketing
    });
  }
}

function saveConsentPreferences(preferences) {
  // Save preferences as cookie
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 months expiry
  
  // Set main consent cookie
  document.cookie = 'cookie_consent_status=accepted; expires=' + expiryDate.toUTCString() + '; path=/; SameSite=Lax';
  
  // Set detailed preferences
  document.cookie = 'cookie_consent_preferences=' + JSON.stringify(preferences) + '; expires=' + expiryDate.toUTCString() + '; path=/; SameSite=Lax';
}

function enableCookies(preferences) {
  // Configure Google Analytics based on preferences
  if (window.gtag && window.dataLayer) {
    if (!preferences.analytics) {
      // Disable Google Analytics tracking
      window['ga-disable-' + findGoogleAnalyticsId()] = true;
      
      // Delete existing analytics cookies
      deleteCookie('_ga');
      deleteCookie('_gid');
      deleteCookie('_gat');
    } else {
      // Enable Google Analytics tracking
      window['ga-disable-' + findGoogleAnalyticsId()] = false;
    }
    
    // Update consent parameters in Google Analytics
    gtag('consent', 'update', {
      'analytics_storage': preferences.analytics ? 'granted' : 'denied',
      'ad_storage': preferences.marketing ? 'granted' : 'denied',
      'functionality_storage': preferences.preferences ? 'granted' : 'denied',
      'security_storage': 'granted', // Always allow security cookies
      'personalization_storage': preferences.preferences ? 'granted' : 'denied'
    });
  }
}

function findGoogleAnalyticsId() {
  // Try to find GA ID from script tag
  const gaScripts = document.querySelectorAll('script[src*="googletagmanager"]');
  if (gaScripts.length > 0) {
    const src = gaScripts[0].getAttribute('src');
    const matches = src.match(/id=([^&]*)/);
    if (matches && matches.length > 1) {
      return matches[1];
    }
  }
  
  // Return placeholder if not found
  return 'UA-XXXXXXXX-X';
}

function getConsentPreferences() {
  const prefsString = getCookie('cookie_consent_preferences');
  if (prefsString) {
    try {
      return JSON.parse(prefsString);
    } catch (e) {
      console.error('Error parsing cookie preferences:', e);
      return null;
    }
  }
  return null;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function deleteCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
}

// Add method to allow users to revoke consent later
window.revokeCookieConsent = function() {
  // Delete consent cookies
  deleteCookie('cookie_consent_status');
  deleteCookie('cookie_consent_preferences');
  
  // Reset tracking
  if (window.gtag) {
    gtag('consent', 'update', {
      'analytics_storage': 'denied',
      'ad_storage': 'denied',
      'functionality_storage': 'denied',
      'personalization_storage': 'denied'
    });
  }
  
  // Show banner again
  const banner = document.getElementById('cookie-consent-banner');
  if (banner) {
    banner.style.display = 'block';
  }
  
  // Track revocation
  if (window.gtag) {
    gtag('event', 'cookie_consent_revoked', {
      'event_category': 'Cookie Consent',
      'event_label': 'Consent Revoked'
    });
  }
};
