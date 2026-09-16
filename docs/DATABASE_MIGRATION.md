# 数据库迁移与正式榜单同步手册

本手册用于把 Music Rank 的数据库结构、Demo 前置数据和两个正式榜单同步到一个目标 PostgreSQL 数据库。目标读者是开发者、部署人员和 AI agent；所有命令都从仓库根目录执行。

> 这里的“数据库迁移”包含两层含义：`db:migrate` 只应用 Drizzle 结构迁移；正式榜单歌曲内容由 manifest importer 单独写入。只执行 `db:migrate` 和 `db:seed` 不会得到两个正式榜单。

## 1. 权威来源与安全边界

- 数据库 Schema：`packages/database/src/schema.ts`
- 已跟踪结构迁移：`packages/database/migrations/`
- Demo Seed：`packages/database/src/seed.ts`
- 正式榜单导入器：`packages/database/src/ranking-importer.ts`
- 大陆榜内容：[`packages/database/manifests/90s-mainland-top-100.json`](../packages/database/manifests/90s-mainland-top-100.json)
- 粤语榜内容：[`packages/database/manifests/90s-cantonese-top-70.json`](../packages/database/manifests/90s-cantonese-top-70.json)

两个 manifest 是榜单标题、歌手、名次、发行年份和来源元数据的唯一权威。不要把 172 条歌曲复制到 SQL 或另一份文档；需要审计内容时直接读取并检查这两个 JSON 文件。

操作时遵守以下边界：

1. 先阅读仓库根目录的 [`AGENTS.md`](../AGENTS.md) 和 [`docs/CONFIGURATION.md`](CONFIGURATION.md)。
2. 不要创建根目录 `.env`、`config/.env`、`apps/api/.env` 或 `packages/database/.env`。
3. 不要修改已经执行过的历史 migration；Schema 变化必须新增 forward migration。
4. 不要把 `db:generate` 当作部署步骤。它用于开发新 Schema migration，不用于应用迁移。
5. staging/production 操作前必须备份数据库，并确认 `APP_ENV` 与目标连接串。
6. `--replace` 会删除并重建目标榜单及其条目。AI agent 不得因为普通 import 冲突就自动执行 `--replace`；必须先检查 manifest diff、备份数据库并取得明确授权。

## 2. 本次同步的两个正式榜单

| 榜单 | 稳定 slug | 权威 manifest | 当前条目 | 名次范围 | 区域 | `displayOrder` | 来源类型 |
| --- | --- | --- | ---: | --- | --- | ---: | --- |
| 90s Mainland China Top 100 | `90s-mainland-top-100` | `90s-mainland-top-100.json` | 100 | 1–100 | `MAINLAND` | 4 | `COMMUNITY` |
| 90s Cantonese Songs Top 70 | `90s-cantonese-top-70` | `90s-cantonese-top-70.json` | 72 | 1–72 | `null` | 5 | `COMMUNITY` |

注意：粤语榜的历史标题和文件名保留 `Top 70`，但当前已批准的 manifest 实际有 **72 条**连续名次。迁移和验收都以 manifest 的 72 条为准，不要擅自截断成 70 条。

每条 manifest entry 包含：

- `rank`：从 1 开始且必须连续、唯一；
- `title`：歌曲标题；
- `artist`：歌手；
- `releaseYear`：发行年份或 `null`；
- `sourceTimestampSeconds`：可选的来源时间点。

两个榜单的来源链接、来源标题和提取说明也保存在各自 manifest 中。导入器不会访问外部链接重新抓取或校验内容。

完成同步后的期望发布状态：

| slug | 条目数 | `is_published` | 说明 |
| --- | ---: | --- | --- |
| `90s-mainland-top-100` | 100 | `true` | 正式大陆榜 |
| `90s-cantonese-top-70` | 72 | `true` | 正式粤语榜 |
| `90s-demo-ranking` | 30 | `false` | Demo 保留但不公开，不得删除 |

