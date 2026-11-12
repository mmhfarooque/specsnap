// Service worker:
//  1. Clicking the toolbar icon opens the side panel.
//  2. Bridge for terminal / AI agents: connects to the native host "com.productcapture.host"
//     (bridge/host.py), which exposes a localhost HTTP API used by the `pcap` CLI.
importScripts('storage.js');

const HOST = 'com.productcapture.host';
let port = null;

function setup() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.alarms.create('bridge-keepalive', { periodInMinutes: 1 });
  connect();
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'bridge-keepalive') connect(); });

function connect() {
  if (port) return;
  try { port = chrome.runtime.connectNative(HOST); } catch { port = null; return; }
  port.onMessage.addListener(onHostMessage);
  port.onDisconnect.addListener(() => { void chrome.runtime.lastError; port = null; }); // host not installed \u2192 retried by alarm
  port.postMessage({ type: 'hello', version: chrome.runtime.getManifest().version });
}
connect();

function onHostMessage(msg) {
  if (!msg || !msg.id || !msg.cmd) return;
  handle(msg)
    .then((res) => port && port.postMessage({ type: 'result', id: msg.id, ...res }))
    .catch((e) => port && port.postMessage({ type: 'result', id: msg.id, ok: false, error: String(e && e.message || e) }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForLoad(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(t); chrome.tabs.onUpdated.removeListener(l); resolve(); };
    const l = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    const t = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(l);
    chrome.tabs.get(tabId).then((tb) => tb.status === 'complete' && finish()).catch(finish);
  });
}

async function ensureOffscreen() {
  const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (ctx.length) return;
  await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Build product PDFs for the terminal API' });
}

// Compact view of the extracted data for the CLI / AI.
const summarize = (d) => ({
  url: d.url, site: d.site, title: d.title, price: d.price.text, capturedAt: d.capturedAt,
  sections: d.sections.map((s) => ({ name: s.name, heading: s.heading, blocks: s.blocks.map((b) => (b.type === 'kv' ? { k: b.k, v: b.text } : { [b.type]: b.text })) })),
  images: d.images.map((i) => ({ url: i.url, selected: i.selected })),
});

async function handle(msg) {
  const opts = msg.opts || {};
  if (msg.cmd === 'ping') return { ok: true, version: chrome.runtime.getManifest().version };
  if (msg.cmd !== 'capture' && msg.cmd !== 'extract') throw new Error(`Unknown command ${msg.cmd}`);

  let tabId, created = false;
  if (msg.current) {
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!t || !/^https?:/.test(t.url || '')) throw new Error('Active tab is not a web page');
    tabId = t.id;
  } else {
    if (!/^https?:\/\//i.test(msg.url || '')) throw new Error('A http(s) URL is required');
    const t = await chrome.tabs.create({ url: msg.url, active: false });
    tabId = t.id; created = true;
    await waitForLoad(tabId, (opts.timeout || 45) * 1000);
    await sleep(opts.wait ?? 2500); // let JS-rendered content (tabs, galleries, prices) settle
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, files: ['extractor.js'] });
    if (!result) throw new Error('Extractor returned nothing');
    if (msg.cmd === 'extract') return { ok: true, data: summarize(result) };

    const settings = { ...(await getSettings()), ...opts };
    await ensureOffscreen();
    const r = await chrome.runtime.sendMessage({ target: 'offscreen', cmd: 'build', data: result, settings });
    if (!r || !r.ok) throw new Error((r && r.error) || 'PDF build failed');

    const CH = 4 * 1024 * 1024; // stay well below the 64 MB native-messaging limit
    for (let i = 0; i < r.b64.length; i += CH) port.postMessage({ type: 'chunk', id: msg.id, data: r.b64.slice(i, i + CH) });
    return { ok: true, filename: r.filename, size: r.size, images: r.images, failedImages: r.failed, data: summarize(result) };
  } finally {
    if (created && !opts.keepTab) chrome.tabs.remove(tabId).catch(() => {});
  }
}
