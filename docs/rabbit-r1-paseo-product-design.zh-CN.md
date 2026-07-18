# Rabbit R1 Paseo Companion 产品设计

状态：提案
日期：2026-07-17
读者：准备拆解、实现或验收 Rabbit R1 Paseo Companion 的产品、设计与工程人员

## 1. 产品契约

Rabbit R1 Paseo Companion 是一个个人离桌干预器。它让一个已经在使用 Paseo 的开发者，在离开桌面 5–30 分钟后主动打开 R1，用 5–30 秒识别并处理一个已有 Agent session 的状态，然后放下设备。

它不是小型 IDE，也不是另一套 Paseo 管理界面。它不启动工作，只帮助用户理解和干预已经运行的工作。

### 1.1 核心用户

首版只有一个用户：拥有一台 Rabbit R1、一个个人 Paseo Host，并在自己的 daemon 上运行 Agent session 的开发者。产品不处理团队账户、共享设备、多租户或多用户授权。

### 1.2 核心触发

用户主动打开 R1。首版不承诺后台通知、实时唤醒或 Creation suspend 期间的推送 SLA。

### 1.3 核心结果

一次使用应完成以下一项：

1. 确认当前没有需要处理的 Attention。
2. 理解一个 finished 或 error Agent session 的最新 meaningful content。
3. 对已有 Agent session 发送一个审阅过的 Follow-up。
4. 明确停止一个 Agent session 的 current turn。
5. 识别 Permission request，并转到完整 Paseo 继续处理。

## 2. 产品成功标准

第一个日用版本必须在真实个人工作中连续 dogfood 7 天，并满足：

- 至少 80% 的离桌干预无需再打开手机或桌面 Paseo。
- 从打开 R1 到识别最高优先级 Attention 的中位时间不超过 3 秒。
- 完成一次安全 Follow-up 的中位时间不超过 20 秒。
- 错误目标、重复提交、误批准和误停止均为 0。
- 缓存内容在同步完成前从不显示 `LIVE`。

指标定义：

- **Intervention session**：R1 后台或关闭至少 5 分钟后进入前台；从首次 foreground/boot event 开始，到再次离开或 60 秒无操作结束。
- **Eligible intervention**：完成 `LIVE` 同步后，用户确认无 Attention，或打开一个最高优先级 Attention/Agent。
- **R1-only success**：session 内完成目标且未打开手机/桌面 Paseo。Permission handoff 计为非 R1-only success，不从分母排除。
- **Identify time**：从 foreground/boot 到最高优先级 live Attention 完整显示并获得 focus；stale cache 不算完成。
- **Safe Follow-up time**：从 hold-to-record 开始，到同一 command identity 在 authoritative timeline 中 confirmed。

7 天验收至少包含 20 个 Eligible intervention sessions 和 10 个 Controlled commands。指标只写设备本地结构化日志，不记录 prompt、transcript 或 timeline 内容。

工程 release gate 与产品指标分开计算：

- Wheel focus feedback 小于 100ms。
- 正常 Wi-Fi 下首个可交互状态不超过 3 秒。
- 强制重连后 command 不丢失、不重复。
- 连续运行 30 分钟时 DOM、timeline 和 timer 保持有界。
- 核心流程无需精确触摸。

“零误操作”还必须通过确定性矩阵，覆盖每个网络断线点、duplicate/replay、target Agent 切换、successor-turn race、stale snapshot 和 grant revoke；低样本 dogfood 不能替代这些测试。

## 3. 范围

### 3.1 首版能力

- 单个 Host 的 Relay E2EE 连接。
- Home Attention 与 Workspace status 概览。
- Project、Workspace、Root Agent、Subagent 和 Native subagent 导航。
- 有界 projected timeline 和 reconnect reconciliation。
- Composer dictation、完整 transcript 审阅、Send 或 Cancel。
- Stop current turn，并等待 authoritative completion。
- Permission request 的只读摘要与人工 handoff。
- Stale/offline 阅读和一个绑定目标的 Draft。

### 3.2 明确非目标

- 创建 Agent session、Workspace、Worktree 或 Schedule。
- 选择或修改 provider、model、mode、MCP 或 shell。
- Terminal、diff、文件浏览、源代码编辑或完整 Markdown timeline。
- Archive Agent/Workspace、Close/Reopen Agent、Detach Subagent。
- 删除或终止 Native subagent。
- 在 R1 上批准或拒绝 Permission。
- 多 Host、团队账户、共享设备或多用户授权。
- 后台通知、实时唤醒或完整 Paseo Voice mode。
- Direct/LAN 正式连接。
- 未经量化 blocker 证明的原生 Android/custom ROM 路线。

