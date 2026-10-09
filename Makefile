SHELL := /bin/bash
COMPOSE ?= docker compose

.PHONY: help up down logs build console smoke test clean diagram

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

# Sources are HTML and Mermaid; a PNG is a build artifact.
diagram:
	@if command -v chromium >/dev/null 2>&1; then B=chromium; elif command -v google-chrome >/dev/null 2>&1; then B=google-chrome; else echo "no chromium on PATH: open docs/diagrams/*.html in a browser"; exit 0; fi; \
	for f in docs/diagrams/*.html; do $$B --headless --screenshot="$${f%.html}.png" --window-size=1200,1000 "$$f" && echo "wrote $${f%.html}.png"; done
