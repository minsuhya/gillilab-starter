# GitHub CLI(gh) 사용 가이드

`gh` 로 GitHub를 터미널에서 다루기 위한 실무 참조 문서. 명령별 핵심 사용법과 이 프로젝트에서 자주 쓰는 흐름을 정리했다.

- 검증 환경: gh 2.96.0, 저장소 `github.com:minsuhya/gillilab-starter`
- **PR 상세 사용법은 [gh-pr-guide.md](./gh-pr-guide.md) 참고** — 이 문서는 gh 전반을 다루고, PR은 그쪽에 깊게 정리돼 있다.

> ⚠️ **이 셸의 주의점**: rtk 훅이 `gh ...` → `rtk gh ...` 로 자동 치환한다. 일반 명령은 정상 동작하지만 `--help` 출력은 rtk가 가로챈다. 도움말은 전체 경로 `/opt/homebrew/bin/gh <cmd> --help` 로 확인한다.

---

## 명령 지도

| 그룹 | 용도 |
|---|---|
| `auth` | 로그인·계정 전환·토큰 관리 |
| `repo` | 저장소 생성·클론·포크·설정 |
| `pr` | Pull Request → **[별도 문서](./gh-pr-guide.md)** |
| `issue` | 이슈 생성·조회·관리 |
| `release` | 릴리스·태그·에셋 |
| `run` / `workflow` / `cache` | GitHub Actions |
| `secret` / `variable` | Actions 시크릿·변수 |
| `search` | 코드·이슈·PR·저장소 검색 |
| `gist` | 코드 스니펫 공유 |
| `label` | 라벨 관리 |
| `api` | 위 명령이 못 하는 것 → REST/GraphQL 직접 호출 |
| `browse` | 브라우저로 열기 |
| `alias` / `config` / `extension` | gh 자체 커스터마이징 |

---

## 1. 인증 (auth)

```bash
gh auth login                        # 대화형 로그인 (브라우저 or 토큰)
gh auth status                       # 현재 로그인 계정·토큰 스코프 확인
gh auth switch                       # 여러 계정 간 활성 계정 전환
gh auth token                        # 현재 토큰 출력 (다른 도구에 파이프)
gh auth refresh -s project,admin:org # 스코프 추가 요청
gh auth setup-git                    # git 인증 헬퍼로 gh 등록
```

- 여러 계정을 등록해두고 `gh auth switch` 로 활성 계정을 바꿀 수 있다.
- 어떤 명령이 권한 오류를 내면 먼저 `gh auth status` 로 **토큰 스코프**를 확인한다. `secret`·`variable`·`project` 등은 기본 스코프(`repo`, `workflow`, `gist`, `read:org`)만으로 부족할 수 있고, `gh auth refresh -s <scope>` 로 넓힌다.

### 여러 계정 간 활성 계정 전환

```bash
gh auth status                                      # 활성 계정(Active account: true)과 등록된 계정 전부 표시
gh auth switch                                      # 대화형 — 등록된 계정 목록에서 선택 (2개면 다른 쪽으로 토글)
gh auth switch --user mmonstar                      # 특정 계정으로 바로 전환
gh auth switch --hostname github.com --user minsuhya  # 호스트까지 지정 (Enterprise 등 다중 호스트)
```

- 인자 없는 `gh auth switch` 는 프롬프트로 고르게 하고, 확실히 지정하려면 `--user` 를 쓴다.
- 새 계정은 먼저 `gh auth login` 으로 등록해야 `switch` 대상이 된다.
- 활성 계정을 바꾸면 이후 모든 gh 명령이 그 계정 권한으로 동작한다. `gh auth setup-git` 으로 git 인증을 gh에 위임했다면 `git push` 도 전환된 계정으로 나간다.
- ⚠️ **커밋 author 는 별개**: `gh auth switch` 는 GitHub 인증 계정만 바꾼다. 커밋에 찍히는 이름·이메일(`git config user.name` / `user.email`)은 따로 맞춰야 하며, 안 그러면 계정을 바꿔 푸시해도 커밋 author 는 그대로다.

### 계정별 커밋 신원 자동 분리 (git includeIf)

여러 계정을 쓸 때 저장소마다 `user.name`/`user.email` 을 손으로 바꾸는 대신, git 의 조건부 포함(`includeIf`)으로 **자동** 전환할 수 있다. 이 저장소 환경은 SSH host alias 로 계정을 나누고 있으므로 alias 기준으로 매칭한다.

