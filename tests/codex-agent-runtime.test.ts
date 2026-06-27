import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildCodexExecArgs,
  CodexAgentRuntime,
  extractCodexTaskState,
  parseCodexExecJsonl,
  prepareCodexHomeFromSource,
  resolveCodexProjectEnvironment,
} from '../src/server/codex-agent-runtime.ts';
import {
  normalizeUserIdentity,
  ProjectStorage,
} from '../src/server/project-storage.ts';
import {
  MAIN_IMAGE_PROMPT_DESCRIPTION,
  MAIN_IMAGE_TOOL_DESCRIPTION,
} from '../src/server/mcp/new-pipeline-main-image-contract.ts';
import { generateLayoutVisualizationAssets } from '../src/server/mcp/new-pipeline-layout-server.ts';
import { generateInsertScene } from '../src/server/mcp/new-pipeline-insert-scene-server.ts';

async function createTempStorage() {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'visionary-codex-agent-'));
  const storage = new ProjectStorage(rootDir);
  return {
    rootDir,
    storage,
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

test('codex project environment creates CODEX_HOME under the user and project namespace', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Codex Project',
    });
    const env = await resolveCodexProjectEnvironment(storage, 'Demo User', project.id);
    const userId = normalizeUserIdentity('Demo User').userId;

    assert.equal(
      env.codexHome,
      path.join(rootDir, userId, project.id, 'codex_home'),
    );
    await stat(env.codexHome);
    assert.equal(
      env.sessionIndexPath,
      path.join(env.codexHome, 'visionary_codex_sessions.json'),
    );
  } finally {
    await cleanup();
  }
});

test('codex project environment imports config and passes auth through child env', async () => {
  const sourceCodexHome = await mkdtemp(path.join(tmpdir(), 'visionary-codex-source-'));
  const targetCodexHome = await mkdtemp(path.join(tmpdir(), 'visionary-codex-target-'));
  try {
    await writeFile(
      path.join(sourceCodexHome, 'config.toml'),
      [
        'model_provider = "beecode_ai"',
        'model = "gpt-5.5"',
        '',
        '[model_providers.beecode_ai]',
        'base_url = "https://beecode.cc"',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(sourceCodexHome, 'auth.json'),
      JSON.stringify({ OPENAI_API_KEY: 'test-api-key' }),
      'utf8',
    );

    const childEnv = await prepareCodexHomeFromSource({
      codexHome: targetCodexHome,
      sourceCodexHome,
      env: {},
    });

    assert.equal(
      await readFile(path.join(targetCodexHome, 'config.toml'), 'utf8'),
      [
        'model_provider = "beecode_ai"',
        'model = "gpt-5.5"',
        '',
        '[model_providers.beecode_ai]',
        'base_url = "https://beecode.cc"',
      ].join('\n'),
    );
    assert.deepEqual(childEnv, { CODEX_API_KEY: 'test-api-key' });
    await assert.rejects(
      () => stat(path.join(targetCodexHome, 'auth.json')),
      /ENOENT/,
    );
  } finally {
    await rm(sourceCodexHome, { recursive: true, force: true });
    await rm(targetCodexHome, { recursive: true, force: true });
  }
});

test('codex project environment appends the new pipeline MCP servers and scene skill', async () => {
  const sourceCodexHome = await mkdtemp(path.join(tmpdir(), 'visionary-codex-source-'));
  const { storage, cleanup } = await createTempStorage();
  const previousSourceHome = process.env.VISIONARY_CODEX_SOURCE_HOME;
  try {
    process.env.VISIONARY_CODEX_SOURCE_HOME = sourceCodexHome;
    await writeFile(
      path.join(sourceCodexHome, 'config.toml'),
      'model = "gpt-5"\n',
      'utf8',
    );
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'MCP Project',
    });

    const env = await resolveCodexProjectEnvironment(storage, 'Demo User', project.id);
    const config = await readFile(path.join(env.codexHome, 'config.toml'), 'utf8');
    const sceneSkill = await readFile(path.join(env.codexHome, 'skills', 'scene-skill', 'SKILL.md'), 'utf8');

    assert.match(config, /\[mcp_servers\.visionary_new_pipeline_main_image\]/);
    assert.match(config, /new-pipeline-main-image-server\.ts/);
    assert.doesNotMatch(config, /visionary_new_pipeline_front_view/);
    assert.doesNotMatch(config, /new-pipeline-front-view-server\.ts/);
    assert.match(config, /\[mcp_servers\.visionary_new_pipeline_top_view\]/);
    assert.match(config, /new-pipeline-top-view-server\.ts/);
    assert.match(config, /\[mcp_servers\.visionary_new_pipeline_layout\]/);
    assert.match(config, /new-pipeline-layout-server\.ts/);
    assert.match(config, /\[mcp_servers\.visionary_new_pipeline_components_3d\]/);
    assert.match(config, /new-pipeline-components-3d-server\.ts/);
    assert.match(config, /\[mcp_servers\.visionary_new_pipeline_insert_scene\]/);
    assert.match(config, /new-pipeline-insert-scene-server\.ts/);
    assert.match(config, /default_tools_approval_mode = "approve"/);
    assert.match(config, /VISIONARY_PROJECT_ID = /);
    assert.match(config, /VISIONARY_PROJECT_ROOT = /);
    assert.match(config, /tool_timeout_sec = 900/);
    assert.match(sceneSkill, /name: scene-skill/);
    assert.match(sceneSkill, /prompt contains `\$scene-skill`/);
    assert.match(sceneSkill, /mcp__visionary_new_pipeline_main_image__generate_main_image/);
    assert.match(sceneSkill, /Remove the `\$scene-skill` routing token/);
  } finally {
    if (previousSourceHome === undefined) {
      delete process.env.VISIONARY_CODEX_SOURCE_HOME;
    } else {
      process.env.VISIONARY_CODEX_SOURCE_HOME = previousSourceHome;
    }
    await rm(sourceCodexHome, { recursive: true, force: true });
    await cleanup();
  }
});

