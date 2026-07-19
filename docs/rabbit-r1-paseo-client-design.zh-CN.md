# Rabbit R1 Paseo 客户端：方案设计

简体中文 | [English](rabbit-r1-paseo-client-design.md)

状态：提案  
日期：2026-07-17  
读者：负责实现或评审首个 Rabbit R1 Paseo 客户端的工程师

## 1. 文档目的

本文定义一个可实施的 Rabbit R1 Paseo 客户端首版方案。读完后，工程师应能把 MVP 拆成具体任务，实现设备客户端及其服务端适配层，并在真实硬件上完成验证。

该客户端把 Rabbit R1 变成运行于其他机器上的 Paseo coding agent 的紧凑型遥控器。它适合在离开桌面时查看工作进展、发送简短的后续指令和处理决策，不试图复制完整的 Paseo 移动端或桌面端体验。

首版只服务一个核心场景：Paseo 已在一个个人 Host 上运行 Agent session；用户离桌 5–30 分钟后主动打开 R1，在 5–30 秒内识别并处理一个需要关注的事项，然后放下设备。R1 是离桌干预器，不是另一套 Paseo 管理界面。

## 2. 目标与非目标

### 2.1 目标

- 无需解锁或刷写 Rabbit R1 即可安装和更新客户端。
- 通过 Paseo Relay 的端到端加密连接安全访问已有 Paseo 实例。
- 以适合 R1 屏幕的形式展示需要关注的事项，以及它们所属的 host、project、workspace 和 agent session。
- 在 workspace 上下文中打开一个 agent，并跟踪最近最有意义的活动。
- 通过按住说话、完整审阅并明确发送来完成 Follow-up。
- 停止运行中的 Agent session，并将 Permission request 安全转交完整 Paseo 客户端。
- 主要通过滚轮和侧键操作，以触摸作为辅助输入。
- 在休眠、断网、daemon 重启和凭证失效后正确恢复。
- 主动打开后快速同步；缓存可以立即展示，但只有完成 replay/snapshot 对账后才显示 `LIVE`。

### 2.2 MVP 非目标

- 在 Rabbit R1 上运行 coding agent 或 Paseo daemon。
- 复刻完整 timeline、终端模拟器、文件浏览器、diff viewer 或 workspace manager。
- 原样复用现有手机布局。
- 替换 RabbitOS launcher 或语音助手。
- 依赖 bootloader 解锁、root、Magisk、AOSP 或 CipherOS。
- 支持任意第三方 Paseo 扩展。
- 在 R1 上编辑源代码。
- 创建 Agent session、Workspace 或 Schedule，或修改 provider、model、mode。
- Archive Agent/Workspace、Close/Reopen Agent session、Detach Subagent，或删除/终止 Native subagent。
- 承诺后台通知、实时唤醒或 Creation 被 suspend 时的推送 SLA。
- 在真机验证 OSK 高度、焦点和目标语言输入前，承诺 typed Follow-up 是核心能力。

## 3. 设备与平台约束

MVP 以 RabbitOS Creation 运行。Creation 是由 QR payload 安装的托管 WebView 应用。

以下约束作为产品要求处理：

- Creation 的有效 viewport 是 240×292 CSS pixels，物理屏幕分辨率不是应用布局尺寸。
- 滚轮产生离散的向上和向下事件，应移动选择项，而不是模拟高分辨率惯性滚动。
- 侧键提供短按和按住事件，按住说话是主要输入方式。
- 原生语音转写通过 Creation bridge 返回完整 transcript；MVP 不自行传输原始麦克风音频。
- 设备支持触摸，但核心目标必须在无需精确触摸的情况下可操作。
- WebView 渲染能力有限，不适合大型 DOM、复杂 Markdown、WebGL、持续动画和无限日志。
- 客户端从 HTTPS 加载，远程连接必须使用 secure WebSocket 或 HTTPS。
- RabbitOS 按安装 URL 缓存 Creation，发布时需要版本化 URL 或等效的 cache busting。
- 不同 RabbitOS 版本提供的 bridge 能力可能不同。每个原生 API 都必须先检测能力，并提供可见 fallback 或明确的“不支持”状态。
- 首版固定 chrome 使用简短英文，不提供语言切换；Project、Workspace、Agent title、timeline 摘要和 transcript 保留原始 UTF-8/CJK 内容。

社区实验表明，Creation 可以使用滚轮、侧键、原生语音转写、安全存储、传感器、HTTPS、Server-Sent Events 和 WebSocket。这些能力足以支撑本方案。

首个可分发版本只支持 owned R1 上完成整套验证的一个 Tested firmware。启动时仍 feature-detect 每项能力，但其他 build 上“看起来可用”不构成支持承诺。未知 firmware 或非安全关键能力缺失时，可以在明确标记下进入 `LIMITED` 只读；E2EE、身份或数据完整性能力缺失时显示 `UNSUPPORTED`，不连接敏感数据，也不启用 Controlled Actions。扩展 firmware support 必须重新执行完整硬件矩阵。

## 4. 方案选型

### 4.1 选定方案

构建专用 Rabbit R1 Creation，先复用现有 Paseo Relay、E2EE 和 WebSocket contract。R1 内部通过锁定版本的本地 client adapter 隔离不稳定 SDK，并用 contract tests 固定实际使用的消息子集。

```text
Rabbit R1
Creation WebView
  - agent 列表
  - 活动摘要
  - PTT 与文字输入
  - stop 与 permission handoff
  - pinned Paseo client adapter
        |
        | Paseo WebSocket + E2EE
        v
Paseo Relay（E2EE）
        |
        v
Paseo daemon
        |
        v
Claude Code、Codex、Copilot、OpenCode、Pi
```

