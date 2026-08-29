#!/bin/sh
set -e

# Apply database migrations before starting the app.
alembic upgrade head

exec "$@"
