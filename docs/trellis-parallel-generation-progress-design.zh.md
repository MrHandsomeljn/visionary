# TRELLIS 多资产并发生成与逐资产进度浮窗设计

## 1. 文档目的

本文记录 TRELLIS.2 自定义 API 在“生成组件 3D 资产”步骤中的并发生成和逐资产进度展示需求，确认现有能力、实现可行性、跨层协议和推荐实施方案。

本文只做需求与设计总结，不包含代码实现。

## 2. 需求理解

### 2.1 并发生成

当 layout 提取出多个物体后，TRELLIS 模式下不应采用以下串行流程：

```text
提交物体 1 -> 等待物体 1 完成 -> 下载物体 1
提交物体 2 -> 等待物体 2 完成 -> 下载物体 2
...
```

目标流程是：

```text
物体 1: 提交 -> 独立轮询 -> 下载
物体 2: 提交 -> 独立轮询 -> 下载
物体 3: 提交 -> 独立轮询 -> 下载
...
```

所有物体任务应尽快发给 TRELLIS 服务。某个物体提交、生成或下载较慢时，不应阻塞其他物体。

该需求第一阶段只针对 `trellis.2` 自定义 API。Hunyuan 可以继续保持现有行为，避免同时改变云 API 的限流和计费特征。

### 2.2 逐资产进度浮窗

用户将鼠标移到“生成组件 3D 资产”的总进度条上时，显示一个小型进度浮窗。

浮窗中每一行对应一个物体资产，至少包含：

- 物体序号和 layout 名称，例如 `03-机械臂-t1024`
- 当前状态，例如提交中、生成中、下载中、完成、失败
- TRELLIS 当前阶段名称
- 阶段序号，例如 `3/8`
- 当前资产总进度条和百分比
- 可选的阶段消息或错误摘要

示意：

```text
组件 3D 生成                         56%

01-工作台-t1024   几何生成  3/8   [========      ]  48%
02-机械臂-t1024   纹理生成  6/8   [===========   ]  73%
03-工具柜-t1024   排队中     -    [              ]   0%
04-显示器-t1024   已完成     8/8  [==============] 100%
```

键盘聚焦进度条时也应显示浮窗；触摸设备可通过点击切换。浮窗不能被 Agent 滚动容器裁切，也不能改变消息布局或滚动位置。

## 3. 现有能力确认

### 3.1 TRELLIS 已经提供足够的进度字段

`third-party/call_3dgen_api.sh` 已经通过 `QueryHunyuanTo3DProJob` 获取并打印：

- `Status`
- `Progress`
- `Stage`
- `StageIndex`
- `StageCount`
- `StageProgress`
- `StageProgressEstimated`
- `StageMessage`

因此，TRELLIS 服务端不需要为了本需求新增进度接口。

`src/server/mcp/new-pipeline-components-3d-server.ts` 当前也已经查询同一个接口，并读取了其中大部分字段。现有问题不是“拿不到进度”，而是进度没有以逐资产结构实时传到浏览器。

### 3.2 当前生成过程是串行的

当前 `writeCompatibleApiHunyuanOutputs()` 使用一个 `for ... of` 循环。每次循环会完整执行：

1. 提交一个物体
2. 等待该物体任务完成
3. 下载 GLB
4. 再处理下一个物体

这正是多个物体互相阻塞的原因。

### 3.3 当前组件步骤不是流式请求

初始 Codex 对话已经支持 SSE：

```text
POST /api/codex-agent/messages/stream
```

但场景流水线中的 `components-3d` 通过以下非流式接口执行：

```text
POST /api/agent/step-action
```

浏览器只在整个步骤结束后收到 JSON 结果。生成过程中即使服务端持续查询到 TRELLIS 进度，也无法实时更新 Agent 进度条。

此外，直接调用 `generateComponents3D()` 时，当前 `emitProgress()` 主要写入服务端 `stderr`。该方式适合 MCP/Codex 子进程日志，但不适合直接函数调用时向浏览器推送结构化进度。

