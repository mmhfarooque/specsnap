const $ = (s) => document.querySelector(s);

async function load() {
  const s = await getSettings();
  document.querySelector(`input[name="mode"][value="${s.mode}"]`).checked = true;
  $('#subfolder').value = s.subfolder;
  $('#imagesPerPage').value = String(s.imagesPerPage);
  $('#maxImagePx').value = String(s.maxImagePx);
  const h = await getFolder();
  if (h) $('#folderName').textContent = `\u{1F4C1} ${h.name}`;
}

function flash(msg) { $('#saved').textContent = msg; setTimeout(() => ($('#saved').textContent = ''), 2500); }

document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', async () => { await setSettings({ mode: r.value }); flash('Saved'); }));
$('#subfolder').addEventListener('change', async (e) => {
  const v = e.target.value.trim().replace(/^[\\/]+|[\\/]+$/g, '').replace(/\.\./g, '');
  e.target.value = v; await setSettings({ subfolder: v }); flash('Saved');
});
$('#imagesPerPage').addEventListener('change', async (e) => { await setSettings({ imagesPerPage: Number(e.target.value) }); flash('Saved'); });
$('#maxImagePx').addEventListener('change', async (e) => { await setSettings({ maxImagePx: Number(e.target.value) }); flash('Saved'); });

$('#pick').addEventListener('click', async () => {
  try {
    const h = await window.showDirectoryPicker({ id: 'product-capture', mode: 'readwrite' });
    await setFolder(h);
    await setSettings({ mode: 'folder' });
    document.querySelector('input[name="mode"][value="folder"]').checked = true;
    $('#folderName').textContent = `\u{1F4C1} ${h.name}`;
    flash('Folder saved');
  } catch (e) {
    if (e.name !== 'AbortError') flash(`Could not use that folder: ${e.message}`);
  }
});

load();
