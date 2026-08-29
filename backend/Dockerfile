# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies:
#   ffmpeg     - clip render / 9:16 reframe / yt-dlp muxing
#   gcc        - build native Python wheels
#   libpq-dev  - psycopg2 build headers
#   curl/unzip - healthcheck + deno download
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg gcc libpq-dev curl unzip \
    && rm -rf /var/lib/apt/lists/*

# deno: JavaScript runtime yt-dlp needs to solve YouTube's signature challenges.
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) DENO_ARCH=x86_64-unknown-linux-gnu ;; \
      arm64) DENO_ARCH=aarch64-unknown-linux-gnu ;; \
      *) echo "unsupported arch" && exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/denoland/deno/releases/latest/download/deno-${DENO_ARCH}.zip" -o /tmp/deno.zip; \
    unzip -o /tmp/deno.zip -d /usr/local/bin; \
    rm /tmp/deno.zip; \
    chmod +x /usr/local/bin/deno; \
    deno --version

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
