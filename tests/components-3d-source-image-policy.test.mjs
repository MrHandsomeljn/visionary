import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('object-images stage owns scene-skill single-object preprocessing', async () => {
  const objectImagesSource = await readFile(
    new URL('../src/server/mcp/new-pipeline-object-images-server.ts', import.meta.url),
    'utf8',
  );
  const componentsSource = await readFile(
    new URL('../src/server/mcp/new-pipeline-components-3d-server.ts', import.meta.url),
    'utf8',
  );
  const runtimeSource = await readFile(
    new URL('../src/server/codex-agent-runtime.ts', import.meta.url),
    'utf8',
  );

  assert.match(objectImagesSource, /export async function generateObjectImages\(input: \{/);
  assert.match(objectImagesSource, /layoutBboxJsonPath: string;/);
  assert.match(objectImagesSource, /'extract_single_object\.py'[\s\S]*'--image'[\s\S]*sourceMainImagePath/);
  assert.match(objectImagesSource, /const singleObjectsRootDir = path\.join\(sourceBatchDir, 'pipeline_output', 'single_objects'\);/);
  assert.match(objectImagesSource, /'--output'[\s\S]*singleObjectsRootDir/);
  assert.match(objectImagesSource, /kind: 'object_image'/);
  assert.match(objectImagesSource, /objectImageReferences: references/);
  assert.match(objectImagesSource, /objectImagesOutputDir:/);
  assert.match(objectImagesSource, /objectImageIncomplete:/);
  assert.match(objectImagesSource, /statusId: incomplete \? 'failed' : 'done'/);
  assert.match(objectImagesSource, /emitProgress\(title, incomplete \? '物体图片获取不完整' : '物体图片获取完成', 1, incomplete \? 'failed' : 'done'\)/);
  assert.match(objectImagesSource, /failedObjects: extraction\.failedObjects/);
  assert.match(objectImagesSource, /forceRegenerate\?: boolean;/);
  assert.match(objectImagesSource, /\.\.\.\(input\.forceRegenerate \? \['--force-regenerate'\] : \[\]\)/);
  assert.match(runtimeSource, /generateObjectImages\(\{[\s\S]*forceRegenerate: action === 'retry'/);
  assert.doesNotMatch(objectImagesSource, /'extract_single_object\.py'[\s\S]*?'--workers'[\s\S]*?'1'/);

  assert.match(componentsSource, /objectImagePaths\?: string\[\];/);
  assert.match(componentsSource, /objectImagesDir\?: string;/);
  assert.match(componentsSource, /await resolveObjectImagePaths\(\{/);
  assert.match(componentsSource, /objectImagePaths: input\.objectImagePaths/);
  assert.match(componentsSource, /objectImagesDir: input\.objectImagesDir/);
  assert.doesNotMatch(componentsSource, /'extract_single_object\.py'/);
});

test('single-object preprocessing queries objects with bounded concurrency', async () => {
  const source = await readFile(
    new URL('../../third-party/new_pipeline/extract_single_object.py', import.meta.url),
    'utf8',
  );

  assert.match(source, /from concurrent\.futures import ThreadPoolExecutor, as_completed/);
  assert.match(source, /ThreadPoolExecutor\(max_workers=worker_count\)/);
  assert.match(source, /executor\.submit\([\s\S]*extract_single_object_with_retries/);
  assert.match(source, /worker_count = max\(1, min\(int\(max_workers or 1\), len\(extraction_jobs\) or 1\)\)/);
  assert.match(source, /for obj_idx, obj_name, output_path in extraction_jobs:[\s\S]*completed\[obj_idx\]/);
  assert.match(source, /pending_by_name = \{\}[\s\S]*duplicate_jobs = \[\]/);
  assert.match(source, /default=MAX_CONCURRENT_IMAGE_GEN/);
  assert.match(source, /expected_object_count/);
  assert.match(source, /failed_object_count/);
  assert.match(source, /"complete": expected_count > 0 and successful_count == expected_count/);
});

test('single-object retry reuses valid outputs and only queries failed objects', () => {
  const pipelineDir = fileURLToPath(new URL('../../third-party/new_pipeline/', import.meta.url));
  const pythonBin = fileURLToPath(new URL('../../third-party/new_pipeline/.venv/bin/python', import.meta.url));
  const script = String.raw`
import json
import os
import tempfile

import extract_single_object as module

calls = []
attempt = {"value": 1}

def fake_validate(path):
    return os.path.exists(path)

def fake_extract(image_path, object_name, output_path, api_key=None):
    calls.append((attempt["value"], object_name))
    if attempt["value"] == 1 and object_name == "beta":
        return {"success": False, "output_path": None, "error": "temporary failure"}
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as handle:
        handle.write(b"mock-image")
    return {"success": True, "output_path": output_path, "error": None}

module.validate_image_file = fake_validate
module.extract_single_object = fake_extract

with tempfile.TemporaryDirectory() as temp_dir:
    object_list_path = os.path.join(temp_dir, "objects.json")
    with open(object_list_path, "w", encoding="utf-8") as handle:
        json.dump([{"object": "alpha"}, {"object": "beta"}], handle)
    output_dir = os.path.join(temp_dir, "output")
    first = module.process_image_with_object_list(
        os.path.join(temp_dir, "image_001.png"),
        object_list_path,
        output_dir,
        1,
        {},
        max_workers=2,
        max_retries=1,
    )
    attempt["value"] = 2
    second = module.process_image_with_object_list(
        os.path.join(temp_dir, "image_001.png"),
        object_list_path,
        output_dir,
        1,
        {},
        max_workers=2,
        max_retries=1,
    )
    attempt["value"] = 3
    third = module.process_image_with_object_list(
        os.path.join(temp_dir, "image_001.png"),
        object_list_path,
        output_dir,
        1,
        {},
        max_workers=2,
        max_retries=1,
        force_regenerate=True,
    )

assert first["complete"] is False
assert first["successful_object_count"] == 1
assert first["failed_object_count"] == 1
assert [name for run, name in calls if run == 2] == ["beta"]
assert second["complete"] is True
assert second["successful_object_count"] == 2
assert sorted(name for run, name in calls if run == 3) == ["alpha", "beta"]
assert third["complete"] is True
print(json.dumps({"calls": calls, "second": second["complete"], "third": third["complete"]}))
`;
  const result = spawnSync(pythonBin, ['-c', script], {
    cwd: pipelineDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"second": true/);
  assert.match(result.stdout, /"third": true/);
});