### 3.4 “流式进度”不等于“流式下载模型”

本文中的 SSE 只传输很小的 JSON 状态事件，例如当前 job、阶段和百分比。它不传输 GLB 内容，也不要求 TRELLIS 一边生成一边下载。

模型流程保持不变：

```text
提交任务 -> Query 接口轮询进度 -> Status=DONE -> 获取结果 URL -> 下载完整 GLB
```

因此不需要修改 TRELLIS 生成服务器的产物交付方式。浏览器实时看到的是 Query 结果的状态快照，不是生成中的模型字节。

这里还需要区分两个 server：

- **TRELLIS 生成服务器**：现有 Submit/Query/结果下载接口已经够用，不需要为进度浮窗修改。
- **Visionary Node 服务**：需要把自己已经查询到的结构化进度转发给浏览器；当前非流式 step-action 正是在这一层截断了实时进度。

`third-party/call_3dgen_api.sh` 是后端实现的正确参考范本：提交、保存 job id、轮询 Query、读取结构化字段、DONE 后下载。应用代码应在 TypeScript 后端独立实现相同状态机并通过回调输出结构化对象，不解析脚本终端文本。

## 4. 可行性结论

该需求可以实现，且不需要修改 TRELLIS API。

实现分为两个相对独立的部分：

1. **并发调度**：将每个物体改成独立的异步任务，并发执行提交、轮询和下载。
2. **实时展示**：把每个任务的结构化进度通过运行时回调和 SSE 传给前端，再由 Agent 进度条浮窗渲染。

并发调度本身改动集中；实时展示会跨越生成器、运行时、HTTP/SSE、前端 API 客户端、Agent 状态和 UI 六个边界，属于中等偏高范围的跨层改造。

按复杂度可以拆开：

- **只实现 TRELLIS 多资产并发**：较简单，主要修改组件 3D 后端生成器。
- **让浏览器实时显示总进度**：中等，需要 Visionary Node 服务增加 step-action SSE 和生成器回调。
- **完整逐资产浮窗、取消、失败资产重试和刷新恢复**：中等偏高，适合单独作为完整任务实现。

如果当前只想先解决生成耗时，可以先做并发，暂缓 SSE 和浮窗；这不会影响后续接入逐资产进度协议。

## 5. 推荐架构

```text
TRELLIS Query API
  -> Components3DProgressReporter
  -> generateComponents3D(onProgress)
  -> CodexAgentRuntime.handleStepActionStream(onTask)
  -> /api/agent/step-action/stream (SSE)
  -> ProjectApiClient.sendCodexAgentStepActionStream()
  -> Agent progress block.assetProgress
  -> progress-bar hover/focus popover
```

### 5.1 不推荐的方案

- 不建议前端浏览器直接请求 TRELLIS。这样会泄露服务地址和认证边界，并产生跨域、取消和项目归属问题。
- 不建议在服务端解析 `call_3dgen_api.sh` 的终端文本。脚本应作为字段语义和人工验证参考，而不是应用内协议。
- 不建议为每个资产创建独立 HTTP 请求。一个步骤请求内的 SSE 快照更容易处理取消、归档和最终一致性。

### 5.2 推荐的进度报告器

在组件 3D 生成器中引入一个内部进度报告器，维护所有资产的最新状态。每次任一资产更新时，报告器生成完整快照。

完整快照比增量事件更适合当前场景：

- 典型物体数量较少
- SSE 丢失单条更新后，下一条快照可自动恢复
- 前端不需要自行合并复杂 delta
- 并发任务完成顺序不会影响 layout 原始顺序

报告器应使用原始物体索引保存结果，不能按完成顺序 `push()`，否则模型、layout 和最终插入场景会错位。

## 6. 并发执行设计

### 6.1 TRELLIS 策略

每个物体封装为独立任务：

```ts
async function processTrellisAsset(item) {
  const jobId = await submit(item);
  const result = await poll(jobId, item);
  const file = await download(result, item);
  return file;
}

const settled = await Promise.allSettled(
  items.map((item) => processTrellisAsset(item)),
);
```

