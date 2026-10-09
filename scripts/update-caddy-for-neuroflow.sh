#!/usr/bin/env bash
set -euo pipefail

CADDYFILE="/opt/zapisflow/web-deploy/gateway.Caddyfile"
BACKUP="${CADDYFILE}.backup.pre-neuroflow"

if [ ! -f "$BACKUP" ]; then
    echo "Создание контрольного бэкапа перед модификацией..."
    cp "$CADDYFILE" "$BACKUP"
fi

# Подключение zapisflow-caddy-1 к сети neuroflow_public
if docker network inspect neuroflow_public >/dev/null 2>&1; then
    if ! docker inspect zapisflow-caddy-1 --format '{{json .NetworkSettings.Networks}}' | grep -q "neuroflow_public"; then
        echo "Подключение контейнера zapisflow-caddy-1 к сети neuroflow_public..."
        docker network connect neuroflow_public zapisflow-caddy-1
    else
        echo "zapisflow-caddy-1 уже подключен к neuroflow_public."
    fi
else
    echo "Сеть neuroflow_public еще не создана. Создаем ее..."
    docker network create neuroflow_public
    docker network connect neuroflow_public zapisflow-caddy-1
fi

# Добавление блока neuro.zapisflow.su в Caddyfile
if ! grep -q "neuro.zapisflow.su" "$CADDYFILE"; then
    echo "Добавление виртуального хоста neuro.zapisflow.su в Caddyfile..."
    cat << 'EOF' >> "$CADDYFILE"

# ==============================================================================
# NeuroFlow Self-Hosted AI Platform (Isolated Deployment)
# ==============================================================================
neuro.zapisflow.su {
	log {
		output stdout
		format json
		level INFO
	}

	request_body {
		max_size 10MB
	}

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "SAMEORIGIN"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}

	# API Endpoints, Documentation & Healthchecks
	@api path /api/* /healthz /documentation*
	handle @api {
		reverse_proxy http://neuroflow-api:4000 {
			header_up Host {host}
			header_up X-Real-IP {remote_host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
		}
	}

	# Next.js Web Frontend & Assets
	handle {
		reverse_proxy http://neuroflow-web:3000 {
			header_up Host {host}
			header_up X-Real-IP {remote_host}
			header_up X-Forwarded-For {remote_host}
			header_up X-Forwarded-Proto {scheme}
		}
	}
}
EOF
else
    echo "Блок neuro.zapisflow.su уже присутствует в Caddyfile."
fi

# Валидация Caddyfile
echo "Проверка конфигурации Caddy (caddy validate)..."
if docker exec zapisflow-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
    echo "Валидация успешна! Выполняем мягкий reload Caddy..."
    docker exec zapisflow-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    echo "CADDY_RELOAD_SUCCESS"
else
    echo "ОШИБКА ВАЛИДАЦИИ CADDY! Откатываемся к резервной копии..."
    cp "$BACKUP" "$CADDYFILE"
    docker exec zapisflow-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    exit 1
fi
