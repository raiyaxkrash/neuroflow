#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/neuroflow/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP_FILE="${BACKUP_DIR}/neuroflow_db_${TIMESTAMP}.sql.gz"
ENV_BACKUP_FILE="${BACKUP_DIR}/neuroflow_env_${TIMESTAMP}.bak"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Запуск резервного копирования NeuroFlow..."

# 1. Дамп PostgreSQL NeuroFlow
if docker ps --format '{{.Names}}' | grep -q "^neuroflow-postgres$"; then
    echo "Создание дампа базы данных neuroflow..."
    docker exec neuroflow-postgres pg_dump -U neuroflow -d neuroflow | gzip > "$DB_BACKUP_FILE"
    chmod 600 "$DB_BACKUP_FILE"
    echo "✓ Дамп базы данных сохранен: $DB_BACKUP_FILE"
else
    echo "Предупреждение: Контейнер neuroflow-postgres не запущен, дамп БД пропущен."
fi

# 2. Резервная копия конфигурации .env
if [ -f "/opt/neuroflow/.env" ]; then
    cp "/opt/neuroflow/.env" "$ENV_BACKUP_FILE"
    chmod 600 "$ENV_BACKUP_FILE"
    echo "✓ Конфигурация .env сохранена: $ENV_BACKUP_FILE"
fi

# 3. Ротация старых бэкапов (хранить 14 дней)
find "$BACKUP_DIR" -type f -name "neuroflow_*" -mtime +14 -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Резервное копирование успешно завершено!"
