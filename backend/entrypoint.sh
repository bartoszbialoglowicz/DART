#!/bin/sh
set -eu

python - <<'PY'
import os, socket, time
host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
for _ in range(30):
    try:
        socket.create_connection((host, port), timeout=1).close()
        break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit(f"Database at {host}:{port} not reachable after 30s")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"