## 4. 领域模型

产品沿用 Paseo 的 canonical language。完整定义见 [CONTEXT](../CONTEXT.md)。

### 4.1 Ownership

```text
Host
└── Project
    └── Workspace
        └── Root Agent session
            ├── Subagent
            └── Native subagent (read-only)
```

- 一个 Workspace 属于一个 Project，并由稳定 identity 标识。
- Workspace 默认只列 Root Agent session，不平铺 Subagent。
- Subagent 始终保留父 Agent 关系。
- Managed Subagent 的关系 home 是 Parent Agent 的 Subagents 列表。
- 跨 Workspace Subagent 还通过 execution Workspace 的独立 `RELATED SUBAGENTS · n` 分组可发现，但不平铺为 Root Agent。
- 跨 Workspace Subagent 同时展示 `RUNS IN` execution Project/Workspace 与 `PARENT` Project/Workspace/Agent。
- Native subagent 与 Subagent 使用同一层级，但始终标记 `READ ONLY`。
- Native subagent 没有独立 Paseo Workspace ownership，只留在 Parent Subagents。
- Parent unavailable/archived 时显示 `PARENT UNAVAILABLE`；managed Subagent 仍可从 execution Workspace 或 Attention 阅读。

### 4.2 正交状态

服务端事实不能压成一个状态值：

| 维度 | Canonical values | 产品用途 |
|---|---|---|
| TransportState | unpaired / offline / connecting / syncing / online | 描述连接生命周期，不承载数据新鲜度或授权结果 |
| Freshness | stale / syncing / live | 判断当前投影是否完成 authoritative reconciliation |
| AuthState | unauthorized / active / auth-required | 判断 Device grant/session 是否允许读取或操作 |
| Compatibility | supported / limited / upgrade-required / unsupported | 判断客户端、协议、firmware 与能力是否兼容 |
| Agent lifecycle | initializing / running / idle / error / closed | 描述一个 Agent session 的真实执行状态 |
| Attention reason | permission / error / finished / none | 判断是否需要用户处理 |
| Workspace status | needs_input / failed / running / attention / done | 汇总一个 Workspace 的工作优先级 |
| Read state | local viewed / unviewed | 只影响视觉强度，不改变服务端事实 |

每个 `finished/error` Attention 关联稳定 attention version 或 source turn/event identity。Finished meaningful content 是对应 turn 的最新 assistant summary 或明确 terminal result；Error meaningful content 是对应 failure 的规范化标题、摘要和下一步。只有 identity 匹配、projection schema 有效、内容非空、截断明确标记 `MORE IN PASEO`、DOM commit 成功且页面仍为 `LIVE` 时，才对该 attention version 调用一次幂等 clear。

Clear 成功是跨 Paseo client 的全局已处理语义。Clear 失败时保留 Attention，不 optimistic hide。找不到匹配 Meaningful content 时显示 `CONTINUE IN PASEO`，不清除。查看 stale snapshot 永不清除 Attention，也不写入 Read state；Permission 只在解决或过期后消失。

## 5. 信息架构

```text
Installation
└── Pairing
    └── Home
        ├── Attention -> Agent/Subagent
        └── Workspace
            ├── Back
            ├── Root Agent
            ├── Related Subagents (cross-workspace only)
            └── Root Agent
                ├── Timeline
                ├── Subagents
                │   ├── Subagent
                │   └── Native subagent (read-only)
                └── Actions
                    ├── Back
                    ├── Follow up -> Composer
                    ├── Review permission -> Handoff
                    └── Stop -> Confirmation
```

Home 是唯一根视图。Workspace、Subagents、Actions、Handoff 和 Decision/list 视图提供 wheel-focusable Back；Composer 只提供默认选中的 Cancel 与 Send。Agent 的 wheel focus 只浏览 timeline；其纯硬件返回路径是 side click → Actions → Back。

Home 先显示服务端 Attention，再显示 Workspace。排序为：

1. Permission Attention。
2. Error Attention。
3. Finished Attention。
4. Workspace status：needs_input / failed / running / attention / done。
5. 同一 bucket 内按最近更新时间。

Read state 不增加新的 Attention 类型，也不改变排序。

