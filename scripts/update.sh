#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "Обновление NeuroFlow Production"
echo "=========================================================="

cd /opt/neuroflow

# 1. Автоматический бэкап перед обновлением
if [ -f "/opt/neuroflow/scripts/backup.sh" ]; then
    echo "1/4 Создание контрольного бэкапа перед обновлением..."
    bash /opt/neuroflow/scripts/backup.sh
fi

# 2. Получение свежего кода из git
echo "2/4 Получение актуальной версии из Git..."
git pull origin master

# 3. Сборка контейнеров
echo "3/4 Сборка обновленных контейнеров..."
docker compose -f docker-compose.prod.yml -p neuroflow build

# 4. Безопасный перезапуск сервисов (без простоя PostgreSQL и Redis)
echo "4/4 Перезапуск приложений (api, worker, web)..."
docker compose -f docker-compose.prod.yml -p neuroflow up -d --remove-orphans

echo "Проверка статуса сервисов:"
docker ps --filter "name=neuroflow"

echo "=========================================================="
echo "Обновление NeuroFlow завершено успешно!"
echo "=========================================================="
