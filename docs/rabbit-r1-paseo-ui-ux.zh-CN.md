# Rabbit R1 Paseo Client UI/UX 设计

状态：提案  
日期：2026-07-17  
依赖：[方案设计](rabbit-r1-paseo-client-design.zh-CN.md) 与根目录 `DESIGN.md`

## 1. 设计命题

Rabbit R1 不是小手机。它的 240×282 Creation viewport、离散滚轮、单侧键/PTT 和短时使用习惯，要求 Paseo 把“完整管理工具”重新定义成“口袋任务仪表”。

首版只服务单个个人 Host 上已有 Agent session 的离桌干预：用户离桌 5–30 分钟后主动打开 R1，在 5–30 秒内处理一个 attention item。产品不负责创建 Agent、Workspace 或 Schedule，也不承诺后台通知或实时唤醒。

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
| Creation 可能被 suspend | UI 必须区分 live 与 stale，并在重连后重新订阅目录、逐 Agent 对账 timeline |
| 橙色实体外壳 | 屏幕保持近黑；橙色只表示 Paseo 身份和物理操作 |

## 3. 信息架构

```text
Pairing
  -> Home
       -> Attention item -> Agent
       -> Project / Workspace
            -> Back
            -> Root agent
                 -> Agent timeline
                      -> Subagents
                           -> Back
                           -> Subagent
                           -> Native subagent (read-only)
                      -> Actions
                           -> Back
                           -> Follow up -> Composer
                           -> Review permission -> Handoff
                           -> Stop -> Stop confirmation

Global states:
  Voice capture
  Offline / stale
  Auth required
  Upgrade required
  Unsupported orientation
  Limited firmware
  Unsupported firmware
```

MVP 不设置 tab bar、drawer 或全局菜单。Home 是唯一根视图；Workspace、Subagents、Actions、Handoff 和 Decision/list 视图直接提供可被滚轮聚焦的 Back 项或命令；Composer 使用逐页 action rail，`CANCEL` 始终默认选中，读完最后一页后才出现 `SEND`。Agent 的滚轮焦点仅用于 timeline，其纯硬件返回路径是侧键短按进入 Actions，再选择 Back。MVP 绑定一个 host；多 host 支持进入范围时，Home 必须显式标记 host，不能合并同名 project/workspace。

## 4. 核心视图

### 4.1 Home

目的：在三秒内找到最值得关注的事项，同时保留 Paseo ownership。

布局：

- 顶部 3px Paseo orange rule。
- 36px header：`PASEO`、connection freshness、当前条目位置。
- Section label 下最多展示 4 个 46px 语义项；更多条目围绕 canonical focus 开窗。
- `Needs attention` 排在最前；其余项目按 Project → Workspace 展示。
- Home 不放全局 destructive action。

排序：

1. Permission Attention。
2. Error Attention。
3. Finished Attention。
4. Workspace status：needs_input / failed / running / attention / done。
5. 同一 bucket 内按最近更新时间。

Attention 行内容：`permission / error / finished`、Agent title、Workspace、距今时间。Workspace 行内容：Workspace title、Project、canonical Workspace status bucket。R1-local Read state 只改变行的视觉强度，不增加 Attention 类型或改变排序。不可加入 filesystem path、model 全名或日志预览。

当 attention-first directory response 带 continuation 且仍有未装入的 Attention 时，Home 在已加载 Attention 之后、普通 Workspace 之前固定插入可聚焦的 `MORE ATTENTION IN PASEO · n` sentinel。侧键确认后只加载下一页有界 continuation，期间显示 `LOADING`；失败时保留 sentinel、剩余数量和 retry，不得回退成“没有 Attention”或把普通 Workspace 提到它前面。Position count 包含当前 materialized rows 与 sentinel，不虚构尚未加载的可聚焦项。

Attention 的去重 identity 是 `(host, workspaceId, agentId, attentionVersion)`。同一 identity 在 Home、Parent relationship list 与 Execution Workspace 只呈现一次入口语义，但各视图保留自己的返回来源。每行必须显示 age。只有在线且 meaningful content 已成功渲染后才可写本地 Read；Read 不改变 attentionVersion、reason 或排序，stale 查看永不写 Read。

### 4.2 Workspace

目的：在一个明确 workspace 中选择 agent session。

