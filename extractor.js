// Injected into the product page. The value of the last expression is returned to the panel.
// Generic: works on any e-commerce page using structured data first, then headings/keywords.
(() => {
  const clean = (s) => (s || '').replace(/[\u00a0\s]+/g, ' ').trim();
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const meta = (name) => {
    const m = document.querySelector(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`);
    return m ? clean(m.getAttribute('content')) : '';
  };
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ''; } };
  const CHROME = 'header, nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"]';

  // ---------- Structured data (JSON-LD) ----------
  const ldProducts = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    const t = [].concat(o['@type'] || []);
    if (t.some((x) => /^(Product|ProductGroup|IndividualProduct|ProductModel)$/i.test(String(x)))) ldProducts.push(o);
    ['@graph', 'mainEntity', 'itemListElement', 'hasVariant'].forEach((k) => o[k] && walk(o[k]));
  };
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try { walk(JSON.parse(s.textContent)); } catch {}
  });
  const ld = ldProducts[0] || null;
  const micro = document.querySelector('[itemtype*="schema.org/Product" i]');

  // ---------- Title ----------
  function getTitle() {
    if (ld && ld.name) return clean(ld.name);
    const mi = micro && micro.querySelector('[itemprop="name"]');
    if (mi && clean(mi.textContent)) return clean(mi.textContent);
    const h1s = [...document.querySelectorAll('h1')]
      .filter((h) => visible(h) && !h.closest(CHROME))
      .map((h) => clean(h.textContent))
      .filter((t) => t.length > 2 && t.length < 300);
    if (h1s.length) return h1s[0];
    const og = meta('og:title');
    if (og) return og;
    const parts = clean(document.title).split(/\s+[|\-\u2013\u2014:]\s+/);
    return parts.sort((a, b) => b.length - a.length)[0] || clean(document.title);
  }
  const title = getTitle();

  // ---------- Price (selling price, not EMI / monthly / struck-through) ----------
  const CUR = '(?:[$\u20ac\u00a3\u00a5\u20b9\u09f3\u20a8\u20a9\u20bd\u20ba\u20ab\u0e3f\u20b1\u20a6]|US\\$|C\\$|A\\$|Tk\\.?|BDT|USD|EUR|GBP|AED|SAR|QAR|INR|PKR|Rs\\.?|RM|MYR|SGD|AUD|CAD|CHF|JPY|CNY|kr|z\u0142|Dhs?)';
  const PRICE_RE = new RegExp(`${CUR}\\s?\\d[\\d,.' ]*\\d|${CUR}\\s?\\d|\\d[\\d,.' ]*\\s?${CUR}`, 'i');
  const EMI_RE = /\b(emi|instal+ments?|per\s*month|\/\s*mo(nth)?\b|monthly|a month|months?|finance|financing|klarna|afterpay|affirm|zip\s*pay|pay in \d|interest|deposit|save|saving|off\b|shipping|delivery|cashback|coupon|points?)\b/i;
  const OLD_RE = /(old|was|compare|regular|list|strike|before|original|crossed|rrp|msrp|mrp)/i;

  function getPrice() {
    let offers = ld && ld.offers;
    if (Array.isArray(offers)) offers = offers[0];
    if (offers && offers.offers) offers = [].concat(offers.offers)[0];
    if (offers) {
      const ps = [].concat(offers.priceSpecification || [])[0] || {};
      const amount = offers.price ?? offers.lowPrice ?? ps.price;
      if (amount !== undefined && amount !== '' && Number(amount) !== 0) {
        return { text: fmt(amount, offers.priceCurrency || ps.priceCurrency), source: 'structured data' };
      }
    }
    const mAmt = meta('product:price:amount') || meta('og:price:amount');
    if (mAmt) return { text: fmt(mAmt, meta('product:price:currency') || meta('og:price:currency')), source: 'meta tags' };
    const ip = document.querySelector('[itemprop="price"]');
    if (ip) {
      const v = ip.getAttribute('content') || clean(ip.textContent);
      const c = document.querySelector('[itemprop="priceCurrency"]');
      if (v && /\d/.test(v)) return { text: /\D{1,4}\d/.test(v) ? v : fmt(v, c && (c.getAttribute('content') || c.textContent)), source: 'microdata' };
    }
    return domPrice();
  }
  function fmt(amount, cur) {
    const n = Number(String(amount).replace(/,/g, ''));
    const a = isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) : String(amount);
    return clean(`${cur || ''} ${a}`);
  }
  function domPrice() {
    const h1 = [...document.querySelectorAll('h1')].find(visible);
    const anchor = h1 ? h1.getBoundingClientRect() : { top: 0, left: 0 };
    const nodes = document.querySelectorAll('[class*="price" i], [id*="price" i], [data-price], [data-testid*="price" i], [class*="amount" i]');
    let best = null;
    for (const el of nodes) {
      if (!visible(el) || el.closest(CHROME)) continue;
      const text = clean(el.textContent);
      if (!text || text.length > 40 || !PRICE_RE.test(text)) continue;
      const ctx = `${text} ${el.className} ${el.id} ${el.parentElement ? el.parentElement.className + ' ' + clean(el.parentElement.textContent).slice(0, 80) : ''}`;
      if (EMI_RE.test(ctx)) continue;
      const cs = getComputedStyle(el);
      if (el.closest('del, s, strike') || cs.textDecorationLine.includes('line-through') || OLD_RE.test(`${el.className} ${el.id}`)) continue;
      if (el.closest('[class*="related" i], [class*="recommend" i], [class*="similar" i], [class*="carousel" i]')) continue;
      const r = el.getBoundingClientRect();
      const dist = Math.hypot(r.top - anchor.top, (r.left - anchor.left) / 3);
      const score = parseFloat(cs.fontSize) * 4 + (parseInt(cs.fontWeight) >= 600 ? 10 : 0) - dist / 25;
      if (!best || score > best.score) best = { score, text: text.match(PRICE_RE)[0].trim() };
    }
    return best ? { text: best.text, source: 'page' } : { text: '', source: '' };
  }
  const price = getPrice();

  // ---------- Sections: description / features / specifications / details ----------
  const KEY_RE = /^(?:product\s+|item\s+|technical\s+|tech\s+|key\s+|main\s+|more\s+|full\s+|additional\s+|general\s+)?(description|features?|specifications?|specs|details|information|info|highlights|overview|about (?:this|the) (?:item|product)|what'?s in the box|in the box|dimensions)\b/i;
  const sectionName = (t) => {
    const s = t.toLowerCase();
    if (/spec|technical|dimension/.test(s)) return 'Specifications';
    if (/feature|highlight|about (this|the)/.test(s)) return 'Features';
    if (/box/.test(s)) return "What's in the box";
    if (/descr|overview/.test(s)) return 'Description';
    return 'Details';
  };
  const isHeadingTag = (el) => /^(H[1-6]|SUMMARY|DT|LEGEND)$/.test(el.tagName) || el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'heading';
  const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|SVG|BUTTON|INPUT|SELECT|TEXTAREA|IFRAME|IMG|PICTURE|VIDEO|FORM|TEMPLATE)$/;

  function serialize(root) {
    const blocks = [];
    const seen = new Set();
    const push = (b) => {
      const key = b.type + '|' + (b.k || '') + '|' + b.text;
      if (!b.text || seen.has(key) || /^(view|see|read|show|load)\s+(more|less|all|full)\b.{0,20}$/i.test(b.text)) return;
      seen.add(key); blocks.push(b);
    };
    const rec = (el) => {
      if (el.nodeType !== 1 || SKIP_TAGS.test(el.tagName)) return;
      if (el.getAttribute('aria-hidden') === 'true' && !el.querySelector('table, li, p')) return;
      const tag = el.tagName;
      if (tag === 'TABLE') {
        for (const tr of el.querySelectorAll('tr')) {
          const cells = [...tr.children].filter((c) => /^(TH|TD)$/.test(c.tagName)).map((c) => clean(c.textContent));
          if (cells.length === 2 && cells[0]) push({ type: 'kv', k: cells[0], text: cells[1] });
          else if (cells.filter(Boolean).length === 1) push({ type: 'h', text: cells.find(Boolean) }); // group label row
          else if (cells.some(Boolean)) push({ type: 'p', text: cells.filter(Boolean).join('  |  ') });
        }
        return;
      }
      if (tag === 'DL') {
        let k = '';
        for (const c of el.children) {
          if (c.tagName === 'DT') k = clean(c.textContent);
          else if (c.tagName === 'DD') push({ type: 'kv', k, text: clean(c.textContent) });
        }
        return;
      }
      if (tag === 'LI') {
        const t = clean(el.textContent);
        const m = t.match(/^([^:]{1,40}):\s+(.+)$/);
        if (m && el.closest('[class*="spec" i], [id*="spec" i]')) push({ type: 'kv', k: m[1], text: m[2] });
        else push({ type: 'li', text: t });
        return;
      }
      const blockKids = [...el.children].filter((c) => !SKIP_TAGS.test(c.tagName) && /^(DIV|P|UL|OL|LI|TABLE|DL|SECTION|ARTICLE|H[1-6]|BLOCKQUOTE|PRE|TBODY)$/.test(c.tagName));
      if (!blockKids.length) {
        const t = clean(el.textContent);
        if (t) {
          // Two-cell "Label | Value" div rows used by many spec layouts
          const kids = [...el.children].filter((c) => clean(c.textContent));
          if (kids.length === 2 && clean(kids[0].textContent).length < 50 && /spec|attr|detail|row|item/i.test(el.className + ' ' + (el.parentElement && el.parentElement.className))) {
            push({ type: 'kv', k: clean(kids[0].textContent).replace(/:$/, ''), text: clean(kids[1].textContent) });
          } else if (/^H[1-6]$/.test(tag)) push({ type: 'h', text: t });
          else push({ type: 'p', text: t });
        }
        return;
      }
      // Mixed: loose text directly inside + block children
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && clean(n.textContent).length > 1) push({ type: 'p', text: clean(n.textContent) });
        else if (n.nodeType === 1) rec(n);
      }
    };
    rec(root);
    return blocks;
  }

  const textLen = (el) => clean(el.textContent).length;
  const bodyLen = textLen(document.body) || 1;

  function explicitTarget(h) {
    // Tabs / accordions / anchor links pointing at a panel
    const ctrl = h.closest('[aria-controls]') || h.querySelector('[aria-controls]');
    if (ctrl) {
      const p = ctrl.getAttribute('aria-controls').split(/\s+/).map((id) => document.getElementById(id)).find(Boolean);
      if (p && !p.contains(h)) return [p];
    }
    const a = h.closest('a[href^="#"]') || h.querySelector('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1) {
      try { const p = document.querySelector(a.getAttribute('href')); if (p && !p.contains(h)) return [p]; } catch {}
    }
    for (const el of [h, h.parentElement]) {
      for (const at of ['data-target', 'data-bs-target', 'data-tab', 'data-area', 'data-href', 'data-content', 'data-panel', 'data-id']) {
        const v = el && el.getAttribute(at);
        if (!v) continue;
        const p = document.getElementById(v.replace(/^#/, '')) || document.querySelector(`[data-tab-content="${CSS.escape(v)}"], [data-content="${CSS.escape(v)}"]`);
        if (p && !p.contains(h) && p !== h) return [p];
      }
    }
    const det = h.closest('summary');
    if (det && det.parentElement.tagName === 'DETAILS') return [...det.parentElement.children].filter((c) => c !== det);
    if (h.tagName === 'DT') {
      const out = []; let n = h.nextElementSibling;
      while (n && n.tagName === 'DD') { out.push(n); n = n.nextElementSibling; }
      return out;
    }
    return null;
  }

  // Following siblings until the next section heading (or an element already claimed by a tab panel)
  function siblingContent(h, heads, usedEls) {
    const blocker = (n) => heads.some((x) => x !== h && (n === x || n.contains(x))) || [...usedEls].some((u) => n === u || n.contains(u));
    let node = h;
    while (node.parentElement && node.parentElement !== document.body && textLen(node.parentElement) === textLen(node)) node = node.parentElement;
    for (let level = 0; level < 4 && node && node !== document.body; level++) {
      const out = [];
      for (let n = node.nextElementSibling; n; n = n.nextElementSibling) {
        if (blocker(n)) { if (out.length) break; else continue; }
        const looksHeading = (isHeadingTag(n) || /^H[1-6]$/.test(n.tagName)) && clean(n.textContent).length < 60;
        if (looksHeading && out.length) break;
        out.push(n);
      }
      // A row of short same-tag items is a tab bar / menu, not content
      if (out.length && out.every((e) => e.tagName === node.tagName && textLen(e) < 40)) return [];
      if (out.reduce((s, e) => s + textLen(e), 0) > 15) return out;
      if (node.parentElement && blocker(node.parentElement)) return []; // climbing further would swallow other sections
      node = node.parentElement;
    }
    return [];
  }

  const headingSel = 'h1,h2,h3,h4,h5,h6,[role="tab"],[role="heading"],summary,dt,legend,button,a,li,span,strong,b,label,div,p,th';
  const heads = [];
  for (const h of document.querySelectorAll(headingSel)) {
    if (h.childElementCount > 4 || h.textContent.length > 300) continue; // cheap checks first
    if (h.querySelectorAll('*').length > 6) continue;
    if (h.closest(CHROME) && !h.closest('main')) continue;
    const t = clean(h.textContent);
    if (t.length < 4 || t.length > 45 || !KEY_RE.test(t)) continue;
    if (/:\s*\S/.test(t) || t.slice(t.match(KEY_RE)[0].length).replace(/[^a-z]/gi, '').length > 12) continue; // "Features: USB-C\u2026" is content, not a heading
    if (h.parentElement && clean(h.parentElement.textContent) === t && h.parentElement.matches(headingSel)) continue; // outermost wrapper only
    heads.push(h);
  }

  const sections = [];
  const usedEls = new Set();
  const addSection = (h, els) => {
    els = (els || []).filter((e) => !usedEls.has(e));
    const len = els.reduce((s, e) => s + textLen(e), 0);
    if (len < 15 || len > bodyLen * 0.6 || len > 60000) return;
    els.forEach((e) => usedEls.add(e));
    const t = clean(h.textContent);
    const blocks = els.flatMap(serialize).filter((b) => !(b.type !== 'kv' && KEY_RE.test(b.text) && b.text.length < 45));
    if (blocks.length) sections.push({ name: sectionName(t), heading: t, blocks, order: sections.length });
  };
  const rest = [];
  for (const h of heads) { const e = explicitTarget(h); if (e) addSection(h, e); else rest.push(h); }
  for (const h of rest) addSection(h, siblingContent(h, heads, usedEls));

  // Structured-data fallbacks
  const ldDesc = clean((ld && ld.description) || (micro && (micro.querySelector('[itemprop="description"]') || {}).textContent) || '');
  if (ldDesc && !sections.some((s) => s.name === 'Description')) {
    sections.unshift({ name: 'Description', heading: 'Description', blocks: [{ type: 'p', text: ldDesc }] });
  }
  const props = ld && [].concat(ld.additionalProperty || []).filter((p) => p && p.name);
  if (props && props.length && !sections.some((s) => s.name === 'Specifications')) {
    sections.push({ name: 'Specifications', heading: 'Specifications', blocks: props.map((p) => ({ type: 'kv', k: clean(p.name), text: clean(String(p.value ?? '')) })) });
  }
  const extra = [];
  if (ld) {
    const brand = ld.brand && (ld.brand.name || ld.brand);
    if (brand && typeof brand === 'string') extra.push({ type: 'kv', k: 'Brand', text: clean(brand) });
    ['sku', 'mpn', 'gtin13', 'gtin', 'model', 'color', 'material'].forEach((k) => {
      if (ld[k] && typeof ld[k] !== 'object') extra.push({ type: 'kv', k: k.toUpperCase().replace('GTIN13', 'GTIN'), text: clean(String(ld[k])) });
    });
  }

  // Drop sections whose text is fully contained in a larger one; merge same-name sections.
  const sig = (s) => s.blocks.map((b) => (b.k || '') + b.text).join(' ');
  const kept = sections.filter((s, i) => !sections.some((o, j) => j !== i && sig(o).length > sig(s).length && sig(o).includes(sig(s))));
  const merged = [];
  for (const s of kept) {
    const m = merged.find((x) => x.name === s.name);
    if (m) { const have = new Set(m.blocks.map((b) => b.type + (b.k || '') + b.text)); s.blocks.forEach((b) => !have.has(b.type + (b.k || '') + b.text) && m.blocks.push(b)); }
    else merged.push({ ...s });
  }
  if (extra.length) {
    const spec = merged.find((s) => s.name === 'Specifications') || (merged.push({ name: 'Specifications', heading: 'Specifications', blocks: [] }), merged[merged.length - 1]);
    const keys = new Set(spec.blocks.filter((b) => b.type === 'kv').map((b) => b.k.toLowerCase()));
    spec.blocks.unshift(...extra.filter((b) => !keys.has(b.k.toLowerCase())));
  }
  const ORDER = ['Features', 'Description', 'Details', 'Specifications', "What's in the box"];
  merged.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));

  // ---------- Images ----------
  const STOP = new Set('the and for with from this that new our your all buy online shop sale best price free shipping only pack set size color colour inch cm mm kg pcs piece'.split(' '));
  const tokens = (s) => [...new Set(clean(s).toLowerCase().split(/[^a-z0-9\u00c0-\uffff]+/).filter((w) => w.length > 2 && !STOP.has(w)))];
  const titleWords = tokens(title).slice(0, 8);

  function upgrade(u) {
    let x = u;
    x = x.replace(/\._[A-Za-z0-9_,\-]+_\.(jpe?g|png|webp|gif)/i, '.$1'); // Amazon ._AC_SX300_.jpg
    x = x.replace(/(\.(?:jpe?g|png|webp))_[^/]*$/i, '$1'); // AliExpress .jpg_350x350.jpg
    x = x.replace(/_(\d+x\d*|x\d+|small|medium|large|grande|compact|thumb|pico|icon)(_crop_[a-z]+)?(@\dx)?\.(jpe?g|png|webp|gif)/i, '.$4'); // Shopify
    x = x.replace(/-\d{2,4}x\d{2,4}\.(jpe?g|png|webp)/i, '.$1'); // WordPress/WooCommerce
    x = x.replace(/\/(thumb|thumbs|thumbnail|small|medium)\//i, '/large/');
    try {
      const U = new URL(x);
      ['w', 'h', 'width', 'height', 'wid', 'hei', 'size', 'resize', 'fit', 'crop', 'sw', 'sh', 'imwidth', 'imheight', 'odnWidth', 'odnHeight', 'dw', 'dh', 'sz'].forEach((p) => U.searchParams.delete(p));
      x = U.href;
    } catch {}
    return x;
  }
  const largestFromSrcset = (ss) => {
    if (!ss) return '';
    let best = '', bw = -1;
    ss.split(/,\s+(?=\S)/).forEach((part) => {
      const [u, d] = part.trim().split(/\s+/);
      const w = d ? parseFloat(d) * (d.endsWith('x') ? 1000 : 1) : 1;
      if (u && w > bw) { bw = w; best = u; }
    });
    return best;
  };
  const isImgUrl = (u) => /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i.test(u) || /\/images?\//i.test(u);
  const BAD_RE = /(logo|icon|sprite|avatar|badge|banner|payment|paypal|visa|mastercard|flag|rating|stars?[-_.]|social|facebook|twitter|instagram|placeholder|loader|loading|spinner|pixel|tracking|blank|transparent|1x1|play[-_]?button|qr[-_]?code)/i;
  const GALLERY_RE = /(gallery|carousel|slider|swiper|thumb|zoom|media|product[-_]?image|product[-_]?photo|pdp|main[-_]?image|image[-_]?block|fotorama|slick)/i;
  const OTHER_RE = /(related|recommend|similar|also[-_ ]?(bought|viewed|like)|upsell|cross[-_]?sell|recently|sponsored|review)/i;

  const cand = new Map();
  // Uses the image exactly as the page shows it (no zoom/"original" upgrades \u2014 those can be blurry upscales).
  // Other URLs (srcset, data-src, zoom) are kept only as fallbacks if the shown one fails to download.
  const add = (rawUrls, score, info) => {
    const ok = (u) => u && !/\/(undefined|null)([?#]|$)/.test(u) && !u.startsWith('data:') && !/\.svg(\?|$)/i.test(u);
    const urls = rawUrls.filter(Boolean).map(abs).filter(ok);
    const s0 = info.shown ? abs(info.shown) : '';
    const shown = ok(s0) ? s0 : '';
    if (!urls.length && !shown) return;
    const first = shown || urls[0];
    const key = upgrade(first).split(/[?#]/)[0].toLowerCase().replace('/image/cache/', '/image/'); // only for de-duplication
    const fallbacks = [...new Set([first, ...urls])];
    const c = cand.get(key);
    if (c) {
      c.score = Math.max(c.score, score) + (c.seen ? 0 : 3); // seen in several places \u2192 more likely a product image
      c.seen = true;
      if (shown && !c.fromPage) { c.url = shown; c.thumb = shown; c.fromPage = true; c.fallbacks = [shown, ...c.fallbacks.filter((u) => u !== shown)]; }
      c.fallbacks = [...new Set([...c.fallbacks, ...fallbacks])];
    } else cand.set(key, { key, url: first, fallbacks, score, thumb: first, alt: info.alt || '', fromPage: !!shown });
  };

  if (ld) {
    [].concat(ld.image || []).forEach((im) => {
      const u = typeof im === 'string' ? im : im && (im.contentUrl || im.url);
      if (u) add([u], 60, { alt: title });
    });
  }
  const og = meta('og:image') || meta('og:image:secure_url');
  if (og) add([og], 35, { alt: title });
  if (micro) micro.querySelectorAll('[itemprop="image"]').forEach((m) => add([m.getAttribute('content') || m.getAttribute('src') || m.getAttribute('href')], 50, { alt: title }));

  const ancestorsInfo = (el) => {
    let s = '', n = el, i = 0;
    while (n && n !== document.body && i < 8) { s += ` ${n.id || ''} ${typeof n.className === 'string' ? n.className : ''}`; n = n.parentElement; i++; }
    return s;
  };

  for (const img of document.querySelectorAll('img, picture source')) {
    const isSource = img.tagName === 'SOURCE';
    const el = isSource ? img.parentElement.querySelector('img') || img : img;
    let dyn = '';
    const dj = img.getAttribute('data-a-dynamic-image');
    if (dj) { try { const o = JSON.parse(dj); dyn = Object.keys(o).sort((a, b) => o[b][0] * o[b][1] - o[a][0] * o[a][1])[0]; } catch {} }
    const link = img.closest('a') && img.closest('a').getAttribute('href');
    const urls = [
      img.getAttribute('data-old-hires'), dyn, img.getAttribute('data-zoom-image'), img.getAttribute('data-zoom'), img.getAttribute('data-large_image'),
      img.getAttribute('data-large'), img.getAttribute('data-full'), img.getAttribute('data-hires'), img.getAttribute('data-original'),
      link && isImgUrl(link) ? link : '',
      largestFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset')),
      img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-lazy'),
      !isSource && img.currentSrc, !isSource && img.getAttribute('src'),
    ];
    if (!urls.some(Boolean)) continue;
    const anc = ancestorsInfo(el);
    const text = `${el.getAttribute('alt') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''} ${urls.filter(Boolean)[0].split('/').pop().split('?')[0]}`;
    const words = tokens(text);
    const matched = titleWords.filter((w) => words.some((x) => x === w || (w.length > 4 && x.includes(w)))).length;
    const ratio = titleWords.length ? matched / Math.min(titleWords.length, 5) : 0;
    let score = Math.min(ratio, 1) * 45;
    if (GALLERY_RE.test(anc)) score += 18;
    const w = Math.max(el.naturalWidth || 0, el.width || 0), h = Math.max(el.naturalHeight || 0, el.height || 0);
    if (Math.max(w, h) >= 300) score += 10;
    else if (w && h && Math.max(w, h) < 90 && !GALLERY_RE.test(anc)) score -= 25;
    if (el.closest(CHROME)) score -= 40;
    if (BAD_RE.test(`${urls.filter(Boolean).join(' ')} ${el.className} ${el.getAttribute('alt') || ''}`)) score -= 50;
    if (OTHER_RE.test(anc)) score -= 35;
    add(urls, score, { shown: isSource ? '' : el.currentSrc || el.getAttribute('src'), alt: el.getAttribute('alt') || '' });
  }

  const images = [...cand.values()]
    .filter((c) => c.score > -20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)
    .map((c, i, arr) => ({ key: c.key, url: c.url, fallbacks: c.fallbacks, thumb: c.thumb, alt: c.alt, score: c.score, selected: c.score >= Math.max(35, arr[0].score - 25) }));
  if (images.length && !images.some((i) => i.selected)) images[0].selected = true;

  return { url: location.href, site: location.hostname, title, price, sections: merged, images, capturedAt: new Date().toISOString() };
})();
