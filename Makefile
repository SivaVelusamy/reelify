COMPOSE = docker compose
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: up down logs migrate test build fresh dev

up:            ## Start the full stack in the background
	$(COMPOSE) up -d

down:          ## Stop the stack
	$(COMPOSE) down

logs:          ## Tail logs from all services
	$(COMPOSE) logs -f

migrate:       ## Run alembic migrations inside the backend container
	$(COMPOSE) exec backend alembic upgrade head

test:          ## Run backend + frontend test suites
	cd backend && pytest tests --cov=app --cov-fail-under=80
	cd frontend && npm test

build:         ## Build all images
	$(COMPOSE) build

fresh:         ## Wipe volumes and bring the stack back up
	$(COMPOSE) down -v
	$(COMPOSE) up -d

dev:           ## Start the stack with dev overrides (hot reload)
	$(COMPOSE_DEV) up
