#!/bin/sh
set -e

echo "[LeadRadar] Starting..."

# Apply database migrations
echo "[LeadRadar] Applying database migrations..."
node -e "
import('dotenv/config').then(() => {
  import('./dist/index.js').catch(() => {});
});
" 2>/dev/null || true

# Run migrations via drizzle-kit if available
if [ -f "./node_modules/.bin/drizzle-kit" ]; then
  npx drizzle-kit migrate 2>/dev/null || echo "[LeadRadar] Migration skipped (DB may not be ready yet)"
fi

# Start the server
echo "[LeadRadar] Starting server on port ${PORT:-3000}..."
exec node dist/index.js