Home Attention、Parent Subagents 和 Execution Workspace 三条路径共享同一 entity/status，Attention 按 `Host + Agent/Subagent identity + attentionVersion` 去重。Navigation 保留来源 stack，Back 返回各自入口；identity 不因入口变化而复制。

目录使用 attention-first 的有界分页。每页先返回所有未解决 Attention 所需的最小 entity/context，再用剩余预算返回普通 Workspace/Agent；响应携带 `totalAttention`、稳定 continuation cursor 和截断原因。客户端内存上限不得丢弃已返回的 Attention；若当前硬件预算无法容纳全部未解决 Attention，Home 固定显示 `MORE ATTENTION IN PASEO · n`，保持最高优先级项和 continuation，并且“无 Attention”结论不可成立。普通目录也必须显示 `MORE IN PASEO`，不得静默截断。

## 6. 核心流程

### 6.0 Action capability matrix

| Target/state | Follow-up | Stop | Permission |
|---|---:|---:|---:|
| Root/managed Subagent · idle | 可用 | 不可用 | 有请求时 handoff |
| Root/managed Subagent · running | 可用 | turn-safe contract 完成后可用 | 有请求时 handoff |
| Root/managed Subagent · permission pending | 禁用 | running 且 turn-safe 时可用 | handoff only |
| initializing/error/closed | 禁用 | 禁用 | 有请求时 handoff |
| Native subagent | 禁用 | 禁用 | 只读 |
| stale/offline/syncing | 禁用 | 禁用 | 只读缓存摘要 |
| grant/lock/security/compatibility gate 缺失 | 禁用 | 禁用 | handoff only |

结构性不支持的 action 直接隐藏；暂时不可用的 action 保留 disabled，并显示 `SYNCING`、`DEVICE LOCK REQUIRED`、`UPGRADE REQUIRED` 等短原因。Permission pending 时不允许 Follow-up，避免形成 provider-specific 隐式队列。服务端再次验证 target type、lifecycle、grant scope、protocol compatibility、turn identity 与 Device session validity，不能只靠前端隐藏按钮；device lock 由客户端本地 gate 负责，除非未来有可信 OS attestation。

### 6.1 Wake and sync

```text
open -> cached snapshot (optional) -> connecting -> syncing -> LIVE
```

- 缓存可立即显示，但始终标记 `STALE` 或 `SYNCING`。
- WebSocket open 不等于 `LIVE`。
- 只有 hello/status、subscription 和 timeline replay/snapshot 对账完成后才进入 `LIVE`。
- 异步新事件不得抢走当前 focus。

### 6.2 Review Attention

```text
Home Attention -> Agent/Subagent -> meaningful content -> Actions or Back
```

Attention internal navigation target 必须保留 Host、execution Workspace、Agent 和父 Agent context。只有匹配 attention version/source identity 的 live Meaningful content 成功渲染后，finished/error 才能幂等清除；失败保持可见。

### 6.3 Composer dictation

```text
Agent -> hold side button -> RECORDING -> release -> TRANSCRIBING
      -> REVIEW -> SEND | CANCEL
```

- Transcript 绝不自动发送。
- 无触摸核心路径只有 Send 或 Cancel。
- Transcript 错误时 Cancel 并重新 dictation。
- Touch keyboard editing 是可选加速能力，不是 MVP 成功条件。
- 转写或发送失败保留原 Draft。

Side-button gesture contract：

- 优先消费 RabbitOS `sideClick / longPressStart / longPressEnd`，产品层不猜测 hold threshold。
- `longPressStart` 后 gesture consumed；到 `longPressEnd` 前忽略 sideClick，并抑制随后一个迟到 click。抑制窗口由 Phase 0A 在 Tested firmware 上实测固化。
- 过短录音显示 `TOO SHORT` 并返回 Agent，不创建 Draft。
- 录音 30 秒达到安全上限时停止采集并进入 review，永不自动发送。
- `TRANSCRIBING / SENDING / STOPPING / UNKNOWN` 忽略新 click/hold，避免重入。
- `longPressEnd` 丢失时 safety timeout 结束录音并标记失败，不提交空 transcript。
- 每个 gesture 只产生一个 semantic command。

### 6.4 Stop current turn

```text
Agent -> Actions -> Stop -> Confirm(Cancel selected)
      -> STOPPING -> authoritative stopped | TURN CHANGED | failed(running)
```