test('codex top-view retry requires an applied main image source', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Top View Project',
    });
    const runtime = new CodexAgentRuntime(storage);

    await assert.rejects(
      () => runtime.handleStepAction({
        user: 'Demo User',
        projectId: project.id,
        sessionId: 'agent-session-1',
        stepKey: 'top-view',
        action: 'retry',
        prompt: '生成一个车间流水线',
        selectedIndex: 0,
        images: [],
      }),
      /main image is required for top-view/,
    );
  } finally {
    await cleanup();
  }
});

test('codex layout retry requires an applied top view source', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Layout Project',
    });
    const runtime = new CodexAgentRuntime(storage);

    await assert.rejects(
      () => runtime.handleStepAction({
        user: 'Demo User',
        projectId: project.id,
        sessionId: 'agent-session-1',
        stepKey: 'layout',
        action: 'retry',
        prompt: '生成一个车间流水线',
        selectedIndex: 0,
        images: [],
        sourceImages: [
          {
            id: 'main_image_001',
            sourceStepKey: 'main-image',
            relativePath: 'agent_history/assets/new_pipeline/project/run/main_images/image_001.png',
            mimeType: 'image/png',
            bytes: 1,
          },
        ],
      }),
      /top view is required for layout/,
    );
  } finally {
    await cleanup();
  }
});

