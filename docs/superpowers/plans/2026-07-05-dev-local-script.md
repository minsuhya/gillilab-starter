# `make dev-local` 스크립트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `make dev-local` 한 명령으로 백엔드(`uvicorn --reload`)와 프론트엔드(`next dev`)를 한 터미널에서 동시에 실행하고, 로그를 `[backend]`/`[frontend]`로 구분하며, Ctrl+C 한 번으로 둘 다 종료되게 한다.

**Architecture:** 신규 셸 스크립트 `scripts/dev-local.sh`가 기존 `make dev-backend`/`make dev-frontend`와 동일한 명령·포트·환경변수를 서브셸 백그라운드 작업으로 실행하고, `while read` 라인 루프로 접두어를 붙인다. `trap 'kill 0'`로 정리한다.

**Tech Stack:** Bash, `uv`, `uvicorn --reload`, `npm run dev` (Next.js).

## Global Constraints

- 새 외부 의존성(`concurrently`, `overmind` 등)을 추가하지 않는다.
- macOS 기본 `/bin/bash`, `/usr/bin/sed`(BSD sed)에서 동작해야 한다 — 로그 접두어는 `sed -u` 대신 `while read` 루프를 사용한다.
- 기존 `make dev`, `make dev-watch`, `make dev-frontend`, `make dev-backend`는 그대로 유지한다.
- 백엔드 포트 8005, 프론트엔드 포트 3005, `CORS_ORIGINS=http://localhost:3005`, `NEXT_PUBLIC_API_URL=http://localhost:8005`, `APP_ENV=development` — 모두 기존 Makefile 타겟과 동일한 값을 그대로 사용한다.
- 참조 스펙: `docs/superpowers/specs/2026-07-05-dev-local-script-design.md`

---

### Task 1: `scripts/dev-local.sh` 작성, Makefile 연결, 기능 검증

**Files:**
- Create: `scripts/dev-local.sh`
- Modify: `Makefile`

**Interfaces:**
- Consumes: 없음 (독립 스크립트, 기존 `backend/`, `frontend/` 디렉터리 구조만 전제).
- Produces: `make dev-local` 명령. Task 2에서 이 명령을 문서에 인용한다.

- [ ] **Step 1: 스크립트 작성**

`scripts/dev-local.sh`를 아래 내용으로 정확히 작성한다:

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

- [ ] **Step 2: 실행 권한 부여**

Run:

```bash
chmod +x scripts/dev-local.sh
ls -l scripts/dev-local.sh
```

Expected: 권한 문자열에 `x`가 포함된다 (예: `-rwxr-xr-x`).

- [ ] **Step 3: Makefile에 타겟 추가**

`Makefile`의 `.PHONY` 목록과 로컬 개발 섹션을 아래와 같이 수정한다 (기존 `dev-backend` 타겟 뒤에 추가):

```makefile
.PHONY: dev dev-watch build down logs install dev-frontend dev-backend dev-local
```

```makefile
dev-backend:
	cd backend && APP_ENV=development CORS_ORIGINS=http://localhost:3005 uv run uvicorn app.main:app --reload --port 8005

dev-local:
	./scripts/dev-local.sh
```

- [ ] **Step 4: 기동 및 헬스 체크**

Run:

```bash
./scripts/dev-local.sh > /tmp/dev-local-test.log 2>&1 &
echo $! > /tmp/dev-local-test.pid
for i in $(seq 1 30); do
  curl -sf http://localhost:8005/ >/dev/null 2>&1 && curl -sf http://localhost:3005/ >/dev/null 2>&1 && break
  sleep 2
done
curl -sf http://localhost:8005/ && echo " BACKEND_OK"
curl -sf http://localhost:3005/ >/dev/null && echo "FRONTEND_OK"
grep -c "^\[backend\]" /tmp/dev-local-test.log
grep -c "^\[frontend\]" /tmp/dev-local-test.log
```

Expected: `BACKEND_OK`, `FRONTEND_OK` 모두 출력되고, 두 `grep -c` 명령이 모두 1 이상의 숫자를 출력한다 (양쪽 로그에 접두어가 붙었음을 증명).

- [ ] **Step 5: 백엔드 리로드 동작 확인**

`backend/app/main.py`의 `@app.get("/")` 핸들러 뒤에 주석을 추가한다:

```python
@app.get("/")
async def root():
    return {"message": "Gillilab Starter API"}
# dev-local-verify-marker
```

Run:

```bash
sleep 2
grep -i "reloading" /tmp/dev-local-test.log
```

Expected: `Reloading...` 포함 로그 라인이 `[backend]` 접두어와 함께 출력된다.

변경 되돌리기:

```bash
git checkout -- backend/app/main.py
```

- [ ] **Step 6: 종료 시 정리 확인**

Run:

```bash
kill -INT "$(cat /tmp/dev-local-test.pid)"
sleep 3
lsof -i :8005 -i :3005 || echo "PORTS_FREE"
rm -f /tmp/dev-local-test.log /tmp/dev-local-test.pid
```

Expected: `PORTS_FREE`가 출력된다 (`lsof`가 아무 프로세스도 찾지 못해 0이 아닌 종료 코드를 반환하고, `||`로 `PORTS_FREE`가 출력됨 — 두 포트를 점유하던 프로세스가 모두 종료되었음을 증명).

- [ ] **Step 7: Commit**

```bash
git add scripts/dev-local.sh Makefile
git commit -m "Add make dev-local to run backend and frontend dev servers together"
```

---

### Task 2: README.md / CLAUDE.md 문서 업데이트

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1의 `make dev-local` 명령.
- Produces: 없음 (문서 전용, 이후 태스크 없음).

- [ ] **Step 1: README.md 업데이트**

`README.md`의 "### 로컬에서 실행 (Docker 없이)" 섹션을 아래 내용으로 교체한다:

```markdown
### 로컬에서 실행 (Docker 없이)

의존성을 먼저 설치합니다.

```bash
make install
```

한 번에 실행 (권장):

```bash
make dev-local
```

또는 터미널 2개를 열고 각각 실행합니다.

```bash
# 터미널 1 — Backend (http://localhost:8005)
make dev-backend

# 터미널 2 — Frontend (http://localhost:3005)
make dev-frontend
```
```

`README.md`의 "## Makefile 명령어" 표에 아래 행을 `| make dev-backend | Backend만 로컬 실행 |` 행 바로 다음에 추가한다:

```markdown
| `make dev-local` | Backend+Frontend 로컬 동시 실행 (한 터미널) |
```

- [ ] **Step 2: CLAUDE.md 업데이트**

`CLAUDE.md`의 "## 빌드 & 실행" 코드 블록에서 `make dev-backend` 줄 다음에 아래 줄을 추가한다:

```
make dev-local       # Backend+Frontend 로컬 동시 실행 (한 터미널, Ctrl+C로 종료)
```

- [ ] **Step 3: 변경 확인**

Run:

```bash
grep -n "dev-local" README.md CLAUDE.md
```

Expected: `README.md`에서 2곳(사용 예시, 명령어 표), `CLAUDE.md`에서 1곳, 총 3줄이 출력된다.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "Document make dev-local in README and CLAUDE.md"
```