- Stop command 绑定 `agentSessionId + targetTurnId/generation + commandId`，只取消用户确认时看到的 turn。
- 服务端原子检查当前 turn 仍匹配 target；若 successor turn 已开始，拒绝并显示 `TURN CHANGED`。
- RPC accepted 只表示请求已接收。
- 只有能指向同一 target turn 的 terminal event，或明确证明该 turn 已结束的 authoritative snapshot 才表示完成。
- 拒绝或超时保持 running，并持续显示失败信息。
- 断线后按 commandId 查询结果，不盲目重发。Stop 绝不影响 successor turn。
- 如果 Paseo 没有稳定 turn identity 与 conditional cancellation，Follow-up 可以发布，但 Stop 推迟。

### 6.5 Permission handoff

```text
Permission Attention -> Agent -> Review permission
                     -> CONTINUE IN PASEO -> Back
```

R1 只显示安全摘要和完整 Host/Workspace/Agent context。`CONTINUE IN PASEO` 是状态文案，唯一 action 是 Back。用户手动打开已配对的手机或桌面 Paseo；首版不生成 handoff token、QR、push 或 deep link。

## 7. Offline 与 Draft

离线允许阅读 stale snapshot，并保留最多一个 Draft。

Draft 必须绑定 Host + Workspace + Agent session：

- 切换 Agent 不迁移 Draft。
- Draft 不显示成 pending command。
- Send 与 Stop 在 stale/offline 时 disabled。
- 重连后重新展示目标与最新上下文，用户必须再次选择 Send。
- 永不自动发送或排队操作。
- Secure storage 不可用时，Draft 仅存在于当前 Creation session。
- 成功转写后才创建或更新 Draft；dictation 开始前记录 preDictationDraft。
- 同一 Agent 再次 dictation 成功后追加；Cancel 本次 review 恢复 preDictationDraft。
- `DISCARD DRAFT` 是独立显式操作，不与 Back/Cancel 混用。
- Send confirmed 后清除；sending/accepted/unknown/failed 时保留。
- Agent B 不得覆盖 Agent A 的 Draft。录音前显示 `DRAFT IN <Agent A>`，只提供 `RETURN TO DRAFT` 或 `DISCARD DRAFT`。
- Target closed/archived/unavailable 时禁止 Send，只允许查看和丢弃。
- Secure storage 中 Draft TTL 为 24 小时，过期后 wipe。

### 7.1 Local data contract

导入 Relay offer、读取 grant 或请求敏感数据前，客户端先完成 firmware 与安全 capability gate。

只有 secure Creation storage 可以跨重启保存：

- Device grant。
- 一个绑定目标的 Draft。
- 最小化 Snapshot cache：Host/Project/Workspace/Agent identity、状态和短摘要。
- 一个未解决 Controlled command 的最小 receipt：`commandId`、command kind、Host/Workspace/Agent identity、Stop 的 target turn、状态和时间戳；不得包含 prompt、transcript、timeline 或 tool payload。

Snapshot cache TTL 为 24 小时，恢复后始终先显示 `STALE`。持久数据必须有 schema/version、严格容量上限和损坏恢复；不得保存 raw tool input/output、完整 timeline、provider credential 或日志 payload。

Secure storage 缺失时，只读可分发能力可以 session-only，grant、Draft 和 snapshot 在 Creation 关闭或重启后失效并要求重新授权与同步；Follow-up 和 Stop 不得发布，因为进程死亡后无法可靠恢复 command receipt。Unpair、auth invalidation、schema failure 或安全 capability 下降时立即 wipe 本地敏感数据；daemon 仍保留 authoritative dedupe/audit result。测试覆盖 suspend、restart、TTL expiry、wipe 和 corrupted-data recovery。

### 7.2 Controlled command reconciliation

```text
draft -> sending -> accepted -> confirmed
              \-> failed
              \-> unknown
```

- Draft 不是 command；提交前生成稳定 commandId。
- 服务端持久去重，并支持按 commandId 查询结果。
- 写 socket 前先原子保存 receipt；未成功写入时删除 receipt 并返回 Draft。
- 断线前未写入 socket 时返回 Draft；已写入但结果不明时进入 `UNKNOWN`。
- `UNKNOWN` 永不自动重发，重连后先查询 command result。
- 启动或恢复时先 reconcile 未解决 receipt；在 confirmed/failed 的 authoritative result 被处理前，阻止新的 Follow-up 和 Stop。
- Follow-up 只有在 authoritative timeline 出现同一 message/command identity 后才 `confirmed`。
- Stop 还必须匹配已确认的 target turn。
- 查询仍无结果时持续显示 `CHECK PASEO`，不猜测成功或失败。
- 如果 Paseo 无法提供 durable dedupe 与 result query，Phase 0B 可私人测试，Controlled Actions 不发布。

