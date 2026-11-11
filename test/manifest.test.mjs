import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

test('manifest declares a forward-compatible DSH range and host peers', () => {
  assert.equal(manifest.name, '@local/dsh-agent-org');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.engines.dsh, /^>=0\.2\.1-rc\.5 <0\.3\.0$/);
  assert.match(manifest.engines.node, /^>=22/);
  assert.equal(manifest.peerDependencies['@deepseek-ai/cordis'], '>=4.0.5 <5.0.0');
  assert.equal(manifest.peerDependenciesMeta['@deepseek-ai/cordis'].optional, true);
  assert.equal(manifest.dependencies, undefined, 'DSH host packages must not be bundled as runtime dependencies');
  assert.ok(manifest.files.includes('content'));
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-workspace',
  ]);
});
