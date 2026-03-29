# Visionary Editor 产品维护基线

本文档由 `openspec/README.md` 迁移而来，用于定义 `docs/superpowers/` 下的长期维护口径。

## 产品方向

本项目应被视为一个统一产品，长期包含 3 条并行工作线：

1. Editor 能力完善
2. Agentic 交互与界面设计
3. 自然语言与大模型集成

这里的 editor 不是通用 DCC 工具，而是服务于 Visionary「电影视频生成」任务的 3D 场景构建与初稿视频导出页面。

有两个持续成立的产品约束：

- 人工干预能力必须完整、可靠、可控
- 人工干预链路应逐步弱化，让自然语言驱动流程成为主路径

## 文档维护模型

使用 `docs/superpowers/specs/` 维护稳定、长期生效的能力基线。

使用 `docs/superpowers/plans/` 维护：

- 新功能
- 行为调整
- 实验方向
- 产品边界未定的交互方案
- 尚未被接受为长期基线的跨能力变更

## 当前能力边界

当前稳定基线能力包括：

- editor-scene-authoring
- editor-model-animation
- editor-camera-timeline
- editor-camera-visualization
- editor-rough-cut-export

潜在的未来能力族包括：

- agentic editor workflow
- natural-language scene editing
- model-assisted export planning

这些未来能力在没有形成可测试、可维护的稳定行为之前，不应直接写进当前基线 spec。

## 事实来源

维护文档时，按以下优先级取舍：

1. 以当前已交付代码行为为主
2. 以已经实现的变更文档补充设计背景
3. 仍在演化的方案继续留在 `plans/` 中，而不是提早进入基线文档

## 升级为基线的条件

只有当以下条件同时满足时，某个计划才应提升为 `specs/` 基线：

- 行为已经在代码中落地，或已经被明确视为新的稳定默认行为
- 能力边界足够稳定，未来维护成本可控
- 可以脱离临时实现细节来描述其用户行为和约束

如果存在以下任一情况，则继续保留在 `plans/`：

- 功能仍处于探索阶段
- 交互模型仍在快速变化
- 行为边界尚不稳定
- 代码实现只完成了一部分

## 写作约束

- 基线文档按能力拆分，不按文件或模块拆分
- Agentic 产品原则优先留在计划或设计文档中，直到其成为稳定的用户可见行为
- UI 绑定细节尽量留在计划文档或实现说明中，除非它已经构成长期外部行为的一部分
- 需求描述优先使用可验证、可复现的场景
- 跨能力的产品方向统一集中描述，避免在每个能力文档中重复铺陈

## 推荐流程

1. 在 `docs/superpowers/plans/` 下新增或更新计划
2. 实现并验证对应行为
3. 当结果成为长期基线后，将稳定要求合并到 `docs/superpowers/specs/`
4. 完成后，将计划移入 `docs/superpowers/plans/archive/`