Device grant 是无条件实现的独立授权扩展，不预设完整 projection gateway。只有真实设备测量证明 bundle/内存、Relay frame/timeline 体积、协议兼容性或服务端强制投影无法满足 release gate 时，才引入窄化、版本化的 projection gateway。

### 4.2 为什么不直接使用现有 Paseo App

现有 Expo 客户端面向手机、平板、Web 和桌面布局。即便 compact layout，也假设了比 Creation 大得多的空间和更精确的输入。加载完整应用还会把导航、retained panels、终端渲染、文件浏览和大量状态订阅带到受限硬件上。

R1 客户端应与 Paseo 共享领域 contract 和语义，但拥有自己的展示层和本地状态。

### 4.3 为什么不先刷 Android

社区固件已经可以在设备上运行 AOSP 或 CipherOS，但现有报告仍包括熄屏后触摸无法恢复、侧键支持不一致、MediaTek fastboot 复杂，以及依赖 Linux 工具的恢复流程。验证 Paseo 用例不需要承担这些风险。

只有当 Creation sandbox 阻塞了已验证的产品需求时，才考虑原生 Android，例如可靠后台连接、更底层的音频控制、系统通知，或 bridge 未开放的硬件行为。

## 5. 用户体验

### 5.1 导航模型

界面包含六个主要视图组：

1. **Home**：需要关注的事项，以及按 project 分组的 workspace。
2. **Workspace**：一个 workspace 内的 root agent session。
3. **Agent**：单个 agent session 的 timeline 投影；保留 host/project/workspace 上下文。
4. **Subagents**：从父 Agent 进入的 parent-scoped 列表，展示 Paseo Subagent 和只读 Native subagent。
5. **Actions**：从 Agent 进入的独立操作列表，包含 Back、Follow up、Stop 或 Review permission。
6. **Composer / Decision / Handoff**：发送前的 transcript 审阅、Stop 决策页，或只读 Permission handoff。

不同视图使用一致的交互规则：

| 输入 | Home / Workspace | Agent | Actions / Composer / Decision |
|---|---|---|---|
| 滚轮上/下 | 移动一个语义项 | 只浏览 timeline item | 移动一个操作或决定 |
| 侧键短按 | 打开所选项 | 打开 Actions，不直接执行副作用 | 确认当前明确选择 |
| 按住侧键 | 不启动录音，避免目标歧义 | 开始针对当前 agent 的 dictation | 不替换已有内容；按当前视图处理或忽略 |
| 松开侧键 | 无操作 | 结束录音并进入 transcribing | 无操作 |
| 触摸 | 选择或打开 | 打开 activity 或 Actions | 编辑、选择、确认或取消 |

Workspace、Subagents、Actions、Handoff 和 Decision/list 视图直接提供可被滚轮聚焦的 **Back** 项或命令。Composer 只提供 `CANCEL` 与 `SEND`，默认选择 Cancel。Agent 的滚轮焦点仅用于 timeline；其纯硬件返回路径是侧键短按进入 Actions，再选择 Back。触摸返回和经验证的 RabbitOS back event 映射到相同 cancel/return command，不是唯一返回方式。

### 5.2 Home 与 Workspace

Home 首先展示 `Needs attention`，然后展示按 project 分组的 workspace。Attention row 必须携带 workspace 名和 agent 标题；workspace row 必须携带 project 名，以及聚合 activity/attention。

Workspace 视图展示：

- 固定在首项的 Back
- Root agent session

Subagent 不在 Workspace 中平铺。每个 Root Agent session 提供 `SUBAGENTS · n` 入口，作为 managed/Native Subagent 的关系 home；Native subagent 显示 `READ ONLY` 且没有独立 Workspace ownership。跨 Workspace managed Subagent 还通过 execution Workspace 的独立 `RELATED SUBAGENTS · n` 分组可发现，并同时显示 `RUNS IN` 与 `PARENT` breadcrumb。Parent unavailable/archived 时标记 `PARENT UNAVAILABLE`。Home Attention、Parent list 和 Execution Workspace 共享同一 entity/status，按 `Host + identity + attentionVersion` 去重，但 Back 返回各自来源。

MVP 默认绑定单个 host。若未来支持多 host，Home 必须在 project 或 workspace 行中显示 host；不能把不同 host 的 workspace 合并成一个扁平列表。

列表有明确上限并按 attention、activity、recent update 排序；MVP 不展示 archived agent。

### 5.3 Agent 视图

首屏应回答三个问题：

- 这个 agent 正在做什么？
- 它是否需要我处理？
- 我下一步可以做什么？

视图包含：

- Workspace / agent 标题与全局 TransportState/Freshness
- 正交的 TransportState、Freshness、AuthState、Compatibility、Agent lifecycle 和 Attention reason
- 最近的 assistant 摘要或关键 timeline item
- 存在结构化步骤时显示紧凑进度
- 固定的 Actions 入口

原始 tool log 被折叠成简短描述。长输出由服务端投影截断，并明确标记仍有未显示内容。

滚轮在 Agent 视图只改变 timeline focus。侧键短按打开 Actions；Actions 中才提供 Back、Follow up、Stop 或 Review permission。异步 timeline 更新不得抢走当前 focus。

Action availability：Root/managed Subagent 在 `idle/running` 且所有安全 gate 通过时可 Follow-up；Permission pending 时禁用 Follow-up。Stop 只在 `running` 且 turn-safe contract 通过时可用。`initializing/error/closed` 与 Native subagent 不提供 Controlled Actions。Stale/offline/syncing 或 grant/lock/security/compatibility gate 缺失时 action disabled 并显示短原因。结构性不支持隐藏，暂时阻塞保留 disabled；服务端再次验证 daemon 可验证条件，没有 OS attestation 时 device lock 仍是本地 gate。