**전제 — `~/.ssh/config` 의 host alias** (계정별 SSH 키 연결):

```sshconfig
Host github.com                       # → minsuhya
  HostName github.com
  IdentityFile ~/.ssh/id_ed25519_personal
Host github.com-gillilab              # → gillilab-ai
  HostName github.com
  IdentityFile ~/.ssh/id_ed25519_gillilab
Host github.com-mmon                  # → mmonstar
  HostName github.com
  IdentityFile ~/.ssh/id_ed25519_mmon
```

remote 는 alias 를 써서 등록한다: `git@github.com-mmon:mmonstar/repo.git`

**`~/.gitconfig` 하단** — 최상단 `[user]` 는 기본값(fallback)으로 두고, alias 별로 덮어쓸 파일을 지정:

```gitconfig
; git 은 ~/.ssh/config 를 풀지 않고 remote URL 문자열 그대로 매칭한다.
; 따라서 URL 의 host alias 로 계정을 판별한다.
[includeIf "hasconfig:remote.*.url:git@github.com-mmon:**"]
	path = ~/.gitconfig-mmonstar
[includeIf "hasconfig:remote.*.url:git@github.com-gillilab:**"]
	path = ~/.gitconfig-ai
[includeIf "hasconfig:remote.*.url:git@github.com:**"]
	path = ~/.gitconfig-minsuhya
```

**계정별 파일** — 이름·이메일만 담는다(예 `~/.gitconfig-mmonstar`):

```gitconfig
[user]
  name = mmonstar
  email = mmonstar@mmonstar.co.kr
```

동작·주의:
- **매칭 기준은 remote URL 의 host alias**, 저장소 폴더 위치와 무관. `git@github.com:**` 는 기본 호스트에만 걸리고 `git@github.com-mmon:...` 에는 안 걸린다(뒤의 `-mmon` 때문). 세 패턴이 서로 겹치지 않는다.
- `[user]` 만 계정별 파일에 두면 나머지(alias·pager·credential 등)는 3계정 공통. 덮어쓰기 단위는 섹션이 아니라 **키**다.
- **remote 추가 전**(갓 `git init`)이나 **HTTPS 클론**(alias 없음)은 alias 매칭이 안 돼 기본값이 잡힌다 → 필요 시 `git remote set-url origin git@github.com-mmon:...` 또는 저장소에서 `git config user.email` 로컬 지정.
- 조직(org) 저장소도 alias 로 push 하면 그대로 계정이 갈린다(소유자 이름과 무관).
- 확인: `git config user.email` (현재 저장소에 적용된 값), `git config --show-origin user.email` (어느 파일에서 왔는지).

## 2. 저장소 (repo)

```bash
gh repo create my-app --private --source=. --push   # 로컬을 새 원격 저장소로
gh repo clone minsuhya/gillilab-starter
gh repo fork --clone                                 # 포크 후 로컬 클론
gh repo view                                         # 현재 저장소 정보
gh repo view --web                                   # 브라우저로 열기
gh repo list minsuhya --limit 30                     # 사용자/조직의 저장소 목록
gh repo edit --default-branch master --add-topic demo
gh repo sync                                          # 포크를 upstream과 동기화
gh repo set-default                                   # 여러 remote일 때 기본 저장소 지정
```

- 여러 remote가 있는 클론에서는 `gh repo set-default` 로 gh가 대상으로 삼을 저장소를 먼저 정해두면 이후 `pr`·`issue` 명령이 헷갈리지 않는다.

### 로컬 디렉터리를 새 GitHub 저장소에 연결하기

`git init` 으로 초기화한 로컬 저장소를 GitHub에 올릴 때 두 가지 방법이 있다.

**방법 A — `gh repo create --source` (한 번에)**

```bash
git init
git add . && git commit -m "Initial commit"
gh repo create my-app --private --source=. --remote=origin --push
```

- `--source=.` : 현재 디렉터리를 소스로 지정 → 원격 생성 + `git remote add` 를 자동 처리.
- `--private` / `--public` : 비대화형 생성 시 **필수**.
- `--remote=origin` : 추가할 원격 이름(기본 `origin`, 생략 가능).
- `--push` : 로컬 커밋을 곧바로 푸시(커밋이 있어야 의미 있음).
- 저장소명을 생략하면 디렉터리명이 저장소명이 된다. 다른 조직은 `gh repo create my-org/my-app ...`.

