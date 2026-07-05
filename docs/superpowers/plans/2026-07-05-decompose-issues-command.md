# decompose-issues 슬래시 커맨드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 작업 설명을 인자로 받아 독립적인 GitHub 이슈들로 분해하고, 승인 시 의존성 순서대로 실제 이슈를 생성하는 `/decompose-issues` 프로젝트 슬래시 커맨드와 그 이슈 템플릿을 추가한다.

**Architecture:** 코드 변경 없음. 프롬프트 지시문 파일(`.claude/commands/decompose-issues.md`) 하나와 GitHub 이슈 템플릿 파일(`.github/ISSUE_TEMPLATE/task.md`) 하나만 추가한다. 커맨드는 실행 시 `gh` CLI로 레이블 조회/이슈 생성을 수행한다.

**Tech Stack:** GitHub CLI (`gh`), Claude Code 프로젝트 슬래시 커맨드, Markdown/YAML frontmatter.

## Global Constraints

- 커맨드 이름: `/decompose-issues` (설계 승인됨, 변경 금지).
- 레이블은 자동 제안만 하고, 저장소에 없는 레이블은 자동 생성하지 않는다 — `gh label list`로 조회된 것만 사용.
- 의존성은 "순서대로 생성 + 본문 상호 참조(`Depends on:` / `Blocks:`)" 방식만 사용한다 — 트래킹 이슈+체크리스트 방식은 사용하지 않는다.
- 이슈 템플릿은 단일 범용 템플릿(`task.md`) 하나만 만든다 — type별 다중 템플릿은 비범위.
- 모든 사용자 대상 텍스트(커맨드 지시문, 템플릿, 출력 표)는 한국어로 작성한다 (프로젝트 기본 언어 규칙, `CLAUDE.md`).
- 참조 스펙: `docs/superpowers/specs/2026-07-05-decompose-issues-command-design.md`

---

### Task 1: GitHub 이슈 템플릿 생성

**Files:**
- Create: `.github/ISSUE_TEMPLATE/task.md`

**Interfaces:**
- Consumes: 없음 (독립 파일).
- Produces: 사람이 GitHub 웹에서 "New Issue" 시 선택하는 템플릿. Task 3에서 커맨드가 생성하는 이슈 본문 구조가 이 템플릿의 필드(배경/목표, 작업 내용, 완료 조건, 의존성, 참고)와 1:1 대응해야 한다.

- [ ] **Step 1: 템플릿 파일 작성**

`.github/ISSUE_TEMPLATE/task.md` 파일을 아래 내용으로 정확히 작성한다:

```markdown
---
name: Task
about: 분해된 작업 단위 이슈 (decompose-issues 커맨드가 생성하는 형식과 동일)
title: "[Task] "
labels: ""
assignees: ""
---

## 배경 / 목표
<!-- 이 작업이 왜 필요한지, 무엇을 달성하려는지 -->

## 작업 내용
<!-- 구체적으로 무엇을 할지, 체크리스트 형태 권장 -->
- [ ]
- [ ]

## 완료 조건 (Definition of Done)
<!-- 이 항목이 모두 충족되면 이슈를 닫을 수 있음 -->
-

## 의존성
<!-- 예: Depends on: #3 / Blocks: #7 / 없음 -->

## 참고
<!-- 관련 문서, 링크, 스크린샷 등 -->
```

- [ ] **Step 2: frontmatter 필드 검증**

Run:

```bash
grep -q '^name: Task$' .github/ISSUE_TEMPLATE/task.md && \
grep -q '^about:' .github/ISSUE_TEMPLATE/task.md && \
grep -q '^title:' .github/ISSUE_TEMPLATE/task.md && \
grep -q '^## 배경 / 목표$' .github/ISSUE_TEMPLATE/task.md && \
grep -q '^## 완료 조건 (Definition of Done)$' .github/ISSUE_TEMPLATE/task.md && \
grep -q '^## 의존성$' .github/ISSUE_TEMPLATE/task.md && \
echo OK
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .github/ISSUE_TEMPLATE/task.md
git commit -m "Add generic GitHub issue template for decomposed tasks"
```

---

### Task 2: `/decompose-issues` 슬래시 커맨드 생성

**Files:**
- Create: `.claude/commands/decompose-issues.md`

**Interfaces:**
- Consumes: 없음 (독립 파일). Task 1의 템플릿 필드 구조(배경/목표, 작업 내용, 완료 조건, 의존성, 참고)를 이슈 본문 생성 시 그대로 재사용한다.
- Produces: `/decompose-issues <작업 설명>` 슬래시 커맨드. Task 3의 수동 검증이 이 커맨드를 직접 실행해서 확인한다.

