const CACHE_NAME = 'office-attendance-v4';
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

// ── Message from app: schedule or cancel daily notifications ─────────
self.addEventListener('message', event => {
  const { type, inTime, userId } = event.data || {};
  if (type === 'SCHEDULE_ATTENDANCE_REMINDER') scheduleAll(inTime, userId);
  if (type === 'CANCEL_ATTENDANCE_REMINDER')   clearAll();
});

// ── Scheduling state ─────────────────────────────────────────────────
let _timers = [];
let _currentInTime  = null;
let _currentUserId  = null;

function clearAll() {
  _timers.forEach(t => clearTimeout(t));
  _timers = [];
}

function scheduleAll(inTime, userId) {
  clearAll();
  if (!inTime) return;
  _currentInTime = inTime;
  _currentUserId = userId;

  const [hh, mm] = inTime.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return;

  // Morning: at inTime
  scheduleOne(hh, mm, 'morning', userId);

  // Afternoon reminder: 3 hours after inTime (but cap at 17:00)
  const afternoonH = Math.min(hh + 3, 17);
  scheduleOne(afternoonH, mm, 'afternoon', userId);
}

function scheduleOne(h, m, slot, userId) {
  const now  = new Date();
  const fire = new Date();
  fire.setHours(h, m, 0, 0);
  if (fire <= now) fire.setDate(fire.getDate() + 1); // tomorrow if already past
  const delay = fire - now;

  const t = setTimeout(async () => {
    await maybeSendReminder(slot, userId);
    // Re-schedule for tomorrow same slot
    scheduleOne(h, m, slot, userId);
  }, delay);
  _timers.push(t);
}

async function maybeSendReminder(slot, userId) {
  // Skip weekends
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) return;

  // Check if attendance already marked today (ask open clients)
  const today = new Date().toISOString().slice(0, 10);
  const clients = await self.clients.matchAll({ type: 'window' });
  let alreadyMarked = false;

  // Ping open app windows; they reply via postMessage
  // For simplicity, skip if afternoon and attendance was already marked via a flag stored in cache
  const markedKey = `marked_${today}`;
  const markedCache = await caches.open('notif-state');
  const markedEntry = await markedCache.match(markedKey);
  if (markedEntry) {
    alreadyMarked = true;
  }

  if (alreadyMarked && slot === 'afternoon') return; // skip afternoon if already done

  const isAfternoon = slot === 'afternoon';
  await self.registration.showNotification(
    isAfternoon ? '⏰ Still need to mark attendance?' : '📋 Mark Your Attendance',
    {
      body: isAfternoon
        ? `Hey! Your attendance for today (${today}) still isn't marked. Tap to update it now.`
        : `Good morning! Don't forget to mark your attendance for today.`,
      icon: './icon.svg',
      badge: './icon.svg',
      tag: `attendance-reminder-${slot}`,   // separate tags = two visible notifications
      renotify: true,
      requireInteraction: true,
      vibrate: isAfternoon ? [300, 150, 300, 150, 300] : [200, 100, 200],
      data: { userId, today, url: self.registration.scope },
      actions: [
        { action: 'open',    title: '📋 Open App' },
        { action: 'dismiss', title: '✖ Dismiss'  }
      ]
    }
  );
}

// ── Notification click ───────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  notification.close();

  const targetUrl = (notification.data && notification.data.url) || self.registration.scope;
  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'RUN_GEOFENCE_CHECK' });
          return;
        }
      }
      return self.clients.openWindow(targetUrl).then(client => {
        if (client) setTimeout(() => client.postMessage({ type: 'RUN_GEOFENCE_CHECK' }), 3000);
      });
    })
  );
});

// ── App tells SW that attendance was marked today ────────────────────
self.addEventListener('message', event => {
  if (!event.data) return;
  const { type } = event.data;
  if (type === 'ATTENDANCE_MARKED_TODAY') {
    const today = new Date().toISOString().slice(0, 10);
    caches.open('notif-state').then(c => c.put(`marked_${today}`, new Response('1')));
  }
});
