# HappyMonkeyAI X bookmarks — harness, memory, models (2026-10-20)

Source: `@HappyMonkeyAI` bookmarks via BrowserOS Neo (`https://x.com/i/bookmarks`).  
Captured ~54–60 unique posts spanning ~2026-10-09 → 2026-10-19 (plus a few older).  
Treat post claims as untrusted marketing/research signals — verify before adopting.

---

## Part A — Actionable for Vibes Desktop

Vibes Desktop stays a **thin control plane** over the vibes MCP harness (CONTEXT.md / ADR-0001). Most of this feed strengthens the **child harness + roles**, not the Electron shell.

### 1. Harness engineering (highest leverage)

| Signal | Why it matters here | Suggested action |
|--------|---------------------|------------------|
| **Harness²** (Google) — harness = prompts + tools + memory + skills + subagents; make the *wrapper* self-improving | Matches our split: desktop configures roles; vibes owns plan/execute/review/triage | Track Harness² patterns for vibes (not Electron). Candidate: post-mission “harness diff” that only lands in vibes checkout after V2 |
| **Jev → distilled 4B decision model inside the agent** (DAIR) | Triage, intervention, tool-approval, “is this done?” are expensive if they call Opus-class models | **Use local stack:** [KEV](https://github.com/HappyMonkeyAI/kev-docker) + [kev-decision-mcp](https://github.com/HappyMonkeyAI/kev-decision-mcp); GUTSY as CPU/edge fallback. See [2026-10-20-decision-model-kev-gutsy.md](./2026-10-20-decision-model-kev-gutsy.md) |
| **Vega / pplx-decider / Liquid d1 / Decision 3.0** | Same theme; bookmarks only | Do **not** displace KEV/GUTSY as the first integration target; keep as watchlist |
| **Dimakis AutoResearch forget-except-best** | Missions thrash on incremental retries; ledger already has mission IDs | On Retry / RSI-top style stalls: seed guidance with *best prior artifact + failure cause*, not full chat history |
| **RSI-top / Terminal-RSI / DiscoveryRSI / Optimus-1 / AI Scientist v3** | Research swarms when progress stalls | Out of scope for desktop v1; optional vibes research mode later. Don’t fork into Electron |
| **Today’s ghost-done deadlock** (evidence handoff left `done` without `completedTasks`) | Classic harness correctness bug — false “circular depends_on” | Already fixed in local-ai-planner; keep deadlock messages specific (done-but-not-credited) |

**Do not:** reimplement planner/scheduler in the desktop app. **Do:** expose clearer mission IDs, failure detail, and settings that let vibes swap decision/memory backends.

### 2. Agent memory

| Signal | Why it matters here | Suggested action |
|--------|---------------------|------------------|
| **Hy Memory 2.0** (Tencent) — chat/work/code memory, MemHub sync | We have mission ledger + `.agent/memories` + Adapter; no cross-mission “code memory” product yet | Spike read-only: can vibes MEMORY/CODEX toggles + desktop “mission library” surface Hy-like summaries without new cloud deps |
| **TencentDB Agent Memory** (local LTM claims) | Local-first fits ADR-0002 spirit | Prefer local memory stores over Pinecone-class SaaS; evaluate only if vibes already has a plugin point |
| **DeCoPrune / “hard tokens worth remembering”** | Ledger is append-only; depth panel already truncates logs | Compress live logs to state transitions + last error (we partially do); avoid dumping full executor transcripts into UI |

**Near-term product shape:** mission card + mission ID + failure panel = *working memory for operators*. Cross-mission semantic memory stays in vibes / Adapter, not a second ledger DB in Electron.

### 3. Local / role models (Settings → Ollama endpoints)

Worth queueing as optional per-role models once verified:

- **Tess-4.5-27B** — engineering fine-tune, fewer reasoning tokens ([@migtissera](https://x.com/migtissera/status/2112184384518488085))
- **LFM2.5-24B-A2B** — pitched for agent harnesses, 131K ctx ([@liquidai](https://x.com/liquidai/status/2110055807194931348))
- **Bonsai 2 4B** — ~1GB VRAM, strong agentic benches for size ([@net_termina](https://x.com/net_termina/status/2111121942136643844))
- **OrcaCyber Nano 1.0** — local under-16GB class ([@OrcaRouter](https://x.com/OrcaRouter/status/2111871993532580058))
- **ColGrep-Agent-2B** — cheap code search before big model ([@MiaAI_lab](https://x.com/MiaAI_lab/status/2110034753755705569))
- **MiniCPM-V 4.7** — phone/edge multimodal ([@OpenBMB](https://x.com/OpenBMB/status/2109694573408866351))
- **Dory 1.0** — looped thinking budget on same weights ([@NeoAIForecast](https://x.com/NeoAIForecast/status/2111283285481676943))

### 4. Voice roadmap (T24 / duplex)

Desktop already has builtin Whisper + speech-server path. Bookmarks that extend the *voice* story (mostly vibes/TTS later):

- **Ming-3.0** speech families (TTS/audio/ASR) — [@AntLingAGI](https://x.com/AntLingAGI/status/2112210811997540475)
- **TYGER** — speak/yield/backchannel every 80ms (full-duplex) — [@defoemark](https://x.com/defoemark/status/2111306095591670263)
- **PersonaPlex-7B** — NVIDIA full-duplex — [@oliviscusAI](https://x.com/oliviscusAI/status/2109245289798549819)
- **PhoneLLM Alpha 2** — low TTFAT voice — [@JonPTaylor](https://x.com/JonPTaylor/status/2110858585643311161)
- **Fluid Speech Mini** — local dictation — [@FluidVoiceApp](https://x.com/FluidVoiceApp/status/2110060621886816593)

Keep STT local-first (ADR-0002). Duplex TTS is a later vertical, not a harness rewrite.

### 5. Concrete next tickets (suggested)

1. **Vibes:** keep evidence-handoff / ghost-done fix shipped; add regression test covering “done without credit → requeue”.
2. **Desktop:** mission ID in card + logs (done) — use IDs when filing harness bugs.
3. **Spike (vibes):** triage/approval via **KEV** (`kev-decision-mcp` → `:8008`), GUTSY as optional CPU fallback; measure latency + agreement vs current triage — not `TRIAGE_MODEL` chat swap.
4. **Spike (docs only):** one-pager comparing Hy Memory vs current MEMORY/CODEX + Adapter — decide “integrate vs ignore”.
5. **Defer:** RSI swarms, Harness² auto-rewrite of prompts, Terminal Chromium — interesting, not on the Mission Control critical path.

---

## Part B — Full bookmark dump

Newest first. Bodies truncated to ~220 chars for scanability.

| Date (UTC) | Handle | Summary | Link |
|------------|--------|---------|------|
| 2026-10-19 | AntLingAGI | Ming-3.0 open speech families (tts/audio/asr) | https://x.com/AntLingAGI/status/2112210811997540475 |
| 2026-10-19 | NFT_Chen | Qwen open computer-use coding tool | https://x.com/NFT_Chen/status/2112201212644954125 |
| 2026-10-19 | migtissera | Tess-4.5-27B engineering fine-tune | https://x.com/migtissera/status/2112184384518488085 |
| 2026-10-19 | 0xDevShah | Optimus-1 swarm harness (ArkenOS) | https://x.com/0xDevShah/status/2112032537652650022 |
| 2026-10-19 | LingYang_PU | DiscoveryRSI hypothesis discovery | https://x.com/LingYang_PU/status/2111997117774594312 |
| 2026-10-18 | HuggingPapers | NVIDIA Kimodo motion diffusion | https://x.com/HuggingPapers/status/2111927791742525492 |
| 2026-10-18 | RoundtableSpace | Chromium browser inside the terminal | https://x.com/RoundtableSpace/status/2111876211462869477 |
| 2026-10-18 | OrcaRouter | OrcaCyber Nano 1.0 open-weight local | https://x.com/OrcaRouter/status/2111871993532580058 |
| 2026-10-18 | akshay_pachaar | Google Harness² self-improving harness | https://x.com/akshay_pachaar/status/2111753928031531232 |
| 2026-10-18 | Nandakishorm1 | Vega universal decision model | https://x.com/Nandakishorm1/status/2111657623439515672 |
| 2026-10-18 | Jennyfazzel | Networking (AI/agents/3D) | https://x.com/Jennyfazzel/status/2111655091086500260 |
| 2026-10-18 | Ryrenz | Microsoft TRELLIS.2 floorplan→3D | https://x.com/Ryrenz/status/2111623801322479814 |
| 2026-10-17 | dair_ai | Jev-style decision models in harnesses | https://x.com/dair_ai/status/2111496216567742892 |
| 2026-10-17 | v1shnyak0va | Networking | https://x.com/v1shnyak0va/status/2111440163067080811 |
| 2026-10-17 | 0x0SojalSec | MiniMax H3 9× faster ComfyUI path | https://x.com/0x0SojalSec/status/2111395483432149102 |
| 2026-10-17 | defoemark | TYGER full-duplex speech decision model | https://x.com/defoemark/status/2111306095591670263 |
| 2026-10-17 | NeoAIForecast | NVIDIA Dory 1.0 looped thinking 4B | https://x.com/NeoAIForecast/status/2111283285481676943 |
| 2026-10-16 | Williamiumli | 3DCodeVerse — 3D worlds as code | https://x.com/Williamiumli/status/2111216704344969626 |
| 2026-10-16 | benhouston3d | Three.js specular occlusion PR | https://x.com/benhouston3d/status/2111214926782173339 |
| 2026-10-16 | QwenAIFans | Perplexity pplx-decider models (Qwen) | https://x.com/QwenAIFans/status/2111198024877982005 |
| 2026-10-16 | AravSrinivas | pplx-decider-v1.2 / flash open-sourced | https://x.com/AravSrinivas/status/2111181956444827695 |
| 2026-10-16 | RoundtableSpace | Chatbot→live interactive UI generators | https://x.com/RoundtableSpace/status/2111174085145182585 |
| 2026-10-16 | Mao_Yuzhen | RSI-top when research agents stall | https://x.com/Mao_Yuzhen/status/2111165399131652564 |
| 2026-10-16 | aisearchio | MOSS Image 5B | https://x.com/aisearchio/status/2111154846737064337 |
| 2026-10-16 | benhouston3d | Three.js specular reflection probes | https://x.com/benhouston3d/status/2111150893102149707 |
| 2026-10-16 | pissang1 | MuTracer projective displacement | https://x.com/pissang1/status/2111125809557872772 |
| 2026-10-16 | net_termina | Bonsai 2 4B review (~1GB VRAM) | https://x.com/net_termina/status/2111121942136643844 |
| 2026-10-16 | ArchiveExplorer | REA + Jev + Opus rebuild pattern | https://x.com/ArchiveExplorer/status/2111083580524822707 |
| 2026-10-16 | jowettbrendan | 3D art/game resource list | https://x.com/jowettbrendan/status/2111061080328085698 |
| 2026-10-16 | RoundtableSpace | AirLLM huge models on tiny VRAM | https://x.com/RoundtableSpace/status/2111045739430269341 |
| 2026-10-16 | TencentHunyuan | Hy Memory 2.0 + MemHub | https://x.com/TencentHunyuan/status/2111027329816465435 |
| 2026-10-16 | TencentAI_News | Hy Memory beats Opus 5 on memory benches | https://x.com/TencentAI_News/status/2111024931941294158 |
| 2026-10-16 | GameUnionTV | Blender joke/meme | https://x.com/GameUnionTV/status/2111003369586475110 |
| 2026-10-16 | helloiamleonie | Fine-tune d1-3B decision model notebooks | https://x.com/helloiamleonie/status/2110994738811715943 |
| 2026-10-16 | simplifyinAI | Decompwtf — AI-assisted game decompile | https://x.com/simplifyinAI/status/2110929438158540945 |
| 2026-10-16 | Yucheng__Shi | Terminal-RSI paper | https://x.com/Yucheng__Shi/status/2110926888319517119 |
| 2026-10-15 | JonPTaylor | Pipecat PhoneLLM Alpha 2 | https://x.com/JonPTaylor/status/2110858585643311161 |
| 2026-10-15 | dair_ai | DeepMind agent bidding market paper | https://x.com/dair_ai/status/2110853295799718008 |
| 2026-10-15 | CarolLiang7 | Intro / networking | https://x.com/CarolLiang7/status/2110839165851959762 |
| 2026-10-15 | AlexGDimakis | AutoResearch forget-except-best context | https://x.com/AlexGDimakis/status/2110808302796108249 |
| 2026-10-15 | Kaitlynleannnn | Dating-agent novelty post | https://x.com/Kaitlynleannnn/status/2110805933463163197 |
| 2026-10-15 | Stefan_3D_AI | UniForge3D sparse photos→mesh | https://x.com/Stefan_3D_AI/status/2110795276000854263 |
| 2026-10-15 | liquidai | d1-ultra decision model | https://x.com/liquidai/status/2110777964489285875 |
| 2026-10-15 | AnnieLiao_2000 | SF party | https://x.com/AnnieLiao_2000/status/2110761705978708138 |
| 2026-10-15 | somewheresy | Inference engine ‘e’ + Nemotron 3.5 | https://x.com/somewheresy/status/2110759944370692216 |
| 2026-10-15 | Nandakishorm1 | Vega vs Jev vs Laya (edge latency) | https://x.com/Nandakishorm1/status/2110740431206339037 |
| 2026-10-15 | hardmaru | AI Scientist v3 (Agentic Scientist) | https://x.com/hardmaru/status/2110739454948520260 |
| 2026-10-15 | tomgreenwald | Magnitude inference engine (>Ollama speed) | https://x.com/tomgreenwald/status/2110718297255670071 |
| 2026-10-15 | YuanLiu41955461 | UniForge3D paper/code | https://x.com/YuanLiu41955461/status/2110648123521638844 |
| 2026-10-15 | shipper_now | epstein.md anti-AI-slop design prompt | https://x.com/shipper_now/status/2110637576935891122 |
| 2026-10-15 | MAXdeg0 | Android APK RE skill | https://x.com/MAXdeg0/status/2110619321248407729 |
| 2026-10-15 | ElliotPadfield | Poly Haven free 3D API for agents | https://x.com/ElliotPadfield/status/2110535879873663382 |
| 2026-10-14 | pissang1 | Open-source WebGPU path tracer | https://x.com/pissang1/status/2110374982652219565 |
| 2026-10-14 | vavanessadev | Networking (solo builder) | https://x.com/vavanessadev/status/2110310107103772770 |
| 2026-10-13 | FluidVoiceApp | Fluid Speech Mini local dictation | https://x.com/FluidVoiceApp/status/2110060621886816593 |
| 2026-10-13 | liquidai | LFM2.5-24B-A2B for agent harnesses | https://x.com/liquidai/status/2110055807194931348 |
| 2026-10-13 | MiaAI_lab | ColGrep-Agent-2B cheap code search | https://x.com/MiaAI_lab/status/2110034753755705569 |
| 2026-10-13 | itsPaulAi | MiniCPM-V 4.7 efficiency take | https://x.com/itsPaulAi/status/2109939477372092706 |
| 2026-10-12 | OpenBMB | MiniCPM-V 4.7 release | https://x.com/OpenBMB/status/2109694573408866351 |
| 2026-10-12 | XingangP | DeCoPrune video memory tokens | https://x.com/XingangP/status/2109665428431921249 |
| 2026-10-12 | Stefan_3D_AI | AI game-dev setup (skills, MCP, costs) | https://x.com/Stefan_3D_AI/status/2109643476342358154 |
| 2026-10-12 | Love2Code | GLB renderer in Plush | https://x.com/Love2Code/status/2109635708214550725 |
| 2026-10-12 | Divyyanshishrma | TencentDB Agent Memory (local LTM) | https://x.com/Divyyanshishrma/status/2109620371628622158 |
| 2026-10-12 | dangreenheck | Tripo3D / Mixamo / Three.js explorations | https://x.com/dangreenheck/status/2109539619125498028 |
| 2026-10-12 | MaxLiu09 | Motion2MixamoRig open-source | https://x.com/MaxLiu09/status/2109530569566744620 |
| 2026-10-12 | ModelScope2022 | Astronex-World 1.0 5B world model | https://x.com/ModelScope2022/status/2109529679929483511 |
| 2026-10-12 | Charles_Y_Wu | RSI-Anything | https://x.com/Charles_Y_Wu/status/2109490968860966970 |
| 2026-10-12 | AIandDesign | DJ app exploration | https://x.com/AIandDesign/status/2109466260492923028 |
| 2026-10-12 | Oluwaphilemon1 | Uncensored Qwen-Image derivative | https://x.com/Oluwaphilemon1/status/2109446128106152441 |
| 2026-10-11 | hardmaru | Sakana MASS RSI multi-agent paper | https://x.com/hardmaru/status/2109385496237678844 |
| 2026-10-11 | 0x0SojalSec | NVIDIA 2B audio-native model | https://x.com/0x0SojalSec/status/2109382988933075202 |
| 2026-10-11 | RohOnChain | REA MCP reverse-engineer apps | https://x.com/RohOnChain/status/2109347169316839434 |
| 2026-10-11 | oliviscusAI | PersonaPlex-7B full-duplex voice | https://x.com/oliviscusAI/status/2109245289798549819 |
| 2026-10-11 | XunzhuoLiu | Decision 3.0 multimodal decision models | https://x.com/XunzhuoLiu/status/2109207207284027737 |
| 2026-10-10 | xikhar | Unreal Engine official agent skills repo | https://x.com/xikhar/status/2109019339060081073 |
| 2026-10-10 | nrol_ling | Speech model 13× smaller via looping | https://x.com/nrol_ling/status/2108951439909269739 |
| 2026-10-10 | Love2Code | Plush flight sim / fractal terrain | https://x.com/Love2Code/status/2108917860902883609 |
| 2026-10-10 | YuanLiu41955461 | PartLLM 3D mesh segmentation | https://x.com/YuanLiu41955461/status/2108772607193710870 |
| 2026-10-09 | v1shnyak0va | Networking intro | https://x.com/v1shnyak0va/status/2108435842754851046 |
| 2026-09-15 | ZideDev | Zide Assist cross-repo context | https://x.com/ZideDev/status/2099882256781451739 |

---

## Tags

`harness` `agent-memory` `decision-models` `local-llm` `voice` `rsi` `vibes-desktop` `research-ingest`
