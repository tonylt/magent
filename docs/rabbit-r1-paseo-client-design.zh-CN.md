# Rabbit R1 Paseo 客户端：方案设计

简体中文 | [English](rabbit-r1-paseo-client-design.md)

状态：提案  
日期：2026-07-17  
读者：负责实现或评审首个 Rabbit R1 Paseo 客户端的工程师

## 1. 文档目的

本文定义一个可实施的 Rabbit R1 Paseo 客户端首版方案。读完后，工程师应能把 MVP 拆成具体任务，实现设备客户端及其服务端适配层，并在真实硬件上完成验证。

该客户端把 Rabbit R1 变成运行于其他机器上的 Paseo coding agent 的紧凑型遥控器。它适合在离开桌面时查看工作进展、发送简短的后续指令和处理决策，不试图复制完整的 Paseo 移动端或桌面端体验。

## 2. 目标与非目标

### 2.1 目标

- 无需解锁或刷写 Rabbit R1 即可安装和更新客户端。
- 通过局域网或远程 relay 安全连接已有 Paseo 实例。
- 以适合 R1 屏幕的形式展示需要关注的事项，以及它们所属的 host、project、workspace 和 agent session。
- 在 workspace 上下文中打开一个 agent，并跟踪最近最有意义的活动。
- 通过文字或按住说话发送 follow-up。
- 停止运行中的 agent，并响应受支持的 permission 请求。
- 主要通过滚轮和侧键操作，以触摸作为辅助输入。
- 在休眠、断网、daemon 重启和凭证失效后正确恢复。

### 2.2 MVP 非目标

- 在 Rabbit R1 上运行 coding agent 或 Paseo daemon。
- 复刻完整 timeline、终端模拟器、文件浏览器、diff viewer 或 workspace manager。
- 原样复用现有手机布局。
- 替换 RabbitOS launcher 或语音助手。
- 依赖 bootloader 解锁、root、Magisk、AOSP 或 CipherOS。
- 支持任意第三方 Paseo 扩展。
- 在 R1 上编辑源代码。

## 3. 设备与平台约束

MVP 以 RabbitOS Creation 运行。Creation 是由 QR payload 安装的托管 WebView 应用。

以下约束作为产品要求处理：

- Creation 的有效 viewport 是 240×282 CSS pixels，物理屏幕分辨率不是应用布局尺寸。
- 滚轮产生离散的向上和向下事件，应移动选择项，而不是模拟高分辨率惯性滚动。
- 侧键提供短按和按住事件，按住说话是主要输入方式。
- 原生语音转写通过 Creation bridge 返回完整 transcript；MVP 不自行传输原始麦克风音频。
- 设备支持触摸，但核心目标必须在无需精确触摸的情况下可操作。
- WebView 渲染能力有限，不适合大型 DOM、复杂 Markdown、WebGL、持续动画和无限日志。
- 客户端从 HTTPS 加载，远程连接必须使用 secure WebSocket 或 HTTPS。
- RabbitOS 按安装 URL 缓存 Creation，发布时需要版本化 URL 或等效的 cache busting。
- 不同 RabbitOS 版本提供的 bridge 能力可能不同。每个原生 API 都必须先检测能力，并提供可见 fallback 或明确的“不支持”状态。

社区实验表明，Creation 可以使用滚轮、侧键、原生语音转写、安全存储、传感器、HTTPS、Server-Sent Events 和 WebSocket。这些能力足以支撑本方案。

## 4. 方案选型

### 4.1 选定方案

构建专用 Rabbit R1 Creation，并在 Paseo 前提供一个窄化、版本化的设备 API。

```text
Rabbit R1
Creation WebView
  - agent 列表
  - 活动摘要
  - PTT 与文字输入
  - stop 与 permission 操作
        |
        | HTTPS + secure WebSocket
        v
R1 client gateway
  - 配对与设备 token
  - 协议版本
  - 过滤与投影
  - 重连与恢复
        |
        | Paseo client contract
        v
Paseo daemon / relay
        |
        v
Claude Code、Codex、Copilot、OpenCode、Pi
```

R1 client gateway 是一个逻辑边界，不一定是独立部署的服务。如果这样能简化认证和事件投影，它可以实现在 Paseo server 内部；如果修改 Paseo 会拖慢首个硬件原型，也可以先作为小型 companion process。

