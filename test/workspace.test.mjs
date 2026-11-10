import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { workspaceFilePath } from '../index.js';

test('each workspace path resolves to its own durable organization file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-workspaces-'));
  const previousDir = process.env.DSH_AGENT_ORG_DIR;
  const previousFile = process.env.DSH_AGENT_ORG_FILE;
  try {
    delete process.env.DSH_AGENT_ORG_FILE;
    process.env.DSH_AGENT_ORG_DIR = dir;
    const a = workspaceFilePath({ path: '/workspace/alpha' });
    const b = workspaceFilePath({ path: '/workspace/beta' });
    assert.notEqual(a, b);
    assert.ok(a.startsWith(dir));
    assert.ok(b.startsWith(dir));
    assert.equal(a, workspaceFilePath({ path: '/workspace/alpha' }));
  } finally {
    if (previousDir === undefined) delete process.env.DSH_AGENT_ORG_DIR;
    else process.env.DSH_AGENT_ORG_DIR = previousDir;
    if (previousFile === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previousFile;
    await rm(dir, { recursive: true, force: true });
  }
});