**방법 B — `git remote add` (수동, 3단계)**

원격 저장소만 먼저 만들고(`--source` 생략) 로컬 연결·푸시는 git으로 직접 한다.

```bash
gh repo create minsuhya/my-app --private           # 1) 빈 원격 저장소만 생성 (README·.gitignore 없이)
git remote add origin git@github.com:minsuhya/my-app.git   # 2) 원격 추가 (SSH)
#   또는 HTTPS: git remote add origin https://github.com/minsuhya/my-app.git
git add . && git commit -m "Initial commit"        # 3) 커밋 후
git branch -M main                                 #    기본 브랜치명 정리(선택)
git push -u origin main                             #    첫 푸시 + 업스트림 연결
```

- `gh` 에는 `remote` 명령이 없다(`gh remote` 는 존재하지 않음). 임의 원격 추가는 항상 `git remote add`.
- `-u`(`--set-upstream`) 는 로컬 `main` ↔ 원격 `origin/main` 을 연결해, 이후엔 `git push`/`git pull` 만으로 동작하게 한다.
- SSH URL 은 SSH 키 등록이 전제. HTTPS 는 `gh auth setup-git` 으로 gh가 git 인증을 대행하게 해두면 편하다.
- 확인·수정: `git remote -v` / `git remote remove origin`.

> 방법 A의 `--source=. --remote=origin --push` 가 결국 방법 B의 remote add + push 를 자동화한 것이다.

## 3. 이슈 (issue)

```bash
gh issue create --title "..." --body "..." --label bug --assignee @me
gh issue create --web                                # 브라우저에서 작성
gh issue list --state open --label bug
gh issue list --assignee @me
gh issue status                                      # 나와 관련된 이슈 요약
gh issue view 42                                     # 본문·코멘트 (터미널)
gh issue view 42 --comments
gh issue comment 42 --body "확인했습니다"
gh issue edit 42 --add-label wip --add-assignee minsuhya
gh issue close 42 --reason completed
gh issue develop 42 --checkout                        # 이슈에 연결된 브랜치 생성 후 체크아웃
```

- `gh issue develop` 은 이슈 기반 브랜치 워크플로를 쓸 때 유용하다(이슈 ↔ 브랜치 연결).
- 이 저장소에는 작업을 GitHub 이슈로 분해하는 `decompose-issues` 스킬 흐름이 있으니, 대량 생성은 그쪽과 연계.

## 4. 릴리스 (release)

```bash
gh release create v1.0.0 --generate-notes           # 커밋 기반 릴리스 노트 자동 생성
gh release create v1.0.0 ./dist/*.zip --title "v1.0.0" --notes "..."
gh release create v1.0.0 --draft                     # 초안
gh release list
gh release view v1.0.0
gh release download v1.0.0                            # 에셋 내려받기
gh release upload v1.0.0 ./extra-asset.tar.gz         # 기존 릴리스에 에셋 추가
gh release edit v1.0.0 --draft=false                  # 초안 → 정식 공개
```

- `--generate-notes` 가 가장 편하다. 직전 태그 이후 커밋·PR을 모아 노트를 만든다.

## 5. GitHub Actions (run / workflow / cache)

```bash
# 워크플로 자체
gh workflow list
gh workflow view ci.yml
gh workflow run deploy.yml -f env=staging            # workflow_dispatch 수동 실행 (입력 전달)
gh workflow disable ci.yml
gh workflow enable ci.yml

# 실행(run) 조회·조작
gh run list --workflow ci.yml --limit 10
gh run view 123456789                                # 요약
gh run view 123456789 --log                          # 전체 로그
gh run view 123456789 --log-failed                   # 실패 스텝 로그만
gh run watch 123456789                               # 진행 실시간 감시
gh run rerun 123456789 --failed                      # 실패한 잡만 재실행
gh run download 123456789                             # 아티팩트 내려받기
gh run cancel 123456789

# 캐시
gh cache list
gh cache delete --all
```

- CI 디버깅 표준 흐름: `gh run list` → `gh run view <id> --log-failed` 로 실패 스텝만 바로 확인.
- `gh run watch` 는 배포 파이프라인이 끝날 때까지 기다릴 때.