### 4.2 为什么不直接使用现有 Paseo App

现有 Expo 客户端面向手机、平板、Web 和桌面布局。即便 compact layout，也假设了比 Creation 大得多的空间和更精确的输入。加载完整应用还会把导航、retained panels、终端渲染、文件浏览和大量状态订阅带到受限硬件上。

R1 客户端应与 Paseo 共享领域 contract 和语义，但拥有自己的展示层和本地状态。

### 4.3 为什么不先刷 Android

社区固件已经可以在设备上运行 AOSP 或 CipherOS，但现有报告仍包括熄屏后触摸无法恢复、侧键支持不一致、MediaTek fastboot 复杂，以及依赖 Linux 工具的恢复流程。验证 Paseo 用例不需要承担这些风险。

只有当 Creation sandbox 阻塞了已验证的产品需求时，才考虑原生 Android，例如可靠后台连接、更底层的音频控制、系统通知，或 bridge 未开放的硬件行为。

## 5. 用户体验

### 5.1 导航模型

界面包含五个主要视图：

1. **Home**：需要关注的事项，以及按 project 分组的 workspace。
2. **Workspace**：一个 workspace 内的 root agent、Paseo subagent 和 provider-owned child session。
3. **Agent**：单个 agent session 的 timeline 投影；保留 host/project/workspace 上下文。
4. **Actions**：从 Agent 进入的独立操作列表，包含 Back、Follow up、Stop 或 Review permission。
5. **Composer / Decision**：发送前的 transcript 审阅，或独立的 permission/stop 决策页。

不同视图使用一致的交互规则：

| 输入 | Home / Workspace | Agent | Actions / Composer / Decision |
|---|---|---|---|
| 滚轮上/下 | 移动一个语义项 | 只浏览 timeline item | 移动一个操作或决定 |
| 侧键短按 | 打开所选项 | 打开 Actions，不直接执行副作用 | 确认当前明确选择 |
| 按住侧键 | 不启动录音，避免目标歧义 | 开始针对当前 agent 的 dictation | 不替换已有内容；按当前视图处理或忽略 |
| 松开侧键 | 无操作 | 结束录音并进入 transcribing | 无操作 |
| 触摸 | 选择或打开 | 打开 activity 或 Actions | 编辑、选择、确认或取消 |

每个非根视图都必须提供可被滚轮选中的 **Back** 语义项。触摸 back 和未来可能验证通过的 RabbitOS back event 只映射到同一 command，不是唯一返回方式。

### 5.2 Home 与 Workspace

Home 首先展示 `Needs attention`，然后展示按 project 分组的 workspace。Attention row 必须携带 workspace 名和 agent 标题；workspace row 必须携带 project 名，以及聚合 activity/attention。

Workspace 视图展示：

- 固定在首项的 Back
- Root agent session
- Paseo-managed subagent
- Provider-owned child session，并明确只读能力

MVP 默认绑定单个 host。若未来支持多 host，Home 必须在 project 或 workspace 行中显示 host；不能把不同 host 的 workspace 合并成一个扁平列表。

列表有明确上限并按 attention、activity、recent update 排序；MVP 不展示 archived agent。

### 5.3 Agent 视图

首屏应回答三个问题：

- 这个 agent 正在做什么？
- 它是否需要我处理？
- 我下一步可以做什么？

视图包含：

- Workspace / agent 标题与全局连接状态
- Agent lifecycle、attention reason 和 connection freshness 三条正交状态
- 最近的 assistant 摘要或关键 timeline item
- 存在结构化步骤时显示紧凑进度
- 固定的 Actions 入口

原始 tool log 被折叠成简短描述。长输出由服务端投影截断，并明确标记仍有未显示内容。

滚轮在 Agent 视图只改变 timeline focus。侧键短按打开 Actions；Actions 中才提供 Back、Follow up、Stop 或 Review permission。异步 timeline 更新不得抢走当前 focus。

状态不能压缩成单个 `working/waiting/done/offline` 字段：

- **Connection**：online / reconnecting / stale / auth-required
- **Lifecycle**：initializing / running / idle / error / closed
- **Attention**：needs-input / permission / failed / finished / unread / none

