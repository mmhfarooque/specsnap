// Hidden document that downloads images and builds the PDF for API (terminal) requests.
chrome.runtime.onMessage.addListener((m, _sender, send) => {
  if (!m || m.target !== 'offscreen') return;
  build(m).then(send, (e) => send({ ok: false, error: String(e && e.message || e) }));
  return true;
});

async function build({ data, settings }) {
  const chosen = data.images.filter((i) => settings.allImages || i.selected).slice(0, settings.maxImages || 60);
  const loaded = [];
  for (let i = 0; i < chosen.length; i += 4) {
    (await Promise.all(chosen.slice(i, i + 4).map((im) => loadImageData(im, settings.maxImagePx)))).forEach((r) => r && loaded.push(r));
  }
  const d = { ...data, price: data.price.text };
  const blob = await buildPdf(d, loaded, settings);
  const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  return {
    ok: true,
    b64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    size: blob.size,
    filename: `${safeName(data.title)} - ${new Date().toISOString().slice(0, 10)}.pdf`,
    images: loaded.map((i) => ({ url: i.from, width: i.origW, height: i.origH })),
    failed: chosen.length - loaded.length,
  };
}
