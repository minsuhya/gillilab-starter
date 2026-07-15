# gillilab-starter

화면 녹화 강의용 풀스택 데모 프로젝트. Next.js 15 + FastAPI + SQLite 모노레포.

## 빌드 & 실행

```bash
make build          # Docker 이미지 빌드
make dev            # Docker로 전체 실행
make dev-watch      # Docker watch 모드 (핫 리로드)
make down           # 컨테이너 종료
make logs           # 로그 스트리밍

make install        # 로컬 의존성 설치
make dev-frontend   # Frontend만 로컬 실행 (포트 3005)
make dev-backend    # Backend만 로컬 실행 (포트 8005)
make dev-local       # Backend+Frontend 로컬 동시 실행 (한 터미널, Ctrl+C로 종료)
```

## 접속 주소 (Docker)

| 서비스 | 주소 |
|---|---|
| Frontend | http://localhost:3005 |
| Backend API | http://localhost:8005 |
| API Docs | http://localhost:8005/docs (APP_ENV=development 일 때만) |

## 프로젝트 구조

```
gillilab-starter/
├── frontend/               # Next.js 15 (App Router, TypeScript, Tailwind v4)
│   └── src/app/
├── backend/
│   └── app/
│       ├── main.py         # FastAPI 앱, CORS, docs 설정
│       ├── models.py       # SQLModel 모델 (TaskBase, Task, TaskCreate, TaskUpdate, TaskRead)
│       ├── database.py     # DB 엔진 및 세션
│       └── routers/tasks.py  # Tasks CRUD 라우터
├── docker-compose.yml
└── Makefile
```

## 환경 변수 (backend)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `APP_ENV` | `production` | `development` 로 설정 시 `/docs` · `/redoc` 활성화 |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/tasks.db` | DB 연결 문자열 |
| `CORS_ORIGINS` | `http://localhost:3000` | 허용 origin (콤마 구분) |

docker-compose에서는 `APP_ENV=development`, `CORS_ORIGINS=http://localhost:3005` 로 설정되어 있음.

## 문서 (docs/)

- `docs/gh-guide.md` — GitHub CLI(gh) 전반 사용 가이드
- `docs/gh-pr-guide.md` — gh로 Pull Request 처리하기 (심화)
- `docs/copilot-astronvim-guide.md` — AstroNvim에서 CopilotChat.nvim 설정하기

## 주요 규칙

- build=`make build` | test=`make test` (테스트 미구현 시 스킵)
- Frontend는 Next.js 15 — `node_modules/next/dist/docs/` 를 먼저 확인 후 코드 작성
- Backend는 SQLModel ORM 사용, raw SQL 쿼리 금지
- 새 의존성 추가 시: frontend는 `npm install`, backend는 `uv add`
- DB 스키마 변경 시 `backend/data/tasks.db` 삭제 후 재시작 (마이그레이션 미설정)