## 8. Permission 安全边界

首个 Controlled Actions 版本不执行 Permission decision。后续只有真实 request corpus 证明存在稳定子集，并且 allowlisted provider adapter 能生成完整 `Device decision` 时才重新评估。

Future Device decision 至少包含：

- Stable request ID。
- Content fingerprint。
- 完整、未截断详情。
- Stable action IDs 与明确 behavior。

R1 只能提交 `selectedActionId`，不能从 label、位置或 yes/no 推断授权语义。

## 9. Trust 与授权

### 9.1 三个不同概念

- Installation QR：安装一个 immutable Creation release URL。
- Relay offer：建立 Host 的 Relay E2EE 连接，但持有者具有 trusted operator authority。
- Device grant：R1 专属、按安装版本实际能力最小签发、可独立撤销的授权。

### 9.2 私人实验边界

Phase 0A、0B 和 Phase 1 可以在 owned device 上使用现有 Relay offer，但只能私人 dogfood。“Read-only”只描述 UI，不是 credential scope；这些阶段不得作为产品分发。

### 9.3 可分发版本前提

任何可分发版本必须同时具备：

- 经过审计的 immutable bundle。
- 绑定一个 Host、只包含当前版本已获批准 scopes 的 Device grant。
- Trusted full Paseo 中的 grant 确认与独立撤销。
- Reliable RabbitOS device lock，且用户已启用。
- 首个可分发版本即完成 client/daemon protocol 与 minimum-client compatibility negotiation，并在不兼容时 fail closed。
- Secure storage 用于跨重启持久化；若缺失，仅允许 session-only 的只读分发，不发布 Follow-up/Stop。
- Unpair/auth invalidation 后清除 grant、敏感缓存与 Draft。

若目标 firmware 没有可靠设备锁，项目保持私人只读实验状态。

### 9.4 Device enrollment 状态机（TO-BE-BUILT）

```text
UNPAIRED -> ENTER CODE -> CONNECTING -> VERIFY CODE
         -> AWAITING APPROVAL -> ACTIVE | DENIED | EXPIRED
```

- Trusted full Paseo 生成 5 分钟有效、一次性的 enrollment code。
- Code 只换取 Host identity、Relay/E2EE bootstrap 和 enrollment nonce，不授予 command authority。
- R1 建立受限 enrollment session，并显示 verification words/code。
- Trusted Paseo 同时显示同一 verification 值、R1 identity 和安装版本实际请求的 scopes。
- 用户批准后，daemon 签发绑定 R1 identity 的 Device grant。
- 初始仅请求 `read`；Phase 2B 和 2C 分别要求用户再次批准 `follow-up` 和 `stop`。安装或升级 Creation 绝不自动扩大 scope。
- Grant 持续有效直到显式撤销、设备重置或必需安全能力失效，不要求周期性重新 enrollment。
- 每次连接由 daemon 重新校验 grant、scope 和 protocol compatibility，再签发短期自动轮换的 Device session；撤销立即终止全部派生 session。Device lock 是 Tested firmware 上的发布与客户端本地 gate；除非 RabbitOS 后续提供可信 attestation，daemon 不声称能远程证明锁已启用。
- Denied、Expired 或 Cancel 回到 Unpaired，不保留半完成凭证。
- Revoke 后在线 R1 立即进入 `AUTH REQUIRED` 并 wipe。
- 无 secure storage 时，grant 在当前 Creation session 结束时失效。
- R1 不要求相机；短 code 可通过 wheel/touch keyboard 输入。

这是新的 Paseo authorization protocol，不是现有 Relay offer 或 SDK capability。

### 9.5 Trusted Paseo Device 管理

Phase 2A 必须在 Trusted full Paseo 中提供 Device 管理界面。每台 R1 显示用户可识别名称、stable identity、绑定 Host、当前 scopes、immutable Creation release、Tested firmware 状态、last seen，以及 `ACTIVE / REVOKED / SECURITY BLOCKED`。用户可以确认 `REVOKE DEVICE`，或显式执行 `ENABLE FOLLOW-UP`、`ENABLE STOP` 升权。离线设备的 revoke 立即使 grant 失效；R1 下次连接只能进入 `AUTH REQUIRED`。

