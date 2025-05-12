const CACHE_NAME = 'sistema-facil-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/firebase.js',
  '/js/clients.js',
  '/js/loans.js',
  '/js/payments.js',
  '/js/dashboard.js',
  '/js/reports.js',
  '/js/ui.js',
  '/assets/logo.svg',
  '/assets/user-placeholder.png',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // só cacheia requisições HTTP/HTTPS
          if (fetchRequest.url.startsWith('http')) {
            // Clone the response
            const responseToCache = response.clone();
            
            // Add to cache
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(fetchRequest, responseToCache);
              });
          }
          
          return response;
        });
      })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', event => {
  if (event.tag === 'sync-payments') {
    event.waitUntil(syncPayments());
  } else if (event.tag === 'sync-loans') {
    event.waitUntil(syncLoans());
  } else if (event.tag === 'sync-clients') {
    event.waitUntil(syncClients());
  }
});

// Handle push notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: 'assets/logo.svg',
    badge: 'assets/logo.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'Ver Detalhes'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    // Open specific page based on notification data
    event.waitUntil(
      clients.openWindow('/')
    );
  } else {
    // Open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Sync functions
async function syncPayments() {
  // Implementation depends on the app's offline/online structure
  console.log('Syncing payments...');
}

async function syncLoans() {
  // Implementation depends on the app's offline/online structure
  console.log('Syncing loans...');
}

async function syncClients() {
  // Implementation depends on the app's offline/online structure
  console.log('Syncing clients...');
}