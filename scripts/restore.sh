#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Использование: $0 /opt/neuroflow/backups/neuroflow_db_YYYYMMDD_HHMMSS.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Ошибка: Файл бэкапа не найден: $BACKUP_FILE"
    exit 1
fi

echo "ВНИМАНИЕ: Восстановление базы данных заменит текущие данные NeuroFlow!"
read -p "Продолжить восстановление? (y/N): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Отмена операции."
    exit 0
fi

echo "Остановка приложений api и worker перед восстановлением..."
docker compose -f /opt/neuroflow/docker-compose.prod.yml -p neuroflow stop api worker

echo "Восстановление схемы и данных PostgreSQL..."
gunzip -c "$BACKUP_FILE" | docker exec -i neuroflow-postgres psql -U neuroflow -d neuroflow

echo "Запуск приложений..."
docker compose -f /opt/neuroflow/docker-compose.prod.yml -p neuroflow start api worker

echo "Восстановление успешно завершено!"
