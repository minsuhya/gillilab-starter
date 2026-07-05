# 로컬 HMR Docker Compose 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 Docker 개발 환경에서 `next dev`/`uvicorn --reload`가 실제로 동작하도록 하고, 기존 프로덕션 `Dockerfile`은 완전히 그대로 유지한다.

**Architecture:** `backend/Dockerfile.dev`, `frontend/Dockerfile.dev`를 새로 추가해 의존성만 이미지에 설치하고, `docker-compose.yml`이 소스 디렉터리를 bind mount해서 컨테이너 내부의 dev 서버(리로드 기능 내장)가 변경을 즉시 반영하게 한다.

**Tech Stack:** Docker, Docker Compose (`develop.watch` 포함), `uv`, `uvicorn --reload`, `next dev`.

## Global Constraints

- 기존 `backend/Dockerfile`, `frontend/Dockerfile`은 수정하지 않는다 (프로덕션 배포 아티팩트).
- `docker-compose.yml`의 `develop.watch` 블록은 그대로 유지한다 (사용자 확인됨).
- `Makefile`, `README.md`, `CLAUDE.md`는 수정하지 않는다.
- `frontend/.dockerignore`(`node_modules/`, `.next/` 제외), `backend/.dockerignore`(`.venv/`, `data/`, `__pycache__/` 제외)는 기존 그대로 재사용한다.
- 참조 스펙: `docs/superpowers/specs/2026-07-05-local-hmr-docker-compose-design.md`

---

### Task 1: `backend/Dockerfile.dev` 생성 및 단독 검증

**Files:**
- Create: `backend/Dockerfile.dev`

**Interfaces:**
- Consumes: 없음 (독립 파일, `backend/pyproject.toml`, `backend/uv.lock`, `backend/app/`를 빌드 컨텍스트로 사용).
- Produces: `uv run uvicorn app.main:app --reload`로 기동되는 개발용 이미지. Task 3에서 `docker-compose.yml`이 이 파일을 `dockerfile:`로 참조한다.

- [ ] **Step 1: Dockerfile.dev 작성**

`backend/Dockerfile.dev`를 아래 내용으로 정확히 작성한다:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.7 /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY app/ ./app/

RUN useradd -m -u 1000 appuser \
    && mkdir -p data \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 2: 이미지 빌드**

Run:

```bash
docker build -f backend/Dockerfile.dev -t gillilab-backend-dev ./backend
```

Expected: `Successfully tagged gillilab-backend-dev:latest` (또는 BuildKit 출력의 마지막 줄이 에러 없이 종료).

- [ ] **Step 3: 컨테이너 기동 후 헬스 체크 및 리로더 로그 확인**

Run:

```bash
docker run --rm -d --name backend-dev-smoke -p 18005:8000 gillilab-backend-dev
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf http://localhost:18005/ >/dev/null 2>&1 && break
  sleep 1
done
curl -sf http://localhost:18005/ && echo "HEALTH_OK"
docker logs backend-dev-smoke 2>&1 | grep -i "will watch for changes"
```

Expected: 응답 본문 `{"message":"Gillilab Starter API"}` 뒤에 `HEALTH_OK` 출력, 그리고 `grep`이 `Will watch for changes in these directories` 형태의 로그 한 줄을 찾아 출력한다 (이 로그가 `--reload`가 실제로 활성화되었음을 증명한다).

- [ ] **Step 4: 정리**

```bash
docker stop backend-dev-smoke
docker rmi gillilab-backend-dev
```

Expected: 컨테이너가 정지되고 이미지가 삭제된다 (에러 없음).

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile.dev
git commit -m "Add backend Dockerfile.dev for local uvicorn --reload"
```

---

### Task 2: `frontend/Dockerfile.dev` 생성 및 단독 검증

**Files:**
- Create: `frontend/Dockerfile.dev`

**Interfaces:**
- Consumes: 없음 (독립 파일, `frontend/package.json`, `frontend/package-lock.json`, 전체 소스를 빌드 컨텍스트로 사용).
- Produces: `npm run dev`로 기동되는 개발용 이미지. Task 3에서 `docker-compose.yml`이 이 파일을 `dockerfile:`로 참조한다.

- [ ] **Step 1: Dockerfile.dev 작성**

`frontend/Dockerfile.dev`를 아래 내용으로 정확히 작성한다:

```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000
CMD ["npm", "run", "dev"]
```

- [ ] **Step 2: 이미지 빌드**

Run:

```bash
docker build -f frontend/Dockerfile.dev -t gillilab-frontend-dev ./frontend
```

Expected: `Successfully tagged gillilab-frontend-dev:latest` (또는 BuildKit 출력의 마지막 줄이 에러 없이 종료).

- [ ] **Step 3: 컨테이너 기동 후 헬스 체크 및 dev 서버 로그 확인**

Run:

```bash
docker run --rm -d --name frontend-dev-smoke -p 13005:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8005 gillilab-frontend-dev
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  curl -sf http://localhost:13005/ >/dev/null 2>&1 && break
  sleep 1