`items.map()` 会立即启动所有任务。一个慢请求不会阻止其他任务提交或轮询。

### 6.2 并发上限

产品默认行为应是“全部同时提交”，符合当前需求。

为保护不同部署规模，可以保留可选后端配置：

```text
VISIONARY_COMPONENTS_3D_TRELLIS_MAX_CONCURRENCY
```

- 未设置或为 `0`：并发数等于本批物体数
- 设置为正整数：使用有上限的 worker pool

该配置只属于部署保护，不应让默认 UI 回退到逐个阻塞。

### 6.3 轮询节奏

- 每个 job 独立维护超时截止时间。
- 每个 job 独立按照现有 `pollIntervalSeconds` 查询。
- 可以给首次轮询增加很小的随机抖动，避免所有任务永久在同一毫秒形成请求尖峰。
- 单个查询临时网络错误可以有限重试；明确的 `FAIL/ERROR` 必须立即标记该资产失败。

## 7. 逐资产进度协议

推荐在现有 task payload 中新增 `assetProgress`：

```json
{
  "title": "组件 3D 资产生成",
  "stage": "components-3d",
  "statusId": "running",
  "progress": 0.56,
  "assetProgress": {
    "version": 1,
    "revision": 18,
    "provider": "trellis.2",
    "total": 4,
    "submitted": 4,
    "running": 2,
    "completed": 1,
    "failed": 0,
    "items": [
      {
        "assetId": "component_3d_001",
        "ordinal": 1,
        "label": "工作台",
        "modelName": "01-工作台-t1024",
        "jobId": "job-123",
        "status": "running",
        "stageKey": "texture_generation",
        "stageLabel": "Texture generation",
        "stageIndex": 6,
        "stageCount": 8,
        "stageProgress": 42,
        "stageProgressEstimated": false,
        "progress": 0.68,
        "message": "Generating texture",
        "updatedAt": "2026-07-13T12:00:00.000Z"
      }
    ]
  }
}
```

### 7.1 资产状态

```text
pending
submitting
queued
running
downloading
done
failed
canceled
```

状态机必须单向前进，终态不能被较晚到达的旧轮询结果覆盖。

### 7.2 快照版本

`revision` 每次更新递增。前端只接受不小于当前 revision 的快照，防止并发事件乱序或旧请求覆盖新状态。

### 7.3 字段安全

进度事件不能包含：

- SecretId、SecretKey
- 输入图片 Base64
- 可直接访问内部服务的敏感 URL
- 完整 provider 响应对象

只传展示和状态恢复需要的字段。

## 8. 进度计算

### 8.1 单资产总进度

优先使用 TRELLIS 返回的 `Progress`，因为它是服务端已经计算好的总进度，也可能包含比等权步骤更合理的耗时权重。

如果 `Progress` 缺失或非法，则使用阶段等权回退：

```text
stageFraction = clamp(StageProgress, 0, 100) / 100
assetProgress = ((StageIndex - 1) + stageFraction) / StageCount
```

规则：

- `StageIndex` 按 1-based 处理。
- `StageCount <= 0` 时显示不确定进度。
- `StageProgressEstimated` 用于标记该阶段进度是否为估算值，不应当作数值使用。
- 每个资产的进度必须单调不减：`next = max(previous, calculated)`。
- provider 完成但正在下载时保持在 `99%`；GLB 写入成功后更新为 `100%`。
- 大耗时阶段通过 `StageProgress` 提供阶段内部的精细进度，不需要在前端硬编码大量阶段权重。

### 8.2 总进度条

生成阶段的聚合进度使用所有资产等权平均：

```text
aggregate = sum(assetWorkProgress) / assetCount
```

其中：

- 运行中资产使用当前 `progress`
- `done`、`failed`、`canceled` 都视为该资产任务已经结束，聚合工作完成度按 `1` 计算
- 失败状态通过颜色和状态文字表达，不应让已结束的总进度永远停在中间