test('layout MCP creates an SVG visualization when extract_bbox does not return a visual image', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-layout-visual-'));
  try {
    const bboxDir = path.join(projectRoot, 'agent_history', 'assets', 'new_pipeline', 'project', 'run-layout', 'bbox_front');
    const imageDir = path.join(bboxDir, 'image_001');
    await mkdir(imageDir, { recursive: true });
    const bboxJsonPath = path.join(imageDir, 'image_001_bbox_front.json');
    await writeFile(
      bboxJsonPath,
      JSON.stringify([
        {
          box_2d: [100, 200, 420, 610],
          front_point: [420, 420],
          label: 'assembly station',
        },
      ]),
      'utf8',
    );
    await writeFile(
      path.join(bboxDir, 'bbox_front_index.json'),
      JSON.stringify({
        results: [
          {
            image_index: 1,
            success: true,
            bbox_json: bboxJsonPath,
            visual_image: null,
            detection_count: 1,
          },
        ],
      }),
      'utf8',
    );

    const images = await generateLayoutVisualizationAssets(projectRoot, bboxDir, '');

    assert.equal(images.length, 1);
    assert.equal(images[0].mimeType, 'image/svg+xml');
    assert.match(images[0].relativePath, /image_001_bbox_front_visual\.svg$/);
    assert.equal(images[0].metadata?.kind, 'layout_bbox');
    assert.equal(images[0].metadata?.detectionCount, 1);
    const svg = await readFile(path.join(projectRoot, images[0].relativePath), 'utf8');
    assert.match(svg, /assembly station/);
    assert.match(svg, /<rect x="100" y="200"/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('codex components-3d retry requires an applied layout source', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Components 3D Project',
    });
    const runtime = new CodexAgentRuntime(storage);

    await assert.rejects(
      () => runtime.handleStepAction({
        user: 'Demo User',
        projectId: project.id,
        sessionId: 'agent-session-1',
        stepKey: 'components-3d',
        action: 'retry',
        prompt: '生成一个车间流水线',
        selectedIndex: 0,
        images: [],
        sourceImages: [
          {
            id: 'main_image_001',
            sourceStepKey: 'main-image',
            relativePath: 'agent_history/assets/new_pipeline/project/run/main_images/image_001.png',
            mimeType: 'image/png',
            bytes: 1,
          },
        ],
      }),
      /layout is required for components-3d/,
    );
  } finally {
    await cleanup();
  }
});

