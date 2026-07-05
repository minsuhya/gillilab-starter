# `make dev-local` 로컬 개발 편의 스크립트 설계

- 날짜: 2026-07-05
- 상태: 승인됨 (사용자 확인 완료)

## 배경 / 목표

`docs/superpowers/specs/2026-07-05-local-hmr-docker-compose-design.md`에서 시도한 Docker(Colima) 기반 HMR은 bind mount의 파일 변경 이벤트가 VM으로 전달되지 않아 실패했다 (`docker-compose.yml`, `frontend/next.config.ts` 변경은 되돌리고 `backend/Dockerfile.dev`, `frontend/Dockerfile.dev`는 삭제함). Next.js 공식 문서도 Mac/Windows에서 Docker 기반 dev 서버의 HMR이 느리거나 불안정할 수 있다고 명시한다.

대안으로, 이미 정상 동작하는 로컬 실행 방식(`make dev-frontend`, `make dev-backend`를 각각 터미널에서 실행)의 불편함(터미널 2개 필요)만 해소한다. 목표는 한 명령(`make dev-local`)으로 백엔드+프론트엔드를 한 터미널에서 동시에 띄우고, Ctrl+C 한 번으로 둘 다 종료되게 하는 것이다.

## 범위

- 신규 파일: `scripts/dev-local.sh` (실행 권한 부여)
- 수정 파일: `Makefile` (`dev-local` 타겟 추가), `README.md`, `CLAUDE.md` (문서에 새 명령어 반영)
- 기존 `make dev-frontend`, `make dev-backend`, Docker 기반 `make dev`/`make dev-watch`는 그대로 유지 (대안으로 남겨둠).

## 구성 요소

### `scripts/dev-local.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

trap 'kill 0' EXIT INT TERM

echo "Backend:  http://localhost:8005"
echo "Frontend: http://localhost:3005"
echo "Press Ctrl+C to stop both."
echo ""

(
  cd backend
  APP_ENV=development CORS_ORIGINS=http://localhost:3005 \
    uv run uvicorn app.main:app --reload --port 8005 2>&1 \
    | while IFS= read -r line; do echo "[backend] $line"; done
) &

(
  cd frontend
  NEXT_PUBLIC_API_URL=http://localhost:8005 \
    npm run dev -- -p 3005 2>&1 \
    | while IFS= read -r line; do echo "[frontend] $line"; done
) &

wait
```

- 백엔드/프론트엔드를 각각 서브셸 백그라운드 작업으로 실행하고, 기존 `make dev-backend`/`make dev-frontend`와 동일한 명령·포트·환경변수를 그대로 사용한다.
- 출력은 `while read` 라인 루프로 한 줄씩 `[backend]`/`[frontend]` 접두어를 붙인다. macOS 기본 `sed`(BSD sed)는 GNU sed의 `-u`(무버퍼링) 옵션을 지원하지 않아 실시간 로그 출력이 보장되지 않으므로, 이식성을 위해 `sed` 대신 `while read` 루프를 사용한다.
- `trap 'kill 0' EXIT INT TERM`으로 스크립트가 어떤 이유로든 종료될 때(Ctrl+C 포함) 같은 프로세스 그룹의 모든 자식 프로세스(백엔드, 프론트엔드, 각 파이프의 read 루프)를 함께 종료한다.
- `cd "$(dirname "$0")/.."`로 스크립트를 어느 위치에서 실행하든 저장소 루트 기준 상대 경로(`backend/`, `frontend/`)가 올바르게 동작한다.

### `Makefile` 변경

`.PHONY` 목록에 `dev-local` 추가하고 새 타겟 추가:

```makefile
dev-local:
	./scripts/dev-local.sh
```

### 문서 변경

- `README.md`: "로컬에서 실행 (Docker 없이)" 섹션에 `make dev-local` 한 줄 명령 옵션을 기존 2-터미널 방식보다 먼저 안내. Makefile 명령어 표에 `make dev-local` 행 추가.
- `CLAUDE.md`: "빌드 & 실행" 코드 블록에 `make dev-local` 한 줄 추가.

## 테스트 방법

- `chmod +x scripts/dev-local.sh` 후 `./scripts/dev-local.sh` (또는 `make dev-local`) 실행 시 두 서비스가 모두 뜨고, `http://localhost:8005/`, `http://localhost:3005/`에 정상 응답하는지 확인한다.
- 출력에 `[backend]`, `[frontend]` 접두어가 붙어 로그가 구분되는지 확인한다.
- 백엔드 소스(`backend/app/main.py`)를 수정하면 `[backend]` 로그에 리로드 메시지가 뜨는지, 프론트엔드 소스(`frontend/src/app/page.tsx`)를 수정하면 브라우저에서 Fast Refresh로 반영되는지 확인한다 (둘 다 로컬 프로세스이므로 기존에 이미 동작하던 방식과 동일).
- `Ctrl+C`를 눌렀을 때 두 프로세스가 모두 종료되고 셸 프롬프트로 정상 복귀하는지, `lsof -i :8005`/`lsof -i :3005`로 좀비 프로세스가 남지 않았는지 확인한다.

## 비범위 (Out of scope)

- Docker 기반 HMR 재시도 — 위 배경에서 설명한 대로 이 환경(Colima)에서는 신뢰할 수 없어 포기함.
- `concurrently`, `overmind` 등 외부 프로세스 매니저 도입 — 새 의존성 없이 셸 스크립트만으로 충분하다고 판단.
- 기존 `make dev-frontend`/`make dev-backend`/`make dev`/`make dev-watch` 제거 — 그대로 유지.
