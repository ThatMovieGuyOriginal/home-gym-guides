/**
 * Service Worker for Home Gym Guides
 * Provides offline capabilities and faster loading
 */

// Cache version - update when deploying new versions
const CACHE_VERSION = 'v1';
const CACHE_NAME = `homegymguides-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/assets/css/theme.css',
  '/assets/css/custom.css',
  '/assets/css/cookie-consent.css',
  '/assets/js/jquery.min.js',
  '/assets/js/bootstrap.min.js',
  '/assets/js/theme.js',
  '/assets/js/enhanced-analytics.js',
  '/assets/js/cookie-consent.js',
  '/assets/images/logo.png',
  '/assets/images/intro.svg',
  '/offline.html',  // Fallback page for when offline
  '/manifest.json'
];

// Pages to cache for offline access
const DYNAMIC_CACHE_PAGES = [
  '/about/',
  '/contact/',
  '/categories/',
  '/blog/'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll([...STATIC_CACHE_URLS, ...DYNAMIC_CACHE_PAGES]);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('homegymguides-') && cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fall back to cache, then offline page
self.addEventListener('fetch', event => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension') ||
      event.request.url.includes('extension') ||
      !(event.request.url.startsWith('http'))) {
    return;
  }
  
  // For Google Analytics, bypass cache
  if (event.request.url.includes('google-analytics.com') || 
      event.request.url.includes('googletagmanager.com')) {
    return;
  }
  
  // For HTML requests, try network first, then cache, then offline page
  if (event.request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the latest version
          const clone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Try to get from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fall back to offline page
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }
  
  // For images, CSS, JS, etc., use cache first, network as fallback
  if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg|css|js)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Return cached response if available
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Otherwise, fetch from network
          return fetch(event.request)
            .then(response => {
              // Cache the new response
              const clone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, clone));
              return response;
            })
            .catch(error => {
              // Special handling for images - return a placeholder
              if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
                return caches.match('/assets/images/placeholder.png');
              }
              throw error;
            });
        })
    );
    return;
  }
  
  // For all other requests, try network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the latest version
        const clone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Fall back to cache
        return caches.match(event.request);
      })
  );
});

// Background sync for form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'form-submission') {
    event.waitUntil(syncFormData());
  }
});

// Function to sync stored form data when online
async function syncFormData() {
  const db = await openDatabase();
  const tx = db.transaction('formData', 'readwrite');
  const store = tx.objectStore('formData');
  const formDataList = await store.getAll();
  
  // Process each stored form submission
  for (const formData of formDataList) {
    try {
      const response = await fetch(formData.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData.data)
      });
      
      if (response.ok) {
        // If successful, remove from storage
        await store.delete(formData.id);
      }
    } catch (error) {
      console.error('Sync failed for form data:', error);
    }
  }
}

// Helper function to open IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HomegymGuides', 1);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('formData')) {
        db.createObjectStore('formData', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}
