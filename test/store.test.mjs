import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { OrgRevisionError, createOrgStore } from '../org-store.js';
import { OrgValidationError, createDefaultOrg } from '../org.js';

async function withStore(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-test-'));
  try {
    const file = join(dir, 'nested', 'org.json');
    await fn({ file, dir });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('store loads defaults when no file exists, then saves atomically with a new revision', async () => {
  await withStore(async ({ file }) => {
    const store = createOrgStore({ file, now: () => new Date('2026-01-02T03:04:05Z') });
    const initial = await store.load();
    assert.equal(store.configured, false);
    assert.equal(initial.revision, 1);
    assert.equal(initial.teamName, '北极星产品组');

    const org = createDefaultOrg();
    org.teamName = '测试小组';
    const saved = await store.save(0, org);
    assert.equal(store.configured, true);
    assert.equal(saved.revision, 1);
    assert.equal(saved.teamName, '测试小组');
    assert.equal(saved.updatedAt, '2026-01-02T03:04:05.000Z');

    const onDisk = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(onDisk.revision, 1);
    assert.equal(onDisk.teamName, '测试小组');
  });
});

test('stale revisions and invalid organizations are rejected', async () => {
  await withStore(async ({ file }) => {
    const store = createOrgStore({ file });
    await store.load();
    await store.save(0, createDefaultOrg());
    await assert.rejects(() => store.save(0, createDefaultOrg()), (error) => {
      assert.ok(error instanceof OrgRevisionError);
      assert.equal(error.code, 'revision-conflict');
      return true;
    });
    const invalid = createDefaultOrg();
    invalid.roles = [{ id: 'INVALID ID', name: 'X', title: 'Y', reportsTo: 'lead' }];
    await assert.rejects(() => store.save(1, invalid), (error) => {
      assert.ok(error instanceof OrgValidationError);
      return true;
    });
    assert.equal(store.current.revision, 1);
  });
});

test('a malformed file surfaces a warning and is not overwritten by load', async () => {
  await withStore(async ({ file, dir }) => {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '{broken', 'utf8');
    const store = createOrgStore({ file });
    const loaded = await store.load();
    assert.equal(loaded.revision, 1);
    assert.match(store.warning, /不是合法 JSON/);
    assert.equal(await readFile(file, 'utf8'), '{broken');
    assert.ok(dir.length > 0);
  });
});


test('a corrupt file is preserved as a backup before a deliberate replacement', async () => {
  await withStore(async ({ file, dir }) => {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '{"version":1,"revision":7,"teamName":"IMPORTANT"', 'utf8');
    const store = createOrgStore({ file, now: () => new Date('2026-02-03T04:05:06Z') });
    await store.load();
    assert.match(store.warning, /不是合法 JSON/);
    const saved = await store.save(0, createDefaultOrg());
    assert.equal(saved.revision, 1);
    assert.match(store.warning, /已备份/);
    assert.ok(store.lastBackup !== null);
    const backup = await readFile(store.lastBackup, 'utf8');
    assert.equal(backup, '{"version":1,"revision":7,"teamName":"IMPORTANT"');
    const disk = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(disk.revision, 1);
    const entries = await readdir(dir, { recursive: true });
    assert.ok(entries.some((entry) => entry.includes('.corrupt-')));
    assert.ok(!entries.some((entry) => entry.endsWith('.lock')));
  });
});

test('concurrent store instances serialize writes and one observes a revision conflict', async () => {
  await withStore(async ({ file }) => {
    const a = createOrgStore({ file });
    const b = createOrgStore({ file });
    await Promise.all([a.load(), b.load()]);
    const orgA = createDefaultOrg();
    orgA.teamName = 'A 组';
    const orgB = createDefaultOrg();
    orgB.teamName = 'B 组';
    const results = await Promise.allSettled([a.save(0, orgA), b.save(0, orgB)]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'revision-conflict');
    const disk = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(disk.revision, 1);
    assert.ok(['A 组', 'B 组'].includes(disk.teamName));
  });
});
