// Shared by the side panel and the offscreen (API) builder.
// Downloads an image candidate (shown URL first, then fallbacks) and returns a JPEG data URL for jsPDF.
async function fetchBitmap(url) {
  const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(r.status);
  const blob = await r.blob();
  if (!/^image\//.test(blob.type) && blob.size < 1000) throw new Error('not image');
  return createImageBitmap(blob);
}

async function loadImageData(im, maxPx) {
  let bmp = null, from = '';
  for (const u of im.fallbacks || [im.url]) {
    try {
      const b = await fetchBitmap(u);
      if (b.width < 60 || b.height < 60) { b.close(); continue; }
      bmp = b; from = u; break;
    } catch {}
  }
  if (!bmp) return null;
  const origW = bmp.width, origH = bmp.height;
  const scale = maxPx ? Math.min(1, maxPx / Math.max(origW, origH)) : 1;
  const c = new OffscreenCanvas(Math.round(origW * scale), Math.round(origH * scale));
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  return { key: im.key, dataUrl, w: c.width, h: c.height, origW, origH, from };
}

const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'product';
