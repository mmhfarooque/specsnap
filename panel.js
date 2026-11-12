const $ = (s) => document.querySelector(s);
let DATA = null;
let TAB = null;
const IMG_CACHE = new Map(); // key -> Promise<loaded image | null>

function status(msg, cls = '') { const s = $('#status'); s.textContent = msg; s.className = `status ${cls}`; s.hidden = !msg; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Scan ----------
async function scan() {
  $('#result').hidden = true; $('#save').disabled = true; $('#saveAs').disabled = true; IMG_CACHE.clear();
  status('Scanning\u2026');
  [TAB] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!TAB || !/^https?:/.test(TAB.url || '')) { status('Open a product page (http/https) and press Rescan.', 'error'); return; }
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: TAB.id }, files: ['extractor.js'] });
    if (!result) throw new Error('No data returned');
    DATA = result;
    render();
    status('');
  } catch (e) {
    status(`Could not read this page: ${e.message}`, 'error');
  }
}

// ---------- Render ----------
function render() {
  $('#title').value = DATA.title;
  $('#price').value = DATA.price.text;
  $('#source').textContent = DATA.price.source ? `Price from ${DATA.price.source}` : 'Price not detected';

  const secs = $('#sections'); secs.innerHTML = '';
  if (!DATA.sections.length) secs.innerHTML = '<p class="muted">No description / features / specification sections found.</p>';
  DATA.sections.forEach((s, i) => {
    s.include = s.include ?? true;
    const det = document.createElement('details'); det.className = 'sec';
    let body = '', rows = '';
    for (const b of s.blocks) {
      if (b.type === 'kv') rows += `<tr><td>${esc(b.k)}</td><td>${esc(b.text)}</td></tr>`;
      else { if (rows) { body += `<table>${rows}</table>`; rows = ''; } body += b.type === 'li' ? `<li>${esc(b.text)}</li>` : b.type === 'h' ? `<p><b>${esc(b.text)}</b></p>` : `<p>${esc(b.text)}</p>`; }
    }
    if (rows) body += `<table>${rows}</table>`;
    det.innerHTML = `<summary><input type="checkbox" ${s.include ? 'checked' : ''}> <b>${esc(s.name)}</b> <span class="muted small">(${s.blocks.length} items)</span></summary><div class="body">${body}</div>`;
    const cb = det.querySelector('input');
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => (s.include = cb.checked));
    secs.appendChild(det);
  });

  const grid = $('#images'); grid.innerHTML = '';
  DATA.images.forEach((im) => {
    const t = document.createElement('div'); t.className = `tile ${im.selected ? 'on' : ''}`;
    t.innerHTML = `<input type="checkbox" ${im.selected ? 'checked' : ''}><img loading="lazy" referrerpolicy="no-referrer" src="${esc(im.thumb || im.url)}" alt=""><div class="dim">\u2026</div>`;
    const cb = t.querySelector('input');
    const toggle = (v) => { im.selected = v; cb.checked = v; t.classList.toggle('on', v); updateCount(); if (v) probe(im, t); };
    cb.addEventListener('click', (e) => { e.stopPropagation(); toggle(cb.checked); });
    t.addEventListener('click', () => toggle(!im.selected));
    t.querySelector('img').addEventListener('error', () => { t.querySelector('img').src = im.url; }, { once: true });
    im.tile = t;
    grid.appendChild(t);
    if (im.selected) probe(im, t);
  });
  updateCount();
  $('#result').hidden = false;
  $('#save').disabled = false; $('#saveAs').disabled = false;
  updateSaveTo();
}
function updateCount() {
  const n = DATA.images.filter((i) => i.selected).length;
  $('#imgCount').textContent = `${n} selected of ${DATA.images.length} found`;
}

// ---------- Image loading (shared code in images.js) ----------
let MAX_PX = 3000;
function loadImage(im) {
  if (!IMG_CACHE.has(im.key)) IMG_CACHE.set(im.key, loadImageData(im, MAX_PX));
  return IMG_CACHE.get(im.key);
}
function probe(im, tile) {
  loadImage(im).then((r) => {
    const dim = tile.querySelector('.dim');
    dim.textContent = r ? `${r.origW}\u00d7${r.origH}` : 'failed';
  });
}

// ---------- Save ----------