首项固定为 Back，之后是 Root Agent session；cross-workspace managed Subagent 另放在 `RELATED SUBAGENTS · n` 分组，不与 Root 平铺。Root Agent 的 `SUBAGENTS · n` 是关系 home，Native subagent 只出现在这里并显示 `READ ONLY`。Related Subagent 同时展示 `RUNS IN` 与 `PARENT`；Parent 不可见时显示 `PARENT UNAVAILABLE`。Home Attention、Parent list 与 Execution Workspace 按同一 identity/attentionVersion 去重，但 Back 返回打开来源。Workspace aggregate 不得覆盖 Agent literal lifecycle。

### 4.3 Agent

目的：理解当前进展并选择下一步。

首屏顺序：

1. Workspace / agent 标题和 connection freshness。
2. Literal lifecycle 与 attention reason。
3. 当前 step 或最新 meaningful activity。
4. Assistant 最新摘要，最多六行。
5. 固定单一入口：`ACTIONS`。

滚轮只在 timeline item 间移动。Timeline 与其他列表一样围绕 canonical focus identity 开一个有界窗口；越过可视边缘时窗口移动一个语义项，不能让 focus 跑到屏幕外。侧键短按打开 Actions，不直接作用于当前 activity。新事件到达时不得抢走当前 focus 或阅读锚点；focused item 被删除时，确定性选择 successor，否则选择 predecessor。

### 4.4 Actions

目的：把浏览与副作用操作彻底分离。

Actions 是全屏语义列表，首项为 Back；`SUBAGENTS` 是关系导航命令，不属于 controlled action。其余按上下文显示最多三个 controlled actions：Follow up、Review permission 和 Stop。列表项超过可视高度时围绕 canonical focus 开窗。Wheel 选择、side click 打开下一步；Stop 不在本页直接执行。

结构性不支持的 action 隐藏，例如 Native subagent 永远没有 Follow up/Stop。暂时不可用的 action 保留 disabled，并用 `RECONNECTING · SYNCING`、`DEVICE LOCK REQUIRED` 等短原因解释。Managed Root/Subagent 仅在 idle/running 且安全 gate 通过时可 Follow up；Permission pending 时 Follow up disabled。Stop 仅在 running 且 turn-safe contract 可用时出现。

### 4.5 Composer

目的：审阅并发送一句明确 follow-up。

组成：

- 来源标记：`VOICE` 或 `KEYBOARD`。
- 完整 transcript 按语义边界切成稳定页，显示页码；真机能力允许时可通过触摸键盘编辑。
- 字符数与发送状态。
- Action rail：未读完的中间页为 `BACK`、`CANCEL`、`NEXT`；首页省略无目标的 `BACK`，末页省略无目标的 `NEXT`。只有所有前页都访问后，末页才显示 `BACK`、`CANCEL`、`SEND`。任一页面最多三个 command。触摸编辑直接作用于 transcript，不占用硬件 action。

`CANCEL` 在进入 Composer、翻页后的 rail 重建以及内容重新分页后都默认选中。`SEND` 只在末页且所有前页已访问时出现，永不默认选中。无需触摸的核心路径能用 `BACK/NEXT` 审阅每一页，再选择 `SEND` 或 `CANCEL`；错误 transcript 通过 Cancel 后重新 dictation。触摸编辑仅在真机 OSK 验证通过后作为加速能力；编辑或追加会使原 read-through 失效，从受影响页重新审阅，期间隐藏 Send。已有草稿时新 transcript 默认追加；Replace 是显式且可取消的操作。发送后经历 `sending -> confirmed | failed | unknown`，失败时保留草稿，unknown 按 commandId 对账且不盲目重试。转写失败进入 `voice-failed`，已有草稿保持不变；只有转写成功后才追加新 transcript。

Cancel 本次 dictation review 恢复 preDictationDraft，不删除原 Draft；退出一个既有 Draft 的 review 只返回来源，不修改 Draft。删除使用独立且需要确认的 `DISCARD DRAFT`。另一个 Agent 已有 Draft 时阻止录音并显示 `DRAFT IN <Agent>`，action 只有 `RETURN TO DRAFT` 与 `DISCARD DRAFT`。`RETURN TO DRAFT` 必须恢复绑定的 Host + Workspace + Agent，而不是绑定当前浏览上下文。Target unavailable 时保留全文和绑定目标，显示明确原因并禁用 Send；不得静默改绑或迁移 Draft。

