# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies:
#   ffmpeg     - clip render / 9:16 reframe
#   gcc        - build native Python wheels
#   libpq-dev  - psycopg2 build headers
#   curl       - container healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code + migrations
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Non-root runtime user. Pre-create the cache dir so the `whispercache` named
# volume inherits appuser ownership (Docker seeds a fresh volume from this path).
RUN useradd --create-home --shell /bin/sh appuser \
    && mkdir -p /home/appuser/.cache \
    && chown -R appuser:appuser /app /home/appuser/.cache
ENV HF_HOME=/home/appuser/.cache/huggingface \
    XDG_CACHE_HOME=/home/appuser/.cache
USER appuser

EXPOSE 8000

# entrypoint.sh (runs `alembic upgrade head` then exec's the command) is opt-in
# per-service via compose; the worker/beat services skip it and just run celery.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
