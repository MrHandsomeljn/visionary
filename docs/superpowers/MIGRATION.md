# OpenSpec 到 Superpowers 迁移映射

本文档记录 `openspec/` 到 `docs/superpowers/` 的迁移关系。

## 迁移原则

- `openspec/specs/*/spec.md` 迁移为 `docs/superpowers/specs/*.md`
- `openspec/changes/*` 中的活动变更迁移为 `docs/superpowers/plans/*.md`
- `openspec/changes/archive/*` 中的历史变更迁移为 `docs/superpowers/plans/archive/*.md`
- `openspec/README.md` 中的维护规则迁移为 [README.md](/E:/Codes/Visionary/visionary/docs/superpowers/README.md) 与下方的产品维护文档

## 基线 Spec 映射

- `openspec/specs/editor-scene-authoring/spec.md`
  -> [2026-03-29-editor-scene-authoring-baseline.md](/E:/Codes/Visionary/visionary/docs/superpowers/specs/2026-03-29-editor-scene-authoring-baseline.md)
- `openspec/specs/editor-model-animation/spec.md`
  -> [2026-03-29-editor-model-animation-baseline.md](/E:/Codes/Visionary/visionary/docs/superpowers/specs/2026-03-29-editor-model-animation-baseline.md)
- `openspec/specs/editor-camera-timeline/spec.md`
  -> [2026-03-29-editor-camera-timeline-baseline.md](/E:/Codes/Visionary/visionary/docs/superpowers/specs/2026-03-29-editor-camera-timeline-baseline.md)
- `openspec/specs/editor-camera-visualization/spec.md`
  -> [2026-03-29-editor-camera-visualization-baseline.md](/E:/Codes/Visionary/visionary/docs/superpowers/specs/2026-03-29-editor-camera-visualization-baseline.md)
- `openspec/specs/editor-rough-cut-export/spec.md`
  -> [2026-03-29-editor-rough-cut-export-baseline.md](/E:/Codes/Visionary/visionary/docs/superpowers/specs/2026-03-29-editor-rough-cut-export-baseline.md)
- `openspec/README.md`
  -> [2026-03-29-editor-product-maintenance.md](/E:/Codes/Visionary/visionary/docs/superpowers/specs/2026-03-29-editor-product-maintenance.md)

## 活动计划映射

- `openspec/changes/add-editor-glb-animation-playback`
  -> [2026-03-29-add-editor-glb-animation-playback.md](/E:/Codes/Visionary/visionary/docs/superpowers/plans/2026-03-29-add-editor-glb-animation-playback.md)
- `openspec/changes/add-editor-viewport-transform-gizmo`
  -> [2026-03-29-add-editor-viewport-transform-gizmo.md](/E:/Codes/Visionary/visionary/docs/superpowers/plans/2026-03-29-add-editor-viewport-transform-gizmo.md)

## 归档计划映射

- `openspec/changes/archive/2026-03-29-document-current-editor-workflow`
  -> [2026-03-29-document-current-editor-workflow.md](/E:/Codes/Visionary/visionary/docs/superpowers/plans/archive/2026-03-29-document-current-editor-workflow.md)
- `openspec/changes/archive/2026-03-29-expand-camera-interpolation-modes`
  -> [2026-03-29-expand-camera-interpolation-modes.md](/E:/Codes/Visionary/visionary/docs/superpowers/plans/archive/2026-03-29-expand-camera-interpolation-modes.md)
- `openspec/changes/archive/2026-03-29-update-camera-sequence-curved-interpolation`
  -> [2026-03-29-update-camera-sequence-curved-interpolation.md](/E:/Codes/Visionary/visionary/docs/superpowers/plans/archive/2026-03-29-update-camera-sequence-curved-interpolation.md)
- `openspec/changes/archive/2026-03-29-update-camera-sequence-screen-space-thickness`
  -> [2026-03-29-update-camera-sequence-screen-space-thickness.md](/E:/Codes/Visionary/visionary/docs/superpowers/plans/archive/2026-03-29-update-camera-sequence-screen-space-thickness.md)

## 后续维护建议

- 新的稳定基线能力继续写入 `docs/superpowers/specs/`
- 新的 editor 功能、agentic 交互、大模型集成计划继续写入 `docs/superpowers/plans/`
- 已完成计划移入 `docs/superpowers/plans/archive/`
- 在确认团队已经完全切换到 `docs/superpowers/` 之后，再决定是否删除 `openspec/`
