const CACHE_NAME = 'office-attendance-v3';
const ASSETS = ['.', 'index.html', 'manifest.json', 'icon.svg'];

// ── Install & cache ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (cache-first) ──────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('index.html'));
    })
  );
});

// ── Message from app: schedule or cancel daily notification ──────────
self.addEventListener('message', event => {
  const { type, inTime, userId } = event.data || {};

  if (type === 'SCHEDULE_ATTENDANCE_REMINDER') {
    scheduleNext(inTime, userId);
  }
  if (type === 'CANCEL_ATTENDANCE_REMINDER') {
    clearSchedule();
  }
});

// ── Scheduling logic ─────────────────────────────────────────────────
let _scheduleTimer = null;

function clearSchedule() {
  if (_scheduleTimer) { clearTimeout(_scheduleTimer); _scheduleTimer = null; }
}

function scheduleNext(inTime, userId) {
  clearSchedule();
  if (!inTime) return;

  const [hh, mm] = inTime.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return;

  const now  = new Date();
  const fire = new Date();
  fire.setHours(hh, mm, 0, 0);

  // If already past today's time, schedule for tomorrow
  if (fire <= now) fire.setDate(fire.getDate() + 1);

  const msUntil = fire - now;

  _scheduleTimer = setTimeout(async () => {
    await showAttendanceNotification(userId, inTime);
    // Reschedule for next day
    scheduleNext(inTime, userId);
  }, msUntil);
}

async function showAttendanceNotification(userId, inTime) {
  // Skip weekends
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) {
    scheduleNext(inTime, userId); // just reschedule
    return;
  }

  // Skip if already marked today (check via postMessage to client)
  const clients = await self.clients.matchAll({ type: 'window' });
  let alreadyMarked = false;
  // We optimistically show — app will dismiss banner if already marked
  // (checking from SW is complex; let the app handle it)

  await self.registration.showNotification('📋 Mark Your Attendance', {
    body: `Good morning! It's ${inTime}. Don't forget to mark your attendance for today.`,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: 'attendance-reminder',    // replaces any previous unread one
    renotify: true,
    requireInteraction: true,       // stays until user acts
    vibrate: [200, 100, 200],
    data: { userId, inTime, url: self.registration.scope },
    actions: [
      { action: 'open',    title: '📋 Open App' },
      { action: 'dismiss', title: '✖ Dismiss' }
    ]
  });
}

// ── Notification click ───────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  notification.close();

  const targetUrl = (notification.data && notification.data.url) || self.registration.scope;

  if (event.action === 'dismiss') return;

  // Focus existing window or open new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          client.focus();
          // Tell the app to run geofence check immediately
          client.postMessage({ type: 'RUN_GEOFENCE_CHECK' });
          return;
        }
      }
      // No open window — open a new one
      return self.clients.openWindow(targetUrl).then(client => {
        if (client) {
          // Small delay for app to load, then trigger geofence
          setTimeout(() => client.postMessage({ type: 'RUN_GEOFENCE_CHECK' }), 3000);
        }
      });
    })
  );
});

// ── Notification close (user swiped away) ───────────────────────────
self.addEventListener('notificationclose', () => {
  // Nothing extra needed — reschedule already handled by scheduleNext loop
});
