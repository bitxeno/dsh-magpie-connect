# dsh-magpie-connect

**Magpie LAN gateway models, natively inside DSH (DeepSeek Harness).**

No extra process. Points at your configured gateway origin and serves
every model from `GET /v1/models` in the DSH model picker as provider
`dsh-magpie-connect` (picker label `magpie`).

> The gateway is **not** configured out of the box: set the API URL **and**
> API key on the Settings → Magpie page (or via `cordis.patch.yml`). Both
> are required — until then the picker stays empty and calls fail fast with
> a "not configured" error.

- **双接口** — `/v1/chat/completions` 与 `/v1/responses` 按模型 `native_endpoints`
  自动分流（Muse Spark / Codex / Grok 走 responses，其余走 completions）
- **图片识别** — 声明 `modalities.input: image` 的模型开放图片输入，经 harness
  附件服务取字节后以 OpenAI `image_url` / `input_image` 上行
- **思考级别选择** — 网关 `supported_reasoning_levels` 原样进 picker（含 `none` /
  `ultra` 扩展档），直通网关不截断；过期档位按就近原则收敛，不会 400

## Install

```sh
dsh plugin --profile web add dsh-magpie-connect
```

Restart `dsh web` after installing. Requires DSH with a web profile;
Node.js ≥ 20; LAN route to `http://api.lan`.

## Settings page

Settings → Magpie 网关 (sidebar): edit the API URL and API key, test the
connection (reports how many models the endpoint serves), and tick which
models appear in the model picker. Everything saves to
`~/.dsh-magpie-connect/settings.json` and applies immediately — no restart.

Precedence per field: settings page > `cordis.patch.yml` config > defaults.
Hidden models only come from the page; an empty list shows everything.

## Configuration

Set the gateway URL first — either on the Settings → Magpie page (recommended,
applies instantly) or via the profile's `cordis.patch.yml`:

```yaml
- id: dsh-magpie-connect
  name: 'dsh-magpie-connect'
  config:
    providerId: dsh-magpie-connect
    displayName: magpie
    baseUrl: http://api.lan  # gateway origin (/v1 appended when missing)
    apiKey: not-needed       # LAN gateway needs none
    refreshSeconds: 300
    maxRetries: 2
    timeoutMs: 300000
    firstEventTimeoutMs: 90000
    idleTimeoutMs: 60000
```

| Option | Default | Description |
| --- | --- | --- |
| `providerId` | `dsh-magpie-connect` | Provider name shown in DSH. |
| `displayName` | `magpie` | Picker grouping label. |
| `baseUrl` | `''` (not configured) | Gateway origin, e.g. `http://127.0.0.1:3425/v1`. Required. |
| `apiKey` | `''` (not configured) | Bearer key. Required, even if `/v1/models` answers without one. |
| `dataDir` | `~/.dsh-magpie-connect` | State dir (status, settings file, cache). |
| `refreshSeconds` | `300` | Live catalog refresh interval. |
| `maxRetries` | `2` | Connection-setup retries on 429/5xx. |
| `timeoutMs` | `300000` | Overall upstream request cap in ms. |
| `firstEventTimeoutMs` | `90000` | Stall watchdog: max wait for first event. |
| `idleTimeoutMs` | `60000` | Stall watchdog: max silence between events. |

## How it works

```
DSH session
   │  harness chunks (block-start / text-delta / usage / finish …)
   ▼
MagpieAdapter (registered LlmAdapter)
   │  pi-ai openai-completions stream (default) /
   │      openai-responses stream (responses-only lane)
   ▼
http://api.lan/v1  ← chat/completions or responses per native_endpoints
```

- **Catalog** — `GET /v1/models` 全量接入，无付费过滤；磁盘缓存 + 编译期静态
  快照兜底，网关宕机时 picker 仍可用。
- **思考档** — `reasoning=true` 且有 ladder 的模型出 picker；无 ladder 但可思考
  的模型保持 wire 可思考（显式档位直通）；`none` 显式关闭思考，`ultra` 直通
  网关，不在 pi-ai 内截断。
- **图片** — 有图的请求经 `ctx.get('attachments')` 取 request 版本字节；
  文本模型误收图时直接失败（harness 按 inputModalities 已做门控）。
- **韧性** — 启动即注册，目录后台预热（失败按短间隔重试）；stall 看门狗让静默
  挂起快速失败为 `TIMEOUT`；`length` 截断如实上抛，不做自动续写。

Health snapshot: `~/.dsh-magpie-connect/adapter-status.json`.

## Development

```sh
pnpm install
pnpm run check
```

The check ladder is typecheck + tests + build; `lib/` is committed, so profile
installs run without a build.

## License

[MIT](./LICENSE)