- [ ] **Step 1: 커맨드 파일 작성**

`.claude/commands/decompose-issues.md` 파일을 아래 내용으로 정확히 작성한다:

````markdown
---
description: 작업을 독립적인 GitHub 이슈로 분해하는 전략 전문가
argument-hint: <분해할 작업 설명>
allowed-tools: Bash(gh label list:*), Bash(gh issue create:*), Bash(gh issue edit:*), Bash(gh issue view:*), Bash(gh repo view:*), Bash(gh auth status:*)
---

# 이슈 분해 전략 전문가

당신은 하나의 작업을 독립적으로 처리 가능한 여러 GitHub 이슈로 분해하는 전략 전문가입니다. 아래 절차를 순서대로 따르세요.

## 입력 작업

$ARGUMENTS

작업 설명이 비어 있거나 너무 모호하면, 진행하기 전에 사용자에게 한 문장으로 범위를 되물으세요.

## 절차

### 1. 작업분석
입력된 작업의 목표, 제약, 범위를 분석하세요. 이 작업이 왜 필요한지, 무엇이 완료되면 끝인지를 먼저 명확히 하세요.

### 2. 작업분해
작업을 각각 독립적으로 완료 가능한 단위(이슈)로 분해하세요. 각 단위는:
- 하나의 명확한 목적을 가져야 합니다.
- 다른 단위 없이도 (또는 명시된 의존성만 해결되면) 완료 가능해야 합니다.
- 완전히 독립적이지 않다면 반드시 의존성으로 표시하세요 (임의로 합치지 마세요).

### 3. 의존성분석
분해된 이슈 간 선후관계를 파악해 방향성 그래프로 정리하세요. `#번호 depends_on #번호` 형태로 표현하세요 (여기서 번호는 이 단계에서 임시로 매긴 순번이며, 실제 GitHub 이슈 번호는 6단계에서 생성 후 확정됩니다).
- 순환 의존성이 발견되면, 4단계로 넘어가기 전에 경고하고 분해를 재조정하세요.

### 4. 분해된 이슈 출력
아래 표 형식으로 터미널에 출력하세요:

| 번호 | 제목 | 배경/목표 | 작업내용 | 완료조건(DoD) | 제안 레이블 | 의존성 |
|---|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... | 없음 |
| 2 | ... | ... | ... | ... | ... | #1에 의존 |

제안 레이블을 채우기 전에 실제 저장소 레이블 목록을 조회하세요:

```bash
gh label list
```

조회된 레이블 중에서만 매칭하세요. 존재하지 않는 레이블은 제안하지 마세요.

### 5. GitHub 이슈 생성 여부 질문
`AskUserQuestion` 도구로 다음을 물으세요: "지금 GitHub에 이슈로 생성할까요?" (예/아니오, 단일 선택)

"아니오"를 선택하면 여기서 종료하세요. 아무 이슈도 생성하지 마세요.

### 6. 이슈 생성 (예 선택 시)
생성 전에 인증 상태를 확인하세요:

```bash
gh auth status
```

인증되어 있지 않으면 안내 메시지만 출력하고 중단하세요 (이슈를 생성하지 마세요).

인증되어 있으면, 의존성 순서대로(의존 대상이 먼저 생성되도록) 이슈를 하나씩 순차 생성하세요. 각 이슈는 다음 본문 구조를 사용하세요:

```
## 배경 / 목표
<2단계에서 정리한 배경/목표>

## 작업 내용
- [ ] <작업 항목>

## 완료 조건 (Definition of Done)
- <DoD 항목>

## 의존성
Depends on: #<이미 생성된 의존 이슈 번호> (없으면 "없음")

## 참고
<필요 시 참고 링크>
```

생성 명령 예시:

```bash
gh issue create --title "<제목>" --body "<위 구조로 채운 본문>" --label "<제안 레이블 콤마 구분>"
```

- 나중에 생성되는 이슈가 앞서 생성된 이슈에 의존한다면, 본문의 `Depends on:` 항목에 실제 이슈 번호(`gh issue create` 출력의 URL에서 파싱)를 채우세요.
- 앞서 생성된 이슈가 나중에 생성되는 이슈에 의해 블로킹된다면, `gh issue edit <먼저 생성된 번호> --body "..."`로 본문에 `Blocks: #<나중 번호>`를 추가하세요.
- 4단계에서 확인한 레이블만 `--label`에 사용하세요.

생성이 끝나면 생성된 모든 이슈 번호와 URL을 목록으로 출력하세요.
````