`idle` 不得显示成 `waiting`；parent agent 处于 idle 时，workspace 仍可能因 subagent 运行而聚合为 running。

### 5.4 语音 Follow-Up

1. 用户在明确打开的 Agent 视图按住侧键。
2. 客户端进入 `recording` 并调用原生 Creation voice bridge。
3. 松开后进入 `transcribing`，bridge 返回 transcript 或错误。
4. Composer 进入 `review`，展示 transcript 供用户检查。
5. 用户明确选择 Send 后进入 `sending`；服务端确认后进入 `accepted`，失败则保留文本进入 `failed`。
6. Agent timeline 显示 pending item，并通过 idempotency key 与 server acknowledgement 对账。

转写完成后绝不自动发送。发送前审阅可以防止语音识别错误直接变成 agent 指令。

这里的能力是 composer dictation，不是 Paseo 的完整 Voice mode。Composer 已有内容时，新的 dictation 默认追加；替换必须作为显式操作，并可取消。

### 5.5 Permission 请求

只有能在小屏上完整且无歧义呈现的 permission schema 才允许操作。客户端显示：

- 请求执行的操作
- 简短原因或影响目标
- 与 schema 对应的 confirm 或少量 select 选项
- 详情完整性和 workspace 上下文

MVP 只支持未截断的简单 confirm，以及不需要搜索的少量固定选项 select。Text、editor、multi-step question、optional comment，以及必须区分 skip/cancel 的 schema 都只读展示并引导用户使用完整 Paseo 客户端。未知、截断或详情复杂的审批不得显示可用的 Approve。服务端绝不能把不支持的 permission 转换成泛化的 yes/no 问题。

Stop 使用单独确认页，默认选择 Cancel。提交后显示 `stopping`，只有 provider 确认 interrupt 或发送 terminal turn event 后才显示 stopped；失败或超时必须恢复 running，并解释失败。

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

## 7. 服务端 Contract

### 7.1 兼容性 Spike

在确定 gateway 设计前，先实现一个小型 browser client，尝试现有 Paseo 的 handshake、pairing、agent subscription、follow-up、stop 和 permission 流程。

Spike 必须回答：

- Creation 能否使用现有 transport 和 frame encoding？
- 现有设备配对能否产生 browser client 可用的 scoped credential？
- 重连能否恢复，而无需重新下载无限 timeline？
- Browser origin、TLS 和 relay 约束是否兼容托管 Creation？
- 哪些消息必须经过更小的服务端投影？

如果现有 contract 通过这些检查，R1 gateway 可以退化为薄兼容层，甚至省略；否则实现下述 device API。

### 7.2 建议的 Device API

Device API 独立于 daemon 内部消息进行版本管理。Version 1 只暴露 MVP 操作。

请求/响应操作：

- 用短期 pairing grant 换取 device credential。
- 使用 cursor 列出 project/workspace，以及需要操作的 attention item。
- 获取一个 workspace 的 root agent、subagent 和 provider child 投影。
- 获取一个 agent 的当前 timeline 与 capability 投影。
- 使用 idempotency key 发送 follow-up。
- 使用 idempotency key 停止 agent。
- 处理受支持的 permission 请求。
- 刷新或撤销 device credential。

事件流发送：

- Project/workspace aggregate activity 或 attention 变化
- Agent 被加入、更新或移出 workspace 可见集合
- 投影后的 activity 被追加或替换
- Agent lifecycle 和 attention 独立变化
- Approval 被打开、处理或过期
- Client command 被接受、拒绝或完成
- Session 失效或最低客户端版本发生变化

每个事件都包含单调递增的 stream cursor。重连后客户端提交最后一个 cursor，服务端要么重放有界缺口，要么发送完整新 snapshot。客户端不能因为 WebSocket 已连接就假定本地状态完整。

### 7.3 投影规则

Gateway 把 Paseo 完整领域事件流转换成适合设备的数据：

- 保留稳定的 host、project、workspace、agent、activity、command 和 permission identifier。
- 分别保留 connection freshness、literal agent lifecycle、workspace aggregate activity 和 attention reason；不得投影成单一状态字段。
- 保留 parentAgentId、provider-child 类型和 read-only capability。
- 把冗长的 tool input/output 折叠成服务端生成的简短摘要。
- 移除终端控制序列和不支持的 rich content。
- 发送纯文本及少量受支持格式。
- 明确标记截断。
- 保留足够的 command correlation data，以便重连后校正 optimistic UI。