## 3. 四类数据库命令不能混用

| 操作 | 命令 | 作用 |
| --- | --- | --- |
| 结构迁移 | `npm run db:migrate` | 应用 `packages/database/migrations/` 中尚未执行的 Drizzle migrations |
| Demo Seed | `npm run db:seed` | 幂等创建/更新 Demo 用户、Demo 榜单、30 首 Demo 歌曲和 30 个榜单位置 |
| 正式榜单导入 | `import:ranking` | 校验 manifest，并以事务方式创建或复用正式榜单、歌曲和条目；首次导入保持未发布 |
| 正式榜单发布 | `publish:ranking` | 检查条目完整性，发布目标榜单，同时撤下但保留 Demo |

`db:seed` 不会导入两个正式榜单，也不会创建或覆盖普通用户的 Top 10、Practice Library、用户名、密码、Session 或公开设置。

## 4. 本地 development：完整复制粘贴流程

前提：Node.js、npm 和 Docker 版本满足 README 要求，本机端口 5432、3001、5173 可用。

### 4.1 安装依赖并启动 PostgreSQL

```bash
npm ci
npm run db:up
docker compose ps database
```

等待 `database` 状态变为 `healthy` 后继续。

### 4.2 应用结构迁移并建立 Demo 前置数据

```bash
npm run db:migrate
npm run db:seed
```

必须执行 Seed，因为发布器要求 `90s-demo-ranking` 存在。Seed 是幂等的；如果 Demo 已经被正式榜单撤下，重复 Seed 会保留它当前的未发布状态。

### 4.3 对两个正式榜单执行只读预检

```bash
npm run import:ranking --workspace @music-rank/database -- --dry-run manifests/90s-mainland-top-100.json
npm run import:ranking --workspace @music-rank/database -- --dry-run manifests/90s-cantonese-top-70.json
```

首次同步时，预期摘要分别显示：

- 大陆榜：`rankingCreated: true`、`entriesCreated: 100`；歌曲会根据标准化标题和歌手被创建或复用；
- 粤语榜：`rankingCreated: true`、`entriesCreated: 72`；歌曲同样可能与已有记录复用。

已经同步过的数据库通常会显示 `rankingCreated: false`，并复用全部榜单条目。Dry run 不写数据库；任何 metadata、名次或歌曲冲突都会中止。

### 4.4 导入两个榜单

```bash
npm run import:ranking --workspace @music-rank/database -- manifests/90s-mainland-top-100.json
npm run import:ranking --workspace @music-rank/database -- manifests/90s-cantonese-top-70.json
```

导入器在单个数据库事务中工作：后续条目失败时，本次导入产生的前序写入会一并回滚。首次导入的正式榜单默认 `is_published = false`。

重复执行完全相同的普通 import 是幂等的。共享歌曲按“标准化标题 + 标准化歌手”复用；普通 import 会把复用歌曲标记为 `VERIFIED`，并仅在原发行年份为空时补入 manifest 年份。

### 4.5 发布两个榜单

```bash
npm run publish:ranking --workspace @music-rank/database -- 90s-mainland-top-100
npm run publish:ranking --workspace @music-rank/database -- 90s-cantonese-top-70
```

发布器会验证目标榜单存在、至少有一条记录且名次从 1 连续排列。发布与撤下 Demo 在同一个事务中完成；不会删除 Demo、Demo 条目或 Demo 歌曲，也不会撤下另一个正式榜单。

### 4.6 启动应用

```bash
npm run dev
```

浏览器打开 `http://localhost:5173`。API 健康检查为 `http://localhost:3001/api/health`。

## 5. staging / production

远程数据库不使用 `docker compose`。先按 [`docs/CONFIGURATION.md`](CONFIGURATION.md) 准备 `config/.env.staging.local` 或 `config/.env.production.local`，也可以由部署平台注入真实环境变量。机密配置文件不得提交到 Git。