`read` 覆盖绑定 Host 当前及未来的 Project、Workspace、Agent、Subagent 和 Attention，首版不提供 Workspace allowlist。新 Workspace 自动出现，避免 Attention 静默漏报；更换 Host 必须重新 enrollment。该 scope 不包含 provider/agent CLI credential、daemon 管理、raw filesystem 或未投影 timeline/tool payload。

Phase 2A authorization security matrix 必须至少覆盖：enrollment denial/expiry/cancel、one-time code replay、verification mismatch、pairing/command rate limit、scope elevation 与 downgrade、Creation upgrade 不自动升权、Device reset、在线与离线 grant revoke、全部派生 Device session 失效、protocol mismatch fail-closed，以及无 secure storage 时 Controlled Actions 不可用。测试和 UI 使用 Device grant / Device session 术语，不以含糊的 token revoke 代替。

## 10. Connection 与协议

正式 MVP 只支持 Paseo Relay。Direct/LAN 仅用于受控开发调试，不进入配对界面和支持范围。

客户端先复用现有 Relay E2EE 与 Paseo WebSocket protocol：

- 锁定 Paseo client 版本。
- 用本地 adapter 隔离 SDK 和内部 API。
- 对实际消息子集做 contract tests。
- Timeline 使用 live stream + authoritative paged reconciliation。
- Paseo 无条件提供 R1 safety projection/data minimization：稳定 identity、Attention-first directory、确定性摘要/截断，并且不向 R1 发送 raw terminal/tool payload。它不依赖独立 gateway trigger。
- 当前 Follow-up message ID 与 Stop request ID 不足以证明 durable dedupe。Controlled Actions 要求新增 stable commandId、持久去重与 result query contract。
- Stop 等待 authoritative state，而不只等待 request response。
- Releasable Stop 还要求 stable turn identity 与服务端 atomic precondition；现有 cancel-by-agent 不能直接作为正式 contract。
- 服务端对每个 Controlled command 重新执行 Action capability matrix；客户端可见性不是授权边界。

只有真实 R1 测量证明 bundle/内存、frame/timeline 体积或协议性能仍无法通过 release gate 时，才引入独立的 versioned projection gateway。安全投影与数据最小化是无条件 Paseo extension，不以该性能 trigger 为前提。

## 11. Hosting 与升级

Phase 0A/0B 使用临时 HTTPS tunnel。Phase 1 可使用私有 versioned static hosting 做 owned-device dogfood。

第一个可分发版本使用独立 HTTPS static hosting：

- 每个 release 使用 immutable version path。
- Installation QR 指向一个明确版本。
- 升级发布新 URL，不覆盖旧 bundle。
- QR library 和运行依赖 vendored/bundled，不依赖 runtime third-party CDN。
- 使用严格 CSP、最小 origin 写权限并记录审计 bundle digest；digest 用于发布审计，不宣称是设备端 attestation。
- Self-hosters 可以发布相同静态目录到自己的 HTTPS origin。
- Daemon 负责 Relay/WebSocket、Device grant 和业务协议，不分发正式 Creation assets。

Phase 2A 的首个可分发版本必须新增 client/daemon protocol 与 minimum-client compatibility negotiation；当前 Paseo 尚未提供这项 R1 contract。不兼容时 fail closed 并显示 Upgrade Required。Phase 3 只完善升级 UX、diagnostics 和运维信号。

Immutable path 是受信任 static origin 上的运营控制，不是防止 origin 替换入口文档的密码学证明。当前产品信任官方或 self-hosted origin 的运维者；CSP、vendored dependency、审计 digest 和 origin access control 只能降低误替换与供应链风险。若要抵御恶意或已攻陷 origin，必须依赖 RabbitOS 支持的 signed bundle/attestation，当前不作此承诺。

## 12. 语言与硬件适配

首版 chrome 使用短英文，不提供语言切换。Project、Workspace、Agent title、timeline 和 transcript 保留原始 UTF-8 内容，必须正确显示 CJK。

首个可分发版本只支持一个在 owned R1 上完成完整矩阵的 Tested firmware：