状态不能压缩成单个 `working/waiting/done/offline` 字段。Canonical 维度必须保持分离：

- **TransportState**：unpaired / offline / connecting / syncing / online
- **Freshness**：stale / syncing / live
- **AuthState**：unauthorized / active / auth-required
- **Compatibility**：supported / limited / upgrade-required / unsupported
- **Lifecycle**：initializing / running / idle / error / closed
- **Attention reason**：permission / error / finished / none
- **Workspace status bucket**：needs_input / failed / running / attention / done

R1 另行维护本地 **Read state**，只用于弱化已查看内容，不是 Attention reason，也不改变 Workspace status。`idle` 不得显示成 `waiting`；parent agent 处于 idle 时，workspace 仍可能因 Subagent 运行而聚合为 `running`。

每个 `finished/error` Attention 必须携带稳定 version 或 source turn/event identity。只有 identity 匹配、projection schema 有效、内容非空、截断明确标记 `MORE IN PASEO`、DOM commit 成功且页面仍为 `LIVE` 时，才能对该 version 调用一次幂等 clear。Finished 使用对应 turn 的 assistant summary 或 terminal result；Error 使用对应 failure 的规范化标题、摘要和下一步。Clear 失败不 optimistic hide；缺少匹配内容时显示 `CONTINUE IN PASEO`。查看 stale snapshot 永不清除 Attention；`permission` 只在解决或过期后消失。

### 5.4 语音 Follow-Up

1. 用户在明确打开的 Agent 视图按住侧键。
2. 客户端进入 `recording` 并调用原生 Creation voice bridge。
3. 松开后进入 `transcribing`，bridge 返回 transcript 或错误。
4. Composer 进入 `review`，完整展示 transcript 供用户检查。
5. 用户明确选择 Send 后进入 `sending`；RPC acknowledgement 后进入 `accepted`，明确失败则保留文本进入 `failed`，结果不明进入 `unknown` 且不重试。
6. Timeline 与 command-result query 按 commandId 对账；只有 authoritative timeline 出现同一 command identity 才进入 `confirmed` 并清除 Draft。

转写完成后绝不自动发送。无需触摸的核心路径只有 `SEND` 或 `CANCEL`；transcript 错误时 Cancel 并重新 dictation。触摸键盘编辑只是可选加速能力，在真机验证 OSK 高度、焦点和目标语言输入前不属于 MVP 成功条件。

这里的能力是 composer dictation，不是 Paseo 的完整 Voice mode。Composer 已有内容时，新的 dictation 默认追加；替换必须作为显式操作，并可取消。

转写失败时 Composer 进入 `voice-failed`，已有草稿保持不变；只有转写成功后才把新 transcript 追加到草稿。

Dictation 开始前记录 preDictationDraft；Cancel 本次 review 恢复该版本，只有独立 `DISCARD DRAFT` 才删除整个 Draft。Send confirmed 后清除，sending/accepted/unknown/failed 时保留。其他 Agent 不得覆盖或迁移现有 Draft：录音前显示 `DRAFT IN <Agent>`，只允许 `RETURN TO DRAFT` 或显式 discard。Target closed/archived/unavailable 时禁止 Send。持久 Draft TTL 为 24 小时。

Input controller 以 RabbitOS `sideClick / longPressStart / longPressEnd` 为准，不自行猜 hold threshold。`longPressStart` 消费整个 gesture，直到 `longPressEnd` 并抑制随后一个迟到 click；窗口由 Phase 0A 实测。过短录音显示 `TOO SHORT`，30 秒达到安全上限时结束采集并进入 review。Transcribing/sending/stopping/unknown 防重入。丢失 `longPressEnd` 时 safety timeout 标记失败，不提交空 transcript。

### 5.5 Permission handoff

首个 Controlled Actions 版本不在 R1 上批准或拒绝 Permission。客户端只读展示 request kind、标题、可安全显示的详情摘要、完整性状态和完整 Host / Workspace / Agent context；状态文案为 `CONTINUE IN PASEO`，唯一可执行 action 是 `BACK`。用户手动打开已配对的手机或桌面 Paseo，同一服务端 Permission Attention 会在那里出现。首版不创建 handoff token、QR、push 或跨设备 deep link。未知、畸形、截断或已变化的请求同样不得显示 Approve/Deny。

后续只有真实 request corpus 证明存在稳定子集，并且 allowlisted provider adapter 能生成包含 request ID、内容 fingerprint、完整详情和稳定 action ID 的 `Device decision` 时，才重新评估设备端决策。R1 必须提交 `selectedActionId`，绝不能从 label、位置或泛化 yes/no 推断行为。

Stop 只取消用户确认时看到的 current turn，不 Close、Archive、Detach 或删除任何领域对象。Command 携带 `agentSessionId + targetTurnId/generation + commandId`，服务端原子检查 target 仍是当前 turn；若 successor turn 已开始则拒绝并显示 `TURN CHANGED`。确认页默认选择 Cancel。RPC accepted 只表示请求已受理，不是完成；只有匹配同一 target turn 的 terminal event 或 authoritative snapshot 后才显示 stopped。断线后按 commandId 查询，不盲目重发。若 Paseo 无法提供 stable turn identity 与 conditional cancellation，Follow-up 可以发布，但 Stop 必须推迟。Native subagent 保持只读，其他生命周期管理只在完整 Paseo 中完成。

## 6. 客户端架构

Creation 保持足够小，并分为五项职责：