再将 aggregate 映射到现有 components-3d 大步骤的生成区间；后续位姿写入、缩略图和依赖树整理仍使用现有总步骤区间。

## 9. SSE 与运行时改造

### 9.1 生成器回调

`generateComponents3D()` 增加可选回调：

```ts
onProgress?: (event: Components3DProgressEvent) => void | Promise<void>
signal?: AbortSignal
```

统一的进度发送函数同时负责：

- MCP CLI 模式：继续向 `stderr` 写 `visionary.task.progress`
- 直接运行时模式：调用 `onProgress`

业务代码不应分别维护两套进度字段。

### 9.2 Step-action SSE

新增兼容现有请求体的流式端点：

```text
POST /api/agent/step-action/stream
Accept: text/event-stream
```

事件：

```text
event: ready
event: task
event: result
event: error
```

现有 `/api/agent/step-action` 保留，供兼容和非生成动作使用。

`retry` 生成操作使用流式端点；`apply` 和 `cancel` 可以继续使用普通 JSON，或统一走同一客户端封装。

### 9.3 前端更新

`ProjectApiClient` 增加 `sendCodexAgentStepActionStream()`，复用现有 `parseSseResponse()`。

每次收到 `task`：

- 校验 execution id 和 branch revision，丢弃已经过期的任务更新
- 更新当前 `components-3d` progress block 的总进度
- 更新 `assetProgress` 快照
- 保持当前 Agent 消息滚动位置
- 不在每个轮询事件上立即持久化 `agent_history.json`

最终 `result` 到达时，再写入完整候选结果并触发现有持久化流程。

## 10. 浮窗交互设计

### 10.1 触发方式

- `pointerenter` 进度条：显示
- `pointerleave` 进度条和浮窗：延迟关闭，允许鼠标移动到浮窗
- 进度条获得键盘焦点：显示
- `Escape` 或失焦：关闭
- 触摸点击：切换显示

进度条需要可聚焦，并提供本地化 `aria-label`。

### 10.2 布局

- 使用 top-layer popover 或挂载到独立 portal，不能放在会被 `.agent-message-scroll` 裁切的普通子层中。
- 宽度建议限制在 `min(420px, calc(100vw - 16px))`。
- 行数过多时浮窗内部滚动，最大高度不超过可视区约 `60vh`。
- 每一行使用稳定网格列，文本截断不应挤压进度条。
- 浮窗打开、进度更新和关闭都不能改变 Agent 消息 DOM 高度或垂直滚动位置。
- 不使用浏览器原生 `title` 承载复杂明细。

### 10.3 国际化

状态和已知 TRELLIS 阶段使用 `UI_TEXT.zh/en` 映射。

后端传递稳定 `stageKey` 和 provider 原始 `stageLabel/message`：

- 已知 stageKey：前端本地化
- 未知 stageKey：回退显示 provider 原始文本

所有固定 UI 文本、`aria-label` 和失败状态都必须同时提供中英文。

## 11. 失败与取消策略

### 11.1 单资产失败

推荐行为：

- 一个资产失败不取消其他正在运行的资产。
- 等待所有资产进入终态后再结束批次。
- 成功的 GLB 和索引记录必须保留。
- 总步骤标记为失败或部分失败，浮窗明确列出失败资产。
- “应用”默认禁用，避免无意生成缺物体场景。
- “重试”应优先只重试失败资产，避免重复消耗已完成任务。

如果第一阶段不实现失败资产定向重试，则必须在 UI 和文档中明确重试会重新生成整批资产。

### 11.2 取消

- 浏览器取消请求后，服务端停止本地轮询和下载。
- 如果 TRELLIS 提供取消 job API，应对所有未完成 job 发取消请求。
- 如果 TRELLIS 不提供取消 API，远端 job 可能继续执行；本地必须停止消费结果并在状态中记录这一限制。
- 任何取消后的迟到事件都必须通过 execution id/revision 防护丢弃。

