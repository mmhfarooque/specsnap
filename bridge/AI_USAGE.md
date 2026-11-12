# SpecSnap — instructions for AI agents (Claude Code, Codex, Gemini CLI, …)

Use the `specsnap` command to turn an e-commerce product page into a PDF (and/or structured JSON).
It drives the user's real Chrome through the SpecSnap Chrome extension, so it works on
sites that need JavaScript, cookies or a logged-in session.

## Commands
```bash
specsnap --status                         # check Chrome + extension are connected (exit 0 = ok)
specsnap "<product-url>"                  # PDF saved in current dir; prints the absolute path on stdout
specsnap "<product-url>" -o /abs/path.pdf # exact output file (add --overwrite to replace)
specsnap "<product-url>" -d /abs/dir      # choose output directory
specsnap "<product-url>" --extract        # JSON only: title, price, sections[], images[] — no PDF
specsnap "<product-url>" --json           # PDF + full JSON result on stdout
specsnap --current                        # capture the tab the user is looking at in Chrome
```
Options: `--all-images`, `--images-per-page 1|2|4`, `--max-px N` (0 = no downscale),
`--wait SECONDS` (extra wait after load for JS content, default 2.5), `--keep-tab`.

## Output
- Success: stdout = PDF path (one line); a one-line summary goes to stderr. Exit code 0.
- `--extract` / `--json`: JSON `{ ok, file?, filename, size, images:[{url,width,height}], failedImages, data:{ url, site, title, price, sections:[{name, heading, blocks:[{li}|{p}|{h}|{k,v}]}], images:[{url,selected}] } }`
- Failure: message on stderr, exit code 1.

## Notes
- **File name:** use `-d <folder>` so the PDF is named after the product title (`<title> - <date>.pdf`). Only use `-o` when the user gives an exact file name; never invent one (e.g. a project or brand name).
- **Images:** SpecSnap saves images exactly as the page shows them and never enlarges them in the PDF. Don't fetch "hi-res"/zoom versions; they are usually upscaled copies of the same picture.
- Chrome must be running with the extension enabled. If `specsnap --status` fails, ask the user to open Chrome.
- A background tab opens briefly and closes itself.
- To read the result, use `--extract` (cheaper than parsing the PDF).
- `Operation not permitted` on 127.0.0.1:8777 means *your* sandbox blocks localhost (e.g. Codex CLI), not that SpecSnap is down. Tell the user; don't try to change sandbox settings yourself. See README → "Codex CLI".

## Raw HTTP API (if you can't run the CLI)
`127.0.0.1:8777` (port in `~/.config/productcapture/config.json`), header `X-Token: $(cat ~/.config/productcapture/token)`
- `GET /status`
- `POST /capture` `{"url": "...", "out": "/abs/file.pdf" | "out_dir": "/abs/dir", "current": false, "opts": {"allImages": false, "imagesPerPage": 1, "maxImagePx": 3000, "wait": 2500}}`
- `POST /extract` same body without out → JSON
