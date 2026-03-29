# Superpowers 文档入口

`docs/superpowers/` 现在是本仓库面向 Superpowers 技能体系的文档根目录。

当前迁移规则如下：

- 稳定、长期维护的产品能力基线放在 `docs/superpowers/specs/`
- 正在进行中的功能任务放在 `docs/superpowers/plans/`
- 已完成或已归档的历史任务放在 `docs/superpowers/plans/archive/`

本项目的长期产品目标不是单纯完善一个 3D 编辑器，而是逐步完成一个面向「电影视频生成」任务的 Visionary editor 页面：

1. 完善 editor 基础能力
2. 逐步体现 agentic 的交互和界面设计
3. 接入大模型，支持自然语言驱动的场景编辑与生成流程

因此，后续维护建议遵循以下边界：

- 当前已经稳定的 editor 能力，继续沉淀到 `specs/`
- 边界仍在演化的 agentic / 自然语言能力，先以 `plans/` 的方式推进
- 当某个 agentic 或自然语言能力变成稳定基线后，再提升为新的 `specs/` 文档

当前已迁移的基线能力包括：

- `editor-scene-authoring`
- `editor-model-animation`
- `editor-camera-timeline`
- `editor-camera-visualization`
- `editor-rough-cut-export`

当前已迁移的活动计划包括：

- `add-editor-glb-animation-playback`
- `add-editor-viewport-transform-gizmo`

迁移映射详见 [MIGRATION.md](/E:/Codes/Visionary/visionary/docs/superpowers/MIGRATION.md)。
