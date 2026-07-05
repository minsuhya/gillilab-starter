#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Kills pid and all of its descendants. Kills the parent first so
# reloader/supervisor processes (uvicorn --reload, next dev) can't
# respawn a worker in the gap between killing a child and its parent.
kill_tree() {
  local pid="$1"
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  kill -9 "$pid" 2>/dev/null || true
  for child in $children; do
    kill_tree "$child"
  done
}

cleanup() {
  echo ""
  echo "Stopping dev servers..."
  kill_tree "$BACKEND_PID"
  kill_tree "$FRONTEND_PID"
}
trap cleanup EXIT INT TERM

echo "Backend:  http://localhost:8005"
echo "Frontend: http://localhost:3005"
echo "Press Ctrl+C to stop both."
echo ""

(
  cd backend
  APP_ENV=development CORS_ORIGINS=http://localhost:3005 \
    uv run uvicorn app.main:app --reload --port 8005 2>&1 \
    | while IFS= read -r line; do echo "[backend] $line"; done
) &
BACKEND_PID=$!

(
  cd frontend
  NEXT_PUBLIC_API_URL=http://localhost:8005 \
    npm run dev -- -p 3005 2>&1 \
    | while IFS= read -r line; do echo "[frontend] $line"; done
) &
FRONTEND_PID=$!

wait
