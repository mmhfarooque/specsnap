#!/bin/bash
# SpecSnap terminal/AI bridge installer for Linux and macOS.
# Registers the native-messaging host for Chrome, Chromium, Brave, Edge and Vivaldi, and installs the `specsnap` CLI.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ID="haladpoicgmbenfflejlcgjmlgjompik"   # fixed by the "key" in manifest.json
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
chmod +x "$DIR/host.py" "$DIR/specsnap"

if [ "$(uname)" = "Darwin" ]; then
  BASE="$HOME/Library/Application Support"
  BROWSERS=("Google/Chrome" "Google/Chrome Beta" "Chromium" "BraveSoftware/Brave-Browser" "Microsoft Edge" "Vivaldi")
else
  BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
  BROWSERS=("google-chrome" "google-chrome-beta" "chromium" "BraveSoftware/Brave-Browser" "microsoft-edge" "vivaldi")
fi

n=0
for B in "${BROWSERS[@]}"; do
  [ -d "$BASE/$B" ] || continue
  D="$BASE/$B/NativeMessagingHosts"
  mkdir -p "$D"
  cat > "$D/com.productcapture.host.json" <<JSON
{
  "name": "com.productcapture.host",
  "description": "SpecSnap terminal bridge",
  "path": "$DIR/host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$ID/"]
}
JSON
  echo "✓ registered for $B"; n=$((n+1))
done
[ $n -gt 0 ] || echo "! no Chromium-based browser profile found – start your browser once, then re-run"

mkdir -p "$HOME/.local/bin" "$HOME/.config/productcapture"
ln -sf "$DIR/specsnap" "$HOME/.local/bin/specsnap"
ln -sf "$DIR/specsnap" "$HOME/.local/bin/pcap"     # short alias
[ -f "$HOME/.config/productcapture/token" ] || { python3 -c "import secrets;print(secrets.token_hex(24))" > "$HOME/.config/productcapture/token"; chmod 600 "$HOME/.config/productcapture/token"; }
echo "✓ CLI installed: ~/.local/bin/specsnap (alias: pcap)"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "! add ~/.local/bin to your PATH";; esac
echo "Next: load/reload the extension (ID $ID), then run: specsnap --status"
