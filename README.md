# gillilab-demo-starter

> Next.js 15 + FastAPI + SQLite 풀스택 모노레포 강의 데모 프로젝트

화면 녹화 강의에서 사용하는 실습용 스타터 코드입니다.  
Docker 한 줄로 실행되며, 프론트엔드(Next.js)와 백엔드(FastAPI)가 함께 구성되어 있습니다.

> ⚠️ **로컬 실습 전용 — 공개 서버 배포 금지**
> 이 프로젝트는 학습·데모 목적입니다. API에 **인증이 없어** 누구나 데이터를 조회·생성·수정·삭제할 수 있고, 개발 모드에서 API 문서(Swagger)가 노출되며, 속도·요청 크기 제한이 없습니다.
> `localhost`에서만 실행하세요. VPS·클라우드 등 **외부에서 접근 가능한 서버에 그대로 배포하지 마세요.** 실제 서비스로 확장하려면 인증·인가, CORS 제한, 레이트 리밋, 프로덕션 DB를 먼저 추가해야 합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI, SQLModel, SQLite (aiosqlite) |
| 패키지 관리 | npm (frontend), uv (backend) |
| 컨테이너 | Docker Compose |

## 빠른 시작

### Docker로 실행 (권장)

```bash
make build   # 이미지 빌드 (최초 1회)
make dev     # 실행
```

| 서비스 | 주소 |
|---|---|
| Frontend | http://localhost:3005 |
| Backend API | http://localhost:8005 |
| API Docs (Swagger) | http://localhost:8005/docs |

> API Docs는 개발 모드(`APP_ENV=development`)에서만 표시됩니다.  
> docker-compose 기본 설정에서는 활성화되어 있습니다.

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

## 프로젝트 구조

```
gillilab-demo-starter/
├── frontend/               # Next.js 15 (App Router)
│   ├── src/app/            # 페이지 및 컴포넌트
│   └── Dockerfile
├── backend/                # FastAPI + SQLite
│   ├── app/
│   │   ├── main.py         # FastAPI 앱 진입점
│   │   ├── models.py       # 데이터 모델 (SQLModel)
│   │   ├── database.py     # DB 연결 설정
│   │   └── routers/
│   │       └── tasks.py    # Tasks CRUD API
│   └── Dockerfile
├── docker-compose.yml
├── Makefile
└── README.md
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/tasks` | 전체 태스크 목록 조회 |
| `POST` | `/tasks` | 태스크 생성 |
| `GET` | `/tasks/{id}` | 특정 태스크 조회 |
| `PUT` | `/tasks/{id}` | 태스크 수정 |
| `DELETE` | `/tasks/{id}` | 태스크 삭제 |

## Makefile 명령어

| 명령어 | 설명 |
|---|---|
| `make dev` | Docker로 전체 실행 |
| `make dev-watch` | Docker watch 모드 (핫 리로드) |
| `make build` | Docker 이미지 빌드 |
| `make down` | 컨테이너 종료 |
| `make logs` | 로그 스트리밍 |
| `make install` | 로컬 의존성 설치 |
| `make dev-frontend` | Frontend만 로컬 실행 |
| `make dev-backend` | Backend만 로컬 실행 |
| `make dev-local` | Backend+Frontend 로컬 동시 실행 (한 터미널) |

## 환경 변수

백엔드에서 사용하는 환경 변수입니다. docker-compose에서 자동으로 설정됩니다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `APP_ENV` | `production` | `development` 설정 시 Swagger UI 활성화 |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/tasks.db` | DB 연결 문자열 |
| `CORS_ORIGINS` | `http://localhost:3000` | 허용할 CORS origin (콤마 구분) |