done
curl -sf http://localhost:13005/ >/dev/null && echo "HEALTH_OK"
docker logs frontend-dev-smoke 2>&1 | grep -i "ready in"
```

Expected: `HEALTH_OK` 출력, 그리고 `grep`이 `✓ Ready in <N>ms` 형태의 Next.js dev 서버 시작 로그를 찾아 출력한다 (`next build`가 아닌 `next dev`가 실행 중임을 증명한다).

- [ ] **Step 4: 정리**

```bash
docker stop frontend-dev-smoke
docker rmi gillilab-frontend-dev
```

Expected: 컨테이너가 정지되고 이미지가 삭제된다 (에러 없음).

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile.dev
git commit -m "Add frontend Dockerfile.dev for local next dev"
```

---

### Task 3: `docker-compose.yml`을 dev Dockerfile로 전환하고 엔드투엔드 HMR 검증

**Files:**
- Modify: `docker-compose.yml` (전체)

**Interfaces:**
- Consumes: Task 1의 `backend/Dockerfile.dev`, Task 2의 `frontend/Dockerfile.dev`.
- Produces: `make build` / `make dev` / `make dev-watch`가 그대로 동작하되, 실제로 HMR이 적용되는 로컬 개발 환경.

- [ ] **Step 1: docker-compose.yml 전체 교체**

`docker-compose.yml`을 아래 내용으로 정확히 교체한다:

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "127.0.0.1:8005:8000"
    volumes:
      - ./backend/app:/app/app
      - ./backend/data:/app/data
    environment:
      - APP_ENV=development
      - DATABASE_URL=sqlite+aiosqlite:///./data/tasks.db
      - CORS_ORIGINS=http://localhost:3005
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    develop:
      watch:
        - action: sync+restart
          path: ./backend/app
          target: /app/app

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "127.0.0.1:3005:3000"
    volumes:
      - ./frontend/src:/app/src
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8005
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', r => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    develop:
      watch:
        - action: sync
          path: ./frontend/src
          target: /app/src
```

- [ ] **Step 2: compose 설정 유효성 검증**

Run:

```bash
docker compose config --quiet && echo "CONFIG_OK"
```

Expected: `CONFIG_OK` 출력 (YAML/스키마 오류 없음).

- [ ] **Step 3: 빌드 및 기동**

Run:

```bash
docker compose up -d --build
for i in $(seq 1 30); do
  curl -sf http://localhost:8005/ >/dev/null 2>&1 && curl -sf http://localhost:3005/ >/dev/null 2>&1 && break
  sleep 2
done
curl -sf http://localhost:8005/ && echo " BACKEND_OK"
curl -sf http://localhost:3005/ >/dev/null && echo "FRONTEND_OK"
```

Expected: 백엔드 응답 뒤 `BACKEND_OK`, `FRONTEND_OK` 모두 출력.

- [ ] **Step 4: 백엔드 리로드 실제 동작 확인**

`backend/app/main.py` 42번째 줄(파일 끝) 뒤에 주석 한 줄을 추가한다:

```python
# hmr-verify-marker
```

Run:

```bash
sleep 2
docker compose logs backend --tail 20 | grep -i "reloading\|detected change"
```

Expected: `Reloading...` 또는 `Detected change in` 형태의 로그가 출력된다 (호스트에서 수정한 파일이 bind mount를 통해 컨테이너의 `uvicorn --reload`에 감지되었음을 증명).

변경 되돌리기:

```bash
git checkout -- backend/app/main.py
```

- [ ] **Step 5: 프론트엔드 리로드 실제 동작 확인**

`frontend/src/app/page.tsx`의 57번째 줄(`<main className="min-h-screen bg-gray-50 py-12 px-4">`) 바로 다음 줄에, JSX 자식 주석을 추가한다:

```tsx
      {/* hmr-verify-marker */}
```

(즉 57번째 줄 `<main ...>` 바로 아래, 58번째 줄이었던 빈 줄 앞에 삽입한다.)

Run:

```bash
sleep 2
docker compose logs frontend --tail 20 | grep -i "compiling\|compiled"
```

Expected: `Compiling /page ...` 또는 `Compiled /page` 형태의 로그가 출력된다 (호스트 파일 변경이 bind mount를 통해 `next dev`의 Fast Refresh에 감지되었음을 증명).

변경 되돌리기:

```bash
git checkout -- frontend/src/app/page.tsx
```

- [ ] **Step 6: 프로덕션 Dockerfile 회귀 확인**

Run:

```bash
docker build -f backend/Dockerfile -t gillilab-backend-prod-check ./backend && echo "BACKEND_PROD_BUILD_OK"
docker build -f frontend/Dockerfile -t gillilab-frontend-prod-check --build-arg NEXT_PUBLIC_API_URL=http://localhost:8005 ./frontend && echo "FRONTEND_PROD_BUILD_OK"
```

Expected: `BACKEND_PROD_BUILD_OK`, `FRONTEND_PROD_BUILD_OK` 모두 출력 (기존 프로덕션 Dockerfile이 이번 변경으로 영향받지 않았음을 증명).

- [ ] **Step 7: 정리**

```bash
docker compose down -v
docker rmi gillilab-backend-prod-check gillilab-frontend-prod-check
```

Expected: 컨테이너/볼륨이 정리되고 회귀 확인용 이미지가 삭제된다.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml
git commit -m "Switch docker-compose.yml to dev Dockerfiles with bind mounts for real HMR"
```
