# Rabbit R1 Paseo Client UI/UX 设计

状态：提案  
日期：2026-07-17  
依赖：[方案设计](rabbit-r1-paseo-client-design.zh-CN.md) 与根目录 `DESIGN.md`

## 1. 设计命题

Rabbit R1 不是小手机。它的 240×282 Creation viewport、离散滚轮、单侧键/PTT 和短时使用习惯，要求 Paseo 把“完整管理工具”重新定义成“口袋任务仪表”。

用户打开设备时最需要完成的不是阅读全部 agent 输出，而是：

1. 看见哪个事项需要关注，以及它属于哪个 project/workspace。
2. 理解对应 agent session 当前做到哪里。
3. 发送一句 follow-up，或做一个明确决定。
4. 放下设备。

因此 UI 优先优化 5 至 30 秒的交互，不优化长时间浏览、源代码阅读或终端操作。

## 2. 硬件对 UX 的影响

| 硬件/平台特点 | 设计影响 |
|---|---|
| 240×282 CSS viewport | 每个视图只承担一个任务；固定 header 与 action rail；正文逐层展开 |
| 离散滚轮 | 所有列表都必须存在唯一 focus；一格对应一个语义项 |
| 单侧键 | 短按确认，按住 PTT；破坏性操作不能使用按住快捷方式 |
| 触摸屏 | 用于加速选择和编辑，不作为核心流程唯一入口 |
| 原生语音转写 | 语音是主要输入，但 transcript 必须审阅后发送 |
| WebView 性能有限 | 有界 DOM、无原始终端流、无复杂动画与远程字体 |
| Creation 可能被 suspend | UI 必须区分 live 与 stale，并通过 cursor 恢复 |
| 橙色实体外壳 | 屏幕保持近黑；橙色只表示 Paseo 身份和物理操作 |

## 3. 信息架构

```text
Pairing
  -> Home
       -> Attention item -> Agent
       -> Project / Workspace
            -> Back
            -> Root agent
            -> Paseo subagent
            -> Provider child (read-only)
                 -> Agent timeline
                      -> Actions
                           -> Back
                           -> Follow up -> Composer
                           -> Review permission -> Decision
                           -> Stop -> Stop confirmation

Global states:
  Voice capture
  Offline / stale
  Auth required
  Upgrade required
  Unsupported orientation
```

MVP 不设置 tab bar、drawer 或全局菜单。Home 是唯一根视图；所有下一层视图都提供可被滚轮聚焦的 Back 语义项。MVP 绑定一个 host；多 host 支持进入范围时，Home 必须显式标记 host，不能合并同名 project/workspace。

## 4. 核心视图

### 4.1 Home

目的：在三秒内找到最值得关注的事项，同时保留 Paseo ownership。

布局：

- 顶部 3px Paseo orange rule。
- 36px header：`PASEO`、connection freshness、当前条目位置。
- 中间最多展示 4 至 5 个语义项。
- `Needs attention` 排在最前；其余项目按 Project → Workspace 展示。
- Home 不放全局 destructive action。

排序：

1. Permission / needs input。
2. Failed。
3. Finished / unread。
4. Running workspace。
5. 最近更新的 idle workspace。

Attention 行内容：attention type、agent title、workspace、距今时间。Workspace 行内容：workspace title、project、聚合 activity/attention。不可加入 filesystem path、model 全名或日志预览。

### 4.2 Workspace

目的：在一个明确 workspace 中选择 agent session。

首项固定为 Back，之后依次为 root agent、Paseo subagent、provider-owned child。每行分别展示 lifecycle 与 attention；provider child 显示 `READ ONLY`。Workspace 自己的 aggregate activity 不得覆盖 agent 的 literal lifecycle。

### 4.3 Agent

目的：理解当前进展并选择下一步。

首屏顺序：

1. Workspace / agent 标题和 connection freshness。
2. Literal lifecycle 与 attention reason。
3. 当前 step 或最新 meaningful activity。
4. Assistant 最新摘要，最多六行。
5. 固定单一入口：`ACTIONS`。

滚轮只在 timeline item 间移动。侧键短按打开 Actions，不直接作用于当前 activity。新事件到达时不得抢走当前 focus。

### 4.4 Actions

目的：把浏览与副作用操作彻底分离。

