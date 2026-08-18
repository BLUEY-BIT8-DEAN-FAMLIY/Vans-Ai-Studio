#!/usr/bin/env bash
# Vans AI Studio - open the web version locally (macOS / Linux)
cd "$(dirname "$0")/app" || exit 1
PORT=8765
URL="http://localhost:$PORT"
( sleep 1
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  else echo "Open $URL in your browser"; fi ) &
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  python -m SimpleHTTPServer "$PORT"
else
  echo "Python not found - open app/index.html directly in a browser."
fi