- [ ] **Step 2: frontmatter 및 필수 섹션 검증**

Run:

```bash
grep -q '^description:' .claude/commands/decompose-issues.md && \
grep -q '^argument-hint:' .claude/commands/decompose-issues.md && \
grep -q '^allowed-tools:' .claude/commands/decompose-issues.md && \
grep -q '\$ARGUMENTS' .claude/commands/decompose-issues.md && \
grep -q '### 1. 작업분석' .claude/commands/decompose-issues.md && \
grep -q '### 2. 작업분해' .claude/commands/decompose-issues.md && \
grep -q '### 3. 의존성분석' .claude/commands/decompose-issues.md && \
grep -q '### 4. 분해된 이슈 출력' .claude/commands/decompose-issues.md && \
grep -q '### 5. GitHub 이슈 생성 여부 질문' .claude/commands/decompose-issues.md && \
grep -q '### 6. 이슈 생성' .claude/commands/decompose-issues.md && \
echo OK
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/decompose-issues.md
git commit -m "Add /decompose-issues slash command for task-to-issue decomposition"
```

---

### Task 3: 엔드투엔드 수동 검증

**Files:**
- 없음 (기존 파일만 실행/조회).

**Interfaces:**
- Consumes: Task 1의 템플릿 필드 구조, Task 2의 커맨드.
- Produces: 검증 완료 여부 (통과/실패 기록). 실패 시 Task 1 또는 Task 2로 돌아가 수정.

이 태스크는 Claude Code 세션 안에서 실제로 커맨드를 실행해야 하므로, 실행자가 대화형으로 직접 수행한다. gh 인증이 되어 있고 origin이 실제 GitHub 저장소를 가리키는 상태에서 진행한다.

- [ ] **Step 1: 분해 전용(생성 없이) 실행**

세션에서 다음을 실행한다:

```
/decompose-issues 블로그에 댓글 기능 추가: 댓글 작성, 댓글 삭제, 스팸 필터링
```

Expected: 4단계 표가 번호/제목/배경·목표/작업내용/완료조건/제안 레이블/의존성 7개 컬럼으로 출력되고, 최소 1개 이상의 행에 "없음"이 아닌 의존성이 표시된다. 제안 레이블은 `gh label list` 결과에 실제로 존재하는 값만 사용된다.

- [ ] **Step 2: "아니오" 선택 시 생성되지 않음을 확인**

5단계 질문에서 "아니오"를 선택한다.

생성 전후 이슈 개수를 비교한다:

```bash
gh issue list --state all --limit 100 | wc -l
```

Expected: Step 1 실행 전과 실행 후의 개수가 동일하다 (새 이슈가 생기지 않음).

- [ ] **Step 3: "예" 선택 시 순차 생성 및 상호 참조 확인**

Step 1과 동일한 입력으로 커맨드를 다시 실행하고, 5단계 질문에서 "예"를 선택한다.

Expected: 커맨드가 의존성이 없는 이슈부터 먼저 생성하고, 의존하는 이슈 본문에 실제 이슈 번호로 `Depends on: #N`이 채워진다. 생성된 이슈 번호와 URL 목록이 출력된다.

생성된 각 이슈를 확인한다:

```bash
gh issue view <생성된 번호> --json title,body,labels
```

Expected: `body`에 배경/목표, 작업 내용, 완료 조건, 의존성, 참고 섹션이 모두 포함되고, 의존 관계가 있는 이슈는 `Depends on: #<실제 번호>`가 정확히 채워져 있다. `labels`는 4단계에서 제안한 레이블과 일치한다.

- [ ] **Step 4: 순환 의존성 경고 확인**

의도적으로 순환을 유도하는 입력으로 실행한다:

```
/decompose-issues A 작업은 B 작업이 끝나야 시작할 수 있고, B 작업은 A 작업이 끝나야 시작할 수 있다
```

Expected: 3단계에서 순환 의존성 경고가 출력되고, 4단계 표 출력 전에 재분해 여부를 확인한다 (표가 순환된 의존성 그대로 출력되지 않는다).

- [ ] **Step 5: 테스트 이슈 정리**

Step 3에서 생성된 테스트용 이슈를 닫는다 (삭제는 하지 않음 — 되돌리기 쉬운 쪽을 선택):

```bash
gh issue close <Step 3에서 생성된 번호들> --comment "decompose-issues 커맨드 검증용 테스트 이슈, 검증 완료 후 종료"
```

Expected: 해당 이슈들이 `CLOSED` 상태로 바뀐다. `gh issue list --state closed --limit 5`로 확인.