Actions 是全屏语义列表，首项为 Back，其余按上下文显示 Follow up、Review permission 和 Stop。Wheel 选择、side click 打开下一步；Stop 不在本页直接执行。

### 4.5 Composer

目的：审阅并发送一句明确 follow-up。

组成：

- 来源标记：`VOICE` 或 `KEYBOARD`。
- 可编辑 transcript，默认显示完整文本的开头和结尾。
- 字符数与发送状态。
- Action rail：`CANCEL`、`EDIT`、`SEND`。

`SEND` 不能默认选中；dictation 进入 Composer 时默认选中 `EDIT`。已有草稿时新 transcript 默认追加；Replace 是显式且可取消的操作。发送后经历 `sending -> accepted | failed`，失败时保留草稿。

### 4.6 Dictation

目的：让用户明确知道设备正在听，并能自然结束。

Dictation 仅从明确打开的 interactive Agent 启动。它替换整屏，不采用 modal card。按住侧键后立即显示橙色顶部 rule、五条音量 bar 和 `RECORDING`；松开后显示 `TRANSCRIBING`，成功进入 Composer，失败进入可恢复状态。

如果 voice bridge 不可用，显示 `VOICE UNAVAILABLE`，并直接提供键盘输入，不自动重试。

这属于 Paseo composer dictation，不得称为完整 Voice mode。

### 4.7 Permission Decision

目的：在信息足够且无歧义时完成决策。

内容顺序：

1. Permission schema 类型与完整性。
2. 操作名称。
3. 影响目标。
4. 简短原因。
5. 详情完整性状态。
6. Workspace / agent context。
7. Action rail 或 select options。

简单 confirm 默认 focus 是 `DENY`。少量固定 select 直接展示选项。Text/editor/multi-step/optional-comment、区分 skip/cancel、未知或截断 schema 不显示 Approve，action rail 只有 `BACK`、`OPEN PASEO`。

### 4.8 Stop Confirmation

目的：正确反映 Paseo cancellation acknowledgement。

默认 focus 是 `CANCEL`。Confirm 后进入 `STOPPING`，只有 provider acknowledgement 或 terminal turn event 后显示 stopped。拒绝或超时返回 Agent，lifecycle 仍为 running，并保留失败信息。

### 4.9 Offline / Stale

目的：保留上下文，但阻止用户把缓存误认为实时状态。

断网后保留 Home、Workspace 或 Agent snapshot，在 header 下增加高对比 `STALE` band，显示上次同步时间和下一次 retry。所有 destructive actions disabled；用户仍可返回和阅读缓存。

## 5. 输入状态机

```text
Browse
  + wheel -> Focus changed
  + side click on Home/Workspace -> Open focused item
  + side click on Agent -> Open Actions
  + side hold on Agent -> Recording
  + touch -> Select or activate

Dictation
  recording + side release -> transcribing
  transcribing + success -> review
  transcribing + error -> failed -> edit/cancel

Composer
  review -> sending -> accepted | failed

Decision screen
  + wheel -> Change decision focus
  + side click -> Confirm focused decision
  + back -> Cancel without side effect

Stop
  confirm -> stopping -> stopped | failed(running)
```

输入规则：

- Wheel 只改变 focus，永不执行副作用；Agent 页的 wheel 只浏览 timeline。
- Touch 与 wheel 写入同一个 canonical focus。
- Async update 不改变 focus，除非当前项目已被服务端删除。
- 每次 destructive action 都必须经过单独确认视图或明确 decision focus。
- 每个非根视图都必须有可聚焦 Back；触摸不是唯一返回方式。

## 6. 关键用户流程

### 流程 A：查看进行中的任务

```text
Wake -> Home -> Workspace -> root/subagent -> Agent -> read timeline -> Actions -> Back
```

目标：五次以内输入完成；无网络恢复时仍可阅读最后 snapshot。

### 流程 B：语音 Follow-Up

```text
Agent -> hold side button -> recording -> release -> transcribing -> review -> select SEND -> sending -> accepted
```

目标：不自动发送；发送后立即显示 pending item，并在 server acknowledgement 后改为 accepted。

### 流程 C：处理 Permission

```text
Home attention -> Agent -> Actions -> Review permission -> inspect -> move from DENY if needed -> click
```

目标：默认拒绝；信息不足时不能批准；重连不会重复提交。