### 4.6 Dictation

目的：让用户明确知道设备正在听，并能自然结束。

Dictation 仅从明确打开的 interactive Agent 启动。它替换整屏，不采用 modal card。按住侧键后立即显示橙色顶部 rule、五条音量 bar 和 `RECORDING`；松开后显示 `TRANSCRIBING`，成功进入 Composer，失败进入可恢复状态。

收到 `longPressStart` 后整个 gesture 被消费，到 `longPressEnd` 前及随后一个迟到 click 都不能打开 Actions。抑制窗口由 Tested firmware 实测。过短录音显示 `TOO SHORT`；30 秒达到安全上限时进入 review。Transcribing/sending/stopping/unknown 防重入，lost end 由 safety timeout 失败收尾。

如果 voice bridge 不可用，显示 `VOICE UNAVAILABLE`，并直接提供键盘输入，不自动重试。

这属于 Paseo Composer dictation，不得称为完整 Voice mode。

### 4.7 Permission Handoff

目的：理解阻塞原因，并安全转交完整 Paseo 客户端。

内容顺序：

1. Permission request kind 与完整性。
2. 操作名称。
3. 影响目标。
4. 简短原因。
5. 详情完整性状态。
6. Workspace / agent context。
7. 状态文案 `CONTINUE IN PASEO`；Action rail 只有 `BACK`。

Request kind 与完整性、detail completeness 都是独立必填字段，使用 `FULL`、`TRUNCATED`、`CHANGED`、`MALFORMED` 或 `UNKNOWN`；不得根据标题是否存在推断完整性。服务端语义投影必须让 kind、operation、target 摘要、reason、两类 completeness 与 context 在一屏可见；装不下时标记 `TRUNCATED` 并转交完整 Paseo，不在 R1 伪装成完整详情。`CONTINUE IN PASEO` 始终可见，且始终提供硬件可达的 Back。

首个 Controlled Actions 版本不显示 Approve、Deny 或 provider action option。任何 Permission shape 都是只读摘要；未知、畸形、截断或已变化时同样显示 `CONTINUE IN PASEO`。用户手动打开已配对的手机或桌面 Paseo；R1 不生成 handoff token、QR、push 或跨设备 deep link。

### 4.8 Stop Confirmation

目的：只取消 current turn，并正确反映 Paseo cancellation acknowledgement；不 Close、Archive、Detach 或删除 Agent/Workspace/Subagent。

默认 focus 是 `CANCEL`。Confirm 时把当前 stable turn identity 冻结为不可变的 `pendingTargetTurnId`；如果 successor turn 已开始，服务端拒绝并显示 `TURN CHANGED`。Confirm 后进入 `STOPPING`；RPC accepted 不是完成，只有匹配 pendingTargetTurnId 的 authoritative terminal event 或 snapshot 后显示 stopped。任何 successor/mismatched event 都不能把新 turn 改成 idle 或 stopped。拒绝或超时返回 Agent，lifecycle 仍为 running，并保留失败信息。无法获得 stable turn identity 时不显示 Stop action。

### 4.9 Offline / Stale

目的：保留上下文，但阻止用户把缓存误认为实时状态。

断网后保留 Home、Workspace 或 Agent snapshot，在 header 下增加高对比 `STALE` band，显示上次同步时间和下一次 retry。用户可返回、阅读缓存并保留一条绑定 Host + Workspace + Agent session 的 Draft，但 Send 与 Stop disabled。切换 Agent 不迁移 Draft；重连后重新展示目标与最新上下文，用户必须再次确认 Send。Draft 永不显示成 pending command，也不自动发送；stale 查看不清除 Attention 或写入 Read state。

### 4.10 Pairing、恢复与首次加载

没有可信 Device grant 的首次启动只显示 Pairing，不加载 Host、Workspace、Agent 或 Draft。Pairing 必须有硬件可聚焦的恢复命令，并明确展示 `PAIRING`、`PAIRED`、`PAIR FAILED`、`PAIR AGAIN`；不能用唯一 action disabled 的死屏代替恢复流程。配对在完整 Paseo 完成时，R1 进入有界轮询并保留 Back，成功后重新验证 Device grant、device lock、firmware 与 Host 绑定再进入 Home。