- **Bridge adapter**：统一 RabbitOS 事件、语音转写、安全存储和能力检测。
- **Transport**：配对、认证请求、secure WebSocket 生命周期、重试和恢复。
- **Store**：保存有界且规范化的 project、workspace、agent、attention、activity、连接状态、composer 和 pending action 状态。
- **Views**：固定尺寸的 Home、Workspace、Agent、Actions、Composer、Decision、Pairing、Offline 和 Upgrade Required 页面。
- **Input controller**：把滚轮、侧键、键盘 fallback 和触摸映射成语义命令。

设备代码使用 TypeScript 和轻量构建链。可以采用小型组件库，但除非真实设备测量证明大型框架仍足够流畅，否则首个原型优先使用普通 DOM 渲染或最小型 reactive library。

客户端必须限制保留数据量。初始限制为：

- 内存中最多 12 个 workspace 和 30 个 agent
- 当前 agent 最多 50 个投影后的 activity item
- 每个 activity item 投影后最多渲染 8 KiB 文本
- 仅一条活跃 transport connection
- 除重连和 heartbeat 外，不保留隐藏动画或后台 timer

这些是初始工程限制，可在设备 profiling 后调整。

目录加载必须有界且 attention-first。每页先返回未解决 Attention 所需的最小 entity/context，再返回普通 Workspace/Agent row，并携带 `totalAttention`、稳定 continuation cursor 和截断原因。内存上限不得静默丢弃已返回的 Attention。若全部未解决 Attention 无法装入，Home 保留最高优先级 row 与 continuation，并固定显示 `MORE ATTENTION IN PASEO · n`；客户端不得宣称“没有 Attention”。普通目录溢出同样显示 `MORE IN PASEO`。

## 7. 服务端 Contract

### 7.1 兼容性 Spike

先实现一个小型 browser client，通过 pinned adapter 尝试现有 Paseo 的 handshake、Relay offer、agent subscription、follow-up、stop 和 permission 流程。

Spike 必须回答：

- Creation 能否使用现有 transport 和 frame encoding？
- 现有 Relay offer 能否为 owned-device 私人 spike 建立 browser E2EE transport？它已明确不提供 cryptographic read-only scope。
- 重连能否恢复，而无需重新下载无限 timeline？
- Browser origin、TLS 和 relay 约束是否兼容托管 Creation？
- 哪些消息必须经过更小的服务端投影？

默认通过 pinned adapter 使用现有 transport。Paseo safety projection/data minimization、authorization、compatibility 和 command-safety extension 是无条件发布前置工作；独立 projection gateway 仍只由性能或协议测量触发。

### 7.2 必需的 R1 Authorization 与 Command Extension（TO-BE-BUILT）

当前 Paseo 没有 Device enrollment/grant/scope/revoke、durable command dedupe/result query 或 turn-safe conditional Stop。无论是否需要 projection gateway，Phase 2 都必须增加：

- 一次性 Device enrollment、Host-bound grant、短期 Device session、scope elevation、Device 管理和立即 revoke。
- 每个可发布 Follow-up/Stop 的 stable commandId、服务端持久去重和 command-result query。
- Stop 发布前的 stable target-turn identity 与服务端原子 conditional cancellation。
- 服务端对 target type、lifecycle、Device session、grant scope、compatibility 和 turn precondition 的强制检查。Device lock 在 RabbitOS 提供可信 attestation 前只是 Tested firmware 的发布/本地 gate。
- 首个可分发 Phase 2A 版本之前的 protocol/minimum-client compatibility exchange。
- 服务端强制 safety projection/data minimization，包括 attention-first 有界目录且不向 R1 发送 raw terminal/tool payload。

这些是新的 Paseo authorization/command contract，不是当前 SDK 或 daemon 已观察到的能力。

### 7.3 当前 Sync 与 Projection Contract

当前 Paseo 不提供跨 directory 和 timeline 的统一 monotonic stream cursor。重连时 adapter 必须：

- refetch 或 resubscribe Project、Workspace、Agent、Subagent 和 Attention directory。
- 对每个已打开 Agent，使用其各自可用的 epoch/sequence 或 authoritative paged snapshot 语义对账 timeline。
- directory 与 per-Agent reconciliation 全部完成前，缓存始终标记 `STALE` 或 `SYNCING`。
- Controlled command 通过新增的 result-query contract，按 commandId 单独对账。

客户端不能因为 WebSocket 已连接就假定状态完整。Paseo 在发送数据前强制 safety/data-minimization invariant；本地 adapter 保持这些 invariant，后续 measured gateway 只优化相同 contract：

- 保留稳定的 host、project、workspace、agent、activity、command 和 permission identifier。
- 分别保留 Freshness、literal Agent lifecycle、Workspace aggregate activity 和 Attention reason；不得投影成单一状态字段。
- 保留 parentAgentId、managed/native ownership 和 read-only capability。
- 只接收服务端确定性生成的摘要，不接收冗长 raw tool input/output。
- 移除终端控制序列和不支持的 rich content。
- 发送纯文本及少量受支持格式。
- 明确标记截断。
- 保留足够的 command correlation data，以便重连后校正 optimistic UI。

投影不能仅为了缩短内容而调用 LLM。确定性截断和已有结构化摘要更可预测、更快，也更保护隐私。

### 7.4 条件性 Projection Gateway

只有真实 R1 测量证明 bundle/内存成本、Relay frame/timeline 体积、browser 兼容性或协议性能仍不可接受时，才引入窄化、版本化 gateway。Safety projection/data minimization、Device enrollment、grant/session authorization、compatibility exchange、command reconciliation 和 turn-safe Stop 不依赖该 trigger。

## 8. 配对与安全

Creation 安装 QR 和 Paseo 设备配对是两个不同概念：

- 安装 QR 标识托管客户端 URL 和展示 metadata。
- 现有 Paseo Relay offer 提供 Host identity、Relay endpoint 和建立 E2EE 所需的公钥；持有者是可信 daemon operator，并不等于 R1 专属授权。