async function updateSaveTo() {
  const s = await getSettings();
  let t = '';
  if (s.mode === 'folder') { const h = await getFolder(); t = h ? `Saving to \u{1F4C1} ${h.name}` : 'No folder chosen \u2013 open \u2699'; }
  else if (s.mode === 'downloads') t = `Saving to Downloads/${s.subfolder || ''}`;
  else t = 'Will ask where to save';
  t += ' \u2013 change';
  $('#saveTo').textContent = t;
}

async function uniqueFile(dir, name) {
  const base = name.replace(/\.pdf$/i, '');
  for (let i = 1; i < 100; i++) {
    const n = i === 1 ? `${base}.pdf` : `${base} (${i}).pdf`;
    try { await dir.getFileHandle(n); } catch { return n; }
  }
  return `${base} ${Date.now()}.pdf`;
}

async function save(askOnce = false) {
  const btn = $('#save');
  const s = await getSettings();
  if (askOnce === true) s.mode = 'ask'; // "Save as...": pick folder + name for this PDF only
  MAX_PX = s.maxImagePx;

  // Permission must be requested right away, while the click still counts as a user gesture.
  let dir = null;
  if (s.mode === 'folder') {
    dir = await getFolder();
    if (!dir) { status('Choose a save folder in Settings first.', 'error'); chrome.runtime.openOptionsPage(); return; }
    try {
      let p = await dir.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted') p = await dir.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') throw new Error('denied');
    } catch {
      dir = null; s.mode = 'ask'; // fall back to a Save As dialog
      status('Folder access not available right now \u2013 showing Save As instead.');
    }
  }

  btn.disabled = true;
  try {
    const chosen = DATA.images.filter((i) => i.selected);
    status(`Downloading ${chosen.length} images\u2026`);
    const loaded = [];
    for (let i = 0; i < chosen.length; i += 4) {
      (await Promise.all(chosen.slice(i, i + 4).map(loadImage))).forEach((r) => r && loaded.push(r));
      status(`Downloading images\u2026 ${Math.min(i + 4, chosen.length)}/${chosen.length}`);
    }
    status('Building PDF\u2026');
    const d = { ...DATA, title: $('#title').value.trim(), price: $('#price').value.trim(), sections: DATA.sections.filter((x) => x.include) };
    const blob = await buildPdf(d, loaded, s);
    const date = new Date().toISOString().slice(0, 10);
    const name = `${safeName(d.title)} - ${date}.pdf`;

    if (dir) {
      const fname = await uniqueFile(dir, name);
      const fh = await dir.getFileHandle(fname, { create: true });
      const w = await fh.createWritable(); await w.write(blob); await w.close();
      status(`Saved \u201c${fname}\u201d to ${dir.name} (${loaded.length} images, ${(blob.size / 1048576).toFixed(1)} MB)`, 'ok');
    } else {
      const url = URL.createObjectURL(blob);
      const filename = s.mode === 'downloads' && s.subfolder ? `${s.subfolder}/${name}` : name;
      await chrome.downloads.download({ url, filename, saveAs: s.mode === 'ask', conflictAction: 'uniquify' });
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status(`Saved \u201c${name}\u201d (${loaded.length} images, ${(blob.size / 1048576).toFixed(1)} MB)`, 'ok');
    }
    const failed = chosen.length - loaded.length;
    if (failed) $('#status').textContent += ` \u2013 ${failed} image(s) could not be downloaded`;
  } catch (e) {
    console.error(e);
    status(`Failed: ${e.message}`, 'error');
  } finally { btn.disabled = false; }
}

// ---------- Wiring ----------
$('#rescan').addEventListener('click', scan);
$('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#save').addEventListener('click', () => save(false));
$('#saveAs').addEventListener('click', () => save(true));
$('#saveTo').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#selAll').addEventListener('click', () => DATA && DATA.images.forEach((im) => { if (!im.selected) im.tile.click(); }));
$('#selNone').addEventListener('click', () => DATA && DATA.images.forEach((im) => { if (im.selected) im.tile.click(); }));
chrome.storage.onChanged.addListener(updateSaveTo);
chrome.tabs.onActivated.addListener(() => scan());
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (TAB && id === TAB.id && info.status === 'complete' && tab.active) scan(); });
getSettings().then((s) => { MAX_PX = s.maxImagePx; scan(); });
