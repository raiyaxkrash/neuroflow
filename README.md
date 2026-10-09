# NeuroFlow — Next-Gen Self-Hosted Automation Platform

**NeuroFlow** — профессиональная платформа оркестрации и визуальной автоматизации рабочих процессов с собственным движком выполнения (Workflow Engine), расширяемым реестром блоков и архитектурной готовностью к подключению автономных AI-агентов.

Проект разработан как масштабируемый self-hosted SaaS-продукт с первоклассным инженерным интерфейсом в стиле **Linear**, **Vercel** и **Raycast**.

---

## 🚀 Ключевые возможности (Phase 1)

1. **Визуальный редактор сценариев (Workflow Editor)**:
   - Бесконечный интерактивный холст на базе `@xyflow/react` (React Flow) с точечной сеткой, масштабированием и мини-картой.
   - Drag & Drop добавление узлов из каталога.
   - Поддержка удаления, дублирования (Ctrl+D), истории отмены/повтора (Undo / Redo Ctrl+Z / Ctrl+Y).
   - Автоматическое сохранение графа в базу данных.
   - Живая визуализация выполнения (running pulse, success green, failed red, skipped gray) в реальном времени через Server-Sent Events (SSE).
   - Правый инспектор с вкладками настройки параметров узла, просмотра входящего/исходящего JSON и зарезервированным слотом под **AI Copilot**.

2. **Расширяемая система узлов (Node System)**:
   - **Manual Trigger** — ручной или API запуск сценария с передачей полезной нагрузки.
   - **HTTP Request** — безопасная отправка REST-запросов с промышленной защитой от **SSRF** (блокировка частных диапазонов IP, DNS rebinding, AWS/GCP metadata, ограничение размера буфера).
   - **Condition** — ветвление логики на порты `True` и `False` с поддержкой dot-нотации путей и 10 операторов сравнения.
   - **Set Data** — создание, трансформация и модификация полей JSON без использования небезопасного `eval`.
   - **Delay** — неблокирующая асинхронная задержка без простоя worker.
   - **Output** — структурирование и фиксация итогового результата выполнения ветки.

3. **Собственный Workflow Execution Engine**:
   - Топологический DAG-обход с алгоритмом детектирования циклов (DFS cycle detection).
   - Проверка допустимости соединений и валидация портов узлов.
   - Корректная обработка условных переходов: активная ветка выполняется, альтернативная помечается как `skipped`.
   - Полная история запусков в PostgreSQL с детализацией каждого узла (`durationMs`, `status`, `inputData`, `outputData`, `error`).
   - Поддержка отмены запущенных процессов (`AbortController`).
   - Архитектура очередей: **BullMQ + Redis** для распределенного продакшна и **In-Memory Queue Runner** для автономной локальной разработки без внешних зависимостей.

4. **База данных и безопасность**:
   - Drizzle ORM с PostgreSQL-схемами: `users`, `workflows`, `workflow_versions`, `executions`, `node_executions`, `credentials`, `application_settings`.
   - Поддержка внешнего PostgreSQL (`DATABASE_URL=postgres://...`) и встроенного WebAssembly PostgreSQL (`@electric-sql/pglite`) для нулевой конфигурации.
   - Безопасная локальная аутентификация JWT.

---

## 🛠 Технологический стек

- **Monorepo**: pnpm workspaces
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, `@xyflow/react`, Zustand, TanStack Query, Lucide Icons
- **Backend API**: Node.js, Fastify, TypeScript, Zod, OpenAPI / Swagger UI
- **Workflow Engine & Nodes**: TypeScript, BullMQ / IORedis, SSRF Guard, Drizzle ORM
- **Database**: PostgreSQL (или встроенный PGLite)
- **Infrastructure & Testing**: Docker Compose, Vitest

---

## 📂 Структура репозитория

```text
neuroflow/
├── apps/
│   ├── web/                    # Пользовательский интерфейс Next.js
│   ├── api/                    # REST API Fastify с OpenAPI
│   └── worker/                 # Сервис выполнения очередей BullMQ
├── packages/
│   ├── shared/                 # Общие схемы Zod, типы DTO, энумы
│   ├── database/               # Схема Drizzle ORM, миграции, адаптеры
│   ├── nodes/                  # Реестр блоков и реализации 6 узлов + SSRF Guard
│   ├── workflow-engine/        # Движок выполнения, DAG-валидатор, менеджер очередей
│   └── ui/                     # Общие утилиты стилей и токены
├── infrastructure/
│   ├── docker-compose.yml      # Конфигурация PostgreSQL, Redis, API, Worker, Web
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── Dockerfile.web
├── tests/                      # Наборы тестов Vitest (SSRF, DAG, Engine)
├── DESIGN.md                   # Спецификация дизайн-системы (SSOT)
├── package.json
└── pnpm-workspace.yaml
```

---

## ⚡ Быстрый старт (Локальная разработка)

### 1. Установка зависимостей
```bash
pnpm install
```

### 2. Сборка пакетов
```bash
pnpm build
```

### 3. Запуск тестов
```bash
pnpm test
```

### 4. Запуск всех сервисов (API, Web, Worker)
```bash
# Запуск API (порт 4000)
pnpm dev:api

# Запуск Web UI (порт 3000)
pnpm dev:web
```

При первом запуске база данных и аккаунт администратора инициализируются автоматически:
- **Web UI**: [http://localhost:3000](http://localhost:3000)
- **REST API Swagger**: [http://localhost:4000/documentation](http://localhost:4000/documentation)
- **Email администратора**: `admin@neuroflow.local`
- **Пароль**: `adminneuroflow`

---

## 🐳 Запуск через Docker Compose

Для развертывания полного стека с внешним PostgreSQL 16 и Redis 7:

```bash
cd infrastructure
docker compose up -d --build
```

---

## 🤖 Будущая архитектура AI (Фаза 2)

В модуле `packages/nodes/src/ai-interfaces.ts` заранее спроектированы контракты для второй фазы:
- `IAIWorkflowGenerator` — генерация сценариев по текстовому описанию и автоматическое устранение ошибок.
- `IAIAgentNodeConfig` — агентный узел с памятью (`IAgentMemory`) и доступом к инструментам платформы.
- `ILLMProviderRegistry` — реестр провайдеров (OpenAI, Anthropic, Ollama, vLLM).
- `IMultiAgentOrchestrator` — координация взаимодействия группы специализированных агентов.
- Мессенджер-триггеры для Telegram и Discord.
