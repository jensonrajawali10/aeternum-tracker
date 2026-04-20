#!/usr/bin/env bash
# Push env vars from .env.local to Vercel production.
# Skips placeholders (REPLACE_WITH_*) and empties. Overwrites if exists.
set -e
export PATH="/c/Program Files/nodejs:/c/Users/JENSON RADJAWALI/AppData/Roaming/npm:$PATH"
cd "$(dirname "$0")"

push() {
  local key="$1"
  local val="$2"
  if [ -z "$val" ] || [[ "$val" == REPLACE_WITH_* ]]; then
    echo "SKIP  $key  (empty or placeholder)"
    return
  fi
  # Remove existing then add. printf '%s' = NO trailing newline (Vercel preserves it).
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  local out
  out=$(printf '%s' "$val" | vercel env add "$key" production 2>&1)
  if echo "$out" | grep -q "Added Environment Variable"; then
    echo "OK    $key"
  else
    echo "FAIL  $key  -- $out"
  fi
}

# Load .env.local manually (handle spaces, quotes, equals in values)
while IFS= read -r line || [ -n "$line" ]; do
  # Strip trailing CR (Windows line endings)
  line="${line%$'\r'}"
  # Skip comments and blanks
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  # Split key=value on first '='
  key="${line%%=*}"
  val="${line#*=}"
  key="${key// /}"
  # Strip surrounding quotes if any
  val="${val%\"}"; val="${val#\"}"
  push "$key" "$val"
done < .env.local

echo "---"
echo "Done. Vercel env list (production):"
vercel env ls production 2>&1 | head -30
