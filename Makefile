.PHONY: dev dev-watch build down logs install dev-frontend dev-backend dev-local

# Docker 환경
dev:
	docker compose up

dev-watch:
	docker compose watch

build:
	docker compose build

down:
	docker compose down -v

logs:
	docker compose logs -f

# 로컬 개발 (Docker 없이)
install:
	cd frontend && npm install
	cd backend && uv sync

dev-frontend:
	cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8005 npm run dev -- -p 3005

dev-backend:
	cd backend && APP_ENV=development CORS_ORIGINS=http://localhost:3005 uv run uvicorn app.main:app --reload --port 8005

dev-local:
	./scripts/dev-local.sh