`AUTH REQUIRED`、grant revoked、security blocked、upgrade required、limited firmware 与 unsupported firmware 都必须给出安全恢复说明或硬件返回路径。需要在完整 Paseo 操作时，R1 只说明下一步并等待重新验证，不伪装成已打开另一台设备。

首次连接且没有 verified cache 时，在 canonical `RECONNECTING` 下显示有界 loading/empty surface，不渲染示例数据，也不把空缓存标记为 `STALE`。`STALE` 仅表示曾验证过的 snapshot，必须同时显示 last-sync age 与 retry timing。内部的 connecting、resubscribing、catch-up、verifying 只是 `RECONNECTING` 的次级进度，不形成另一套 connection 状态。

### 4.11 Unsupported Orientation

横屏只显示 rotate-back surface，不加载或泄露产品内容，不提供 controlled action。进入横屏时保留内存中的 view、canonical focus、Draft 与阅读页；恢复竖屏后回到完全相同的状态。MVP 不缩放、旋转或重排 240×282 应用画布来适配横屏。

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
  review-page + back/next -> review-page
  final-page + send -> sending -> accepted -> confirmed
                    |-> failed
                    \-> unknown -> reconcile by commandId

Stop decision screen
  + wheel -> Change decision focus
  + side click -> Confirm focused decision
  + back -> Cancel without side effect

Stop
  confirm -> stopping -> stopped | failed(running)
```

输入规则：

- Wheel 只改变 focus，永不执行副作用；Agent 页的 wheel 只浏览 timeline。
- Home、Workspace、Subagents、Actions 与 timeline 都使用稳定 item identity 作为 canonical focus，并只渲染其周围有界窗口。越过可视边缘时窗口移动一个语义项，position count 仍按完整列表计算。
- Touch、wheel、DOM focus 与 screen-reader active descendant 写入同一个 canonical focus。
- Async update 不改变 focused identity 或阅读锚点；当前项目被删除时优先选择 successor，无 successor 才选择 predecessor。
- 每次 destructive action 都必须经过单独确认视图或明确 decision focus。
- Workspace、Subagents、Actions、Handoff 和 Decision/list 视图直接提供可聚焦 Back；Composer 使用逐页 rail 且 Cancel 始终默认。Agent 通过侧键短按进入 Actions，再选择 Back。触摸不是唯一返回方式。

Dictation 的硬件事件合同：`longPressStart` 成功进入 recording 后消费整个 gesture；对应 `longPressEnd` 只结束录音，直到固件实测抑制窗口结束前的 synthesized/late click 都被丢弃。过短录音进入 `TOO SHORT` 且不改 Draft；30 秒达到上限时自动结束并进入 transcribing；lost end 由 safety timeout 收尾为可恢复失败。Recording、transcribing、sending、stopping 和 unknown 均拒绝重入。Voice bridge 不可用时显示 `VOICE UNAVAILABLE` 并提供键盘 Composer，不自动重试。

## 6. 关键用户流程

### 流程 A：查看进行中的任务

```text
Wake -> Home -> Workspace -> root Agent -> Agent -> Subagents or read timeline -> Actions -> Back
```

目标：五次以内输入完成；无网络恢复时仍可阅读最后 snapshot。

### 流程 B：语音 Follow-Up

```text
Agent -> hold side button -> recording -> release -> transcribing -> review
      -> select SEND -> sending -> accepted -> confirmed
                              \-> failed | unknown
```

目标：不自动发送；RPC acknowledgement 只进入 accepted，只有 authoritative timeline 出现同一 command identity 才 confirmed；unknown 按 commandId 对账且不盲目重试。

### 流程 C：处理 Permission

```text
Home attention -> Agent -> Actions -> Review permission -> inspect -> CONTINUE IN PASEO -> BACK
```

目标：R1 不提交 Permission response，也不伪装成能打开另一台设备；用户手动在完整 Paseo 中完成决策。

### 流程 D：断线恢复

```text
Online -> network loss -> STALE snapshot -> reconnect
       -> directory refetch/resubscribe + per-Agent timeline catch-up -> LIVE