Phase 0A、0B 和 Phase 1 可以在 owned device 上从可信 Paseo 客户端导入现有 Relay offer。该凭证在服务端仍是 trusted operator authority；“只读”只描述 R1 UI，不是 cryptographic scope。因此这些阶段仅限私人 dogfood，不得作为产品分发，也不得因此自动启用 Follow-up、Stop 或 Permission。

Controlled actions 的正式流程：

1. 使用公开或自托管安装 QR 安装 Creation。
2. 用户在 Trusted full Paseo 中生成 5 分钟有效、一次性的 enrollment code。
3. 用户在 R1 输入短 code；code 只建立无 command authority 的 enrollment session。
4. R1 与 Trusted Paseo 同时显示 verification words/code、R1 identity，以及安装版本实际支持的 scopes。
5. 用户在 Trusted Paseo 批准后，daemon 签发绑定 R1 identity、可独立撤销的 Device grant。
6. 通过 secure Creation storage 保存 grant、Draft、snapshot 和未解决 command 的最小 receipt。没有 secure storage 时，只有只读分发可 session-only 运行；Follow-up 和 Stop 不得发布，且绝不回退到长期 `localStorage`。
7. 每次连接由 daemon 重新检查 scope 与 protocol compatibility，再用有效 grant 换取短期 Device session；客户端同时执行 Tested-firmware device-lock 本地 gate。

状态机是 `UNPAIRED -> ENTER CODE -> CONNECTING -> VERIFY CODE -> AWAITING APPROVAL -> ACTIVE | DENIED | EXPIRED`。Denied、Expired 或 Cancel 不保留半完成凭证；Revoke 让在线 R1 立即进入 `AUTH REQUIRED` 并 wipe。流程不要求 R1 相机。这是 TO-BE-BUILT authorization protocol，不是现有 Paseo capability。

Device grant 必须：

- 可以独立撤销。
- 只绑定一个 Host。`read` 覆盖该 Host 当前及未来的 Project、Workspace、Agent、Subagent 和 Attention；访问另一 Host 必须重新 enrollment。
- 初始只有 `read`；仅当安装版本支持相应能力，且用户再次在 Trusted Paseo 明确批准时，才增加 `follow-up` 或 `stop`。
- Creation 升级绝不自动扩大 scope；降级或兼容性失败只能缩减有效能力。
- 绝不暴露 provider credential 或 agent CLI credential。
- 持续有效直到显式撤销、设备重置或必需安全能力失效；不要求周期性重新 enrollment。
- 签发短期、自动轮换的 Device session；grant 撤销时立即使其派生的全部 session 失效。
- 在日志和错误报告中被隐藏。

Phase 2A 退出前，Trusted full Paseo 必须提供 Device 管理界面。每台已 enrollment 的 R1 显示用户可识别名称、stable device identity、绑定 Host、已批准 scopes、immutable Creation release 版本、Tested firmware 状态、last seen，以及 `ACTIVE`、`REVOKED` 或 `SECURITY BLOCKED`。用户可以在此确认 `REVOKE DEVICE`，或显式执行 `ENABLE FOLLOW-UP` 和后续 `ENABLE STOP` 升权。R1 离线时撤销仍立即生效；设备下次连接只能进入 `AUTH REQUIRED`。

Host-wide `read` 不暴露 provider/agent CLI credential、daemon 管理、raw filesystem 或未投影 timeline/tool payload。首版没有 Workspace allowlist：绑定 Host 新增 Workspace 时自动可见；更换 Host 必须重新 enrollment。

Phase 1 只读私人 dogfood 不强制设备锁。每个可分发版本，包括只读 Phase 2A，都必须使用经过审计的不可变 bundle、只包含该版本已批准 scopes 的 Device grant，以及在 Tested firmware 上已启用的可靠 RabbitOS device lock。这是发布与客户端本地 capability gate；没有 OS-backed attestation 时，daemon 不得声称能逐命令验证锁状态。Creation 不自建或保存第二套长期 PIN。若无法验证该物理安全前提，项目停留在私人实验状态。解除配对或认证失效后立即清除本地敏感状态。

在导入 Relay offer、读取 grant 或请求敏感数据前，先完成 firmware 与安全 capability gate。跨重启只通过 secure Creation storage 保存 grant、一个绑定目标的 Draft、TTL 24 小时的最小化 Snapshot cache，以及一个未解决 command receipt。Receipt 只含 commandId、kind、target identity、Stop target turn、状态和时间戳，不含 prompt、transcript、timeline 或 tool payload。所有持久数据都有 schema/version、容量上限和损坏恢复。Secure storage 缺失时只读可分发能力可 session-only 运行，但 Follow-up 和 Stop 不得发布。

Daemon 的 Device grant 授权扩展必须在重连时重新校验 grant，并对每个 command 强制检查当前 Device session、scope、compatibility、target lifecycle 和 turn precondition；在 Creation 中隐藏按钮不等于授权。Daemon 不得把客户端上报的 lock boolean 当作 attestation。部署拓扑允许时还应验证 WebSocket origin，对配对和命令限流，并在显式启用的本地开发环境之外强制 TLS。

正式 MVP 只支持 Paseo Relay。Direct/LAN 连接仅用于受控开发调试，不进入首版配对界面或支持范围；生产客户端不能提供关闭证书校验的选项。

## 9. 连接与故障行为

Transport state machine 必须显式定义，并与 5.3 节独立的 Freshness、AuthState、Compatibility 维度组合使用：

```text
unpaired -> connecting -> syncing -> online
                |            |         |
                v            v         v
              offline <------+---------+
                |
                +-> auth-required
                +-> upgrade-required
```

必要行为：