test('components-3d MCP uses local demo GLB outputs instead of calling Hunyuan', async () => {
  const source = await readFile(
    new URL('../src/server/mcp/new-pipeline-components-3d-server.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /const DEFAULT_COMPONENTS_3D_DEMO_GLB_DIR = path\.join\(/);
  assert.match(source, /20260623_components-3d-existing-glb-demo/);
  assert.match(source, /process\.env\.VISIONARY_COMPONENTS_3D_DEMO_GLB_DIR \|\| DEFAULT_COMPONENTS_3D_DEMO_GLB_DIR/);
  assert.match(source, /const COMPONENTS_3D_DEMO_ASSET_COUNT = 7;/);
  assert.match(source, /async function collectDemoGlbFiles\(\)/);
  assert.match(source, /Array\.from\(\{ length: COMPONENTS_3D_DEMO_ASSET_COUNT \}/);
  assert.match(source, /const targetCount = COMPONENTS_3D_DEMO_ASSET_COUNT;/);
  assert.match(source, /'extract_single_object\.py'/);
  assert.match(source, /'render_front_candidates\.py'/);
  assert.match(source, /'select_front_with_vlm\.py'/);
  assert.match(source, /VISIONARY_COMPONENTS_3D_MOCK_VLM/);
  assert.match(source, /--mock-response/);
  assert.doesNotMatch(source, /VISIONARY_COMPONENTS_3D_REAL_VLM/);
  assert.match(source, /await writeMockHunyuanOutputs\(\{/);
  assert.match(source, /annotations: layoutAnnotations,/);
  assert.match(source, /await rm\(hunyuanDir, \{ recursive: true, force: true \}\);/);
  assert.match(source, /const demoGlbPaths = await collectDemoGlbFiles\(\);/);
  assert.match(source, /await copyFile\(demoGlbPath, modelPath\);/);
  assert.doesNotMatch(source, /'hunyuan3d\.py'/);
  assert.doesNotMatch(source, /isHunyuanDisabledError/);
  assert.match(source, /function selectedCandidateImage\(item: JsonRecord\)/);
  assert.match(source, /function isRasterImagePath\(filePath: string\): boolean/);
  assert.match(source, /const frontRendersDir = path\.join\(input\.outputRoot, 'front_renders'\);/);
  assert.match(source, /await mkdir\(frontRendersDir, \{ recursive: true \}\);/);
  assert.match(source, /item\.frontRenderPath && isRasterImagePath\(item\.frontRenderPath\) && await pathExists\(item\.frontRenderPath\)/);
  assert.match(source, /await runBlenderScript\(\[[\s\S]*render-glb-front-thumbnail\.py[\s\S]*--glb[\s\S]*--output/);
  assert.match(source, /const existingRelativePath = async \(filePath: string \| undefined\): Promise<string> => \{/);
  assert.match(source, /const sourceGlbPaths = \(await Promise\.all\([\s\S]*existingRelativePath\(modelPath\)/);
  assert.match(source, /const frontOrientationPath = await existingRelativePath\(item\.frontOrientationPath\);/);
  assert.match(source, /const candidateSheetPath = await existingRelativePath\(item\.candidateSheetPath\);/);
  assert.match(source, /metadata[\s\S]*thumbnailPath: frontRenderTarget \? toRelative\(input\.projectRoot, frontRenderTarget\) : ''/);
  assert.match(source, /metadata[\s\S]*frontRenderPath: frontRenderTarget \? toRelative\(input\.projectRoot, frontRenderTarget\) : ''/);
  assert.doesNotMatch(source, /sourceGlbPaths: item\.modelPaths\.map\(\(modelPath\) => toRelative\(input\.projectRoot, modelPath\)\)/);
  assert.doesNotMatch(source, /thumbnailPath: toRelative\(input\.projectRoot, previewTarget\)/);
  assert.doesNotMatch(source, /frontRenderPath: toRelative\(input\.projectRoot, previewTarget\)/);
  assert.match(source, /const previewPath = frontRenderPath \|\| objectPreviewPath \|\| candidateSheetPath;/);
});

test('components-3d retry replaces the previous asset gallery instead of appending', async () => {
  const source = await readFile(
    new URL('../src/server/codex-agent-runtime.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /const images = stepKey === 'components-3d'[\s\S]*\? nextImages[\s\S]*: \[\.\.\.currentImages, \.\.\.nextImages\];/);
});

test('codex insert-scene retry requires an applied components-3d source', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Insert Scene Project',
    });
    const runtime = new CodexAgentRuntime(storage);

    await assert.rejects(
      () => runtime.handleStepAction({
        user: 'Demo User',
        projectId: project.id,
        sessionId: 'agent-session-1',
        stepKey: 'insert-scene',
        action: 'retry',
        prompt: '生成一个车间流水线',
        selectedIndex: 0,
        images: [],
        sourceImages: [],
      }),
      /components-3d is required for insert-scene/,
    );
  } finally {
    await cleanup();
  }
});

test('insert-scene MCP returns a Visionary scene insert plan without creating a blend asset', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-insert-scene-'));
  try {
    const batchDir = path.join(projectRoot, 'agent_history', 'assets', 'new_pipeline', 'project', 'run', 'main_images');
    const bboxDir = path.join(batchDir, 'pipeline_output', 'bbox_front', 'image_001');
    const topViewDir = path.join(batchDir, 'pipeline_output', 'top_views');
    const hunyuanDir = path.join(batchDir, 'pipeline_output', 'hunyuan_outputs', 'image_001');
    await mkdir(bboxDir, { recursive: true });
    await mkdir(topViewDir, { recursive: true });
    await mkdir(hunyuanDir, { recursive: true });
    await writeFile(
      path.join(bboxDir, 'image_001_bbox_front.json'),
      JSON.stringify([
        {
          box_2d: [100, 200, 300, 500],
          front_point: [300, 350],
          label: 'workbench',
        },
      ]),
      'utf8',
    );
    await writeFile(
      path.join(topViewDir, 'image_001_top.png'),
      Buffer.from('89504e470d0a1a0a0000000000000000000003e8000003e8', 'hex'),
    );
    await writeFile(
      path.join(hunyuanDir, 'object_01_workbench_model.glb'),
      Buffer.from('676c544602000000140000000000000000000000', 'hex'),
    );
    await writeFile(
      path.join(hunyuanDir, 'front_orientation.json'),
      JSON.stringify({
        items: [
          {
            model_file: 'object_01_workbench_model.glb',
            bbox_index: 0,
            correction_yaw_deg: 90,
            status: 'selected',
          },
        ],
      }),
      'utf8',
    );

    const result = await generateInsertScene({
      projectRoot,
      projectId: 'project',
      components3DFrontOrientationPath: 'agent_history/assets/new_pipeline/project/run/main_images/pipeline_output/hunyuan_outputs/image_001/front_orientation.json',
      runLabel: 'insert-scene',
    });

    const plan = result.sceneInsertPlan as Record<string, unknown>;
    const items = Array.isArray(plan.items) ? plan.items as Array<Record<string, unknown>> : [];
    assert.equal(result.stage, 'insert_scene');
    assert.deepEqual(result.images, []);
    assert.equal(result.blendAsset, undefined);
    assert.equal(plan.schema, 'visionary.scene_insert_plan');
    assert.equal(items.length, 1);
    assert.equal(items[0].path, 'agent_history/assets/new_pipeline/project/run/main_images/pipeline_output/hunyuan_outputs/image_001/object_01_workbench_model.glb');
    assert.match(String(items[0].name), /\.glb$/);
    assert.equal((items[0].orientation as Record<string, unknown>).finalYawDeg, 90);
    assert.equal(plan.coordinateSystem, 'visionary_y_up_xz_ground');
    assert.deepEqual((items[0].transform as Record<string, unknown>).position, [-3, 0, 1.5]);
    assert.deepEqual((items[0].transform as Record<string, unknown>).rotationEulerRad, [0, Math.PI / 2, 0]);
    assert.deepEqual((items[0].transform as Record<string, unknown>).referenceSize, [2, 2, 3]);
    assert.equal((items[0].transform as Record<string, unknown>).scaleMode, 'xyz_min');
    await stat(path.join(projectRoot, String(plan.manifestPath)));
    await assert.rejects(
      () => stat(path.join(hunyuanDir, 'layout.blend')),
      /ENOENT/,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('new pipeline main image MCP contract requires raw user prompt passthrough', () => {
  const contractText = `${MAIN_IMAGE_TOOL_DESCRIPTION}\n${MAIN_IMAGE_PROMPT_DESCRIPTION}`;

  assert.match(contractText, /verbatim/);
  assert.match(contractText, /original language/);
  assert.match(contractText, /Do not translate/);
  assert.match(contractText, /Do not translate, rewrite, summarize, expand, or optimize/);
  assert.match(contractText, /new_pipeline owns all prompt rewriting/);
});

test('codex auth file copy is explicit opt-in for isolated debugging', async () => {
  const sourceCodexHome = await mkdtemp(path.join(tmpdir(), 'visionary-codex-source-'));
  const targetCodexHome = await mkdtemp(path.join(tmpdir(), 'visionary-codex-target-'));
  try {
    await mkdir(sourceCodexHome, { recursive: true });
    await writeFile(
      path.join(sourceCodexHome, 'auth.json'),
      JSON.stringify({ OPENAI_API_KEY: 'test-api-key' }),
      'utf8',
    );

    await prepareCodexHomeFromSource({
      codexHome: targetCodexHome,
      sourceCodexHome,
      env: { VISIONARY_CODEX_COPY_AUTH: '1' },
    });

    assert.deepEqual(
      JSON.parse(await readFile(path.join(targetCodexHome, 'auth.json'), 'utf8')),
      { OPENAI_API_KEY: 'test-api-key' },
    );
  } finally {
    await rm(sourceCodexHome, { recursive: true, force: true });
    await rm(targetCodexHome, { recursive: true, force: true });
  }
});

test('codex project auth file is preferred over source auth for child env', async () => {
  const sourceCodexHome = await mkdtemp(path.join(tmpdir(), 'visionary-codex-source-'));
  const targetCodexHome = await mkdtemp(path.join(tmpdir(), 'visionary-codex-target-'));
  try {
    await writeFile(
      path.join(sourceCodexHome, 'auth.json'),
      JSON.stringify({ OPENAI_API_KEY: 'source-api-key' }),
      'utf8',
    );
    await writeFile(
      path.join(targetCodexHome, 'auth.json'),
      JSON.stringify({ CODEX_API_KEY: 'project-api-key' }),
      'utf8',
    );

    const childEnv = await prepareCodexHomeFromSource({
      codexHome: targetCodexHome,
      sourceCodexHome,
      env: {},
    });

    assert.deepEqual(childEnv, { CODEX_API_KEY: 'project-api-key' });
  } finally {
    await rm(sourceCodexHome, { recursive: true, force: true });
    await rm(targetCodexHome, { recursive: true, force: true });
  }
});

test('codex exec args start and resume JSONL non-interactive sessions safely', () => {
  assert.deepEqual(
    buildCodexExecArgs({
      prompt: 'hello',
      sandbox: 'workspace-write',
    }),
    [
      '-a',
      'never',
      'exec',
      '--json',
      '--sandbox',
      'workspace-write',
      '--skip-git-repo-check',
      'hello',
    ],
  );

  assert.deepEqual(
    buildCodexExecArgs({
      prompt: 'continue',
      threadId: '0199-thread',
      sandbox: 'workspace-write',
    }),
    [
      '-a',
      'never',
      'exec',
      '--json',
      '--sandbox',
      'workspace-write',
      '--skip-git-repo-check',
      'resume',
      '0199-thread',
      'continue',
    ],
  );
});

test('codex JSONL parser extracts thread id and final assistant text', () => {
  const parsed = parseCodexExecJsonl([
    '{"type":"thread.started","thread_id":"0199a213"}',
    '{"type":"turn.started"}',
    '{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"Final answer"}}',
    '{"type":"turn.completed","usage":{"input_tokens":10}}',
  ].join('\n'));

  assert.equal(parsed.threadId, '0199a213');
  assert.equal(parsed.finalText, 'Final answer');
  assert.equal(parsed.events.length, 4);
});

test('codex JSONL parser extracts generated images from MCP tool results', () => {
  const toolResult = {
    ok: true,
    images: [
      {
        id: 'main_image_001',
        relativePath: 'agent_history/assets/new_pipeline/manual/run/main_images/image_001.png',
        mimeType: 'image/png',
        bytes: 1234,
      },
    ],
    visionaryTask: {
      title: '主图生成',
      message: '生成 1 张主图',
      progress: 1,
    },
  };
  const parsed = parseCodexExecJsonl([
    '{"type":"thread.started","thread_id":"0199a213"}',
    JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'mcp_tool_call_end',
        result: {
          Ok: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult),
              },
            ],
          },
        },
      },
    }),
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: '已生成 1 张主图。',
          },
        ],
      },
    }),
  ].join('\n'));

  assert.deepEqual(parsed.images, [
    {
      id: 'main_image_001',
      relativePath: 'agent_history/assets/new_pipeline/manual/run/main_images/image_001.png',
      mimeType: 'image/png',
      bytes: 1234,
    },
  ]);
});