```

目标：用户始终知道数据是否实时，focus 与阅读位置在 snapshot 仍有效时保持不变。

## 7. 文案规范

- 首版固定 chrome 使用简短英文，不提供语言切换或完整 i18n framework。
- Project、Workspace、Agent title、timeline 摘要和 transcript 保留原始 UTF-8 内容，必须支持 CJK 显示与换行。
- 使用短动词：`OPEN`、`SEND`、`STOP`、`BACK`、`RETRY`。
- Connection freshness 只使用 `LIVE`、`RECONNECTING`、`STALE`、`AUTH REQUIRED`。Transport 的 connecting、resubscribing、catch-up、verifying 仅作为 `RECONNECTING` 下的次级进度文案。
- Firmware capability 使用 `LIMITED` 或 `UNSUPPORTED`；未知 build 不显示成 fully supported。
- Lifecycle 使用 `INITIALIZING`、`RUNNING`、`IDLE`、`ERROR`、`CLOSED`。
- Attention 使用 `REVIEW`、`FAILED`、`FINISHED`；Read state 只改变视觉强度，不显示成额外 Attention。Workspace 可使用 `NEEDS INPUT`、`FAILED`、`RUNNING`、`ATTENTION`、`DONE`，但不能把它们当作 Agent lifecycle。
- 避免“Something went wrong”；错误必须指出下一步，如 `PAIR AGAIN`。
- 时间使用短格式：`NOW`、`2M`、`1H`、`YDAY`。
- Provider 使用稳定短名：`CODEX`、`CLAUDE`、`OPENCODE`。
- 不在屏幕中解释滚轮、快捷键或 UI 设计；只显示当前动作需要的文案。

## 8. 状态与反馈

| 状态 | 视觉 | 行为 |
|---|---|---|
| Running lifecycle | 黄色圆点 + `RUNNING` | 与 attention 独立显示 |
| Idle lifecycle | 灰色圆点 + `IDLE` | 不代表需要用户输入 |
| Permission attention | 橙色 rail + `REVIEW` | 进入独立只读 Handoff view |
| Finished attention | 浅灰 mark + `FINISHED` | 在线同步且 meaningful content 渲染后才可清除 |
| Local read state | 降低已查看行的视觉强度 | 不改变 Attention 或排序；stale 时不写入 |
| Error lifecycle | 红色菱形 + `ERROR` | 展示明确错误摘要 |
| Stale connection | `STALE` band + 上次同步时间 | 可读、可保留绑定 Draft；禁用 Send/Stop，不清除 Attention |
| Reconnecting, no cache | `RECONNECTING` + transport 次级进度 | 显示 loading/empty surface，不渲染产品数据 |
| Pairing / recovery | `PAIRING`、`PAIR FAILED`、`PAIR AGAIN` | 至少一个硬件可聚焦恢复或 Back 命令，不形成死屏 |
| Sending | Pending row + 固定进度 mark | 使用 idempotency key |
| Accepted | 短暂 success mark | 600ms 后恢复普通状态 |
| Stopping | 固定进度 mark + `STOPPING` | 等待匹配 exact target turn 的 authoritative state |

## 9. 无障碍与安全性

- Focus 使用反相底色、橙色 rail 和文本，不依赖颜色。
- Error 使用菱形，其他状态使用圆形。
- 所有 touch target 至少 44px 高且至少 44px 宽。列表视觉行保持 46px，action rail 高度至少 44px。
- 支持 `prefers-reduced-motion`，移除位移和音量 bar 动画。
- Transcript 发送前始终可完整审阅；触摸编辑是可选能力。
- Stop 不得通过单个无上下文手势直接触发；R1 不执行 Permission decision。
- Screen reader 名称描述语义动作，不描述图标外观。
- Composite list 使用 `aria-activedescendant` 暴露 canonical focus，或实现真正的 roving `tabindex`；DOM focus、触摸、滚轮与视觉 focus 不得分叉。原生 button 保留 button 语义，不为样式覆盖成 `role=option`。
- View、connection、focus position、recording/transcribing 和 destructive result 的变化通过适当的 polite/assertive live region 增量播报；重新 render 不得把焦点重置到无名称的 app shell，也不得重复朗读整屏。
- 固定 chrome 显式使用英文语言标记。用户拥有的 UTF-8 内容优先使用源数据的合法 language tag，否则继承设备 locale；不得根据短标题猜语言。需要用中英文内容在 TalkBack 上验证发音与切换。
- 长文本先由服务端做语义投影，再由 UI 截断。

## 10. 原型与实现验收

### 视觉验收

- `#app` 的内容盒精确为 240×282 CSS px；device bezel、border、outline 和 shadow 全在内容盒外，不能因全局 `border-box` 变成 238×280。应用本身不缩放。
- 每个视图在 240×282 下无横向滚动、非规范裁切和文字覆盖；Composer/Permission 的规范分页不算裁切。
- Focus 改变不引发布局位移。
- 任一 action rail 同屏不超过三项 command。Actions 全屏列表可以同时包含 Back、Subagents 关系导航和最多三个 controlled actions，但必须窗口化且 focus 始终可见。
- 无 cards inside cards、drawer、bottom sheet、gradient 或 decorative imagery。
- Orange 不支配整个屏幕，只标记身份和动作。
- 原型的颜色、字体、字号、行高、间距、圆角、header、row 与 rail token 必须逐项引用或机械同步根目录 `DESIGN.md`，不得维护数值略有差异的第二套 token。

