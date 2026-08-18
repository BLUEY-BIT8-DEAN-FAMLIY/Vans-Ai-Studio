#!/usr/bin/env bash
# Vans AI Studio - one-line installer for macOS / Linux
# Usage:  curl -fsSL https://raw.githubusercontent.com/BLUEY-BIT8-DEAN-FAMLIY/Vans-Ai-Studio/main/installers/install.sh | bash
# Afterwards just run:  vurs
set -e
OWNER="BLUEY-BIT8-DEAN-FAMLIY"
REPO="Vans-Ai-Studio"
DIR="$HOME/.vans-ai-studio"
BIN="$HOME/.local/bin"
mkdir -p "$DIR" "$BIN"
WEB="https://$(echo "$OWNER" | tr '[:upper:]' '[:lower:]').github.io/$REPO/"
OS="$(uname -s)"

echo ""
echo "  Vans AI Studio installer"
echo "  ------------------------"

APP=""
if [ "$OS" = "Darwin" ]; then PAT="mac.dmg"; else PAT="AppImage"; fi
URL=$(curl -fsSL "https://api.github.com/repos/$OWNER/$REPO/releases/latest" 2>/dev/null \
      | grep browser_download_url | grep -i "$PAT" | head -1 | cut -d '"' -f 4 || true)

if [ -n "$URL" ]; then
  FILE="$DIR/VansAiStudio.${PAT##*.}"
  echo "  downloading $(basename "$URL") ..."
  curl -fsSL -o "$FILE" "$URL"
  if [ "$OS" != "Darwin" ]; then chmod +x "$FILE"; fi
  APP="$FILE"
  echo "  desktop app installed."
else
  echo "  release not available yet - vurs will open the web version."
fi

cat > "$BIN/vurs" <<EOF
#!/usr/bin/env bash
if [ "\$1" = "web" ]; then
  (open "$WEB" 2>/dev/null || xdg-open "$WEB" 2>/dev/null || echo "Open: $WEB"); exit 0
fi
if [ -n "$APP" ] && [ -e "$APP" ]; then
  case "$APP" in
    *.dmg) open "$APP" ;;
    *) "$APP" ;;
  esac
else
  (open "$WEB" 2>/dev/null || xdg-open "$WEB" 2>/dev/null || echo "Open: $WEB")
fi
EOF
chmod +x "$BIN/vurs"

case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo "  note: add $BIN to your PATH (e.g. echo 'export PATH=\$PATH:$BIN' >> ~/.bashrc)" ;;
esac

echo ""
echo "  Done! Run:  vurs"
echo ""
