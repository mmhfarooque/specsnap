// Builds the product PDF with jsPDF. Uses bundled DejaVu Sans so \u20b9 \u20ac \u00a3 \u2122 \u00b0 etc. render correctly.
let FONT_CACHE = null;
async function loadFonts() {
  if (FONT_CACHE) return FONT_CACHE;
  const b64 = async (path) => {
    const buf = new Uint8Array(await (await fetch(chrome.runtime.getURL(path))).arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  FONT_CACHE = { regular: await b64('fonts/DejaVuSans.ttf'), bold: await b64('fonts/DejaVuSans-Bold.ttf') };
  return FONT_CACHE;
}

async function buildPdf(d, imgs, opts) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const f = await loadFonts();
  doc.addFileToVFS('DejaVuSans.ttf', f.regular); doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', f.bold); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');

  const W = 210, H = 297, M = 15, CW = W - 2 * M, PT = 0.3528;
  let y = M;
  const ensure = (h) => { if (y + h > H - M - 6) { doc.addPage(); y = M; } };
  const setF = (size, style = 'normal', color = [31, 35, 40]) => { doc.setFont('DejaVu', style); doc.setFontSize(size); doc.setTextColor(...color); };
  const lineH = (size) => size * PT * 1.4;
  const para = (str, size, style, { x = M, width = CW, color, gap = 1.2 } = {}) => {
    setF(size, style, color);
    for (const ln of doc.splitTextToSize(String(str), width)) { ensure(lineH(size)); doc.text(ln, x, y + size * PT); y += lineH(size); }
    y += gap;
  };
  const fit = (w, h, maxW, maxH) => { const r = Math.min(maxW / w, maxH / h); return [w * r, h * r]; };
  const addImg = (im, x, yy, w, h) => doc.addImage(im.dataUrl, 'JPEG', x, yy, w, h, im.key, 'NONE');

  // ---- Header ----
  para(d.title || 'Untitled product', 18, 'bold', { gap: 2 });
  if (d.price) para(d.price, 15, 'bold', { color: [37, 99, 235], gap: 2 });
  setF(8.5, 'normal', [107, 114, 128]);
  const urlLines = doc.splitTextToSize(d.url, CW);
  urlLines.forEach((ln) => { ensure(lineH(8.5)); doc.textWithLink(ln, M, y + 8.5 * PT, { url: d.url }); y += lineH(8.5); });
  para(`Captured ${new Date(d.capturedAt).toLocaleString()} from ${d.site}`, 8.5, 'normal', { color: [107, 114, 128], gap: 4 });

  // ---- Hero image ----
  if (imgs[0]) {
    const room = Math.min(115, H - M - 8 - y);
    if (room > 60) {
      const [w, h] = fit(imgs[0].w, imgs[0].h, CW, room);
      addImg(imgs[0], M + (CW - w) / 2, y, w, h);
      y += h + 6;
    }
  }

  // ---- Sections ----
  for (const s of d.sections) {
    ensure(16);
    y += 2;
    para(s.name, 13, 'bold', { gap: 0.5 });
    doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.5); doc.line(M, y, M + 25, y); y += 3;
    for (const b of s.blocks) {
      if (b.type === 'kv') {
        const kw = 55, vw = CW - kw - 3;
        setF(9.5, 'bold'); const kl = doc.splitTextToSize(b.k || '', kw);
        setF(9.5, 'normal'); const vl = doc.splitTextToSize(b.text || '', vw);
        const rows = Math.max(kl.length, vl.length), rh = rows * lineH(9.5) + 2;
        ensure(Math.min(rh, 60));
        doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2); doc.line(M, y, M + CW, y);
        let yy = y + 1;
        for (let i = 0; i < rows; i++) {
          if (yy + lineH(9.5) > H - M - 6) { doc.addPage(); yy = M; }
          if (kl[i]) { setF(9.5, 'bold'); doc.text(kl[i], M, yy + 9.5 * PT); }
          if (vl[i]) { setF(9.5, 'normal'); doc.text(vl[i], M + kw + 3, yy + 9.5 * PT); }
          yy += lineH(9.5);
        }
        y = yy + 1;
      } else if (b.type === 'li') {
        setF(10, 'normal'); ensure(lineH(10)); doc.text('\u2022', M + 1, y + 10 * PT);
        para(b.text, 10, 'normal', { x: M + 5, width: CW - 5, gap: 0.8 });
      } else if (b.type === 'h') {
        para(b.text, 10.5, 'bold', { gap: 0.8 });
      } else {
        para(b.text, 10, 'normal', { gap: 1.6 });
      }
    }
    y += 3;
  }

  // ---- Image gallery ----
  if (imgs.length) {
    doc.addPage(); y = M;
    para(`Product images (${imgs.length})`, 13, 'bold', { gap: 3 });
    const per = opts.imagesPerPage || 1;
    const top0 = y;
    const cols = per === 4 ? 2 : 1, rows = per === 1 ? 1 : 2;
    const cellW = (CW - (cols - 1) * 6) / cols;
    imgs.forEach((im, i) => {
      const slot = i % per;
      if (i > 0 && slot === 0) { doc.addPage(); y = M; }
      const top = i < per ? top0 : M;
      const cellH = (H - M - 8 - top - (rows - 1) * 6) / rows - 6;
      const cx = M + (slot % cols) * (cellW + 6);
      const cy = top + Math.floor(slot / cols) * (cellH + 12);
      const [w, h] = fit(im.w, im.h, cellW, cellH);
      addImg(im, cx + (cellW - w) / 2, cy, w, h);
      setF(8, 'normal', [107, 114, 128]);
      doc.text(`Image ${i + 1} \u00b7 ${im.origW}\u00d7${im.origH}px`, cx, cy + h + 4);
    });
  }

  // ---- Footer ----
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); setF(7.5, 'normal', [150, 150, 150]);
    doc.text(`${d.site}  \u00b7  Page ${i} / ${n}`, W / 2, H - 8, { align: 'center' });
  }
  return doc.output('blob');
}