### 交互验收

- Arrow Up/Down、Enter、Space hold/release 和 Escape 可模拟全部核心流程；列表/决策视图可通过 wheel + Enter 直接返回，Agent 通过 Enter 打开 Actions，再选择 Back 返回。
- Wheel 一格移动一个语义项，边界不循环。
- 所有长列表与 timeline 围绕 canonical focus 正确开窗；focus 不可落在屏幕外，异步插入不抢 focus，删除 focused item 时按 successor/predecessor 规则恢复。
- Attention 超过一页时，`MORE ATTENTION IN PASEO · n` 始终位于普通 Workspace 前；加载失败仍保留 continuation 与剩余数量，绝不静默显示为零。
- Touch 和 wheel focus 始终一致。
- Voice transcript 不自动发送；不用触摸即可分页读完全文，未访问完前页时末页不显示 Send，内容改变后必须重新完成 read-through。
- Permission handoff 永不显示 approve/deny；Stop 默认选择 cancel。
- Offline 时无法执行 stop 或 send；Permission 只能阅读缓存摘要，不能 handoff 到未连接的目标。
- 没有有效 Device grant 或可靠 RabbitOS device lock 时，Follow-up 和 Stop 不显示为可执行 action，产品保持只读。
- 首次无 cache 不显示示例/陈旧数据；Pairing、恢复与 rotate-back 都存在完整硬件路径且不形成 disabled-only 死屏。
- Stop success 只接受匹配 frozen pendingTargetTurnId 的 authoritative terminal state；successor/mismatched event 不能停止新 turn。
- `aria-activedescendant` 或 roving focus、live-region 播报、英文 chrome 与 device-locale 用户内容均通过 TalkBack 验收。

### 性能验收

- Wheel focus feedback 小于 100ms。
- 页面 transition 不超过 120ms。
- 无持续后台 animation。
- 30 分钟 session 中 DOM node 数保持有界。
- 首屏不依赖 remote font 或 large asset。
- 中文标题、timeline 与 transcript 在真机上无缺字，并按语义优先级换行或截断。

### 产品验收

- 在真实个人工作中连续 dogfood 7 天。
- 至少 80% 的离桌干预无需再打开手机或桌面 Paseo。
- 打开 R1 后识别最高优先级 Attention 的中位时间不超过 3 秒。
- 完成安全 Follow-up 的中位时间不超过 20 秒。
- 错误目标、重复提交、误批准和误停止均为 0。
- 缓存内容在同步完成前从不显示 `LIVE`。

## 11. 后续设计问题

以下问题需要在真实设备 spike 中验证：

1. WebView 实际字体 metrics 是否导致 13px 中文和英文混排溢出。
2. R1 滚轮快速旋转时的 event rate，以及是否需要合并 render。
3. Creation 是否暴露可靠 back event 或 haptic API。
4. Native keyboard 占用 viewport 后 Composer 的可用高度。
5. Side click 与 long-press events 的精确时序和取消语义。
6. 日光和暗光下 inverted focus 与状态色的可辨识度。