- 未知 firmware 或非安全关键能力缺失时可以进入明确标记的 `LIMITED` read-only。
- E2EE、identity 或 data-integrity capability 缺失时进入 `UNSUPPORTED`。
- `UNSUPPORTED` 不接收敏感数据，也不启用 Controlled Actions。
- 增加 firmware support 必须重新执行完整硬件矩阵。

## 13. Delivery phases

### Phase 0A · Hardware capability probe

现有 build-free probe 只提供 viewport、wheel、side button、STT、storage、HTTPS/WSS 和 suspend/resume 的测试入口；目前没有真机证据证明这些能力可用。Phase 0A 必须在 owned R1 上逐项记录 hardware result、fallback 与 blocker，browser mock 不算通过。

### Phase 0B · Private transport vertical slice

在 owned R1 上使用 Relay offer + pinned adapter，完成 E2EE、Workspace/Attention、一个 Agent timeline 和一次测试 Follow-up。记录当前 dedupe/reconciliation 缺口；本阶段测试不构成 Controlled Actions 保证。

### Phase 1 · Read-only private dogfood

完成 Home、Workspace、Root Agent、Subagents、Attention、timeline reconciliation 和 offline/stale。使用 Relay offer，只能私人 dogfood。

### Phase 2A · Controlled Actions security foundation

完成 audited immutable bundle、Device enrollment、`read` grant、Trusted Paseo Device 管理、offline independent revocation、protocol/minimum-client negotiation、secure storage 和 device-lock gate。Device lock 验证失败时 Phase 2A 不得作为产品分发；所有安全矩阵通过前保持私人只读，不开放 Controlled Action。

### Phase 2B · Follow-up

用户在 Trusted Paseo 中单独批准 `follow-up` scope 后，完成 Composer dictation、完整审阅、Send/Cancel、target-bound Draft，以及 secure receipt、durable commandId/dedupe/result-query reconciliation。Secure storage 缺失时不得发布。通过断连、process restart、duplicate/replay、target 切换、grant revoke 和 `UNKNOWN` 矩阵后，可以发布不含 Stop scope/UI 的 `Follow-up-only beta`；Permission 保持 handoff。

### Phase 2C · Turn-safe Stop

仅在 Paseo 提供 stable turn identity、服务端 conditional cancellation 和 exact-turn result correlation 后开放 Stop。successor-turn race、turn changed 原子拒绝和断线对账必须全部通过；用户还必须在 Trusted Paseo 中重新批准 `stop` scope。

### Phase 3 · Daily-use release

Phase 2C 完成后，完善 upgrade UX、diagnostics、battery/suspend/connectivity trial 和 7 天 dogfood，满足产品与工程 gate。Compatibility negotiation 已是 Phase 2A gate；Follow-up-only beta 不属于日用版本。

### Phase 4 · Native evaluation

只有量化的 Creation limitation 阻塞核心场景，且原生 Android 能证明解决该 blocker 时才启动。

## 14. 仍需实测的问题

以下问题不是待定产品方向，而是阶段退出所需证据：

1. Tested firmware 的 wheel direction、event rate 和 side click/hold timing。
2. STT、secure storage 和 system device lock 的真实 contract。
3. Relay E2EE 所需 crypto primitive、frame size 和 memory 是否满足 Creation。
4. Pinned Paseo client bundle 与 projected timeline 的资源上限。
5. Suspend/resume 后 directory refetch/resubscribe、per-Agent timeline catch-up 与 data freshness 的正确性。
6. CJK font metrics、line breaking、glyph coverage 和 OSK 行为。
7. 是否有测量证据触发 projection gateway。
8. Paseo 是否已提供 stable turn identity、conditional cancellation 和按 commandId 查询 Stop 结果。
9. Paseo 是否已提供 Follow-up/Stop 的 durable dedupe 与 command-result query。
10. Device enrollment、identity-bound grant、scope enforcement 和 immediate revoke 是否已完成端到端实现。
11. Hold 后迟到 click 的抑制窗口、过短录音阈值与 suspend 中断行为。
12. Attention-first pagination、continuation 和 `MORE ATTENTION IN PASEO` 在超过内存上限时是否仍不漏报。

## 15. 相关文档

- [领域语言](../CONTEXT.md)
- [方案设计](rabbit-r1-paseo-client-design.zh-CN.md)
- [UI/UX 设计](rabbit-r1-paseo-ui-ux.zh-CN.md)
- [Design system](../DESIGN.md)
- [Creation 调研与验证路径](../research.md)
- [架构决策](adr/)
