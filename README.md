# dsh-magpie-connect

**Magpie LAN gateway models, natively inside DSH (DeepSeek Harness).**

No extra process. Points at your configured gateway origin and serves
every model from the gateway's `GET …/models` in the DSH model picker as provider
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

**API 地址是带版本号的完整前缀**，例如 `http://api.lan/v1`：插件只往后拼资源名
（`/models`、`/chat/completions`、`/responses`），**绝不自己补版本号**。网关以后
上 `/v2`、`/v3` 时，只改这一个字符串即可，不会拼成 `/v2/v1/models`。尾斜杠会被
去掉，路径原样保留。

**获取可用模型** 打开候选弹窗：它问的是**表单当前显示的地址与 Key**（包括还没
保存的），所以填一个新网关是一趟而不是"保存—返回—再看"。弹窗里可搜索、可全选/
取消全选、逐个勾选，**应用选择**把勾选结果换算成隐藏集合；网关已经不再提供的旧 id
不受影响，保持原样。查不通也不会卡死——失败信息就显示在列表下方，行仍然可以手改。

Precedence per field: settings page > `cordis.patch.yml` config > defaults.
Hidden models only come from the page; an empty list shows everything.

Toggling visibility, changing the origin, or a refresh that added/dropped
models publishes `llm/adapters-updated`, the one event DSH's picker listens
to — the browser caches one catalog read per Host generation, so without it
the picker keeps the stale list until `dsh web` restarts.

## Configuration

Set the gateway URL first — either on the Settings → Magpie page (recommended,
applies instantly) or via the profile's `cordis.patch.yml`:

```yaml
- id: dsh-magpie-connect
  name: 'dsh-magpie-connect'
  config:
    providerId: dsh-magpie-connect
    displayName: magpie
    baseUrl: http://api.lan/v1  # versioned API root — include the version
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
| `baseUrl` | `''` (not configured) | Versioned API root, e.g. `http://api.lan/v1`. The version is part of the value, not appended — a gateway on `/v2` is reached by changing this string. Required. |
| `apiKey` | `''` (not configured) | Bearer key. Required, even if `/models` answers without one. |
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

- **Catalog** — `GET {baseUrl}/models` 全量接入，无付费过滤；磁盘缓存 + 编译期静态
  快照兜底，网关宕机时 picker 仍可用。任何暴露集合的变化（隐藏/显示、换网关
  地址、刷新后模型增删）都会 `emit('llm/adapters-updated')`，让浏览器那份
  catalog 缓存立即重读——否则 picker 会一直显示旧列表到下次重启。
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
