#!/usr/bin/env bash
# One-shot Vercel deploy — no GitHub required.
#
# Uploads this folder straight to Vercel, pushes every value from your local
# .env into the project, then builds. Run it from the project root:
#
#   bash scripts/deploy.sh
#
# Re-run it any time to ship changes.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "✗ No .env found in $(pwd) — copy .env.example to .env and fill it in first."
  exit 1
fi

echo "▸ Linking project (a browser window will open the first time)…"
npx --yes vercel@latest link --yes

echo
echo "▸ Uploading environment variables from .env…"
# VITE_* values are inlined at BUILD time, so they must exist before the build.
while IFS= read -r line || [ -n "$line" ]; do
  # skip blanks and comments
  case "$line" in ''|\#*) continue ;; esac
  key=${line%%=*}
  val=${line#*=}
  # strip surrounding quotes and whitespace
  key=$(printf '%s' "$key" | tr -d '[:space:]')
  val=$(printf '%s' "$val" | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')
  [ -z "$key" ] && continue
  [ -z "$val" ] && { echo "  · skip $key (empty)"; continue; }

  for env in production preview; do
    # remove any existing value so re-runs update instead of erroring
    npx --yes vercel@latest env rm "$key" "$env" --yes >/dev/null 2>&1 || true
    printf '%s' "$val" | npx --yes vercel@latest env add "$key" "$env" >/dev/null 2>&1 \
      && echo "  ✓ $key → $env" \
      || echo "  ✗ $key → $env (failed)"
  done
done < .env

echo
echo "▸ Deploying to production…"
npx --yes vercel@latest deploy --prod

echo
echo "✅ Done. Share the URL above with your friends."
echo "   Reminder: turn OFF 'Confirm email' in Supabase → Authentication,"
echo "   and set your caps in Admin → Limits before sharing widely."
