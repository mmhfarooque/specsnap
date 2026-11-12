// Settings (chrome.storage) + the chosen save folder handle (IndexedDB; handles can't go in chrome.storage).
const DEFAULTS = { mode: 'folder', subfolder: 'ProductCapture', imagesPerPage: 1, maxImagePx: 3000 };

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}
async function setSettings(patch) { await chrome.storage.local.set(patch); }

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('product-capture', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction('kv').objectStore('kv').get(key);
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
async function idbSet(key, val) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction('kv', 'readwrite');
    t.objectStore('kv').put(val, key);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
const getFolder = () => idbGet('folder');
const setFolder = (h) => idbSet('folder', h);
