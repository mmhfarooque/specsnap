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
