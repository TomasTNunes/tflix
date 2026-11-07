/* ─── ACCOUNT + CONTINUE WATCHING (shared) ───
   Used by the main page (the row, the title modal) and the stream page (which
   records what's playing), so both agree on the Firebase project, on who can
   sync and on where progress is kept.

   Progress is one entry per title, keyed "movie_550" / "tv_1399", holding the
   same TMDB fields as My List plus season, episode, time, duration and
   updatedAt. A show's status is "caughtup" while no newer episode has aired.
   A finished movie has no entry: nothing is kept once it's done.

   Guests keep entries in localStorage (WATCH_KEY). Signed-in users keep them
   in users/{uid} → { watching: { key: entry } }, and every change goes through
   a local queue first, per account, so it survives a closed tab or a failed
   write; the main page retries whatever is still queued. A removal is queued
   as { deleted: true, updatedAt }. The newest updatedAt wins per title. */

// Firebase web config is public by design; the Firestore rules are what protect the data
const FIREBASE_VERSION = '13.1.0';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDYtSIxT89rF9xWjKt9TNZQCN3rQSzhFyc',
  authDomain: 'tflix-5f48f.firebaseapp.com',
  projectId: 'tflix-5f48f',
  storageBucket: 'tflix-5f48f.firebasestorage.app',
  messagingSenderId: '1077791721042',
  appId: '1:1077791721042:web:7a37c01a48ab03b155018b',
};
// Username-only accounts sign in as <username>@USER_DOMAIN (must match the Firestore rules)
const USER_DOMAIN = 'users.tflix.stream';
const SIGNED_IN_KEY = 'tflix_signed_in';

const isUsernameAccount = u => (u?.email || '').endsWith('@' + USER_DOMAIN);
const canSync = u => !!u && (u.emailVerified || isUsernameAccount(u));

// The TMDB fields makeCard/openModal need, saved with My List and progress entries
const TITLE_FIELDS = ['id', 'title', 'name', 'poster_path', 'backdrop_path', 'vote_average',
  'release_date', 'first_air_date', 'overview', 'genre_ids', 'original_language'];

const WATCH_KEY    = 'tflix_watching';
const SYNC_UID_KEY = 'tflix_sync_uid';   // the account progress syncs to, if any
const WATCH_MIN_RESUME = 30;             // seconds; resuming earlier than this isn't worth it

const watchQueueKey = uid => `tflix_watching_queue_${uid}`;

// Storage can throw (private windows, full quota), and this runs during playback
function readJsonStore(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function writeJsonStore(key, obj) {
  try {
    if (Object.keys(obj).length) localStorage.setItem(key, JSON.stringify(obj));
    else localStorage.removeItem(key);
  } catch {}
}

function syncUid() {
  try { return localStorage.getItem(SYNC_UID_KEY); } catch { return null; }
}
function setSyncUid(uid) {
  try {
    if (uid) localStorage.setItem(SYNC_UID_KEY, uid);
    else localStorage.removeItem(SYNC_UID_KEY);
  } catch {}
}

// Queued changes laid over what the account has; the newer one wins per title
function overlayQueue(remote, queue) {
  const out = { ...remote };
  for (const [key, item] of Object.entries(queue)) {
    if ((remote[key]?.updatedAt || 0) > item.updatedAt) continue;
    if (item.deleted) delete out[key]; else out[key] = item;
  }
  return out;
}

// What this browser knows without asking Firestore
function readOwnWatching(uid) {
  return uid ? overlayQueue({}, readJsonStore(watchQueueKey(uid))) : readJsonStore(WATCH_KEY);
}

// Saves an entry, or removes the title when entry is null. Signed in, this only
// queues it; sending it is up to the page, which has its own Firestore handle.
function storeWatching(uid, key, entry) {
  const storeKey = uid ? watchQueueKey(uid) : WATCH_KEY;
  const store = readJsonStore(storeKey);
  if (uid) store[key] = entry || { deleted: true, updatedAt: Date.now() };
  else if (entry) store[key] = entry;
  else delete store[key];
  writeJsonStore(storeKey, store);
}

// A queued change is done once written, unless a newer one has replaced it since
function clearQueued(uid, key, updatedAt) {
  const store = readJsonStore(watchQueueKey(uid));
  if (store[key]?.updatedAt !== updatedAt) return;
  delete store[key];
  writeJsonStore(watchQueueKey(uid), store);
}

// The field value for users/{uid}.watching[key]
const queuedValue = (item, deleteField) => item.deleted ? deleteField() : item;
