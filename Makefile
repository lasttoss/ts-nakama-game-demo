SHELL := /bin/bash
COMPOSE ?= docker compose

.PHONY: help up down logs build console smoke test clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build the plugin, start postgres + nakama, then smoke test
	$(COMPOSE) up -d --build
	@$(MAKE) --no-print-directory smoke

down: ## Stop the stack
	$(COMPOSE) down

logs: ## Tail the nakama log
	$(COMPOSE) logs -f nakama

build: ## Compile the TypeScript plugin into build/index.js
	npm install && npx tsc

console: ## Where the Nakama console is
	@PORT=$$(grep -E '^CONSOLE_PORT=' .env 2>/dev/null | cut -d= -f2); echo "http://127.0.0.1:$${PORT:-7351} (user: admin, password: from local.yml)"

smoke: ## End-to-end smoke test against a running stack
	@PORT=$$(grep -E '^NAKAMA_PORT=' .env 2>/dev/null | cut -d= -f2); node scripts/smoke.mjs 127.0.0.1 $${PORT:-7350}

clean: ## Remove build output and container volumes
	rm -rf build node_modules
	$(COMPOSE) down -v
