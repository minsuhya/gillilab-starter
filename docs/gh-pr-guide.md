# gh CLI로 Pull Request 처리하기

GitHub CLI(`gh`)로 PR을 만들고, 리뷰하고, 병합하는 실무 참조 문서.

- 검증 환경: gh 2.96.0, 저장소 `github.com:minsuhya/gillilab-starter`
- PR 지정 방법: **번호**(`123`) · **URL** · **브랜치 이름** 중 아무거나. 생략하면 현재 체크아웃된 브랜치의 PR을 자동으로 찾는다.

> ⚠️ **이 셸의 주의점**: rtk 훅이 `gh ...` → `rtk gh ...` 로 자동 치환한다. 일반 명령은 정상 동작하지만 `--help` 출력은 rtk가 가로채므로, 도움말은 전체 경로 `/opt/homebrew/bin/gh <cmd> --help` 로 확인한다.

---

## 1. PR 만들기

```bash
gh pr create --fill                              # 커밋 메시지로 제목·본문 자동 채움 (가장 흔함)
gh pr create --base master --title "..." --body "..."
gh pr create --draft                             # 초안으로 생성
gh pr create --web                               # 브라우저에서 작성 (lazygit의 o 키와 동일)
```

- `--fill`: 커밋이 하나면 그 메시지가 제목·본문이 되고, 여러 개면 제목은 브랜치명 / 본문은 커밋 목록.
- 초안으로 열었다가 준비되면 `gh pr ready` 로 전환.

## 2. 현황 파악

```bash
gh pr status                                     # 내 PR / 리뷰 요청받은 PR / 현재 브랜치 PR + CI 상태
gh pr list                                       # 열린 PR 목록
gh pr list --state all --author @me
gh pr list --search "review-requested:@me"
```

`gh pr status` 는 하루 시작할 때 한눈에 보기 좋다.

## 3. 내용 확인

```bash
gh pr view 123                                   # 제목·본문·상태 (터미널)
gh pr view 123 --comments                        # 코멘트까지 포함
gh pr view 123 --web                             # 브라우저로 열기
gh pr diff 123                                   # 변경 diff
gh pr diff 123 --name-only                       # 바뀐 파일 목록만
gh pr checks 123                                 # CI 체크 상태
gh pr checks 123 --watch                         # CI 끝날 때까지 실시간 감시 (병합 전 대기용)
```

## 4. 로컬에서 직접 돌려보기

```bash
gh pr checkout 123                               # PR 브랜치를 로컬에 체크아웃
# 이 프로젝트라면: make dev-local 로 띄워서 실제 동작 확인
git switch master                                # 확인 끝나면 복귀
```

diff만 읽는 것과 실제로 받아 실행하는 것은 다르다. 리뷰의 핵심 단계.

## 5. 리뷰 남기기

```bash
gh pr review 123 --approve
gh pr review 123 --request-changes --body "여기 널 체크가 빠졌습니다"
gh pr review 123 --comment --body "확인했습니다"
gh pr comment 123 --body "일반 대화 코멘트"          # 정식 리뷰가 아닌 코멘트
```

- 정식 리뷰: `--approve` / `--request-changes` / `--comment` 중 하나.
- 본문이 길면 `--body-file <파일>` 또는 `--body-file -`(표준입력) 사용.
- **한계**: 특정 줄에 인라인 코멘트를 다는 것은 gh CLI로 불가능. 웹 또는 API 필요.

## 6. 병합

```bash
gh pr merge 123 --squash --delete-branch         # squash 후 로컬·원격 브랜치 삭제
gh pr merge 123 --merge                          # 머지 커밋
gh pr merge 123 --rebase                         # 리베이스
gh pr merge 123 --squash --auto                  # CI 통과하면 자동 병합
gh pr merge 123 --admin                          # 보호 규칙 무시 (권한 있을 때)
```

- `--squash` / `--merge` / `--rebase` 중 하나 필수. 생략하면 대화형으로 물어본다.
- `--delete-branch`: 병합 후 로컬·원격 브랜치 함께 삭제.
- `--auto`: CI가 도는 중에도 걸어두면 통과 즉시 GitHub가 알아서 병합.
- 병합 후 문제 발견 시 `gh pr revert 123` 으로 되돌리는 PR 생성.

## 7. 기타 자주 쓰는 명령

```bash
gh pr ready 123                                  # 초안 → 리뷰 준비 완료
gh pr edit 123 --add-reviewer minsuhya --add-label bug
gh pr update-branch 123                          # base 브랜치 최신 변경을 PR 브랜치에 반영
gh pr close 123
gh pr reopen 123
```

---

## 전형적인 리뷰 한 사이클

```bash
gh pr status                                     # 1. 뭐가 왔는지 확인
gh pr checkout 123                               # 2. 받아서
make dev-local                                   # 3. 실제로 돌려보고
gh pr diff 123                                   # 4. 코드를 읽고
gh pr review 123 --approve                       # 5. 승인한 뒤
gh pr merge 123 --squash --delete-branch --auto  # 6. CI 통과 시 자동 병합
```

## lazygit 연계

lazygit은 PR **생성·열기**까지만 지원한다(로컬 브랜치 패널 `3`에서):

| 키 | 동작 |
|---|---|
| `o` | 선택 브랜치로 PR 생성 페이지를 브라우저에서 염 |
| `O` | 베이스 브랜치를 고른 뒤 PR 생성 페이지를 염 |
| `G` | 그 브랜치에 열려 있는 PR을 브라우저에서 염 (커밋 패널에서도 동작) |
| `Ctrl+y` | PR 생성 URL을 클립보드에 복사 |

리뷰·머지·코멘트 등 나머지 처리는 위 gh 명령으로 한다. lazygit `customCommands` 로 gh를 호출하는 키를 만들어 둘 수도 있다(`subprocess: true` 필요).