投影不能仅为了缩短内容而调用 LLM。确定性截断和已有结构化摘要更可预测、更快，也更保护隐私。

## 8. 配对与安全

Creation 安装 QR 和 Paseo 设备配对是两个不同概念：

- 安装 QR 标识托管客户端 URL 和展示 metadata。
- Paseo pairing 授权该物理客户端访问某个 Paseo 实例。

推荐流程：

1. 使用公开或自托管安装 QR 安装 Creation。
2. 在可信的完整尺寸 Paseo 客户端中生成短期 pairing grant。
3. 在 R1 上输入或扫描 grant。
4. 通过 HTTPS 将其换成 scoped device token。
5. 如果 RabbitOS 支持，则使用 Creation secure storage 保存 token。

Device token 必须：

- 可以独立撤销。
- 只包含客户端操作权限，不包含 daemon 管理权限。
- 绝不暴露 provider credential 或 agent CLI credential。
- 无需重新安装 Creation 即可过期或轮换。
- 在日志和错误报告中被隐藏。

Gateway 必须对每个 command 强制授权；在 Creation 中隐藏按钮不等于授权。部署拓扑允许时还应验证 WebSocket origin，对配对和命令限流，并在显式启用的本地开发环境之外强制 TLS。

没有可信 HTTPS 的纯本地部署应使用 Paseo relay 或有文档的本地 TLS 配置。生产客户端不能提供关闭证书校验的选项。

## 9. 连接与故障行为

Transport state machine 必须显式定义：

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
- 恢复后重连，并从最后提交的 cursor 请求 replay。
- 本地最多保留一条未发送 follow-up；离线时不排队 destructive action。
- 使用 idempotency key，避免重连导致 follow-up、stop 或 permission 决定重复。
- 缓存状态过期时明确显示 stale，不能表现为实时数据。
- 设备解除配对时清除敏感状态。

## 10. 部署与运维

客户端是通过 HTTPS 提供的版本化静态 Web bundle。安装页面生成 Rabbit R1 Creation QR payload，其中包含标题、客户端 URL、描述、图标和主题色。

计划支持两种部署方式：

### 10.1 Paseo 托管

Paseo server 同时提供静态 Creation 和 device API。这是最简单的自托管安装方式，也能保持客户端与服务端兼容版本一致。

### 10.2 独立托管

静态客户端托管在公共 static host，连接用户自己的 Paseo gateway 或 relay。安装更方便，但需要谨慎处理 origin policy、兼容性和升级提示。

每次发布都使用不可变的版本化 URL。安装 QR 指向该版本，或包含 cache-busting version。客户端和 gateway 在连接时交换 protocol version 和 minimum client version。

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
- Store：snapshot、replay、重复事件、乱序 command 和 stale event
- Transport：断连、重试、cursor resume、认证过期和幂等性
- Projection contract：代表性的 Paseo timeline 和 permission events
- 精确 240×282 CSS pixels 的布局截图
- Bundle size 和最大 DOM node 数检查

### 11.2 硬件场景

- 使用新 QR 安装，并从干净设备状态开始配对
- 只用滚轮和侧键，从 Home 进入 project/workspace，并浏览 root agent、subagent 和 provider child
- 持续跟踪一个运行十分钟的 Codex 或 Claude Code 任务
- 发送语音 follow-up 和编辑后的文字 follow-up
- 验证 simple confirm、small fixed select、unsupported/truncated permission，以及 Stop 成功、拒绝和超时
- Streaming 时关闭 Wi-Fi，恢复后确认 cursor-based recovery
- 重启 Paseo daemon 并确认状态恢复
- 多次 suspend 和唤醒 R1
- 从 Paseo 撤销 token，确认 R1 返回配对状态
- 服务端升级到客户端不支持的版本，确认显示清晰的升级页面

MVP 验收目标：

- 正常 Wi-Fi 下，除首次配对外三秒内出现可交互首屏
- 滚轮选择反馈小于 100 ms
- 强制重连后，已接受的 command 不丢失且不重复
- 30 分钟会话中 DOM node 和保留 activity 不出现无限增长
- 无需精确触摸即可完成全部核心流程