## 6. 시크릿·변수 (secret / variable)

```bash
gh secret set API_KEY                                # 값을 프롬프트로 입력 (히스토리에 안 남음)
gh secret set API_KEY < key.txt                      # 파일에서
gh secret list
gh secret delete API_KEY
gh variable set DEPLOY_ENV --body "production"
gh variable list
```

- 시크릿은 조회 불가(쓰기·삭제만). 값을 명령줄 인자로 넘기지 말고 프롬프트나 파일 리다이렉트를 쓴다.
- 저장소·환경·조직 범위는 `--env <name>` / `--org <name>` 로 구분.

## 7. 검색 (search)

```bash
gh search repos --language typescript --stars ">1000" fastapi
gh search code "def create_task" --repo minsuhya/gillilab-starter
gh search issues --state open --label bug --repo minsuhya/gillilab-starter
gh search prs --author @me --state merged
gh search commits "fix: cleanup" --repo minsuhya/gillilab-starter
```

- 저장소를 넘나드는 검색은 `search`, 한 저장소 안 목록은 `pr list`/`issue list` 가 빠르다.

## 8. gist / label

```bash
gh gist create script.sh --public --desc "배포 스크립트"
gh gist create - < notes.md                          # 표준입력으로
gh gist list
gh gist edit <id>

gh label list
gh label create urgent --color E11D21 --description "긴급"
gh label clone minsuhya/other-repo                    # 다른 저장소 라벨 복제
```

## 9. API 직접 호출 (api) — gh의 만능키

전용 명령이 없는 작업은 `gh api` 로 REST/GraphQL을 직접 친다. 인증·페이지네이션을 gh가 처리해준다.

```bash
gh api repos/minsuhya/gillilab-starter               # REST GET
gh api repos/minsuhya/gillilab-starter --jq '.stargazers_count'
gh api -X PATCH repos/minsuhya/gillilab-starter -f description="화면 녹화 강의용 데모"
gh api repos/minsuhya/gillilab-starter/issues --paginate --jq '.[].title'   # 자동 페이지네이션

# GraphQL
gh api graphql -f query='
  query { viewer { login } }'
```

- **PR 인라인 코멘트처럼 CLI가 지원 안 하는 것**은 `gh api` 로 처리한다.
- `--jq` 로 jq 필터를 바로 걸 수 있어 스크립트에 유용하다.

## 10. 편의 명령

```bash
gh browse                                            # 현재 저장소를 브라우저로
gh browse --settings                                 # 설정 페이지 등 바로가기
gh browse src/app/page.tsx:10                        # 특정 파일·줄로
gh status                                            # 여러 저장소의 관련 이슈·PR·알림 요약
gh co 123                                            # = gh pr checkout 123 (기본 alias)
```

## 11. gh 커스터마이징 (alias / config / extension)

```bash
gh alias set prs 'pr list --author @me'              # gh prs 로 단축
gh alias set bugs 'issue list --label bug'
gh config set editor "code --wait"                   # 에디터 지정
gh config set git_protocol ssh
gh extension install <owner>/<repo>                  # 커뮤니티 확장 설치
gh extension list
```

- 자주 치는 조합은 `gh alias set` 으로 등록해두면 손이 준다.

---

## 자주 쓰는 워크플로 모음

**이슈 → 브랜치 → PR → 병합**
```bash
gh issue develop 42 --checkout                       # 이슈에서 브랜치 생성·체크아웃
# ...작업...
gh pr create --fill                                  # PR 생성
gh pr merge --squash --delete-branch --auto          # CI 통과 시 자동 병합
```

**CI 실패 디버깅**
```bash
gh run list --limit 5
gh run view <id> --log-failed
gh run rerun <id> --failed                            # 원인 수정 후 실패 잡만 재실행
```

**릴리스 내기**
```bash
gh release create v1.2.0 --generate-notes --title "v1.2.0"
```

---

## 참고

- 이 저장소는 계정 `minsuhya`(활성) 기준으로 인증돼 있으며 토큰 스코프는 `repo`, `workflow`, `gist`, `read:org`. `project`·조직 관리 등은 스코프 확장(`gh auth refresh -s ...`)이 필요할 수 있다.
- PR 작업 상세: **[gh-pr-guide.md](./gh-pr-guide.md)**
