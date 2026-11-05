# magpie-connect 配置持久化改造方案（最小改动版）

- 版本基线：`0.4.4`（commit `296f9a5`）
- 范围：**只修「更新/重装后 API 地址与 API Key 被初始化」**，不引入 settings/credentials 服务的重构
- 目标：让配置**存放在 DSH 推荐位置**，并**消除会导致配置被抹写的写盘/读盘缺陷**
- 迁移策略：**不做启动时预迁移**——旧文件只读兼容，等用户**第一次保存**时才写新位置并清理旧文件（升级零文件改动）
- 预期工作量：~1 天（含测试）

> **实施状态：已完成（未提交）。** 改动见 `src/homeDir.ts`、`src/config.ts`、`src/settings.ts`、
> `src/index.ts`、`src/adapter/catalog.ts`，测试见 `test/config.test.ts` / `test/settings.test.ts`；
> `pnpm run check` 通过（151 个测试全绿，typecheck + build 正常）。下文保留为设计依据与验收清单。

---

## 1. 问题回顾（为什么会「重置」）

| # | 缺陷 | 位置 | 后果 |
| --- | --- | --- | --- |
| 1 | 自建 `~/.dsh-magpie-connect/settings.json`，绕开 DSH 的 profile patch / 凭据库 | [src/config.ts:95](../../src/config.ts#L95) | 没有 DSH 层的备份、原子写、HMR、回滚保护 |
| 2 | 写盘「先删后改名」：`writeFile(tmp)` → **`rm(path)`** → `rename(tmp,path)` | [src/settings.ts:271-275](../../src/settings.ts#L271-L275) | `rm` 与 `rename` 之间存在「文件不存在」窗口，此时读=空 |
| 3 | 临时文件名只含 pid：`${path}.${process.pid}.tmp` | [src/settings.ts:271](../../src/settings.ts#L271) | 热重载时同一进程内新旧两代实例临时名相同，互相踩踏（`ENOENT` / 内容互串） |
| 4 | 读失败一律当空文档：`catch { return {} }` | [src/settings.ts:189-196](../../src/settings.ts#L189-L196) | 解析失败/IO 失败被当成「用户没配过」，随后一次只含 `enabledModels` 的自动保存（[page.tsx:103-106](../../src/client/page.tsx#L103-L106)）把 `baseUrl`/`apiKey` 整段写没 |
| 5 | `save()` 无写锁：`{...内存旧值, ...本次字段}` 直写 | [src/settings.ts:248-253](../../src/settings.ts#L248-L253) | 并发/交错时落盘顺序不可控，旧状态可能覆盖新状态 |
| 6 | 模型缓存同样「先删后改名」，临时名同样只用 pid | [src/adapter/catalog.ts:673-680](../../src/adapter/catalog.ts#L673-L680) | 同类竞态；缓存损坏虽可重建，但会产生无谓的目录抖动 |

一句话：**位置不对 + 写盘不原子 + 读失败被当成空 + 没写锁**。四项叠加，在「更新时新旧实例并存」的窗口内就会把凭据抹掉。

---

## 2. 最小改动方案（4 项，互不依赖，可分批合入）

### A. 路径改为 DSH 推荐位置；旧文件只「兼容读」，不预迁移

**新默认**：`$DSH_HOME/storages/magpie-connect`
（`$DSH_HOME` 缺省即 `~/.dsh`，解析顺序：显式配置 > `DSH_HOME` > `~/.dsh`）

**不预迁移**是刻意的取舍：升级瞬间不动任何文件、不复制、不删旧，冷启动零风险；
旧配置在**第一次真正保存时**才落到新位置，那时才清理旧文件。

**读写规则（三层回退，只读）**

新位置 `cfg.dataDir` = `$DSH_HOME/storages/magpie-connect`：

1. 先读新位置 `settings.json`；
2. 新位置不存在 → **回退只读** 旧位置 `~/.dsh-magpie-connect/settings.json`（若存在），并在内存里标记 `#legacySource = true`；
3. 都没有 → `{}`。

> 旧位置必须用**旧的解析方式**算出来，不能用新的 `dshHomePath`：旧版是 `join(homedir(), '.dsh-magpie-connect')`，**不看 `DSH_HOME`**（见 `git show 296f9a5:src/config.ts` 第 95 行）。若用 `dshHomePath` 去拼，对设了 `DSH_HOME` 的用户会找错目录。

**写规则：首次保存时「写到新位置 + 删旧」**

- `persist()` 永远只写新位置（原子写，见 B）。
- 写成功后：若本次处于 `#legacySource` 且**新位置写入成功**，才 `rm` 旧 `settings.json`（失败只 `warn`，不影响新文件）。
- 删除是**幂等**的：`ENOENT` 视为已完成；只有「新文件确实存在且可读」时才动手删旧，避免新写失败却把旧文件删掉。

**由此产生的三种状态**

| 场景 | 行为 |
| --- | --- |
| 只升级、没进设置页、没改模型 | 新目录**不会**出现任何文件；旧文件原样在，冷启动完全无感 |
| 改了模型（自动保存 `enabledModels`） | 首次写入即把完整文档（含读到的旧 `baseUrl`/`apiKey`）写到新位置，然后删旧 |
| 显式传 `config.dataDir` | 完全按用户给的路径读写，**不**回退旧位置、**不**删任何东西 |

**一个必须防的坑：`enabledModels` 自动保存会「顺手搬走凭据」**

自动保存只 POST `{ enabledModels }`（[page.tsx:103-106](../../src/client/page.tsx#L103-L106)），服务端 `save()` 是
`{...内存旧值, ...本次字段}`（[settings.ts:248-253](../../src/settings.ts#L248-L253)）。
只要启动时**正确读到了旧文件**，内存里就有 `baseUrl`/`apiKey`，于是第一次自动保存写出的完整文档是安全的。
**反例**：若旧文件读取失败被当成 `{}`（缺陷 4），这次自动保存就会把「只有 enabledModels」的文档写到新位置 →
既丢了凭据、又因「新文件已存在」而永远不再回退读旧文件。所以 **C（读失败不当空）必须先于 A 上线**。

**代码**

`src/homeDir.ts`（新增，零依赖，等价官方 `dsh-home-paths`）：

```ts
// src/homeDir.ts
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Resolve the Harness home: explicit override > $DSH_HOME > ~/.dsh. Mirrors @deepseek-ai/dsh-home-paths. */
export function resolveDshHome(configured?: string, env: NodeJS.ProcessEnv = process.env): string {
  if (configured && configured.trim()) return resolve(configured)
  const fromEnv = env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim()) return resolve(fromEnv)
  return join(homedir(), '.dsh')
}

/** Join segments onto the resolved Harness home (e.g. dshHomePath('storages','magpie-connect')). */
export function dshHomePath(...segments: string[]): string {
  return join(resolveDshHome(), ...segments)
}

/** Legacy state dir of 0.4.x and earlier: `~/.dsh-magpie-connect` (homedir-based, DSH_HOME-independent). */
export function legacyDataDir(): string {
  return join(homedir(), '.dsh-magpie-connect')
}
```

`src/config.ts` 改动：

```diff
-import { homedir } from 'node:os'
-import { join } from 'node:path'
+import { dshHomePath } from './homeDir.ts'
...
-  /** Plugin state directory (status snapshot, settings file, catalog cache).
-   *  Defaults to `~/.dsh-magpie-connect`. */
+  /** Plugin state directory (status snapshot, settings file, catalog cache).
+   *  Defaults to `$DSH_HOME/storages/magpie-connect` (`~/.dsh/storages/magpie-connect`). */
   dataDir?: string
...
-    dataDir: config.dataDir ?? join(homedir(), '.dsh-magpie-connect'),
+    dataDir: config.dataDir ?? dshHomePath('storages', 'magpie-connect'),
```

> `join` 在 `config.ts` 里仅用于这一行（`grep -n "join(" src/config.ts`），改完可连同 `node:path` 导入删除。

“桥接”落在 `SettingsStore` 上（它已经持有唯一路径，最合适）：新增一个可选的 `legacyPath`，
把「该读哪、该删什么」收在一处，`index.ts` 只负责把 `legacyDataDir()` 传进去。

```ts
// src/settings.ts —— 字段 & 构造
constructor(options: { path?: string; legacyPath?: string } = {}) {
  this.#path = options.path
  // 仅当未显式配置 dataDir 时传；显式配置时传 undefined = 不兼容旧位置、不删旧文件
  this.#legacyPath = options.legacyPath
}

#legacyPath?: string
#legacySource = false

// read(): 新位置优先，缺失时只读回退旧位置
async read(): Promise<MagpiePageSettings> {
  const fromNew = await this.#readFile(this.#path)
  if (fromNew !== undefined) return fromNew            // undefined = 不存在
  const fromOld = await this.#readFile(this.#legacyPath)
  if (fromOld !== undefined) { this.#legacySource = true; return fromOld }
  return {}
}

// persist() 成功后清理旧文件（只在本代确实读过旧文件时）
async persist(): Promise<void> {
  ...await rename(tmp, target)                              // 只写新位置
  if (this.#legacySource && this.#legacyPath) {
    await rm(this.#legacyPath, { force: true })
      .then(() => { this.#legacySource = false })
      .catch(() => { /* 删不掉不影响已写入的新文件 */ })
  }
}
```

`#readFile` 返回**结果对象**而不是直接抛/返回空——因为 `load()` 还要拿到**原始**文档做 `hiddenModels` 迁移（`normalizePageSettings` 会丢掉这个字段）：

```ts
/** 不抛错：exists=false 表示不存在；exists=true 且 raw=undefined 表示存在但读坏。 */
async #readFile(path?: string): Promise<{ exists: boolean; raw?: unknown; error?: unknown }> {
  if (!path) return { exists: false }
  let text: string
  try { text = await readFile(path, 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false }
    return { exists: true, error }
  }
  try { return { exists: true, raw: JSON.parse(text) as unknown } }
  catch (error) { return { exists: true, error } }
}

/** 新位置优先；present-but-corrupt 的新文件是权威的，不回退旧文件。 */
async #resolveRaw() {
  const fromNew = await this.#readFile(this.#path)
  if (fromNew.raw !== undefined) return fromNew
  if (fromNew.exists) return fromNew
  const fromOld = await this.#readFile(this.#legacyPath)
  if (fromOld.raw !== undefined) { this.#legacySource = true; return fromOld }
  return fromOld
}
```

> 已按此实现。`read()` 用 `#resolveRaw().raw` 经 `normalizePageSettings` 归一化；`load()` 用原始 `raw` 交给 `migrateLegacySettings`。

`src/index.ts` 接线（`store` 构造处，[index.ts:471](../../src/index.ts#L471)）：

```ts
const store = new SettingsStore({
  path: defaultSettingsPath(cfg.dataDir),
  // 显式 dataDir 时不给 legacy：不读旧位置，也不在保存时删任何文件
  legacyPath: config.dataDir === undefined ? join(legacyDataDir(), 'settings.json') : undefined,
})
```

**模型缓存不做兼容**：`magpie-models.json` 是可重建的缓存，旧位置那份直接忽略、在新位置重建即可。
`persist()` 只删旧的 `settings.json`，**不**动旧的 `magpie-models.json`——留着无害，也避免误删。
（可选收尾：首次保存成功后，若旧目录只剩这些死文件（`plugin-status.*`、旧的 `magpie-models.json`），可再尝试 `rm` 整个旧目录；失败则忽略。此步放最后、默认关闭，先把主流程跑稳。）

### B. 写盘原子化（settings + 模型缓存）

去掉 `rm(path)`，临时名加随机后缀，串行化写入；把 A 的「删旧」并进同一次写（不新增依赖）：

```ts
import { randomBytes } from 'node:crypto'

// 类字段
#writeChain: Promise<void> = Promise.resolve()

async persist(): Promise<void> {
  if (!this.#path) return
  // serialize: one write at a time
  this.#writeChain = this.#writeChain.then(async () => {
    const target = this.#path!
    await mkdir(dirname(target), { recursive: true })
    const tmp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await writeFile(tmp, JSON.stringify(this.#settings, null, 2), { encoding: 'utf8', mode: 0o600 })
      await rename(tmp, target) // atomic replace (POSIX; Windows via MoveFileExW REPLACE_EXISTING)
    } finally {
      await rm(tmp, { force: true }).catch(() => {})
    }
    // A 的收尾：本代确实读过旧文件，且新文件已成功落盘 —— 才删旧
    if (this.#legacySource && this.#legacyPath) {
      await rm(this.#legacyPath, { force: true })
        .then(() => { this.#legacySource = false })
        .catch(() => { /* 删不掉不影响已写入的新文件 */ })
    }
    // 可选：首次写成功后留一份 settings.json.bak 作为读坏兜底
  }, () => {})
  await this.#writeChain
}
```

要点：
- **移除 `rm(this.#path)`** —— `rename` 本身是原子覆盖，先删既无必要又制造空窗。
- 临时名 `pid + random`，跨代同进程也不再撞名。
- `#writeChain` 做**进程内写队列**（对应 `dsh-im` 的 `#writeQueue`），并发 `save` 不再交错。
- 文件权限 `0o600`（凭据文件不该是 `0644`）。
- **删旧只发生在新文件写成功之后**，且只发生在「读时确实用了旧文件」的那一代；`ENOENT` 幂等。
- 同步对 [catalog.ts:673-680](../../src/adapter/catalog.ts#L673-L680) 的 `saveModelsCache` 做原子写（去 `rm`、随机临时名）；缓存**不做**旧位置兼容。

### C. 读失败不再伪装成「空」（**必须与 A 同时上线**）

A 里的 `#readFile` 已经建立正确语义：**`undefined` = 文件不存在；抛错 = 存在但读坏**。`read()` 直接用它：

```ts
async read(): Promise<MagpiePageSettings> {
  const resolved = await this.#resolveRaw()
  if (resolved.raw !== undefined) {
    try { return normalizePageSettings(resolved.raw) }
    catch { this.#loadFailed = true; return {} }        // 结构非法也算读坏
  }
  if (resolved.exists) this.#loadFailed = true          // 存在但读坏
  return {}
}

async load(known?: readonly string[]): Promise<MagpiePageSettings> {
  const resolved = await this.#resolveRaw()
  if (resolved.raw === undefined) {
    if (resolved.exists) this.#loadFailed = true        // 读坏：只读降级，绝不置空
    this.#settings = {}
    return this.get()
  }
  const { settings, migrated } = migrateLegacySettings(resolved.raw, known) // 用原始文档
  this.#settings = settings
  if (migrated) await this.persist().catch(() => {})
  return this.get()
}
```

- `#loadFailed = true` 时，`save()` 拒绝**不带凭据的部分保存**（见 D）。
- 注意：`load()` 抛错分支里 **不要** 写盘、**不要** 把 `#legacySource` 之外的状态改变成「可清空」。

### D. 保存不得抹掉凭据（兜底护栏）

```ts
async save(partial: unknown): Promise<MagpiePageSettings> {
  const normalized = normalizePageSettings(partial)
  // 护栏：读盘失败后，禁止一次只含 enabledModels 的自动保存把凭据写没。
  if (this.#loadFailed && normalized.baseUrl === undefined && normalized.apiKey === undefined) {
    throw new Error('dsh-magpie-connect: settings file was unreadable; refusing to overwrite it with a partial save — reload the settings page or restore settings.json')
  }
  this.#settings = { ...this.#settings, ...normalized }
  await this.persist()
  // 完整保存（含凭据）成功后解除降级态，恢复正常自动保存
  if (normalized.baseUrl !== undefined && normalized.apiKey !== undefined) this.#loadFailed = false
  this.#emit()
  return this.get()
}
```

效果：读坏时自动保存**报错可见**，而不是「静默成功、实际把 key 清空」。前端自动保存失败已有 UI 落点（`modelsStatus: 'error'` → [model-list.tsx](../../src/client/model-list.tsx) 的 `failure`）。

> `#loadFailed` 必须在**一次成功的完整保存**（同时带 `baseUrl` 与 `apiKey`）后清除，否则用户修好之后自动保存会一直被拒。

---

## 3. 改动清单（文件 × 动作）

| 文件 | 动作 |
| --- | --- |
| `src/homeDir.ts` | **新增**：`resolveDshHome` / `dshHomePath`（等价官方实现）+ `legacyDataDir()`（`~/.dsh-magpie-connect`，用 `homedir` 拼，与旧版一致） |
| `src/config.ts` | 默认 `dataDir` 改为 `dshHomePath('storages','magpie-connect')`；更新注释；去掉 `homedir`/`join` 导入 |
| `src/settings.ts` | 构造参数加 `legacyPath`；新增 `#legacyPath` / `#legacySource` / `#loadFailed` / `#writeChain`；新增 `#readFile()`（不存在返回 `undefined`，读坏抛错）；`read()/load()` 走「新位置 → 旧位置（只读）」回退；`persist()` 原子写 + 写队列 + `0o600` + 随机临时名 + 去 `rm` + **写成功后删旧**；`save()` 加 D 护栏 |
| `src/adapter/catalog.ts` | `saveModelsCache()` 同款原子写（去 `rm`、随机临时名）；缓存不做旧位置兼容 |
| `src/index.ts` | `new SettingsStore({ path, legacyPath: config.dataDir === undefined ? join(legacyDataDir(),'settings.json') : undefined })` |
| `README.md` | 第 147 行 `dataDir` 默认值改为 `$DSH_HOME/storages/magpie-connect`；第 180 行状态快照路径同步；第 93 行补充「升级后旧 `~/.dsh-magpie-connect` 只读兼容，下次保存时写到新目录并清理旧文件」 |
| `cordis.patch.yml` | 注释里 `<dataDir>` 说明改为 `$DSH_HOME/storages/magpie-connect` |
| `test/config.test.ts` | 断言改为 `storages/magpie-connect` 结尾；新增「显式 dataDir 不被覆盖」「`DSH_HOME` 生效」「`legacyDataDir` 恒为 `~/.dsh-magpie-connect`」用例 |
| `test/settings.test.ts` | 新增：并发写不互踩 / 读失败不覆盖 / 部分保存被拒绝 / `ENOENT` 仍返回空 / **新位置缺失时读旧位置** / **保存后旧文件被删** / **读坏旧文件绝不写新位置** |
| ~~`test/migrate.test.ts`~~ | **不需要**（本方案无预迁移；相关行为已并入 `settings.test.ts`） |

---

## 4. 测试计划

**单元测试（`node --test`）**

1. `config`：默认 `dataDir` 以 `storages/magpie-connect` 结尾；`dataDir: '/tmp/x'` 原样返回；`DSH_HOME=/tmp/h` 时默认解析到 `/tmp/h/storages/magpie-connect`；`legacyDataDir()` 恒为 `join(homedir(),'.dsh-magpie-connect')`（不受 `DSH_HOME` 影响）。
2. `settings` 原子性：
   - 两个 `SettingsStore` 实例（同进程）并发 `save` → 都不抛 `ENOENT`，最终文件是合法 JSON 且含 `baseUrl`/`apiKey`。
   - 写过程中并发 `read()` → **不再出现空文档**。
3. `settings` 读失败护栏：
   - 预置损坏 JSON → `read()` 返回 `{}` 且 `#loadFailed = true`；
   - 随后 `save({ enabledModels: ['a'] })` **抛错**，且**磁盘原文件未被改写**；
   - 随后 `save({ baseUrl, apiKey, enabledModels })` 成功，`#loadFailed` 清除。
4. `settings` `ENOENT`：两处都不存在 → `read()` 返回 `{}` 且允许保存。
5. `settings` 兼容读（本方案核心）：
   - 新位置无文件、旧位置有 `settings.json` → `read()` 返回旧内容，`#legacySource = true`；
   - 此时 `save({ enabledModels: ['a'] })`（模拟自动保存）→ **新位置**出现完整文档（含旧 `baseUrl`/`apiKey`），**旧文件被删除**；
   - 新位置已有文件 + 旧位置也有 → 读新位置，且保存后**不碰**旧文件（`#legacySource=false`）。
6. `settings` 读坏旧文件：新位置缺失、旧位置是坏 JSON → `read()` 抛错/`#loadFailed`，**不得**创建新文件（防止把空文档固化到新位置）。
7. `settings` 显式 `dataDir`：`legacyPath` 为 `undefined` → 完全不读旧位置、保存时不删任何文件。

**手工验收**

1. 备份现有 `~/.dsh-magpie-connect`，旧版跑一次，记下设置页 URL/Key 与模型白名单。
2. 覆盖安装新版 → 重启 `dsh web` → 设置页显示同一 URL/Key（来自**只读兼容**旧文件），且此时 `$DSH_HOME/storages/magpie-connect/` **仍为空**（没保存就不写）。
3. 在页面上删一个模型（触发自动保存）→ 检查新目录出现 `settings.json` 且含完整 `baseUrl`/`apiKey`；旧 `~/.dsh-magpie-connect/settings.json` 已删除。
4. 反复重启 5 次、期间删/加模型 → `baseUrl`/`apiKey` 始终不变。
5. 手动把新位置 `settings.json` 写坏 → 重启 → 页面报读取问题；删模型应**失败并提示**，文件不被清空。

---

## 5. 验收标准

- [ ] 默认数据目录为 `$DSH_HOME/storages/magpie-connect`，且尊重 `DSH_HOME`。
- [ ] **升级后不改动任何文件**：不读旧→不写；`~/.dsh-magpie-connect` 原样保留。
- [ ] 升级后设置页仍显示旧配置（只读兼容），旧配置不会「消失」。
- [ ] 用户**第一次保存**（含自动保存）后：配置落到新位置，旧文件被清理，`baseUrl`/`apiKey` 不丢。
- [ ] 多次重启 + 自动保存不再导致 `baseUrl`/`apiKey` 变化。
- [ ] 读盘失败时不静默清空凭据（有可见报错），且不会把空文档固化到新位置。
- [ ] `pnpm run check`（typecheck + test + build）通过。

---

## 6. 回滚方案

- 代码回滚：`git revert` 本次提交即可。**只要用户还没在新版里保存过**，磁盘上什么都没变（旧文件原封不动），回滚后旧版本照读。
- 已保存过（旧文件已清理）：回滚后把 `$DSH_HOME/storages/magpie-connect/settings.json` 复制回 `~/.dsh-magpie-connect/settings.json` 即可。
- 新版本身也可直接用 `config.dataDir` 指回旧目录，无需回滚代码。

---

## 7. 本方案**不做**的事（留给后续「正解」版）

以下属于结构性重构，改动面与风险都大，单独立项：

1. `baseUrl` / `displayName` / `refreshSeconds` 等改为 **volatile Config 字段**，设置页经 `ctx.settings` + `ctx.configEditor.edit()` 写回 `cordis.patch.yml`（magpie 已有 `ctx.inject(['settings'])`，只是当前用来关自动表单，可改造成真正的持久化通道）。
2. `apiKey` 迁到 **`ctx.credentials`**（存 `.credentials.yaml`），配置里只留引用名，页面用 `describe()` 显示「已设置」而不回显。
3. `enabledModels` 若体量变大，改用 **`ctx.storageDomain` + `defineDomain`** 存 `storages/`（schema 校验 + 变更事件）。
4. 与 `dsh-credentials-local` 的 `0o600`、原子写、导入校验完全对齐。

> 最小版先解决「不被重置」；正解版再解决「与 DSH 语义完全一致」。两者不冲突，最小版是正解版的过渡态，且数据目录选在 `storages/` 后，正解版迁移成本更低。

---

## 8. 风险与注意点

| 风险 | 处理 |
| --- | --- |
| `DSH_HOME` 与 `homedir` 不一致的用户：旧文件在 `~/.dsh-magpie-connect`，新位置在 `$DSH_HOME/storages/...` | 旧位置**必须**用 `legacyDataDir()`（homedir 拼）解析，而不是 `dshHomePath`；否则会找不到旧文件，表现为「配置不见了」 |
| **只读兼容 → 延迟写**带来的窗口：用户升级后一直不保存，配置就长期停留在旧文件 | 可接受（旧文件仍在、功能正常）；一旦保存即迁移。文档说明即可 |
| 旧文件「读坏」时若误判为不存在，会自动保存并固化空文档 | **C 必须先于 A 上线**：`#readFile` 区分 `ENOENT`（`undefined`）与读坏（抛错）；读坏时 `#loadFailed` 阻止部分保存 |
| 删除旧文件失败（权限/占用） | 只 `warn`，新文件已写好；下次保存会重试删除（`#legacySource` 仍为 true） |
| Windows 上 `rename` 覆盖偶发 `EPERM/EACCES` | 可选：捕获后重试若干次（`dsh-atomic-write` 的做法）；最小版先保证非 Windows，Windows 留 TODO |
| 只读文件系统 | `persist()` 抛错 → 路由返回 500，前端显示错误（现状已如此） |
| `#loadFailed` 导致自动保存报错 | **有意行为**（宁可报错不静默清空），文案需友好 |

---

## 9. 实施顺序建议

1. `homeDir.ts`（含 `legacyDataDir`）+ `config.ts` + `config.test.ts`
2. `settings.ts`：`#readFile` + 只读回退 + `#loadFailed` 护栏（**C、D 先落地**）+ `settings.test.ts`
3. `settings.ts`：原子写 + 写队列 + 写成功后删旧（B + A 的收尾）
4. `index.ts` 接线 `legacyPath`
5. `catalog.ts` 缓存原子写
6. 文档（README / cordis.patch.yml）
7. 跑 `pnpm run check`，手工验收，发版 `0.4.5`

> 注意顺序：**先 C/D 再 A**。A 的「读旧→写新→删旧」只有在「读坏不当空」成立时才是安全的；否则一次坏读 + 一次自动保存就会把空文档固化到新位置。
