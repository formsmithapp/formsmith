#!/bin/sh
# Formsmith one-command self-host installer.
#
# What it does (nothing hidden, read it top to bottom):
#   1. checks you have Docker + Docker Compose and a running daemon
#   2. creates a ./formsmith directory
#   3. downloads compose.yml (web + postgres) from this repo
#   4. generates BETTER_AUTH_SECRET + POSTGRES_PASSWORD into .env (once)
#   5. runs `docker compose up -d` and waits for health
#
# It installs nothing on your system, changes nothing outside ./formsmith,
# needs no root beyond whatever your Docker setup needs, and sends NO telemetry.
# Everything it starts is the same two containers as the manual quickstart.
#
# Source (review before running): https://github.com/formsmithapp/formsmith/blob/main/install.sh
# Prefer to read first?  curl -fsSL https://get.formsmith.app/install.sh -o install.sh && less install.sh && sh install.sh
#
# Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
# SPDX-License-Identifier: AGPL-3.0-only

set -eu

DIR="${FORMSMITH_DIR:-formsmith}"
REF="${FORMSMITH_REF:-main}"
PORT="${FORMSMITH_PORT:-3000}"
COMPOSE_URL="https://raw.githubusercontent.com/formsmithapp/formsmith/${REF}/compose.yml"

say()  { printf '  %s\n' "$*"; }
die()  { printf '\n  error: %s\n' "$*" >&2; exit 1; }

printf '\n  Formsmith installer\n  Beautiful conversational forms you actually own.\n\n'

# 1. prerequisites
command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/get-docker/"
command -v curl   >/dev/null 2>&1 || die "curl is required but was not found."
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  die "Docker Compose was not found. Install Docker Compose v2 (see https://docs.docker.com/compose/)."
fi
docker info >/dev/null 2>&1 || die "Cannot reach the Docker daemon. Is it running, and are you in the 'docker' group (or using sudo)?"

# secret generators, openssl preferred, /dev/urandom fallback
rand_b64() { openssl rand -base64 "$1" 2>/dev/null || head -c "$1" /dev/urandom | base64 | tr -d '\n'; }
rand_hex() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# 2. workdir
mkdir -p "$DIR"
cd "$DIR"

# 3. compose.yml
say "Fetching compose.yml ..."
curl -fsSL "$COMPOSE_URL" -o compose.yml || die "Could not download compose.yml from $COMPOSE_URL"

# 4. .env, generate secrets once, never clobber an existing file
if [ -f .env ]; then
  say ".env already exists, keeping your existing secrets."
else
  say "Generating secrets into .env ..."
  {
    printf 'BETTER_AUTH_SECRET=%s\n' "$(rand_b64 32)"
    printf 'POSTGRES_PASSWORD=%s\n'  "$(rand_hex 24)"
    printf 'FORMSMITH_PORT=%s\n'     "$PORT"
  } > .env
  chmod 600 .env
fi

# 5. start
say "Starting Formsmith (web + postgres) ..."
$DC up -d

# 6. wait for health
say "Waiting for Formsmith to come up ..."
i=0
until curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 90 ] && die "Timed out waiting for health. Check the logs: (cd $DIR && $DC logs)"
  sleep 2
done

# 7. done
cat <<EOF

  Formsmith is running: http://localhost:${PORT}
  Open it, sign up, and publish your first form.

  Next steps
    - Put it behind HTTPS with your reverse proxy and set FORMSMITH_URL.
    - Full guide: https://github.com/formsmithapp/formsmith/blob/main/docs/self-hosting.md
    - Manage it from ./${DIR}:  ${DC} ps  |  ${DC} logs -f  |  ${DC} down

EOF
