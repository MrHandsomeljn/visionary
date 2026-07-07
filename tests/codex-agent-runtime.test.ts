import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
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
import { generateMainImage } from '../src/server/mcp/new-pipeline-main-image-server.ts';
import { generateInsertScene } from '../src/server/mcp/new-pipeline-insert-scene-server.ts';
import {
  assertTopViewImagesPresent,
  ensureTopViewPromptFileCompatibility,
} from '../src/server/mcp/new-pipeline-top-view-server.ts';
import {
  exportSceneInfo,
  generateCameraTrajectory,
  normalizeCameraTrajectoryPayload,
  normalizeTrajectoryLlmConfig,
  prepareCameraTrajectoryRender,
} from '../src/server/mcp/new-pipeline-camera-trajectory-server.ts';

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

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function createMockOpenAiServer(): Promise<{
  baseUrl: string;
  requests: string[];
  close: () => Promise<void>;
}> {
  const requests: string[] = [];
  const server = createServer(async (request, response) => {
    const body = await readRequestBody(request);
    requests.push(body);
    const payload = JSON.parse(body || '{}') as { messages?: Array<{ content?: unknown }> };
    const prompt = JSON.stringify(payload.messages?.[0]?.content || '');
    let content = JSON.stringify({
      camera_name: 'camera_001',
      keyframes: [
        { frame: 0, position: [3, 0, 2], rotation_quaternion: [1, 0, 0, 0] },
        { frame: 10, position: [2, 2, 2], rotation_quaternion: [0.923, 0, 0.382, 0] },
      ],
    });

    if (prompt.includes('important_names')) {
      content = JSON.stringify({ important_names: ['camera-test.glb'] });
    } else if (prompt.includes('scene_description') && prompt.includes('director_intents')) {
      content = JSON.stringify({
        scene_description: 'A compact test scene with one centered camera target.',
        important_objects: [
          {
            name: 'camera-test.glb',
            description: 'Primary object for the camera move.',
            position: 'center',
          },
        ],
        director_intents: [
          {
            segment_index: 1,
            intent: 'Start outside the object and move smoothly around it.',
          },
        ],
      });
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      id: 'chatcmpl-visionary-test',
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
    }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
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
    const cameraSkill = await readFile(path.join(env.codexHome, 'skills', 'camera-skill', 'SKILL.md'), 'utf8');

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
    assert.match(config, /\[mcp_servers\.visionary_new_pipeline_camera_trajectory\]/);
    assert.match(config, /new-pipeline-camera-trajectory-server\.ts/);
    assert.match(config, /default_tools_approval_mode = "approve"/);
    assert.match(config, /VISIONARY_PROJECT_ID = /);
    assert.match(config, /VISIONARY_PROJECT_ROOT = /);
    assert.match(config, /tool_timeout_sec = 900/);
    assert.match(config, /VISIONARY_NEW_PIPELINE_PYTHON = /);
    assert.match(config, /VISIONARY_TRAJECTORY_GEN_ROOT = /);
    assert.match(config, /GENAI_API_KEY = /);
    assert.match(config, /GENAI_API_BASE = /);
    assert.match(config, /LLM_API_PROVIDER = "gemini"/);
    assert.match(config, /LLM_MODEL_NAME = "gemini-3\.1-pro-preview"/);
    assert.match(sceneSkill, /name: scene-skill/);
    assert.match(sceneSkill, /prompt contains `\$scene-skill`/);
    assert.match(sceneSkill, /mcp__visionary_new_pipeline_main_image__generate_main_image/);
    assert.match(sceneSkill, /Remove the `\$scene-skill` routing token/);
    assert.match(sceneSkill, /Organize the remaining user request into a final image-generation prompt/);
    assert.match(config, /GEMINI_IMAGE_URL = /);
    assert.match(cameraSkill, /name: camera-skill/);
    assert.match(cameraSkill, /prompt contains `\$camera-skill`/);
    assert.match(cameraSkill, /mcp__visionary_new_pipeline_camera_trajectory__export_scene_info/);
    assert.match(cameraSkill, /mcp__visionary_new_pipeline_camera_trajectory__generate_camera_trajectory/);
    assert.match(cameraSkill, /After `generate_camera_trajectory` returns, stop tool work/);
    assert.match(cameraSkill, /the host editor will render the requested views/);
    assert.match(cameraSkill, /Do not call `mcp__visionary_new_pipeline_camera_trajectory__apply_camera_trajectory`/);
    assert.match(cameraSkill, /reversible preview/);
    assert.match(cameraSkill, /Parse structured trajectory parameters from the user request only when the user explicitly provides them/);
    assert.match(cameraSkill, /Do not hide numeric control values inside `humanText`; pass them as MCP arguments/);
    assert.match(cameraSkill, /`segmentCount`[\s\S]*Default `1`/);
    assert.match(cameraSkill, /`segmentDuration`[\s\S]*Default `3`/);
    assert.match(cameraSkill, /`fps`[\s\S]*Default `30`/);
    assert.match(cameraSkill, /`keyframeInterval`[\s\S]*Default `5`/);
    assert.match(cameraSkill, /`firstFrameOnly`[\s\S]*Default `false`/);
    assert.match(cameraSkill, /`sceneBoundsScale`[\s\S]*Default `3`/);
    const cameraMcpServer = await readFile(new URL('../src/server/mcp/new-pipeline-camera-trajectory-server.ts', import.meta.url), 'utf8');
    assert.match(cameraMcpServer, /humanText: z\.string\(\)\.default\(''\)/);
    assert.match(cameraMcpServer, /segmentCount: z\.number\(\)\.int\(\)\.min\(1\)\.max\(24\)\.default\(1\)/);
    assert.match(cameraMcpServer, /segmentDuration: z\.number\(\)\.int\(\)\.min\(1\)\.max\(120\)\.default\(3\)/);
    assert.match(cameraMcpServer, /fps: z\.number\(\)\.int\(\)\.min\(1\)\.max\(240\)\.default\(30\)/);
    assert.match(cameraMcpServer, /keyframeInterval: z\.number\(\)\.int\(\)\.min\(1\)\.max\(1000\)\.default\(5\)/);
    assert.match(cameraMcpServer, /firstFrameOnly: z\.boolean\(\)\.default\(false\)/);
    assert.match(cameraMcpServer, /sceneBoundsScale: z\.number\(\)\.min\(0\.1\)\.max\(20\)\.default\(3\)/);
    assert.match(cameraMcpServer, /const CAMERA_PIPELINE_STAGES = \[[\s\S]*'camera_scene_info_export'[\s\S]*'camera_trajectory_eval_render'[\s\S]*\]/);
    assert.doesNotMatch(cameraMcpServer, /server\.registerTool\(\s*'apply_camera_trajectory'/);
    assert.match(cameraMcpServer, /pipelineStages: CAMERA_PIPELINE_STAGES/);

    const trajectoryGenConfig = await readFile(new URL('../../third-party/Trajectory_gen/config/config.json', import.meta.url), 'utf8');
    const trajectoryGenMain = await readFile(new URL('../../third-party/Trajectory_gen/pipeline/main.py', import.meta.url), 'utf8');
    assert.match(trajectoryGenConfig, /"segment_count": 1/);
    assert.match(trajectoryGenConfig, /"segment_duration": 5/);
    assert.match(trajectoryGenConfig, /"fps": 30/);
    assert.match(trajectoryGenConfig, /"keyframe_interval": 10/);
    assert.match(trajectoryGenConfig, /"max_optimization_rounds": 2/);
    assert.match(trajectoryGenConfig, /"first_frame_only": false/);
    assert.match(trajectoryGenMain, /config\.get\("segment_duration", 3\)/);
    assert.match(trajectoryGenMain, /config\.get\("keyframe_interval", 5\)/);
    assert.match(trajectoryGenMain, /config\.get\("max_optimization_rounds", 3\)/);
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

test('camera trajectory MCP exports Visionary scene assets as Trajectory_gen scene info', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-camera-scene-info-'));
  try {
    await writeFile(
      path.join(projectRoot, 'scene.json'),
      JSON.stringify({
        version: 2,
        assets: [
          {
            name: 'assembly-arm.glb',
            type: 'glb',
            path: 'assets/assembly-arm.glb',
            visible: true,
            transform: {
              position: [2, 3, 4],
              rotationEulerRad: [0, 0, 0],
              scale: [2, 1, 1],
              referenceSize: [4, 2, 1],
            },
          },
        ],
      }),
      'utf8',
    );

    const result = await exportSceneInfo({
      projectRoot,
      projectId: 'camera-project',
      runLabel: 'camera-scene-info',
      sceneBoundsScale: 2,
    });

    assert.equal(result.ok, true);
    const sceneInfo = result.sceneInfo as { data?: Record<string, unknown>; directory?: string };
    assert.match(String(sceneInfo.directory || ''), /scene_info$/);
    const data = sceneInfo.data as Record<string, unknown>;
    const objects = data.objects_info as Array<Record<string, unknown>>;
    assert.equal(objects.length, 1);
    assert.equal(objects[0].name, 'assembly-arm.glb');
    assert.deepEqual(objects[0].world_bbox_min, [-2, 2, 3.5]);
    assert.deepEqual(objects[0].world_bbox_max, [6, 4, 4.5]);
    assert.deepEqual(objects[0].location, [2, 3, 4]);
    assert.equal(objects[0].coordinate_system, 'visionary_y_up_xz_ground');
    assert.equal(objects[0].bbox_source, 'transform.referenceSize');
    const fullInfoPath = path.join(projectRoot, String((result.files as Array<{ relativePath: string }>)[0].relativePath));
    const fullInfo = JSON.parse(await readFile(fullInfoPath, 'utf8'));
    assert.equal(fullInfo.objects_info[0].name, 'assembly-arm.glb');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('camera trajectory MCP prefers saved world bbox center over asset transform origin', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-camera-scene-bbox-'));
  try {
    await writeFile(
      path.join(projectRoot, 'scene.json'),
      JSON.stringify({
        version: 2,
        assets: [
          {
            name: 'offset-hull.glb',
            type: 'glb',
            path: 'assets/offset-hull.glb',
            visible: true,
            transform: {
              position: [0, 0, 0],
              rotationEulerRad: [0, 0, 0],
              scale: [1, 1, 1],
              referenceSize: [1, 1, 1],
            },
            extras: {
              visionarySceneInfo: {
                world_bbox_min: [10, -1, -2],
                world_bbox_max: [14, 3, 2],
              },
            },
          },
        ],
      }),
      'utf8',
    );

    const result = await exportSceneInfo({
      projectRoot,
      projectId: 'camera-project',
      runLabel: 'camera-scene-info',
      sceneBoundsScale: 1,
    });

    const data = (result.sceneInfo as { data?: Record<string, unknown> }).data as Record<string, unknown>;
    const objects = data.objects_info as Array<Record<string, unknown>>;
    assert.deepEqual(objects[0].world_bbox_min, [10, -1, -2]);
    assert.deepEqual(objects[0].world_bbox_max, [14, 3, 2]);
    assert.deepEqual(objects[0].location, [12, 1, 0]);
    assert.deepEqual(objects[0].transform_location, [0, 0, 0]);
    assert.equal(objects[0].bbox_source, 'extras.visionarySceneInfo.world_bbox');
    assert.deepEqual((data.scene_info as Record<string, unknown>).center_xyz, [12, 1, 0]);
    assert.equal((data.scene_info as Record<string, unknown>).coordinate_system, 'visionary_y_up_xz_ground');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('camera trajectory MCP prepares Gemini/apiyi LLM config from Trajectory_gen defaults', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-camera-generate-'));
  const apiKeyEnvNames = [
    'GENAI_API_KEY',
    'GOOGLE_API_KEY',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'CODEX_API_KEY',
  ];
  const previousEnv = new Map(apiKeyEnvNames.map((name) => [name, process.env[name]]));

  try {
    for (const name of apiKeyEnvNames) {
      delete process.env[name];
    }
    await writeFile(
      path.join(projectRoot, 'scene.json'),
      JSON.stringify({
        version: 2,
        assets: [
          {
            name: 'camera-test.glb',
            type: 'glb',
            path: 'assets/camera-test.glb',
            visible: true,
            transform: {
              position: [0, 0, 0],
              rotationEulerRad: [0, 0, 0],
              scale: [1, 1, 1],
              referenceSize: [2, 2, 2],
            },
          },
        ],
      }),
      'utf8',
    );

    await prepareCameraTrajectoryRender({
      projectRoot,
      projectId: 'camera-project',
      runLabel: 'camera-generate',
      humanText: 'orbit around the camera-test object',
      segmentCount: 1,
      segmentDuration: 1,
      fps: 30,
      keyframeInterval: 10,
      firstFrameOnly: false,
      modelName: 'gpt-4o',
      sceneBoundsScale: 2,
    });

    const runsRoot = path.join(projectRoot, 'agent_history', 'assets', 'new_pipeline', 'camera-project');
    const runDirs = await readdir(runsRoot);
    assert.equal(runDirs.length, 1);
    const configPath = path.join(runsRoot, runDirs[0], 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    assert.equal(Boolean(config.api_key), true);
    assert.equal(config.api_base, 'https://api.apiyi.com');
    assert.equal(config.api_provider, 'gemini');
    assert.equal(config.model_name, 'gemini-3.1-pro-preview');
    const cameraInitPath = path.join(runsRoot, runDirs[0], 'data', 'camera_init', 'camera-project', 'camera_init.json');
    const cameraInit = JSON.parse(await readFile(cameraInitPath, 'utf8'));
    assert.equal(cameraInit.cameras.length, 3);
    assert.equal(cameraInit.cameras[0].name, 'camera_001');
  } finally {
    for (const [name, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('camera trajectory MCP backfills missing run LLM config from Trajectory_gen defaults', () => {
  const config = normalizeTrajectoryLlmConfig({
    human_text: 'orbit around the base',
    api_key: '',
    model_name: 'gpt-4o',
  });

  assert.equal(Boolean(config.api_key), true);
  assert.equal(config.api_base, 'https://api.apiyi.com');
  assert.equal(config.api_provider, 'gemini');
  assert.equal(config.model_name, 'gemini-3.1-pro-preview');
});

test('camera trajectory MCP ignores Codex LLM overrides by default', () => {
  const previousAllowOverride = process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousCodexKey = process.env.CODEX_API_KEY;
  try {
    delete process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE;
    process.env.OPENAI_API_KEY = 'sk-codex-openai-key';
    process.env.CODEX_API_KEY = 'sk-codex-api-key';
    const config = normalizeTrajectoryLlmConfig({
      human_text: 'orbit around the base',
      api_key: 'sk-codex-tool-override',
      api_base: 'https://api.apiyi.com',
      api_provider: 'gpt',
      model_name: 'gpt-4o',
    });

    assert.equal(String(config.api_key).startsWith('sk-uv5c'), true);
    assert.equal(config.api_base, 'https://api.apiyi.com');
    assert.equal(config.api_provider, 'gemini');
    assert.equal(config.model_name, 'gemini-3.1-pro-preview');
  } finally {
    if (previousAllowOverride === undefined) {
      delete process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE;
    } else {
      process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE = previousAllowOverride;
    }
    if (previousOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
    if (previousCodexKey === undefined) {
      delete process.env.CODEX_API_KEY;
    } else {
      process.env.CODEX_API_KEY = previousCodexKey;
    }
  }
});

test('camera trajectory MCP prepares render requests without continuing past host render', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-camera-e2e-'));
  const llmServer = await createMockOpenAiServer();
  const previousAllowOverride = process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE;
  try {
    process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE = '1';
    await writeFile(
      path.join(projectRoot, 'scene.json'),
      JSON.stringify({
        version: 2,
        assets: [
          {
            name: 'camera-test.glb',
            type: 'glb',
            path: 'assets/camera-test.glb',
            visible: true,
            transform: {
              position: [0, 0, 0],
              rotationEulerRad: [0, 0, 0],
              scale: [1, 1, 1],
              referenceSize: [2, 2, 2],
            },
          },
        ],
      }),
      'utf8',
    );

    const sceneInfoResult = await exportSceneInfo({
      projectRoot,
      projectId: 'camera-project',
      runLabel: 'camera-e2e-scene-info',
      sceneBoundsScale: 2,
    });
    const sceneInfo = sceneInfoResult.sceneInfo as { directory: string };

    const generated = await generateCameraTrajectory({
      projectRoot,
      projectId: 'camera-project',
      sceneInfoPath: sceneInfo.directory,
      humanText: 'orbit around the camera-test object',
      segmentCount: 1,
      segmentDuration: 1,
      fps: 10,
      keyframeInterval: 10,
      firstFrameOnly: false,
      runLabel: 'camera-e2e-generate',
      apiKey: 'test-key',
      apiProvider: 'openai',
      apiBase: llmServer.baseUrl,
      modelName: 'gpt-test',
      sceneBoundsScale: 2,
    });

    assert.equal(generated.ok, true);
    assert.equal(generated.needsRender, true);
    assert.equal(generated.stage, 'camera_initial_view_prepare');
    assert.equal((generated.visionaryTask as Record<string, unknown>).stage, 'camera_initial_view_prepare');
    assert.equal((generated.visionaryTask as Record<string, unknown>).statusId, 'rendering');
    assert.ok(Array.isArray(generated.renderRequests));
    assert.ok((generated.renderRequests as unknown[]).length > 0);
    assert.ok(llmServer.requests.length <= 1);
    const scene = JSON.parse(await readFile(path.join(projectRoot, 'scene.json'), 'utf8'));
    assert.equal(scene.timeline, undefined);
  } finally {
    if (previousAllowOverride === undefined) {
      delete process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE;
    } else {
      process.env.VISIONARY_TRAJECTORY_ALLOW_LLM_OVERRIDE = previousAllowOverride;
    }
    await llmServer.close();
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('camera trajectory normalization stitches matching segment boundary keyframes', () => {
  const normalized = normalizeCameraTrajectoryPayload({
    cameras: [
      {
        camera_name: 'camera_001',
        keyframes: [
          { frame: 0, position: [0, 2, 6], rotation_quaternion: [1, 0, 0, 0] },
          { frame: 90, position: [1, 2, 5], rotation_quaternion: [0.9239, 0, 0.3827, 0] },
        ],
      },
      {
        camera_name: 'camera_002',
        keyframes: [
          { frame: 0, position: [1, 2, 5], rotation_quaternion: [0.9239, 0, 0.3827, 0] },
          { frame: 30, position: [2, 2, 4], rotation_quaternion: [0.7071, 0, 0.7071, 0] },
        ],
      },
    ],
  }, {
    runId: 'stitch-test',
    fps: 30,
    segmentDuration: 3,
    segmentCount: 2,
    keyframeInterval: 30,
    firstFrameOnly: false,
    cameraInit: {
      cameras: [
        { name: 'camera_001', fov: 55 },
        { name: 'camera_002', fov: 55 },
      ],
    },
  });
  const timeline = normalized.timeline as Record<string, unknown>;
  const keyframes = timeline.keyframes as Array<Record<string, unknown>>;
  const fovKeyframes = timeline.fovKeyframes as Array<Record<string, unknown>>;
  const stitching = timeline.stitching as Record<string, unknown>;
  const dropped = stitching.droppedBoundaryKeyframes as Array<Record<string, unknown>>;

  assert.deepEqual(keyframes.map((keyframe) => keyframe.frame), [0, 90, 120]);
  assert.deepEqual(fovKeyframes.map((keyframe) => keyframe.frame), [0, 90, 120]);
  assert.equal(keyframes.filter((keyframe) => keyframe.frame === 90).length, 1);
  assert.equal(keyframes.find((keyframe) => keyframe.frame === 90)?.cameraName, 'camera_001');
  assert.equal(stitching.policy, 'continuous-single-pose-per-frame');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].action, 'dropped_duplicate_segment_start');
  assert.equal(dropped[0].frame, 90);
  assert.equal(dropped[0].previousCameraName, 'camera_001');
  assert.equal(dropped[0].nextCameraName, 'camera_002');
});

test('camera trajectory normalization rejects discontinuous same-frame segment boundaries', () => {
  assert.throws(
    () => normalizeCameraTrajectoryPayload({
      cameras: [
        {
          camera_name: 'camera_001',
          keyframes: [
            { frame: 0, position: [0, 2, 6], rotation_quaternion: [1, 0, 0, 0] },
            { frame: 90, position: [1, 2, 5], rotation_quaternion: [0.9239, 0, 0.3827, 0] },
          ],
        },
        {
          camera_name: 'camera_002',
          keyframes: [
            { frame: 0, position: [4, 2, 5], rotation_quaternion: [0.9239, 0, 0.3827, 0] },
            { frame: 30, position: [5, 2, 4], rotation_quaternion: [0.7071, 0, 0.7071, 0] },
          ],
        },
      ],
    }, {
      runId: 'stitch-reject-test',
      fps: 30,
      segmentDuration: 3,
      segmentCount: 2,
      keyframeInterval: 30,
      firstFrameOnly: false,
      cameraInit: {
        cameras: [
          { name: 'camera_001', fov: 55 },
          { name: 'camera_002', fov: 55 },
        ],
      },
    }),
    /Camera trajectory boundary discontinuity at frame 90[\s\S]*position 3/,
  );
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

test('top-view MCP creates third-party compatible prompt aliases for legacy main-image batches', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-top-view-prompt-alias-'));
  try {
    const batchDir = path.join(projectRoot, 'agent_history', 'assets', 'new_pipeline', 'project', 'run-main', 'main_images');
    await mkdir(batchDir, { recursive: true });
    const imagePath = path.join(batchDir, 'image_001.jpg');
    await writeFile(imagePath, 'fake-jpg');
    await writeFile(path.join(batchDir, 'image_001_prompt.txt'), 'organized prompt', 'utf8');

    const result = await ensureTopViewPromptFileCompatibility(projectRoot, imagePath);

    assert.equal(result?.created, true);
    assert.equal(result?.promptPath, 'agent_history/assets/new_pipeline/project/run-main/main_images/image_001.txt');
    assert.equal(await readFile(path.join(batchDir, 'image_001.txt'), 'utf8'), 'organized prompt');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('top-view MCP rejects successful script runs with zero generated images', () => {
  assert.throws(
    () => assertTopViewImagesPresent([], {
      total: 1,
      success: 0,
      skipped: 1,
      failed: 0,
      results: [
        {
          index: 1,
          success: false,
          skipped: true,
          skip_reason: 'missing_prompt_file',
        },
      ],
    }),
    /俯视图生成未返回图片.*missing_prompt_file:1/,
  );
});

test('codex runtime rejects empty non-insert scene stage results instead of marking them done', async () => {
  const source = await readFile(new URL('../src/server/codex-agent-runtime.ts', import.meta.url), 'utf8');
  assert.match(source, /const taskStatusId = normalizeTaskStatusId\(taskPayload\.statusId \|\| taskPayload\.statusKey \|\| taskPayload\.state\);/);
  assert.match(source, /if \(taskStatusId === 'failed'\) \{[\s\S]*throw new ProjectStorageError\('BAD_REQUEST'/);
  assert.match(source, /if \(stepKey !== 'insert-scene' && images\.length <= 0\) \{[\s\S]*throw new ProjectStorageError\('BAD_REQUEST'/);
  assert.match(source, /\['running', 'rendering', 'done', 'skipped', 'canceled', 'pending', 'failed'\]/);
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
    assert.equal(images[0].metadata?.detectionCount, 9);
    assert.equal(images[0].metadata?.actualDetectionCount, 1);
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
  assert.match(source, /assets[\s\S]*mock-components-3d[\s\S]*moon-visionary-workspace/);
  assert.match(source, /moon-visionary-workspace/);
  assert.match(source, /process\.env\.VISIONARY_COMPONENTS_3D_DEMO_GLB_DIR \|\| DEFAULT_COMPONENTS_3D_DEMO_GLB_DIR/);
  assert.match(source, /const COMPONENTS_3D_DEMO_ASSET_COUNT = 9;/);
  assert.match(source, /async function collectDemoGlbFiles\(\)/);
  assert.match(source, /const targetCount = COMPONENTS_3D_DEMO_ASSET_COUNT;/);
  assert.match(source, /for \(let index = 0; index < COMPONENTS_3D_DEMO_ASSET_COUNT; index \+= 1\)/);
  assert.match(source, /demoGlbPaths\[index % demoGlbPaths\.length\]/);
  assert.doesNotMatch(source, /await ensureObjectListAndSingleObjects\(\{/);
  assert.match(source, /'extract_single_object\.py'/);
  assert.match(source, /placement_mode: input\.embeddedPlacement \? 'glb_embedded_transform' : 'layout_bbox'/);
  assert.match(source, /Using embedded transforms from \$\{COMPONENTS_3D_DEMO_GLB_DIR\}; layout placement is skipped\./);
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
  assert.match(source, /async function writeCanonicalProjectAssetFromFile\(input: \{/);
  assert.match(source, /const relativePath = `assets\/\$\{hash\}\$\{extension\}`;/);
  assert.match(source, /stage: 'components-3d'/);
  assert.match(source, /const canonicalModelReferences: CanonicalAssetReference\[\] = \[\];/);
  assert.match(source, /const canonicalAssetReference = await writeCanonicalProjectAssetFromFile\(\{/);
  assert.match(source, /copiedModelPaths\.push\(canonicalAssetReference\.path\);/);
  assert.match(source, /item\.frontRenderPath && isRasterImagePath\(item\.frontRenderPath\) && await pathExists\(item\.frontRenderPath\)/);
  assert.match(source, /VISIONARY_BLENDER_TIMEOUT_MS \|\| 15000/);
  assert.match(source, /Blender script timed out after \$\{timeoutMs\}ms/);
  assert.match(source, /async function writeGradientThumbnailSvg/);
  assert.match(source, /renderFrontThumbnails\?: boolean;/);
  assert.match(source, /renderFrontThumbnails: process\.env\.VISIONARY_COMPONENTS_3D_RENDER_FRONT_THUMBNAILS === '1'/);
  assert.match(source, /if \(input\.renderFrontThumbnails\) \{/);
  assert.match(source, /await runBlenderScript\(\[[\s\S]*render-glb-front-thumbnail\.py[\s\S]*--glb[\s\S]*--output/);
  assert.match(source, /frontRenderTarget = path\.join\(frontRendersDir, `\$\{itemSlug\}-front\.svg`\);/);
  assert.match(source, /input\.onProgress\?\.\(assets, index \+ 1, input\.items\.length\);/);
  assert.match(source, /images: completedImages/);
  assert.match(source, /const existingRelativePath = async \(filePath: string \| undefined\): Promise<string> => \{/);
  assert.match(source, /const sourceGlbPaths = \(await Promise\.all\([\s\S]*existingRelativePath\(modelPath\)/);
  assert.match(source, /metadata[\s\S]*glbPaths: copiedModelPaths/);
  assert.match(source, /metadata[\s\S]*canonicalAssetReferences: canonicalModelReferences/);
  assert.match(source, /metadata[\s\S]*assetReferences: canonicalModelReferences/);
  assert.match(source, /const frontOrientationPath = await existingRelativePath\(item\.frontOrientationPath\);/);
  assert.match(source, /const candidateSheetPath = await existingRelativePath\(item\.candidateSheetPath\);/);
  assert.match(source, /metadata[\s\S]*thumbnailPath: frontRenderTarget \? toRelative\(input\.projectRoot, frontRenderTarget\) : ''/);
  assert.match(source, /metadata[\s\S]*frontRenderPath: frontRenderTarget \? toRelative\(input\.projectRoot, frontRenderTarget\) : ''/);
  assert.doesNotMatch(source, /sourceGlbPaths: item\.modelPaths\.map\(\(modelPath\) => toRelative\(input\.projectRoot, modelPath\)\)/);
  assert.doesNotMatch(source, /thumbnailPath: toRelative\(input\.projectRoot, previewTarget\)/);
  assert.doesNotMatch(source, /frontRenderPath: toRelative\(input\.projectRoot, previewTarget\)/);
  assert.match(source, /const previewPath = frontRenderPath \|\| objectPreviewPath \|\| candidateSheetPath;/);
});

test('scene step retry replaces the current stage gallery instead of appending', async () => {
  const source = await readFile(
    new URL('../src/server/codex-agent-runtime.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /const images = nextImages;/);
  assert.doesNotMatch(source, /\[\.\.\.currentImages, \.\.\.nextImages\]/);
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

test('insert-scene MCP uses embedded GLB transforms without layout placement', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-insert-embedded-'));
  try {
    const hunyuanDir = path.join(
      projectRoot,
      'agent_history',
      'assets',
      'new_pipeline',
      'project',
      'run',
      'main_images',
      'pipeline_output',
      'hunyuan_outputs',
      'image_001',
    );
    await mkdir(hunyuanDir, { recursive: true });
    await writeFile(
      path.join(hunyuanDir, 'embedded_component.glb'),
      Buffer.from('676c544602000000140000000000000000000000', 'hex'),
    );
    await writeFile(
      path.join(hunyuanDir, 'front_orientation.json'),
      JSON.stringify({
        placement_mode: 'glb_embedded_transform',
        items: [
          {
            model_file: 'embedded_component.glb',
            placement_mode: 'glb_embedded_transform',
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
    assert.equal(plan.placementMode, 'glb_embedded_transform');
    assert.equal(plan.scaleMode, 'embedded');
    assert.equal(items.length, 1);
    assert.equal(items[0].path, 'agent_history/assets/new_pipeline/project/run/main_images/pipeline_output/hunyuan_outputs/image_001/embedded_component.glb');
    assert.equal(((items[0].source as Record<string, unknown>) || {}).placementMode, 'glb_embedded_transform');
    assert.deepEqual((items[0].transform as Record<string, unknown>).position, [0, 0, 0]);
    assert.deepEqual((items[0].transform as Record<string, unknown>).rotationEulerRad, [0, 0, 0]);
    assert.deepEqual((items[0].transform as Record<string, unknown>).scale, [1, 1, 1]);
    assert.equal((items[0].transform as Record<string, unknown>).scaleMode, 'embedded');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('insert-scene MCP prefers canonical component GLB paths when provided', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-insert-canonical-'));
  try {
    const sourceRelativePath = 'agent_history/assets/new_pipeline/project/run/main_images/pipeline_output/hunyuan_outputs/image_001/embedded_component.glb';
    const canonicalRelativePath = `assets/${'a'.repeat(64)}.glb`;
    const sourcePath = path.join(projectRoot, ...sourceRelativePath.split('/'));
    const canonicalPath = path.join(projectRoot, ...canonicalRelativePath.split('/'));
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await mkdir(path.dirname(canonicalPath), { recursive: true });
    await writeFile(sourcePath, Buffer.from('676c544602000000140000000000000000000000', 'hex'));
    await writeFile(canonicalPath, Buffer.from('676c544602000000140000000000000000000000', 'hex'));
    await writeFile(
      path.join(path.dirname(sourcePath), 'front_orientation.json'),
      JSON.stringify({
        placement_mode: 'glb_embedded_transform',
        items: [
          {
            model_file: 'embedded_component.glb',
            placement_mode: 'glb_embedded_transform',
          },
        ],
      }),
      'utf8',
    );

    const result = await generateInsertScene({
      projectRoot,
      projectId: 'project',
      components3DFrontOrientationPath: 'agent_history/assets/new_pipeline/project/run/main_images/pipeline_output/hunyuan_outputs/image_001/front_orientation.json',
      components3DModelPaths: [{
        sourcePath: sourceRelativePath,
        path: canonicalRelativePath,
      }],
      runLabel: 'insert-scene',
    });

    const plan = result.sceneInsertPlan as Record<string, unknown>;
    const items = Array.isArray(plan.items) ? plan.items as Array<Record<string, unknown>> : [];
    const source = (items[0]?.source as Record<string, unknown>) || {};
    assert.equal(items.length, 1);
    assert.equal(items[0].path, canonicalRelativePath);
    assert.equal(items[0].modelPath, canonicalRelativePath);
    assert.equal(source.glbPath, sourceRelativePath);
    assert.equal(source.canonicalGlbPath, canonicalRelativePath);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('new pipeline main image MCP contract requires organized final prompt input', () => {
  const contractText = `${MAIN_IMAGE_TOOL_DESCRIPTION}\n${MAIN_IMAGE_PROMPT_DESCRIPTION}`;

  assert.match(contractText, /organized final image-generation prompt/i);
  assert.match(contractText, /apiyi Gemini Image \/ Nano Banana/);
  assert.match(contractText, /does not expand the prompt/);
  assert.doesNotMatch(contractText, /verbatim/);
  assert.doesNotMatch(contractText, /new_pipeline owns all prompt rewriting/);
});

test('main-image MCP requires explicit endpoint and API key configuration', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-main-image-config-'));
  const envNames = [
    'GEMINI_IMAGE_URL',
    'VISIONARY_GEMINI_IMAGE_URL',
    'GENAI_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
  ];
  const previousEnv = new Map(envNames.map((name) => [name, process.env[name]]));
  try {
    for (const name of envNames) {
      delete process.env[name];
    }
    await assert.rejects(
      () => generateMainImage({
        projectRoot,
        projectId: 'project',
        prompt: 'organized final image prompt',
        draws: 1,
        runLabel: 'main-image',
      }),
      /GEMINI_IMAGE_URL or VISIONARY_GEMINI_IMAGE_URL is required/,
    );

    process.env.GEMINI_IMAGE_URL = 'https://example.invalid/v1beta/models/test:generateContent';
    await assert.rejects(
      () => generateMainImage({
        projectRoot,
        projectId: 'project',
        prompt: 'organized final image prompt',
        draws: 1,
        runLabel: 'main-image',
      }),
      /GENAI_API_KEY or GEMINI_API_KEY is required/,
    );
  } finally {
    for (const [name, value] of previousEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('scene-build MCP task payloads carry explicit simple status ids', async () => {
  const serverPaths = [
    '../src/server/mcp/new-pipeline-main-image-server.ts',
    '../src/server/mcp/new-pipeline-top-view-server.ts',
    '../src/server/mcp/new-pipeline-layout-server.ts',
    '../src/server/mcp/new-pipeline-components-3d-server.ts',
    '../src/server/mcp/new-pipeline-insert-scene-server.ts',
  ];

  for (const serverPath of serverPaths) {
    const source = await readFile(new URL(serverPath, import.meta.url), 'utf8');
    assert.match(source, /const statusId = progress >= 1 \? 'done' : 'running';/);
    assert.match(source, /payload: \{[\s\S]*title,[\s\S]*message,[\s\S]*progress,[\s\S]*statusId,/);
    assert.match(source, /visionaryTask: \{[\s\S]*progress: 1,[\s\S]*statusId: 'done'/);
    assert.match(source, /visionaryTask: \{[\s\S]*message,[\s\S]*progress: 1,[\s\S]*statusId: 'failed'/);
    assert.doesNotMatch(source, /statusId: 'rendering'/);
    assert.doesNotMatch(source, /statusId: 'skipped'/);
  }
});

test('main-image MCP persists generated image assets with prompt provider and dependency metadata', async () => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'visionary-main-image-success-'));
  const envNames = [
    'GEMINI_IMAGE_URL',
    'VISIONARY_GEMINI_IMAGE_URL',
    'GENAI_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GEMINI_IMAGE_MODEL',
  ];
  const previousEnv = new Map(envNames.map((name) => [name, process.env[name]]));
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; auth: string; body: Record<string, unknown> }> = [];
  try {
    for (const name of envNames) {
      delete process.env[name];
    }
    process.env.GEMINI_IMAGE_URL = 'https://example.test/v1beta/models/test-image:generateContent';
    process.env.GENAI_API_KEY = 'test-image-key';
    process.env.GEMINI_IMAGE_MODEL = 'test-image-model';
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [url, init] = args;
      requests.push({
        url: String(url),
        auth: String(new Headers(init?.headers).get('authorization') || ''),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: Buffer.from('fake-png').toString('base64'),
                  },
                },
              ],
            },
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const result = await generateMainImage({
      projectRoot,
      projectId: 'project',
      prompt: 'organized final image prompt',
      draws: 1,
      runLabel: 'main-image',
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, 'https://example.test/v1beta/models/test-image:generateContent');
    assert.equal(requests[0]?.auth, 'Bearer test-image-key');
    assert.match(JSON.stringify(requests[0]?.body), /organized final image prompt/);
    assert.equal(result.stage, 'main_image_generation');
    assert.equal((result.provider as Record<string, unknown>).provider, 'apiyi');
    assert.equal((result.provider as Record<string, unknown>).model, 'test-image-model');
    assert.equal((result.provider as Record<string, unknown>).endpoint, 'https://example.test/v1beta/models/test-image:generateContent');
    assert.match(String((result.promptOutput as Record<string, unknown>).relativePath), /final_image_prompt\.txt$/);

    const images = result.images as Array<Record<string, unknown>>;
    assert.equal(images.length, 1);
    assert.match(String(images[0]?.relativePath), /main_images\/image_001\.png$/);
    assert.equal(images[0]?.mimeType, 'image/png');
    const imageMetadata = images[0]?.metadata as Record<string, unknown>;
    const canonicalAssetReference = imageMetadata.canonicalAssetReference as Record<string, unknown>;
    assert.match(String(canonicalAssetReference.path), /^assets\/[a-f0-9]{64}\.png$/);
    assert.equal(canonicalAssetReference.assetId, `sha256:${canonicalAssetReference.hash}`);
    assert.equal(canonicalAssetReference.kind, 'image');
    assert.equal(canonicalAssetReference.mimeType, 'image/png');
    assert.equal(canonicalAssetReference.bytes, Buffer.byteLength('fake-png'));
    assert.deepEqual(imageMetadata.assetReferences, [canonicalAssetReference]);
    await stat(path.join(projectRoot, String(canonicalAssetReference.path)));

    const dependencyTree = (result.dependencyTree as Record<string, unknown>).data as Record<string, unknown>;
    const nodes = dependencyTree.nodes as Array<Record<string, unknown>>;
    assert.equal(dependencyTree.stage, 'main_image_generation');
    assert.equal(nodes.some((node) => node.kind === 'image_generation_prompt'), true);
    assert.equal(nodes.some((node) => node.kind === 'image_generation_provider'), true);
    assert.equal(nodes.some((node) => node.kind === 'main_image'), true);
    const mainImageNode = nodes.find((node) => node.kind === 'main_image') as Record<string, unknown>;
    assert.deepEqual((mainImageNode.metadata as Record<string, unknown>).canonicalAssetReference, canonicalAssetReference);

    const promptPath = path.join(projectRoot, String((result.promptOutput as Record<string, unknown>).relativePath));
    assert.equal(await readFile(promptPath, 'utf8'), 'organized final image prompt');
    const indexPath = path.join(projectRoot, String((result.batchOutput as Record<string, unknown>).relativePath), 'index.json');
    const indexJson = JSON.parse(await readFile(indexPath, 'utf8')) as Record<string, unknown>;
    assert.equal((indexJson.provider as Record<string, unknown>).model, 'test-image-model');
    const batchOutputPath = path.join(projectRoot, String((result.batchOutput as Record<string, unknown>).relativePath));
    assert.equal(await readFile(path.join(batchOutputPath, 'image_001_prompt.txt'), 'utf8'), 'organized final image prompt');
    assert.equal(await readFile(path.join(batchOutputPath, 'image_001.txt'), 'utf8'), 'organized final image prompt');
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of previousEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('scene-skill direct main-image loads apiyi config from new_pipeline config file', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  const envNames = [
    'VISIONARY_NEW_PIPELINE_ROOT',
    'GEMINI_IMAGE_URL',
    'VISIONARY_GEMINI_IMAGE_URL',
    'GENAI_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GEMINI_IMAGE_MODEL',
  ];
  const previousEnv = new Map(envNames.map((name) => [name, process.env[name]]));
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; auth: string; body: Record<string, unknown> }> = [];
  try {
    for (const name of envNames) {
      delete process.env[name];
    }
    const newPipelineRoot = path.join(rootDir, 'third-party', 'new_pipeline');
    await mkdir(newPipelineRoot, { recursive: true });
    await writeFile(
      path.join(newPipelineRoot, 'config.py'),
      [
        'GEMINI_IMAGE_URL = "https://example.config/v1beta/models/config-image:generateContent"',
        'GEMINI_API_KEY = "config-image-key"',
        '',
      ].join('\n'),
      'utf8',
    );
    process.env.VISIONARY_NEW_PIPELINE_ROOT = newPipelineRoot;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [url, init] = args;
      requests.push({
        url: String(url),
        auth: String(new Headers(init?.headers).get('authorization') || ''),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: Buffer.from('config-png').toString('base64'),
                  },
                },
              ],
            },
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Scene Skill Config File',
    });
    const runtime = new CodexAgentRuntime(storage);
    const result = await runtime.sendMessageStream({
      user: 'Demo User',
      projectId: project.id,
      prompt: '$scene-skill build a compact workshop scene',
    });

    assert.equal(result.task.statusId, 'done');
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, 'https://example.config/v1beta/models/config-image:generateContent');
    assert.equal(requests[0]?.auth, 'Bearer config-image-key');
    assert.match(JSON.stringify(requests[0]?.body), /compact workshop scene/);
    assert.equal(result.images?.length, 1);
    assert.match(String(result.images?.[0]?.relativePath), /main_images\/image_001\.png$/);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of previousEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await cleanup();
  }
});

test('scene-skill main-image config failure returns a failed task state', async () => {
  const { rootDir, storage, cleanup } = await createTempStorage();
  const envNames = [
    'VISIONARY_NEW_PIPELINE_ROOT',
    'GEMINI_IMAGE_URL',
    'VISIONARY_GEMINI_IMAGE_URL',
    'GENAI_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
  ];
  const previousEnv = new Map(envNames.map((name) => [name, process.env[name]]));
  try {
    for (const name of envNames) {
      delete process.env[name];
    }
    process.env.VISIONARY_NEW_PIPELINE_ROOT = path.join(rootDir, 'missing-new-pipeline');
    const project = await storage.createProject({
      user: 'Demo User',
      name: 'Scene Skill Config Failure',
    });
    const runtime = new CodexAgentRuntime(storage);
    const taskEvents: Array<Record<string, unknown>> = [];
    const result = await runtime.sendMessageStream(
      {
        user: 'Demo User',
        projectId: project.id,
        prompt: '$scene-skill build a compact workshop scene',
      },
      {
        onTask: (task) => {
          taskEvents.push(task as unknown as Record<string, unknown>);
        },
      },
    );

    assert.equal(result.task.statusId, 'failed');
    assert.match(result.task.statusText, /GEMINI_IMAGE_URL or VISIONARY_GEMINI_IMAGE_URL is required/);
    assert.match(result.finalText, /场景构建主图阶段失败/);
    assert.deepEqual(result.images, []);
    assert.equal(taskEvents.at(-1)?.statusId, 'failed');
  } finally {
    for (const [name, value] of previousEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await cleanup();
  }
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
          images: [
            {
              id: 'component_001',
              relativePath: 'agent_history/assets/new_pipeline/project/run/components/previews/component.svg',
              mimeType: 'image/svg+xml',
              bytes: 128,
            },
          ],
        }),
      },
    },
  ]);

  assert.equal(task.started, true);
  assert.equal(task.title, 'Codex generation');
  assert.equal(task.progress, 0.42);
  assert.equal(task.statusText, 'Generating model');
  assert.deepEqual(task.images, [
    {
      id: 'component_001',
      relativePath: 'agent_history/assets/new_pipeline/project/run/components/previews/component.svg',
      mimeType: 'image/svg+xml',
      bytes: 128,
    },
  ]);
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

test('codex task state accepts camera MCP results wrapped in Codex event_msg output', () => {
  const cameraToolResult = {
    ok: true,
    stage: 'camera_trajectory_generation',
    trajectory: {
      relativePath: 'agent_history/assets/new_pipeline/camera-project/run/camera_trajectory.json',
      data: {
        timeline: {
          keyframes: [
            { frame: 0 },
            { frame: 10 },
          ],
        },
      },
    },
    files: [
      {
        id: 'camera_trajectory',
        relativePath: 'agent_history/assets/new_pipeline/camera-project/run/camera_trajectory.json',
        mimeType: 'application/json',
        bytes: 256,
      },
    ],
    images: [],
    dependencyTree: {
      relativePath: 'agent_history/assets/new_pipeline/camera-project/run/dependency_tree.json',
      data: {
        stage: 'camera_trajectory_generation',
      },
    },
    visionaryTask: {
      title: '相机轨迹生成',
      message: '生成 2 个相机关键帧',
      progress: 1,
      stage: 'camera_trajectory_generation',
      pipelineStageStatuses: [
        { stage: 'camera_scene_info_export', statusId: 'done' },
        { stage: 'camera_initial_view_prepare', statusId: 'done' },
        { stage: 'camera_director_analysis', statusId: 'done' },
        { stage: 'camera_trajectory_generation', statusId: 'done' },
        { stage: 'camera_trajectory_eval_render', statusId: 'skipped' },
      ],
      directorIntentText: 'Start outside the object and move smoothly around it.',
      artifacts: [
        {
          kind: 'text',
          title: '导演意图',
          text: 'Start outside the object and move smoothly around it.',
          targetStage: 'camera_director_analysis',
        },
      ],
      initialViewImages: [
        {
          id: 'camera_initial_view_001',
          relativePath: 'agent_history/assets/new_pipeline/camera-project/run/initial_views/camera_001.png',
          mimeType: 'image/png',
          bytes: 512,
        },
      ],
      trajectory: {
        relativePath: 'agent_history/assets/new_pipeline/camera-project/run/camera_trajectory.json',
      },
      files: [
        {
          id: 'camera_trajectory',
          relativePath: 'agent_history/assets/new_pipeline/camera-project/run/camera_trajectory.json',
          mimeType: 'application/json',
          bytes: 256,
        },
      ],
      images: [],
      dependencyTree: {
        relativePath: 'agent_history/assets/new_pipeline/camera-project/run/dependency_tree.json',
      },
      warnings: [],
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
                text: JSON.stringify(cameraToolResult),
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
            text: '已把生成的相机轨迹放到时间轴预览，点击“应用”将确认保留当前预览轨迹并清理备份，点击“重试”将重新生成，点击“取消”将放弃并恢复旧轨迹。',
          },
        ],
      },
    }),
  ].join('\n'));
  const task = extractCodexTaskState(parsed.events);

  assert.equal(parsed.finalText, '已把生成的相机轨迹放到时间轴预览，点击“应用”将确认保留当前预览轨迹并清理备份，点击“重试”将重新生成，点击“取消”将放弃并恢复旧轨迹。');
  assert.equal(task.started, true);
  assert.equal(task.title, '相机轨迹生成');
  assert.equal(task.statusText, '生成 2 个相机关键帧');
  assert.equal(task.progress, 1);
  assert.equal(task.stage, 'camera_trajectory_generation');
  assert.equal(task.pipelineStageStatuses?.length, 5);
  assert.deepEqual(task.pipelineStageStatuses?.[4], { stage: 'camera_trajectory_eval_render', statusId: 'skipped' });
  assert.equal((task.trajectory as Record<string, unknown>).relativePath, 'agent_history/assets/new_pipeline/camera-project/run/camera_trajectory.json');
  assert.equal(task.files?.length, 1);
  assert.equal((task.dependencyTree as Record<string, unknown>).relativePath, 'agent_history/assets/new_pipeline/camera-project/run/dependency_tree.json');
  assert.equal(task.statusId, 'done');
  assert.equal(task.directorIntentText, 'Start outside the object and move smoothly around it.');
  assert.equal(task.artifacts?.length, 1);
  assert.equal(task.initialViewImages?.[0]?.relativePath, 'agent_history/assets/new_pipeline/camera-project/run/initial_views/camera_001.png');
});

test('codex task state preserves camera host render request contracts from MCP results', () => {
  const cameraToolResult = {
    ok: true,
    stage: 'camera_initial_view_prepare',
    needsRender: true,
    renderStage: 'camera_initial_view_prepare',
    preparedPath: 'agent_history/assets/new_pipeline/camera-project/run/prepared.json',
    prepared: {
      relativePath: 'agent_history/assets/new_pipeline/camera-project/run/prepared.json',
    },
    renderRequests: [
      {
        name: 'initial_front',
        outputPath: 'agent_history/assets/new_pipeline/camera-project/run/initial_views/front.png',
        resolution: { width: 1280, height: 720 },
        camera: { lookAt: { target: [0, 0, 0], position: [1, 1, 1] } },
      },
    ],
    visionaryTask: {
      title: '相机初始视图准备',
      message: '请使用 Visionary 渲染初始三视图',
      progress: 1,
      stage: 'camera_initial_view_prepare',
      statusId: 'rendering',
    },
  };
  const parsed = parseCodexExecJsonl(JSON.stringify({
    type: 'event_msg',
    payload: {
      type: 'mcp_tool_call_end',
      result: {
        Ok: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cameraToolResult),
            },
          ],
        },
      },
    },
  }));
  const task = extractCodexTaskState(parsed.events);

  assert.equal(task.started, true);
  assert.equal(task.stage, 'camera_initial_view_prepare');
  assert.equal(task.statusId, 'rendering');
  assert.equal(task.needsRender, true);
  assert.equal(task.renderStage, 'camera_initial_view_prepare');
  assert.equal(task.preparedPath, 'agent_history/assets/new_pipeline/camera-project/run/prepared.json');
  assert.equal((task.prepared as Record<string, unknown>).relativePath, 'agent_history/assets/new_pipeline/camera-project/run/prepared.json');
  assert.equal(task.renderRequests?.length, 1);
  assert.equal((task.renderRequests?.[0] as Record<string, unknown>).outputPath, 'agent_history/assets/new_pipeline/camera-project/run/initial_views/front.png');
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
    assert.equal(result.blockPatch.statusId, 'done');
    assert.equal(result.blockPatch.isCurrent, false);
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
