#!/usr/bin/env bash
# Starts the static server (port 8765) and a Cloudflare quick tunnel, then prints the public URL.
# Usage: bash /workspace/disappearing-chess/start.sh
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG=/tmp/dmuysi
mkdir -p "$LOG"
CF="$(command -v cloudflared || echo "$HOME/bin/cloudflared")"
if ! curl -s -o /dev/null http://127.0.0.1:8765/; then
  (cd "$DIR" && nohup setsid python3 -m http.server 8765 --bind 127.0.0.1 > "$LOG/server.log" 2>&1 &)
  sleep 1
fi
pkill -f "cloudflared tunnel --url http://127.0.0.1:8765" 2>/dev/null
nohup setsid "$CF" tunnel --no-autoupdate --url http://127.0.0.1:8765 > "$LOG/tunnel.log" 2>&1 &
for i in $(seq 1 30); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG/tunnel.log" | head -1)
  [ -n "$URL" ] && break; sleep 1
done
echo "${URL:-Tunnel URL not found yet; check $LOG/tunnel.log}"
