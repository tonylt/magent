# Rabbit R1 Paseo 产品设计迭代审查

日期：2026-07-18  
对象：当前工作树整体，包括已提交内容、未提交修改、产品设计、方案设计、ADR、UI/UX、Design System 与高仿真原型。  
结论：经过 5 轮 review -> fix -> re-review，当前未发现新的重大产品设计冲突。真实 R1 能力与 Paseo 服务端扩展仍是明确的发布门槛，不能由浏览器原型替代。

## 1. 轮次摘要

| 轮次 | 主要发现 | 修订结果 | 复审结论 |
|---|---|---|---|
| 1. 契约与静态基线 | Command `UNKNOWN` 无法跨重启对账；Attention 可能被内存上限静默截断；Phase 2 beta 早于 compatibility negotiation；device lock 被误写成 daemon 可证明；immutable URL 被当成防篡改；安全 projection 与 conditional gateway 冲突；Composer 空 Draft 崩溃/Cancel 误删；全文不可无触摸审阅；列表焦点可跑出屏幕 | 增加无 payload command receipt、attention-first continuation、Phase 2A fail-closed negotiation、明确 lock/origin trust boundary、无条件服务端安全投影；修正 Draft、Composer 分页、列表窗口、exact-turn Stop 与输入状态机 | 架构 blocker 关闭，进入恢复态与高仿真核验 |
| 2. 恢复与边界复审 | Auth/Unsupported/Pairing 存在 disabled-only 死屏；Permission completeness 不完整；foreign Draft 删除无确认；首次无 cache 仍显示样例数据 | 增加完整 Pairing/Pair again/Check again、shape/detail completeness、Discard confirmation、first-load no-cache surface | 核心恢复路径完整，无新的授权冲突 |
| 3. 真实视觉复审 | Agent status band 元数据重叠；Composer target 截断 Agent 名；Discard 使用内部 ID | 修正 grid area、target 两行语义、用户可识别 Agent 名 | 受影响视图重拍通过；无重叠或不明目标 |
| 4. 跨文档完整性复审 | Product/solution 已要求 Attention continuation，但 UI/UX 与 prototype 没有 overflow sentinel | 增加 `MORE ATTENTION IN PASEO · n`、加载/失败保持规则与 `?screen=attention-overflow` | Sentinel 顺序、计数、读屏语义与加载反馈通过 |
| 5. 最终回归 | 搜索旧门槛、阶段漂移、状态枚举、危险默认值与裁切；重跑关键交互和多视口 | 无需继续修改核心设计 | 未发现重大问题，停止迭代（低于 10 轮上限） |

## 2. 关键设计决策

### Controlled command recovery

- Socket write 前原子保存一个无 payload receipt：commandId、kind、target identity、Stop target turn、状态与时间戳。
- Process restart 后先 reconcile receipt，再允许新 Controlled command；`UNKNOWN` 永不自动重发。
- 没有 secure Creation storage 时，只读能力可以 session-only 分发，Follow-up 与 Stop 不发布。

### Authorization 与供应链边界

- Protocol/minimum-client compatibility negotiation 是首个可分发 Phase 2A 的 fail-closed gate，不再推迟到 Phase 3。
- Device lock 是 Tested firmware 的发布/客户端本地 gate。没有 OS attestation 时，daemon 不声称能远程证明锁状态。
- Immutable path 是 trusted static origin 的运营控制，不是密码学防篡改。CSP、vendored dependency、最小写权限和 audit digest 只降低风险；抵御恶意 origin 需要 RabbitOS signed-bundle verification/attestation。
- Server-side safety projection/data minimization 是无条件 Paseo extension；独立 projection gateway 只由真实性能或协议测量触发。

### 240x282 interaction contract

- `#app` 内容盒精确为 240x282；bezel/border/shadow 不侵占画布。
- 行高固定 46px，action rail 至少 44px；所有列表围绕 canonical focus 开窗。
- Composer 对全文做稳定分页。每页 Cancel 默认选中，未读完前只出现 Back/Cancel/Next，末页完成 read-through 后才出现 Send。
- Permission 只做完整上下文的 read-only handoff；Stop 冻结 pendingTargetTurnId，只接受同一 turn 的 authoritative completion。
- Attention 超页时固定显示 `MORE ATTENTION IN PASEO · n`，不得让用户或指标得出“没有 Attention”的错误结论。

## 3. 浏览器证据

截图保存在 `artifacts/design-review/`：

- `round-2/home-240x282.png`：精确首屏与四行 Home。
- `round-2/composer-page-1.png`、`composer-final-page.png`：分页前无 Send，完成 read-through 后出现 Send。
- `round-2/discard-draft-confirm.png`、`turn-changed.png`、`auth-recovery-pairing.png`、`first-load-no-cache.png`：危险操作、successor-turn、恢复与首次加载。
- `round-3/agent-status.png`、`composer-target.png`、`discard-draft.png`、`permission.png`：第三轮视觉修复。
- `round-3/portrait-stage.png`、`landscape-blocked.png`、`desktop-stage.png`：375x667、667x375 与 1280x800。
- `round-3/workspace-window-last-item.png`：第 7/7 项仍处于可视窗口。
- `round-3/attention-overflow.png`：Attention continuation sentinel 位于普通 Workspace 前。

浏览器实测：viewport 240x282，`#app` 240x282，document scroll size 240x282；Home rows 均为 240x46。Composer rail 为 44px，页面 console/page errors 为空。Accessibility snapshot 可识别 application、navigation、Attention buttons、Composer textbox 与 rail buttons。

## 4. 最终评分

| 维度 | 初始 | 当前 | 说明 |
|---|---:|---:|---|
| Product/architecture coherence | D | B+ | blocker 已关闭；真实服务端 contract 尚待实现 |
| UI/UX completeness | D | A- | 核心/恢复/溢出/无障碍路径已定义 |
| Prototype fidelity | D | B+ | 浏览器状态与视觉通过；真实 R1 bridge 尚未验证 |
| AI-slop resistance | A | A | 保持硬件化 task instrument，无卡片拼盘、渐变或装饰性 UI |

## 5. 明确保留的发布门槛

这些不是当前设计冲突，也不能宣称已经实现：

- 在 owned R1 上验证 wheel、side click/hold、迟到 click、STT、secure storage、device lock、suspend/resume、WSS/E2EE、CJK 与 OSK。
- 在 Paseo 实现 Device enrollment/grant/session、即时 revoke、compatibility exchange、durable dedupe/result query、server safety projection 与 conditional exact-turn Stop。
- 完成 authorization security matrix、30 分钟资源测试和 7 天 dogfood 指标。
- 若未来要求抵御 static origin 被攻陷，先取得平台级 signed bundle/attestation；当前信任边界不承诺这一点。

## 6. Final verdict

当前设计已达到可以进入 Phase 0A/0B 验证与后续实现拆分的质量。没有发现需要继续修改的重大产品逻辑、UI/UX 契约或高仿真原型问题。任何可分发版本仍必须按文档中的 Phase gate fail closed，不能用当前原型截图代替硬件与服务端证据。