安装依赖时必须执行完整的 `npm ci`，不要加 `--omit=dev`；结构迁移、Seed 和榜单导入使用的 TypeScript/`tsx` 工具位于 devDependencies。

非 development 环境必须显式设置 `APP_ENV`；否则数据库命令会读取 development 配置。

macOS / Linux 的 production 示例：

```bash
APP_ENV=production npm run db:migrate
APP_ENV=production npm run db:seed
APP_ENV=production npm run import:ranking --workspace @music-rank/database -- --dry-run manifests/90s-mainland-top-100.json
APP_ENV=production npm run import:ranking --workspace @music-rank/database -- --dry-run manifests/90s-cantonese-top-70.json
APP_ENV=production npm run import:ranking --workspace @music-rank/database -- manifests/90s-mainland-top-100.json
APP_ENV=production npm run import:ranking --workspace @music-rank/database -- manifests/90s-cantonese-top-70.json
APP_ENV=production npm run publish:ranking --workspace @music-rank/database -- 90s-mainland-top-100
APP_ENV=production npm run publish:ranking --workspace @music-rank/database -- 90s-cantonese-top-70
```

PowerShell 示例：

```powershell
$env:APP_ENV = 'production'
npm run db:migrate
npm run db:seed
npm run import:ranking --workspace @music-rank/database -- --dry-run manifests/90s-mainland-top-100.json
npm run import:ranking --workspace @music-rank/database -- --dry-run manifests/90s-cantonese-top-70.json
npm run import:ranking --workspace @music-rank/database -- manifests/90s-mainland-top-100.json
npm run import:ranking --workspace @music-rank/database -- manifests/90s-cantonese-top-70.json
npm run publish:ranking --workspace @music-rank/database -- 90s-mainland-top-100
npm run publish:ranking --workspace @music-rank/database -- 90s-cantonese-top-70
Remove-Item Env:APP_ENV
```

staging 使用同样流程，把 `production` 换成 `staging`。执行写操作前，应通过脱敏方式确认最终解析的环境、数据库主机和数据库名；不要在日志或聊天中输出密码或完整 `DATABASE_URL`。

## 6. 验证结果

### 6.1 本地数据库 SQL 验证

以下命令只读取榜单及条目统计：

```bash
docker compose exec -T database psql -U music_rank -d music_rank -c "
SELECT
  r.slug,
  r.is_published,
  count(re.id) AS entry_count,
  min(re.rank) AS min_rank,
  max(re.rank) AS max_rank,
  count(DISTINCT re.rank) AS unique_ranks,
  count(DISTINCT re.song_id) AS unique_songs
FROM rankings r
LEFT JOIN ranking_entries re ON re.ranking_id = r.id
WHERE r.slug IN (
  '90s-mainland-top-100',
  '90s-cantonese-top-70',
  '90s-demo-ranking'
)
GROUP BY r.id, r.slug, r.is_published
ORDER BY r.slug;
"
```

预期：

| slug | 发布 | 条目 | min | max | 唯一名次 | 唯一歌曲 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `90s-mainland-top-100` | true | 100 | 1 | 100 | 100 | 100 |
| `90s-cantonese-top-70` | true | 72 | 1 | 72 | 72 | 72 |
| `90s-demo-ranking` | false | 30 | 1 | 30 | 30 | 30 |

### 6.2 API 验证

应用启动后执行：

```bash
curl --fail --silent --show-error http://localhost:3001/api/health
curl --fail --silent --show-error http://localhost:3001/api/rankings
curl --fail --silent --show-error http://localhost:3001/api/rankings/90s-mainland-top-100
curl --fail --silent --show-error http://localhost:3001/api/rankings/90s-cantonese-top-70
```

`GET /api/rankings` 应返回两个正式 slug，不应返回未发布的 `90s-demo-ranking`。两个详情接口的 `songCount` 应分别为 100 和 72。

## 7. 已有榜单内容变更时

普通 import 不会静默修改一个与 manifest 不一致的现有榜单。若 manifest 是经过批准的权威修订，流程如下：