- 使用带 jitter 和最大等待时间的 exponential backoff。
- 页面隐藏或 RabbitOS suspend 时暂停激进重试。
- 恢复后重连，refetch/resubscribe directories，并使用每个已打开 Agent 各自的 timeline epoch/sequence 或 authoritative snapshot 对账。
- 本地最多保留一条绑定 Host + Workspace + Agent session 的 Follow-up Draft；Draft 不是 pending command，离线时不排队任何操作。
- Controlled command 使用 stable commandId；服务端必须持久去重并支持结果查询，避免重连导致 Follow-up 或 Stop 重复。
- 写 socket 前原子持久化无 payload receipt。已写入但结果不明的 command 进入 `UNKNOWN`；重连或 process restart 后先 reconcile receipt，在此之前禁止新的 Controlled command，永不自动重发；仍未知时显示 `CHECK PASEO`。
- 缓存状态过期时明确显示 stale，不能表现为实时数据。
- 设备解除配对时清除敏感状态。
- 离线时允许阅读 stale snapshot 和编辑已有 Draft，但禁用 Send 与 Stop。切换 Agent 不迁移 Draft；重连后重新显示目标与最新上下文，并要求用户再次选择 Send，永不自动发送。
- Secure storage 不可用时，只读 authorization、Draft 和 snapshot 仅保留在当前 Creation session，且不展示 Follow-up/Stop。查看 stale 内容不清除 Attention，也不写入 Read state。

## 10. 部署与运维

客户端是通过 HTTPS 提供的版本化静态 Web bundle。安装页面生成 Rabbit R1 Creation QR payload，其中包含标题、客户端 URL、描述、图标和主题色。

Phase 0A/0B 使用临时 HTTPS tunnel 做真机开发。Phase 1 可使用私有版本化 static hosting 做 owned-device dogfood；第一个可分发版本必须使用经过审计的独立 HTTPS static origin，并为每个版本发布不可变路径，例如 `/r1/v0.1.0/`。安装 QR 始终指向一个明确版本；升级发布新 URL，不覆盖旧 bundle。这是运营控制，不是抵御 origin 替换的密码学证明。

### 10.1 正式静态托管

官方或个人部署把完整静态目录发布到 HTTPS origin。`install.html` 所需 QR library 必须 vendored/bundled，正式安装页不依赖运行时第三方 CDN。R1 bundle 只通过 Paseo Relay 连接 daemon。

正式托管使用严格 CSP、最小 origin 写权限、vendored dependency 和记录在案的审计 digest。Digest 用于发布复核，不是设备 attestation。当前产品信任官方或 self-hosted static-origin 运维者；抵御恶意或已攻陷 origin 需要 RabbitOS 支持 signed-bundle verification/attestation，不在当前边界内。

### 10.2 自托管

自托管用户把同一不可变静态目录发布到自己的 HTTPS host。Paseo daemon 不负责正式 Creation 静态资源分发，只负责 Relay/WebSocket、Device grant 和业务协议。

Phase 2A 必须在首个可分发版本前新增客户端/daemon protocol 与 minimum-client compatibility exchange。版本不兼容时 fail closed 并显示 Upgrade Required。Phase 3 只完善 upgrade UX、diagnostics 和运维信号，不再创建该安全 gate。

运维信号应包括：

- 按原因分类的连接和认证失败
- Snapshot 和 replay 大小
- Command latency 和拒绝原因
- 重连频率
- 客户端版本和协商后的协议版本

Telemetry 必须 opt-in，默认只写本地结构化日志。Prompt、response、transcript、token 和 provider credential 均不得发送到第三方 analytics 服务。

## 11. 验证计划

Browser simulation 有用，但不足以作为发布依据；release gate 必须包含真实 Rabbit R1。

### 11.1 自动化测试

- Input controller：滚轮、侧键短按、按住/松开、触摸和 fallback keyboard events
- Gesture races：hold 后迟到 click、重复 start/end、过短录音、30 秒上限、lost end、pending-state reentry 和 suspend interruption
- Store：snapshot、replay、重复事件、乱序 command 和 stale event
- Draft：preDictation restore、same-target append、cross-target conflict、explicit discard、target unavailable、confirmed clear 和 24h expiry
- Secure storage：capability-before-data、24h TTL、容量上限、suspend/restart、wipe 和 corrupted-data recovery
- Command receipt：pre-write 原子持久化、无 payload、process restart、先 reconcile 再允许新 command、terminal cleanup，以及 secure storage 缺失
- Transport：断连点、`UNKNOWN`、command-result query、directory refetch/resubscribe、per-Agent timeline catch-up、认证过期和持久去重
- Projection contract：代表性的 Paseo timeline 和 permission events
- Attention directory：attention-first 排序、稳定 continuation、overflow count，以及不静默漏报的 `MORE ATTENTION IN PASEO`
- Action capability：target type、lifecycle、permission pending、transport/freshness/auth/compatibility、grant、本地 device-lock gate、turn identity，以及 daemon 可验证条件的服务端二次 enforcement
- Attention clear：version/source identity、Meaningful content readiness、幂等 clear、失败保留和跨客户端结果
- 精确 240×292 CSS pixels 的布局截图
- Bundle size 和最大 DOM node 数检查

### 11.2 硬件场景

