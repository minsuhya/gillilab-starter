# 로컬 HMR Docker Compose 최적화 설계

- 날짜: 2026-07-05
- 상태: 승인됨 (사용자 확인 완료)

## 배경 / 목표

현재 `docker-compose.yml`은 프로덕션용 `Dockerfile`(백엔드: `uv sync --no-dev` + `uvicorn` 무리로드 실행, 프론트엔드: `next build` → standalone 서버)을 그대로 로컬 개발에도 사용한다. 그 결과:

- 프론트엔드: `develop.watch`가 `action: sync`로 `./frontend/src`를 컨테이너에 복사하지만, 실행 중인 프로세스는 이미 빌드된 standalone 프로덕션 서버(`node server.js`)라서 소스 변경이 반영되지 않는다.
- 백엔드: `develop.watch`가 `action: sync+restart`로 컨테이너 전체를 재시작해 반영하지만, `uvicorn`에 `--reload`가 없어 자체 핫리로드가 아니라 컨테이너 재시작에 의존한다.

목표는 로컬에서 `next dev` / `uvicorn --reload`가 실제로 동작하도록 하면서, 기존 프로덕션 `Dockerfile`은 배포 아티팩트로 완전히 그대로 유지하는 것이다.

## 범위

- 신규 파일 2개: `backend/Dockerfile.dev`, `frontend/Dockerfile.dev`
- 수정 파일 1개: `docker-compose.yml`
- 기존 `backend/Dockerfile`, `frontend/Dockerfile`은 손대지 않는다 — 프로덕션 배포용으로 그대로 유지.
- 기존 `develop.watch` 설정(사용자 확인 결과, "유지")은 그대로 둔다. 실제 HMR/리로드와 중복되더라도 안전하게 함께 적용하는 쪽을 선택했다.
- Makefile, README.md, CLAUDE.md는 수정하지 않는다 — `make dev-watch`의 "핫 리로드" 설명은 이미 사실과 부합하게 된다.

## 구성 요소

### 1. `backend/Dockerfile.dev`

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

프로덕션 `Dockerfile`과의 차이: `uv sync --no-dev` → `uv sync --frozen`(dev 의존성도 설치), `CMD`에 `--reload` 추가. 이미지 빌드 시점에 `app/`을 복사하지만, `docker-compose.yml`이 `./backend/app:/app/app`을 bind mount하면 런타임에는 호스트 파일이 우선한다. `uvicorn --reload`의 내장 파일 감시자가 bind mount로 반영된 변경을 즉시 감지해 자동 재시작한다.

### 2. `frontend/Dockerfile.dev`

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

프로덕션 `Dockerfile`의 3-stage standalone 빌드 대신 단일 스테이지로 단순화한다. `.dockerignore`(`node_modules/`, `.next/` 제외)가 이미 존재하므로 `COPY . .`가 호스트의 `node_modules`를 덮어쓸 위험은 없다. 개발 전용 이미지이므로 non-root 유저 설정은 생략한다.

### 3. `docker-compose.yml` 변경

- `backend.build.dockerfile: Dockerfile.dev` 추가
- `backend.volumes`에 `./backend/app:/app/app` 추가 (기존 `./backend/data:/app/data`는 유지)
- `frontend.build.dockerfile: Dockerfile.dev` 추가
- `frontend.build.args`(`NEXT_PUBLIC_API_URL`)는 제거하고, `frontend.environment`에 `NEXT_PUBLIC_API_URL=http://localhost:8005`로 이동 — `next build`는 빌드 타임에 값을 인라인해야 하지만 `next dev`는 런타임 환경 변수를 읽어 요청 시점에 컴파일하므로 build arg가 아닌 environment로 전달해야 한다.
- `frontend.volumes`에 `./frontend/src:/app/src` 추가
- `develop.watch` 블록은 두 서비스 모두 그대로 유지
- 포트 매핑, `healthcheck`, 기존 환경 변수(`APP_ENV`, `DATABASE_URL`, `CORS_ORIGINS`)는 변경 없음

## 연동 방식

- `backend/.dockerignore`, `frontend/.dockerignore`는 기존 그대로 사용 — 두 Dockerfile이 같은 빌드 컨텍스트(`./backend`, `./frontend`)를 공유하므로 별도 설정 없이 `node_modules/`, `.venv/`, `data/` 등이 이미지에 복사되지 않는다.
- `make build` / `make dev` / `make dev-watch`는 명령어 자체를 바꾸지 않는다 — `docker-compose.yml`이 참조하는 Dockerfile만 바뀌므로 기존 Makefile 타깃이 그대로 동작한다.

## 테스트 방법

- `make build`로 이미지가 정상적으로 빌드되는지 확인한다 (`Dockerfile.dev` 두 개 모두).
- `make dev`로 컨테이너를 띄운 뒤, `backend/app/main.py`와 `frontend/src/app/page.tsx`를 각각 수정하고 컨테이너를 재빌드하지 않은 채 변경이 반영되는지 확인한다.
  - 백엔드: 코드 수정 후 `uvicorn`이 자동으로 재시작 로그를 출력하는지 `docker compose logs backend`로 확인.
  - 프론트엔드: 브라우저에서 Fast Refresh로 즉시 반영되는지 확인 (풀 리로드 없이).
- 기존 프로덕션 `Dockerfile`로 별도 빌드(`docker build -f backend/Dockerfile backend`, `docker build -f frontend/Dockerfile frontend`)가 여전히 정상 동작하는지 확인해 회귀가 없는지 검증한다.

## 비범위 (Out of scope)

- 프로덕션 `Dockerfile`, `Makefile`, `README.md`, `CLAUDE.md` 수정.
- `node_modules`/`.venv`를 위한 별도 named volume — 현재 bind mount 범위가 `app/`, `src/`로 한정되어 있어 이미지 내부에 설치된 의존성이 가려지지 않으므로 불필요.
- `develop.watch` 제거 또는 조정 — 사용자가 유지를 선택함.