## 12. 数据持久化

生成期间的高频进度是瞬态 UI 状态，不应每次轮询都写入项目文件。

推荐：

- 内存中保留完整 `assetProgress`
- SSE 持续推送快照
- 最终完成、失败或取消时持久化最后一次快照
- `model_index.json` 保存每个资产的最终状态、job id、模型名、错误和输出路径
- 不保存 Secret、Base64 或内部响应全文

页面刷新后的任务恢复属于后续增强。若需要跨刷新恢复运行中任务，应新增服务端任务注册表，而不是只依赖 Agent 历史文件。

## 13. 预计改动边界

### 后端生成器

- `src/server/mcp/new-pipeline-components-3d-server.ts`
  - TRELLIS 并发任务
  - 逐资产状态报告器
  - 进度回调和 AbortSignal
  - 稳定结果排序与部分失败索引

### 运行时与 HTTP

- `src/server/codex-agent-runtime.ts`
  - step-action progress callback
  - `assetProgress` 类型和透传
- `src/server/project-api.ts`
  - step-action SSE 端点

### 前端 API 与状态

- `src/editor/project-api-client.js`
  - step-action SSE 客户端
- `public/editor.js`
  - progress block 的 `assetProgress`
  - 快照 revision 合并
  - hover/focus/touch 浮窗控制
  - i18n
- `public/editor.html`
  - 可选的 popover portal 容器
- `public/editor.css`
  - 浮窗、行布局、状态和进度条样式

### 测试

- `tests/codex-agent-runtime.test.ts`
- `tests/editor-codex-agent-policy.test.mjs`
- 新增 TRELLIS 并发调度和进度计算单测
- 新增 SSE step-action 协议测试
- 新增浮窗定位、键盘和滚动稳定性测试

## 14. 验收标准

### 并发

- 三个物体的提交请求在任一物体完成前均已发出。
- 一个物体轮询慢或下载慢时，其他物体可以继续到完成状态。
- 最终输出顺序始终与 layout 原始顺序一致，而不是完成顺序。
- 可选并发上限生效时，不会退化为“一个物体全流程结束后才提交下一个”。

### 进度数据

- 每个资产能独立显示 job、状态、阶段、阶段序号、阶段进度和总进度。
- 单资产进度不会倒退。
- 乱序或旧 revision 不会覆盖新状态。
- 总进度由所有资产状态聚合，并在所有资产进入终态后结束。

### UI

- 鼠标悬停总进度条显示逐资产浮窗。
- 键盘和触摸可以访问同一信息。
- 浮窗不会被 Agent 面板裁切，不覆盖到视口外。
- 进度更新不会改变 Agent 垂直滚动位置。
- 中英文切换后固定文本、状态和无障碍标签同步更新。

### 失败与取消

- 单资产失败不会中止其他资产。
- 失败原因显示在对应行，成功结果仍保留。
- 取消后 UI 不再接收迟到进度更新。
- 不向前端泄露密钥、Base64 和敏感内部 URL。

## 15. 实施顺序建议

1. 提取纯函数：TRELLIS 响应规范化、单资产进度计算、聚合进度计算。
2. 将 TRELLIS 生成改为并发并保持稳定结果顺序。
3. 为 `generateComponents3D()` 增加进度回调和取消信号。
4. 增加 step-action SSE 端点与客户端。
5. 将 `assetProgress` 接入 Agent progress block。
6. 实现 hover/focus/touch 浮窗。
7. 完成失败资产重试、取消和持久化策略。
8. 执行跨层、滚动稳定性、i18n 和并发回归测试。

## 16. 待确认产品决策

实现前建议确认以下两点：

1. 某些资产失败时，是否允许用户应用其余成功资产？推荐默认不允许，并提供“仅重试失败资产”。
2. TRELLIS 部署是否有明确的最大并发 job 数？如果没有，默认整批并发；如果有，配置 worker pool 上限。

除以上两个产品策略外，现有 API 字段和代码结构已经足以开始实现。