- 使用新 QR 安装，并从干净设备状态开始配对
- 只用滚轮和侧键，从 Home 进入 Project/Workspace，浏览 Root Agent、Parent Subagents 和 cross-workspace Related Subagents
- 持续跟踪一个运行十分钟的 Codex 或 Claude Code 任务
- 只用侧键完成 dictation、完整审阅、Send 或 Cancel；另行探索触摸文字编辑
- 验证中文 Project/Workspace/Agent title、timeline 和 transcript 的字体、换行、截断与缺字行为
- 验证不同 Permission shape 都只显示安全摘要、`CONTINUE IN PASEO` 与 `BACK`，以及 Stop 成功、拒绝和超时
- Streaming 时关闭 Wi-Fi，恢复后确认 directory 与 per-Agent timeline recovery
- 重启 Paseo daemon 并确认状态恢复
- 多次 suspend 和唤醒 R1
- 在 R1 在线和离线时分别撤销 Device grant，确认全部派生 Device session 失效，R1 返回 `AUTH REQUIRED`
- 服务端升级到客户端不支持的版本，确认显示清晰的升级页面
- 在 Tested firmware 上执行完整矩阵；模拟未知 firmware、可降级能力缺失和安全关键能力缺失，分别验证 `LIMITED` 与 `UNSUPPORTED`
- 覆盖 authorization denial、expiry、cancel、code replay、verification mismatch、rate limit、scope elevation/downgrade、Device reset、在线/离线 grant revoke 与派生 session 失效

产品成功门槛是在真实个人工作中连续 dogfood 7 天：

- 至少 80% 的离桌干预无需再打开手机或桌面 Paseo
- 从打开 R1 到识别最高优先级 Attention 的中位时间不超过 3 秒
- 完成一次安全 Follow-up 的中位时间不超过 20 秒
- 错误目标、重复提交、误批准和误停止均为 0
- 缓存内容在完成同步前从不显示 `LIVE`

计算口径：Intervention session 从 R1 后台/关闭至少 5 分钟后的首次 foreground/boot event 开始，到离开或 60 秒无操作结束。Eligible intervention 要求完成 `LIVE` 后确认无 Attention，或打开最高优先级 Attention/Agent。Permission handoff 计为非 R1-only success，不从分母排除。Identify time 结束于最高优先级 live Attention 完整显示并获得 focus；Safe Follow-up time 结束于同一 command identity 在 authoritative timeline confirmed。7 天至少包含 20 个 Eligible sessions 和 10 个 Controlled commands。

工程 release gate：

- 正常 Wi-Fi 下，除首次配对外三秒内出现可交互首屏
- 滚轮选择反馈小于 100 ms
- 强制重连后，Controlled command 可按 commandId 对账，不丢失、不重复且不盲重试
- 30 分钟会话中 DOM node 和保留 activity 不出现无限增长
- 无需精确触摸即可完成全部核心流程
- Safety matrix 覆盖每个断线点、duplicate/replay、target Agent 切换、successor-turn race、stale snapshot 和 grant revoke

## 12. 风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| RabbitOS 修改或移除 Creation bridge API | 输入或语音失效 | 能力检测、firmware compatibility matrix、键盘与触摸 fallback |
| 现有 Paseo 协议过重或不兼容 browser | 原型被 transport 工作阻塞 | 限时兼容性 spike，以及版本化 projection gateway |
| 小屏无法安全展示 permission | 用户批准错误操作 | 首个 Controlled Actions 版本全部只读并转完整 Paseo；未来准入由真实 corpus 和 allowlisted adapter 决定 |
| 托管 Creation 引入 supply-chain 风险 | 客户端 bundle 被替换 | 明确信任边界、严格 CSP、vendored dependency、origin access control、审计 digest、自托管；当前没有 signed-bundle attestation |
| Credential 通过存储或日志泄漏 | 未授权控制 agent | Scoped revocable token、安全存储、日志隐藏、设备不保存 provider secret |
| WebView 被频繁 suspend | 漏掉实时事件 | Directory refetch/resubscribe 与 per-Agent timeline catch-up；正确性不依赖后台执行 |
| Timeline 数据量压垮设备 | 卡顿或崩溃 | 服务端投影、严格上限、不发送原始 terminal stream |
| 社区观察的 API 在不同 firmware 上不一致 | 设备特定故障 | 维护已测试 firmware matrix，并在目标设备上发布前验证 |

## 13. 交付计划

### Phase 0A：Hardware capability probe

- 在 owned R1 上运行现有 `demo/`，测试 viewport、wheel/side event 和 STT bridge surface；它不能证明 WSS、secure-storage read/write、firmware capture 或 suspend/resume。
- 记录目标 RabbitOS firmware，并为 secure-storage read/write、HTTPS/WSS 和 suspend/resume 增加直接真机检查。
- 形成 firmware capability matrix，不把 desktop mock 结果当作真机结论。

退出条件：每项 Creation contract 都有真实设备结果、fallback 和 blocker 记录。当前 `demo/` 只属于本阶段。

### Phase 0B：Private transport vertical slice

- 使用现有 Relay offer、Relay E2EE 和 pinned adapter 连接真实 daemon。
- 列出 Workspace / Attention，打开一个 Agent，订阅并补偿其 timeline。
- 发送一次非破坏性测试 Follow-up；它是私人 spike，不是产品发布。
- 测量 bundle、内存、frame size 和兼容性；仅在触发条件成立时提出 gateway。

退出条件：真实 R1 完成上述垂直链路，并在重连后完成 directory/timeline 对账。结果不明的测试 Follow-up 必须明确记录为 `UNKNOWN`；Phase 2B 前不得声称已经具备 durable dedupe 或 duplicate prevention。

### Phase 1：只读客户端

- 使用现有 Relay offer 实现只读连接状态、Home Attention、Project/Workspace、Root Agent、Subagents、timeline reconciliation 和 stale/offline。
- 增加 browser automation 和精确 viewport 截图。
- 在硬件上测试 suspend、daemon 重启和 Relay offer 失效。
- 明确标记为 owned-device 私人 dogfood；不得把 UI-only read-only 宣称为 credential scope 或对外分发。