test('codex task state is driven only by explicit task start and progress events', () => {
  assert.equal(extractCodexTaskState([
    { type: 'thread.started', thread_id: '0199a213' },
    { type: 'item.completed', item: { type: 'agent_message', text: 'Simple answer' } },
  ]).started, false);

  const task = extractCodexTaskState([
    {
      type: 'visionary.task.started',
      payload: {
        title: 'Codex generation',
        statusText: 'Starting',
      },
    },
    {
      type: 'item.completed',
      item: {
        type: 'mcp_tool_call',
        name: 'visionary_task_progress',
        arguments: JSON.stringify({
          progress: 0.42,
          message: 'Generating model',
        }),
      },
    },
  ]);

  assert.equal(task.started, true);
  assert.equal(task.title, 'Codex generation');
  assert.equal(task.progress, 0.42);
  assert.equal(task.statusText, 'Generating model');
  assert.equal(task.events.length, 2);
});

test('codex task state accepts visionaryTask embedded in MCP tool results', () => {
  const task = extractCodexTaskState([
    {
      type: 'item.completed',
      item: {
        type: 'mcp_tool_call',
        name: 'mcp__visionary_new_pipeline_main_image__generate_main_image',
        result: JSON.stringify({
          ok: true,
          visionaryTask: {
            title: '主图生成',
            message: '生成 1 张主图',
            progress: 1,
          },
        }),
      },
    },
  ]);

  assert.equal(task.started, true);
  assert.equal(task.title, '主图生成');
  assert.equal(task.statusText, '生成 1 张主图');
  assert.equal(task.progress, 1);
});

