/**
 * Enhanced Analytics for Home Gym Guides
 * 
 * This script provides comprehensive event tracking for better conversion
 * optimization and user behavior analysis.
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  // Initialize if gtag is available
  if (window.gtag) {
    initEnhancedAnalytics();
  }
});

function initEnhancedAnalytics() {
  // Set up core tracking parameters
  setupCoreTracking();
  
  // Track specific elements
  setupLinkTracking();
  setupProductTracking();
  setupFormTracking();
  setupEngagementTracking();
  setupScrollTracking();
}

function setupCoreTracking() {
  // Track user time zones for better understanding of user base
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  gtag('set', 'user_properties', {
    time_zone: timezone
  });
  
  // Track device category more precisely
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
  const deviceCategory = isMobile ? 'mobile' : (isTablet ? 'tablet' : 'desktop');
  
  gtag('set', 'user_properties', {
    device_category: deviceCategory
  });
  
  // Track page load time
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (window.performance) {
        const pageLoadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        gtag('event', 'timing_complete', {
          'name': 'page_load',
          'value': pageLoadTime,
          'event_category': 'Page Timing'
        });
      }
    }, 0);
  });
}

function setupLinkTracking() {
  // Track affiliate link clicks
  document.querySelectorAll('a[href*="amzn.to"], a[href*="amazon.com"]').forEach(function(link) {
    link.addEventListener('click', function() {
      const productName = this.closest('.product-card') ? 
                        this.closest('.product-card').querySelector('.product-title').textContent : 
                        'Unknown Product';
      
      gtag('event', 'affiliate_click', {
        'event_category': 'Affiliate Links',
        'event_label': productName,
        'product_name': productName,
        'link_url': this.href
      });
    });
  });
  
  // Track external link clicks
  document.querySelectorAll('a').forEach(function(link) {
    if (link.hostname && link.hostname !== window.location.hostname && 
        !link.href.includes('amazon.com') && !link.href.includes('amzn.to')) {
      link.addEventListener('click', function() {
        gtag('event', 'external_link_click', {
          'event_category': 'External Links',
          'event_label': this.href,
          'link_text': this.textContent.trim()
        });
      });
    }
  });
  
  // Track internal navigation
  document.querySelectorAll('a').forEach(function(link) {
    if (link.hostname === window.location.hostname) {
      link.addEventListener('click', function() {
        gtag('event', 'internal_navigation', {
          'event_category': 'Site Navigation',
          'event_label': this.href.replace(window.location.origin, ''),
          'link_text': this.textContent.trim()
        });
      });
    }
  });
}

function setupProductTracking() {
  // Track product card views and interactions
  const productCards = document.querySelectorAll('.product-card');
  
  if (productCards.length > 0) {
    // Create an intersection observer to track when product cards become visible
    const productObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const productTitle = card.querySelector('.product-title').textContent;
          const position = Array.from(productCards).indexOf(card) + 1;
          
          gtag('event', 'view_item', {
            'event_category': 'Product Impressions',
            'event_label': productTitle,
            'items': [{
              'id': card.getAttribute('data-product-id') || 'unknown',
              'name': productTitle,
              'position': position,
              'price': card.getAttribute('data-product-price') || '0.00'
            }]
          });
          
          // Stop observing once impressed
          productObserver.unobserve(card);
        }
      });
    }, { threshold: 0.5 });
    
    // Start observing each product card
    productCards.forEach(card => {
      productObserver.observe(card);
    });
  }
  
  // Track product clicks
  document.querySelectorAll('.product-card').forEach(function(card) {
    card.addEventListener('click', function() {
      const productTitle = this.querySelector('.product-title').textContent;
      const position = Array.from(productCards).indexOf(this) + 1;
      
      gtag('event', 'select_content', {
        'event_category': 'Product Clicks',
        'event_label': productTitle,
        'content_type': 'product',
        'items': [{
          'id': this.getAttribute('data-product-id') || 'unknown',
          'name': productTitle,
          'position': position,
          'price': this.getAttribute('data-product-price') || '0.00'
        }]
      });
    });
  });
}

function setupFormTracking() {
  // Track form submissions and interactions
  document.querySelectorAll('form').forEach(function(form) {
    // Track form submission attempts
    form.addEventListener('submit', function(e) {
      const formId = this.id || this.getAttribute('name') || 'unknown_form';
      const formAction = this.getAttribute('action') || 'unknown_action';
      
      gtag('event', 'form_submit', {
        'event_category': 'Form Interactions',
        'event_label': formId,
        'form_id': formId,
        'form_action': formAction
      });
    });
    
    // Track form field interactions
    form.querySelectorAll('input, select, textarea').forEach(function(field) {
      field.addEventListener('change', function() {
        const formId = this.closest('form').id || this.closest('form').getAttribute('name') || 'unknown_form';
        const fieldName = this.name || this.id || 'unknown_field';
        const fieldType = this.type || 'unknown_type';
        
        // Don't track actual values for privacy reasons
        gtag('event', 'form_field_change', {
          'event_category': 'Form Interactions',
          'event_label': `${formId} - ${fieldName}`,
          'form_id': formId,
          'field_name': fieldName,
          'field_type': fieldType
        });
      });
    });
  });
  
  // Track newsletter signups specifically
  document.querySelectorAll('form[action*="list-manage.com"]').forEach(function(form) {
    form.addEventListener('submit', function() {
      gtag('event', 'newsletter_signup', {
        'event_category': 'Engagement',
        'event_label': this.closest('section')?.className || 'unknown_section'
      });
    });
  });
}

function setupEngagementTracking() {
  // Track how long users stay on the page
  let timeOnPage = 0;
  const timeTrackingInterval = setInterval(function() {
    timeOnPage += 15;
    
    if (timeOnPage === 30) {
      gtag('event', 'time_on_page_30s', {
        'event_category': 'Engagement',
        'event_label': window.location.pathname
      });
    } else if (timeOnPage === 60) {
      gtag('event', 'time_on_page_1m', {
        'event_category': 'Engagement',
        'event_label': window.location.pathname
      });
    } else if (timeOnPage === 180) {
      gtag('event', 'time_on_page_3m', {
        'event_category': 'Engagement',
        'event_label': window.location.pathname
      });
    }
  }, 15000);
  
  // Clear interval when page is unloaded
  window.addEventListener('beforeunload', function() {
    clearInterval(timeTrackingInterval);
  });
  
  // Track copy actions on the page
  document.addEventListener('copy', function() {
    gtag('event', 'content_copy', {
      'event_category': 'Engagement',
      'event_label': window.location.pathname
    });
  });
  
  // Track if users print the page
  window.addEventListener('beforeprint', function() {
    gtag('event', 'print_page', {
      'event_category': 'Engagement',
      'event_label': window.location.pathname
    });
  });
}

function setupScrollTracking() {
  // Track scroll depth
  let scrollMarkers = [25, 50, 75, 90];
  let markers = scrollMarkers.map(function(marker) {
    return {
      percent: marker,
      tracked: false
    };
  });
  
  // Calculate page height
  function getPageHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
  }
  
  // Track scroll position
  window.addEventListener('scroll', function() {
    const scrollPos = window.scrollY;
    const viewportHeight = window.innerHeight;
    const pageHeight = getPageHeight();
    const scrollPercent = (scrollPos / (pageHeight - viewportHeight)) * 100;
    
    markers.forEach(function(marker) {
      if (!marker.tracked && scrollPercent >= marker.percent) {
        marker.tracked = true;
        gtag('event', 'scroll_depth', {
          'event_category': 'Engagement',
          'event_label': `${marker.percent}%`,
          'scroll_percent': marker.percent
        });
      }
    });
  });
}
