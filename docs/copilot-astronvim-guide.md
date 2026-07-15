# AstroNvim에서 CopilotChat.nvim 설정하기

GitHub Copilot Pro 구독 계정으로 AstroNvim에서 [CopilotChat.nvim](https://github.com/CopilotC-Nvim/CopilotChat.nvim) 채팅 UI를 쓰기 위한 설정 가이드.

- 대상: AstroNvim(astrocommunity 사용), Neovim 0.10+, curl 8.0.0+
- 핵심: **인증 백엔드(copilot.lua)** 와 **채팅 UI(CopilotChat)** 를 분리해 넣고, model 은 opts 로 오버라이드한다.

> ⚠️ **model 이름은 추측 금지.** 사용 가능한 모델은 계정·시점마다 다르다. 반드시 `:CopilotChatModels` 로 실제 목록을 확인하고 그 문자열을 그대로 넣는다. (아래 예시의 `claude-sonnet-4` 도 실제 목록에서 확인 후 사용할 것)

---

## 왜 팩을 두 개 넣는가

CopilotChat.nvim 은 **채팅 UI일 뿐**이고, Copilot 인증 토큰은 `copilot.lua` 가 발급한다. 따라서 둘 다 필요하다:

| 팩 | 역할 |
|---|---|
| `astrocommunity.completion.copilot-lua` | Copilot 인증 + 인라인 자동완성 (**인증 백엔드**) |
| `astrocommunity.ai.copilotchat-nvim` | CopilotChat 채팅 UI |

`copilot-lua` 없이 CopilotChat 만 넣으면 토큰이 없어 채팅이 안 뜬다 — 가장 흔한 실패 원인.

## 1. 전제조건 — 인증 백엔드

`lua/community.lua` 에 두 팩을 추가:

```lua
-- lua/community.lua
return {
  { import = "astrocommunity.pack.lua" },

  -- Copilot 인증 + 인라인 자동완성 (인증 백엔드)
  { import = "astrocommunity.completion.copilot-lua" },

  -- CopilotChat 채팅 UI
  { import = "astrocommunity.ai.copilotchat-nvim" },
}
```

- 사전 요구: `curl 8.0.0+`, `Neovim 0.10+` (`curl --version` 으로 확인).
- 추가 후 재시작 → `:Copilot auth` 로 GitHub 로그인(**Copilot Pro 구독 계정**으로). 한 번 해두면 CopilotChat 도 같은 토큰을 공유한다.

## 2. Model 설정 — opts 오버라이드

팩 기본값은 `opts = {}` 라 model 이 안 잡힌다(기본 모델 `gpt-5-mini`). 별도 스펙 파일로 덮어쓴다:

```lua
-- lua/plugins/copilotchat.lua
return {
  "CopilotC-Nvim/CopilotChat.nvim",
  opts = {
    model = "claude-sonnet-4",  -- :CopilotChatModels 로 확인한 실제 id 사용
    temperature = 0.1,
    window = {
      layout = "vertical",
      width = 0.4,
    },
  },
}
```

- **먼저 `:CopilotChatModels` 실행** → 실제 목록(예: `gpt-4o`, `claude-sonnet-4`, `claude-3.7-sonnet`, `o3-mini` 등) 확인 후 그 문자열을 `model` 에 넣는다.
- 채팅 중 프롬프트에서 `$claude-sonnet-4` 형식으로 즉석 전환도 가능.

## 3. 사용법 — 팩이 넣어주는 키맵

astrocommunity 팩이 `<Leader>P` 프리픽스로 자동 매핑한다:

| 키 | 동작 |
|---|---|
| `<Leader>Po` / `Pt` / `Pc` | Open / Toggle / Close |
| `<Leader>Pq` | Quick Chat — 버퍼 대상(노멀) / 선택영역(비주얼) |
| `<Leader>Pp` | Prompt actions (Explain / Fix / Tests 등 선택) |
| `<Leader>Pr` / `Ps` | Reset / Stop |

- 프리픽스 변경: astrocore 의 `options.g.copilot_chat_prefix` 설정.

## 4. 검증 순서

```vim
:Copilot status        " Online / Enabled 확인 (안 되면 :Copilot auth)
:CopilotChatModels     " model id 확인 → 2번 opts.model 에 반영
:CopilotChatToggle     " 또는 <Leader>Pt 로 채팅 창 확인
```

---

## 자주 겪는 문제

| 증상 | 원인·해결 |
|---|---|
| 채팅이 안 뜸 | `copilot-lua` 팩 누락 → `community.lua` 에 추가 후 `:Copilot auth` |
| model 이 기본값(`gpt-5-mini`)만 잡힘 | `opts.model` 미설정 → 2번 스펙 파일 추가 |
| 인증 실패 | `:Copilot auth` 를 Copilot **Pro 구독 계정**으로 재실행 |
| curl 관련 오류 | `curl 8.0.0+` 필요 → `curl --version` 확인 후 업그레이드 |

## 출처

- [CopilotChat.nvim (공식 저장소)](https://github.com/CopilotC-Nvim/CopilotChat.nvim)
- astrocommunity — `copilot-lua` / `copilotchat-nvim` 팩