test('codex step apply action locks the selected main image without regenerating', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Step Action Project',
    });
    const runtime = new CodexAgentRuntime(storage);
    const result = await runtime.handleStepAction({
      user: 'Demo User',
      projectId: project.id,
      sessionId: 'agent-session-1',
      stepKey: 'main-image',
      action: 'apply',
      selectedIndex: 1,
      images: [
        {
          id: 'main_image_001',
          relativePath: 'agent_history/assets/new_pipeline/main/run-1.png',
          mimeType: 'image/png',
          bytes: 1,
        },
        {
          id: 'main_image_002',
          relativePath: 'agent_history/assets/new_pipeline/main/run-2.png',
          mimeType: 'image/png',
          bytes: 2,
        },
      ],
    });

    assert.equal(result.sessionId, 'agent-session-1');
    assert.equal(result.stepKey, 'main-image');
    assert.equal(result.action, 'apply');
    assert.equal(result.blockPatch.applied, true);
    assert.equal(result.blockPatch.selectedIndex, 1);
    assert.equal(result.blockPatch.images.length, 2);
    assert.deepEqual(result.blockPatch.actions, []);
    assert.equal(result.blockPatch.statusText, '');
    assert.deepEqual(result.stepState, {
      sessionId: 'agent-session-1',
      stepKey: 'main-image',
      images: result.blockPatch.images,
      selectedIndex: 1,
      applied: true,
      actions: [],
    });
  } finally {
    await cleanup();
  }
});

test('codex step cancel clears progress and only allows retry', async () => {
  const { storage, cleanup } = await createTempStorage();
  try {
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Cancel Step Project',
    });
    const runtime = new CodexAgentRuntime(storage);
    const result = await runtime.handleStepAction({
      user: 'Demo User',
      projectId: project.id,
      sessionId: 'agent-session-1',
      stepKey: 'components-3d',
      action: 'cancel',
      selectedIndex: 0,
      images: [
        {
          id: 'components_3d_001',
          relativePath: 'agent_history/assets/new_pipeline/components/run-1.png',
          mimeType: 'image/png',
          bytes: 1,
        },
      ],
    });

    assert.equal(result.action, 'cancel');
    assert.equal(result.blockPatch.applied, false);
    assert.equal(result.blockPatch.value, 0);
    assert.equal(result.blockPatch.indeterminate, false);
    assert.deepEqual(result.blockPatch.actions, ['retry']);
    assert.match(String(result.blockPatch.statusText), /已取消.*组件 3D 资产/);
    assert.deepEqual(result.stepState.actions, ['retry']);
  } finally {
    await cleanup();
  }
});