### 流程 D：断线恢复

```text
Online -> network loss -> STALE snapshot -> reconnect -> cursor replay -> LIVE
```

目标：用户始终知道数据是否实时，focus 与阅读位置在 snapshot 仍有效时保持不变。

## 7. 文案规范

- 使用短动词：`OPEN`、`SEND`、`STOP`、`DENY`、`RETRY`。
- Connection 使用 `LIVE`、`RECONNECTING`、`STALE`、`AUTH REQUIRED`。
- Lifecycle 使用 `INITIALIZING`、`RUNNING`、`IDLE`、`ERROR`、`CLOSED`。
- Attention 使用 `INPUT`、`REVIEW`、`FAILED`、`FINISHED`、`UNREAD`；不能用 `WAITING` 代替 idle，也不能用 `DONE` 作为 agent lifecycle。
- 避免“Something went wrong”；错误必须指出下一步，如 `PAIR AGAIN`。
- 时间使用短格式：`NOW`、`2M`、`1H`、`YDAY`。
- Provider 使用稳定短名：`CODEX`、`CLAUDE`、`OPENCODE`。
- 不在屏幕中解释滚轮、快捷键或 UI 设计；只显示当前动作需要的文案。

## 8. 状态与反馈

| 状态 | 视觉 | 行为 |
|---|---|---|
| Running lifecycle | 黄色圆点 + `RUNNING` | 与 attention 独立显示 |
| Idle lifecycle | 灰色圆点 + `IDLE` | 不代表需要用户输入 |
| Permission attention | 橙色 rail + `REVIEW` | 进入独立 Decision view |
| Finished attention | 浅灰 mark + `FINISHED` | 聚合到 Home attention，聚焦后可清除 |
| Error lifecycle | 红色菱形 + `ERROR` | 展示明确错误摘要 |
| Stale connection | `STALE` band + 上次同步时间 | 禁用副作用 |
| Sending | Pending row + 固定进度 mark | 使用 idempotency key |
| Accepted | 短暂 success mark | 600ms 后恢复普通状态 |
| Stopping | 固定进度 mark + `STOPPING` | 等待 provider acknowledgement |

## 9. 无障碍与安全性

- Focus 使用反相底色、橙色 rail 和文本，不依赖颜色。
- Error 使用菱形，其他状态使用圆形。
- 所有核心 touch target 至少 32px 高。
- 支持 `prefers-reduced-motion`，移除位移和音量 bar 动画。
- Transcript 发送前始终可审阅和编辑。
- Approval 和 stop 不得通过单个无上下文手势直接触发。
- Screen reader 名称描述语义动作，不描述图标外观。
- 长文本先由服务端做语义投影，再由 UI 截断。

## 10. 原型与实现验收

### 视觉验收

- 每个视图在 240×282 下无横向滚动、裁切和文字覆盖。
- Focus 改变不引发布局位移。
- 同屏不超过三项 command。
- 无 cards inside cards、drawer、bottom sheet、gradient 或 decorative imagery。
- Orange 不支配整个屏幕，只标记身份和动作。

### 交互验收

- Arrow Up/Down、Enter、Space hold/release 和 Escape 可模拟全部核心流程；同时每个非根视图都能通过 wheel + Enter 返回。
- Wheel 一格移动一个语义项，边界不循环。
- Touch 和 wheel focus 始终一致。
- Voice transcript 不自动发送。
- Confirm permission 默认选择 deny，Stop 默认选择 cancel。
- Offline 时无法执行 stop、send 或 permission decision。

### 性能验收

- Wheel focus feedback 小于 100ms。
- 页面 transition 不超过 120ms。
- 无持续后台 animation。
- 30 分钟 session 中 DOM node 数保持有界。
- 首屏不依赖 remote font 或 large asset。

## 11. 后续设计问题

以下问题需要在真实设备 spike 中验证：

1. WebView 实际字体 metrics 是否导致 13px 中文和英文混排溢出。
2. R1 滚轮快速旋转时的 event rate，以及是否需要合并 render。
3. Creation 是否暴露可靠 back event 或 haptic API。
4. Native keyboard 占用 viewport 后 Composer 的可用高度。
5. Side click 与 long-press events 的精确时序和取消语义。
6. 日光和暗光下 inverted focus 与状态色的可辨识度。
