# LOG

## 2026-11-12 — v1.0.0 built
- MV3 side-panel extension, generic extractor, jsPDF output, 3 save modes.
- Tested headless: mock page, StarTech (Acer laptop, Hikvision DS-D5B55RB/EL — features/desc/57-row spec, BDT price, 1000×1000 original via OpenCart upgrade), Allbirds (Shopify, JSON-LD price + gallery).
- Not yet tested: loaded as real extension in Chrome (side panel, folder picker, save). Amazon blocked headless.

## 2026-11-12 — images: use as shown on page
- User request: don't force high-res; zoom/"original" versions can be blurry upscales.
- extractor.js now takes each image's displayed URL (currentSrc/src); srcset/zoom/data-src only as download fallbacks. upgrade() kept only for de-duplication.

## 2026-11-12 — v1.1.0 terminal / AI bridge
- Native messaging host `bridge/host.py` + `pcap` CLI + `install.sh`; HTTP API on 127.0.0.1:8777 with token.
- manifest: fixed `key` (ID haladpoicgmbenfflejlcgjmlgjompik), perms nativeMessaging/offscreen/alarms.
- images.js shared loader; offscreen doc builds PDF for API calls.
- Fixed: literal U+FFFF in extractor.js made Chrome reject the file ("isn't UTF-8") — all JS now ASCII-only with \u escapes.
- Tested end-to-end in headless Chrome (extension loaded via CDP Extensions.loadUnpacked): Allbirds (8 imgs, 7 s), StarTech Hikvision (4-page PDF, 6 s), --extract JSON.

## 2026-11-12 — v1.2.0 SpecSnap, public release
- Renamed to **SpecSnap – Product Page to PDF**; CLI `specsnap` (alias `pcap`). Internal host name stays `com.productcapture.host`.
- Cross-platform bridge: install.sh (Linux + macOS; Chrome/Chromium/Brave/Edge/Vivaldi), install.ps1 + host.bat + specsnap.cmd (Windows, HKCU registry). Windows/macOS installers NOT tested yet.
- MIT LICENSE © Mahmud Farooque (mfaruk.com); public repo github.com/mmhfarooque/specsnap.
- Blog draft + featured image (SDXL background via ~/Projects/AI + HTML diagram overlay) in blog/ (git-ignored, local only).

## 2026-11-12 — blog draft
- mfaruk.com draft post #22 created; working files in ~/Projects/articles/specsnap (article.html, meta.md, images, insert.php, LOG.md).
- 2026-11-12: blog post PUBLISHED by Mahmud: https://mfaruk.com/blog/save-product-page-as-pdf-chrome-extension-specsnap (verified live: SEO, OG, JSON-LD, images, sitemap). README links it.

## 2026-11-12 — Codex CLI sandbox workaround
- First real (non-headless) install: user loaded unpacked in Chrome; ID matches, bridge `specsnap --status` ok.
- Codex CLI 0.167 failed with `urlopen error [Errno 1] Operation not permitted`: Codex sandbox blocks network incl. 127.0.0.1; session was `read-only` (launched from ~, untrusted).
- Fix (user applied): `~/.codex/config.toml` top-level `sandbox_mode = "workspace-write"` + `[sandbox_workspace_write] network_access = true`, then quit Codex + `pkill -f 'codex app-server'` (daemon keeps old config). Working after that.
- Gotchas: `sandbox_mode` must be before any [table]; duplicate key breaks Codex startup. Backup at ~/.codex/config.toml.bak.
- Documented in README ("Codex CLI"), bridge/AI_USAGE.md, and the live blog post (new h3 + FAQ line).

## 2026-11-12 — v1.2.1 images never enlarged; title file names for agents
- pdf.js `fit()` capped at native size (1 px = 25.4/96 mm): a 500 px image was stretched to full page width (71 ppi) on the "Product images" page; now 96 ppi.
- AI_USAGE.md: agents must use `-d <folder>` (title-based name); `-o` only with a user-given name. Codex had named a StarTech METZ 65HD1 PDF "ARMOR.pdf".
- Verified in user's Chrome (v1.2.1): METZ 65HD1 page -> 4-page PDF, image 500x500 at 96 ppi, file "<title> - 2026-11-12.pdf" in ~/Projects/Durbin Solutions/ProductInfo.

## 2026-11-12 — v1.3.0 Save as… + About
- Side panel: **Save as…** button (Save As dialog for this PDF only, default unchanged); "Saving to …" line is now a link to Settings. Status text no longer says "high-resolution".
- Settings: About card — Mahmud Farooque, mfaruk.com, linkedin.com/in/mmhfarooque, GitHub. Allowed under Chrome Web Store policy (own UI only; nothing injected into pages or PDFs).
- README features updated. Blog text updated locally (articles/specsnap/article.html) but NOT yet pushed live — waiting for user to test v1.3.0 in Chrome.
- Checked: JS ASCII-only, panel.js parses (headless Chrome). NOT yet clicked in the real panel.
