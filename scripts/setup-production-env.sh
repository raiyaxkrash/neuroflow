#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/neuroflow/.env"

if [ -f "$ENV_FILE" ]; then
    echo "Создаем резервную копию существующего .env..."
    cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"
fi

PG_PASS=$(openssl rand -hex 20)
JWT_SEC=$(openssl rand -hex 32)
ENC_KEY=$(openssl rand -hex 32)
ADM_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9!@#%^&*')

cat <<EOF > "$ENV_FILE"
# ==============================================================================
# NEUROFLOW PRODUCTION CONFIGURATION (ISOLATED)
# ==============================================================================
NODE_ENV=production
APP_ENV=production
PORT=4000
HOST=0.0.0.0

# Database Configuration (NeuroFlow Isolated Postgres)
POSTGRES_USER=neuroflow
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=neuroflow
DATABASE_URL=postgresql://neuroflow:${PG_PASS}@postgres:5432/neuroflow

# Redis Configuration (NeuroFlow Isolated Redis)
REDIS_URL=redis://redis:6379

# Cryptography & Security
JWT_SECRET=${JWT_SEC}
ENCRYPTION_KEY=${ENC_KEY}
ADMIN_EMAIL=owner@neuro.zapisflow.su
ADMIN_PASSWORD=${ADM_PASS}

# Domain & Public URL
PUBLIC_URL=https://neuro.zapisflow.su
WEB_URL=https://neuro.zapisflow.su
NEXT_PUBLIC_API_URL=

# Concurrency & Workflows
WORKER_CONCURRENCY=3
EXECUTION_TIMEOUT_MS=60000
HTTP_REQUEST_TIMEOUT_MS=10000
HTTP_REQUEST_MAX_SIZE_BYTES=5242880
EOF

chmod 600 "$ENV_FILE"
echo "ENV_GENERATED_SUCCESSFULLY"