1. 查看 manifest 的 Git diff，确认每个标题、歌手、年份、名次及 metadata 变更都有来源。
2. 对目标数据库做可恢复备份。
3. 运行普通 `--dry-run`。对于已有内容冲突，它可能按设计失败；当前工具不支持 `--dry-run --replace`。
4. 得到明确授权后，只替换发生变化的榜单。
5. 重新执行第 6 节的 SQL 和 API 验证。

大陆榜替换命令：

```bash
npm run import:ranking --workspace @music-rank/database -- --replace manifests/90s-mainland-top-100.json
```

粤语榜替换命令：

```bash
npm run import:ranking --workspace @music-rank/database -- --replace manifests/90s-cantonese-top-70.json
```

非 development 环境仍需显式设置 `APP_ENV`。

`--replace` 的事务行为：

- 删除并重建目标 ranking 和它的 ranking entries，因此 ranking UUID 会变化，公开身份继续使用稳定 slug；
- 保留该榜单原有的发布状态；
- 按新 manifest 更新精确匹配的共享歌曲；
- 只删除没有被任何榜单、Top 10 或 Practice Library 引用的旧孤立歌曲；
- 任一步失败都会回滚整个替换事务。

## 8. 常见失败与处理

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| `DATABASE_URL` 缺失或为空 | 目标环境未配置数据库连接 | 按 `CONFIGURATION.md` 配置对应 `.local` 或真实环境变量；不要创建旧式 `.env` |
| 命令连到了 development 数据库 | 非 development 操作时没有显式设置 `APP_ENV` | 停止操作，确认目标库，恢复误写数据，然后使用正确 `APP_ENV` |
| `90s Demo ranking is required` | 未运行 Seed，或 Demo 被人为删除 | 运行 `db:seed`，确认 Demo slug 和 `sourceType=DEMO` 后重试 |
| rank continuity / duplicate 错误 | manifest 名次不连续、重复，或歌曲标准化后重复 | 修正并重新审批 manifest；不要绕过 validator |
| metadata does not match manifest | 数据库已有同 slug 榜单，但 metadata 与 manifest 不同 | 先审计差异；只有批准的权威更新才能走 `--replace` |
| release year conflict | 复用歌曲的已有年份与 manifest 冲突 | 人工确认数据来源；不要直接改数据库或自动 `--replace` |
| publish 后 Demo 仍公开 | 发布事务未成功或数据库被手工修改 | 检查命令错误与数据库状态；修复后重新运行幂等 publish |
| import 中途失败 | validator、约束或数据库连接失败 | 事务会回滚本次导入；解决原始错误后从 dry run 重新开始 |

## 9. AI agent 执行清单

AI agent 在报告“迁移完成”前必须逐项确认：

- [ ] 已读取 `AGENTS.md`、本手册和配置说明。
- [ ] 已确认 Git 分支、工作区状态和两个 manifest 均来自预期提交。
- [ ] 已确认目标环境；非 development 已显式设置 `APP_ENV`。
- [ ] 未输出密码、Token 或完整数据库连接串。
- [ ] 远程写操作前已有数据库备份。
- [ ] 已应用所有已跟踪 migration。
- [ ] Demo Seed 已成功，且未覆盖个人列表数据。
- [ ] 两个 manifest 的 dry run 均已检查。
- [ ] 大陆榜已导入 100 条，粤语榜已导入 72 条。
- [ ] 两个正式榜单已发布，Demo 保留 30 条且未发布。
- [ ] SQL 或等价数据库查询验证了条目数、名次连续性和唯一歌曲数。
- [ ] API 返回两个正式榜单且详情 `songCount` 正确。
- [ ] 若使用了 `--replace`，报告中记录了授权、备份、manifest diff 和替换摘要。

最终报告至少应包含：目标环境、执行的 migration 范围、两个榜单的导入摘要、发布状态、验证结果，以及任何未完成或需要人工处理的异常。不要在报告中包含敏感配置值。