退出条件：R1 能稳定监控多个 workspace 及其 agent/subagent 30 分钟，transport、freshness、auth、compatibility、lifecycle、aggregate activity 和 attention 不发生语义串线，在超过内存上限时不静默漏掉 Attention，且资源不无限增长。

### Phase 2A：受控操作安全基础

- 使用经过审计的不可变 bundle，并实现 Device enrollment/grant、identity binding、scope enforcement 和立即撤销。
- 只签发 `read` grant；后续阶段必须在 Trusted Paseo 中显式升权。
- 增加 Trusted Paseo Device 管理界面，覆盖 identity、scopes、release/firmware、last seen、状态、升权和离线撤销。
- 验证目标 firmware 的 RabbitOS device lock 并要求用户启用；无法验证时 Phase 2A 不得分发。
- 增加不兼容时 fail closed 的 protocol/minimum-client negotiation。
- 持久 Device grant 必须使用 secure storage；否则只允许只读可分发能力以 session-only 模式运行，重启后必须重新 enrollment 与同步。

退出条件：enrollment、grant 签发、scope enforcement、Device 管理界面、离线独立撤销、protocol/minimum-client negotiation、secure storage、device-lock gate 与不可变发布路径通过安全矩阵；无法验证 device lock 即阻止分发。此阶段仍不开放 Controlled Action。

### Phase 2B：Follow-up

- 增加 Composer dictation、完整审阅、Send/Cancel 和 target-bound Draft 恢复。
- 要求单独批准的 `follow-up` scope；安装或升级 beta 不能自动增加它。
- 要求 secure storage，并在开放 Send 前实现无 payload command receipt、stable commandId、durable dedupe、result query 与幂等 reconciliation。
- 收集真实 Permission request corpus；设备端仍保持只读 handoff。

退出条件：Follow-up 通过每个断连边界、process-restart receipt recovery、duplicate/replay、target 切换、grant revoke 和 `UNKNOWN` 对账测试，且没有错误目标或重复 command。只有 secure storage 可用时才可发布 `Follow-up-only beta`；其 grant scope 和 UI 中完全不包含 Stop。

### Phase 2C：Turn-safe Stop

- 仅在 stable turn identity 和服务端 conditional cancellation 可用后增加 Stop。
- 必须在 Trusted Paseo 中重新批准 `stop` scope；旧 grant 保持 Follow-up-only。
- confirmation 与 result correlation 必须绑定 exact target turn，并覆盖所有 successor-turn race。

退出条件：target-turn precondition、turn changed 后的原子拒绝、success correlation、command-result query 和 successor-turn protection 全部通过；此后 Stop 才进入 Device grant scope 与发布界面。

### Phase 3：打包与日常使用

- 必须先完成 Phase 2C；Follow-up-only beta 不属于本方案定义的日用版本。
- 提供不可变 release 并生成安装 QR。
- 完善升级提示、兼容性诊断和本地诊断；协商本身已是 Phase 2A gate。
- 编写 Paseo 自托管和 relay 远程访问文档。
- 进行 battery、suspend 和 connectivity 测试，并完成连续 7 天 dogfood。

退出条件：无需连接开发工具即可用于个人日常使用，并满足第 11 节产品成功门槛。

### Phase 4：原生 Android 评估

只有在量化确认 Creation 限制阻塞某个目标工作流时，才评估原生 APK。接受 bootloader 或 custom ROM 的复杂度前，必须记录具体限制，并证明原生 Android 能解决该问题。

可能的原生目标包括后台通知、更丰富的音频行为、直接相机控制或 launcher 集成。在 stock RabbitOS 上开发原生应用和使用 custom firmware 是两个独立决策，不能混为一谈。

## 14. 待决问题

以下实现输入必须在所标注阶段解决：

1. 现有 Paseo WebSocket 和 binary framing 能否在 RabbitOS WebView 中稳定运行？
2. 现有 Relay offer 能否 bootstrap owned-device 私人 transport spike？它不得替代 TO-BE-BUILT Device grant。
3. 真实设备测量是否触发性能 projection gateway；若触发，在无条件 safety projection 之外的最小边界是什么？
4. 后续 Permission research 中，真实 corpus 是否足以定义可证明完整的 `Device decision` allowlist？这不是 Phase 0 或首个 Controlled Actions 版本的发布依赖。
5. 目标 RabbitOS firmware 是否以社区观察到的 contract 提供 secure Creation storage 和原生语音转写？
6. 托管 Creation 能否直接使用 Paseo Relay，包括 origin、TLS、E2EE crypto primitive 和 frame-size 要求？
7. RabbitOS 是否提供可靠 back event；若没有，列表/决策视图中的可聚焦 Back，加上 Agent → Actions → Back，是否满足真实设备操作效率？

这些问题是实现输入，不是扩大 MVP 的理由。在得到答案前，保守默认值是 pinned local adapter、只读 activity projection，以及不支持设备端 permission。

## 15. 参考资料

- [Paseo](https://github.com/getpaseo/paseo)
- [Awesome Rabbit R1](https://github.com/sayhiben/awesome-rabbit-r1)
- [Rabbit R1 Creations 示例](https://github.com/andr3w-hilton/rabbit-r1-creations-public)
- [R1 UI Kit](https://github.com/Ashosystem/r1-ui-kit)
- [Warren agent bridge](https://github.com/dkta0/warren)
- [Rabbit R1 hooks for Claude Code and Codex](https://github.com/sarkarsaurabh27/rabbit-r1-hooks)
- [R1 Escape](https://github.com/RabbitHoleEscapeR1/r1_escape)
- [Rabbit R1 firmware guide](https://github.com/TurboTheTurtle/rabbit-r1-firmware)
- [Rabbit R1 boot notes](https://github.com/DavidBuchanan314/rabbit_r1_boot_notes)