## 12. 风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| RabbitOS 修改或移除 Creation bridge API | 输入或语音失效 | 能力检测、firmware compatibility matrix、键盘与触摸 fallback |
| 现有 Paseo 协议过重或不兼容 browser | 原型被 transport 工作阻塞 | 限时兼容性 spike，以及版本化 projection gateway |
| 小屏无法安全展示复杂 permission | 用户批准错误操作 | 只支持明确 schema；未知详情必须转完整客户端处理 |
| 托管 Creation 引入 supply-chain 风险 | 客户端 bundle 被替换 | 不可变版本资源、可用时做完整性校验、支持自托管 |
| Credential 通过存储或日志泄漏 | 未授权控制 agent | Scoped revocable token、安全存储、日志隐藏、设备不保存 provider secret |
| WebView 被频繁 suspend | 漏掉实时事件 | Cursor replay 和 snapshot recovery；正确性不依赖后台执行 |
| Timeline 数据量压垮设备 | 卡顿或崩溃 | 服务端投影、严格上限、不发送原始 terminal stream |
| 社区观察的 API 在不同 firmware 上不一致 | 设备特定故障 | 维护已测试 firmware matrix，并在目标设备上发布前验证 |

## 13. 交付计划

### Phase 0：设备与协议 Spike

- 确认目标设备 RabbitOS firmware 和 Creation API。
- 安装最小 Creation，报告滚轮、侧键、语音、存储和网络能力。
- 从类似 Creation 的 WebView 测试现有 Paseo browser transport。
- 决定 gateway 内置 Paseo，还是先采用 companion service。

退出条件：真实 R1 可以认证、列出 project/workspace 和 attention、订阅一个 agent，并发送非破坏性测试 follow-up。

### Phase 1：只读客户端

- 实现配对、连接状态、Home attention、project/workspace、agent summary、投影和重连。
- 增加 browser automation 和精确 viewport 截图。
- 在硬件上测试 suspend、daemon 重启和 token 撤销。

退出条件：R1 能稳定监控多个 workspace 及其 agent/subagent 30 分钟，connection、lifecycle、aggregate activity 和 attention 不发生语义串线或资源增长。

### Phase 2：受控操作

- 增加发送前审阅的语音和文字 follow-up。
- 增加带明确确认的 stop。
- 增加第一批严格限定的 permission schema。
- 增加幂等 command reconciliation。

退出条件：强制断连情况下 command 仍保持正确，每个操作都有可审计的服务端结果。

### Phase 3：打包与日常使用

- 提供不可变 release 并生成安装 QR。
- 增加兼容性协商、升级提示和本地诊断。
- 编写 Paseo 自托管和 relay 远程访问文档。
- 进行多日 battery、suspend 和 connectivity 测试。

退出条件：无需连接开发工具即可用于个人日常使用。

### Phase 4：原生 Android 评估

只有在量化确认 Creation 限制阻塞某个目标工作流时，才评估原生 APK。接受 bootloader 或 custom ROM 的复杂度前，必须记录具体限制，并证明原生 Android 能解决该问题。

可能的原生目标包括后台通知、更丰富的音频行为、直接相机控制或 launcher 集成。在 stock RabbitOS 上开发原生应用和使用 custom firmware 是两个独立决策，不能混为一谈。

## 14. 待决问题

以下问题必须在 Phase 0 解决：

1. 现有 Paseo WebSocket 和 binary framing 能否在 RabbitOS WebView 中稳定运行？
2. 现有 Paseo pairing 能否签发权限足够窄的 browser credential？
3. 首个 gateway 应内置 Paseo，还是作为 companion service 部署？
4. 哪些 permission schema 既常见，又能在 240×282 上完整且安全地展示？初始上限是 simple confirm 与 small fixed select。
5. 目标 RabbitOS firmware 是否以社区观察到的 contract 提供 secure Creation storage 和原生语音转写？
6. 托管 Creation 能否直接使用 Paseo relay，包括 origin 和 TLS 要求？
7. RabbitOS 是否提供可靠 back event；若没有，可聚焦 Back item 是否满足真实设备操作效率？

这些问题是实现输入，不是扩大 MVP 的理由。在得到答案前，保守默认值是 companion gateway、只读 activity projection，以及不支持设备端 permission。

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
