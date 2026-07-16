import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComponents3DObjectName,
  components3DModelTag,
} from '../src/server/components-3d-model-naming.ts';

test('components 3D names preserve layout labels and encode TRELLIS resolution', () => {
  assert.equal(components3DModelTag('trellis.2', 'TRELLIS.2-512'), 't512');
  assert.equal(components3DModelTag('trellis.2', 'TRELLIS.2-1024'), 't1024');
  assert.equal(components3DModelTag('trellis.2', 'TRELLIS.2-1536'), 't1536');
  assert.equal(components3DModelTag('trellis.2', 'TRELLIS.2-1024-v2'), 't1024');
  assert.equal(buildComponents3DObjectName({
    ordinal: 3,
    label: '机械臂',
    provider: 'trellis.2',
    model: 'TRELLIS.2-1024',
  }), '03-机械臂-t1024');
});

test('components 3D names use hy for Hunyuan and sanitize English labels', () => {
  assert.equal(buildComponents3DObjectName({
    ordinal: 3,
    label: 'assembly station / arm',
    provider: 'hunyuan',
    model: '3.1',
  }), '03-assembly-station-arm-hy');
});
