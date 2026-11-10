import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createExperienceStore } from '../experience.js';

test('global experience entries are short, persistent, and rendered for the lead', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-experience-'));
  try {
    const file = join(dir, 'experience.json');
    const first = createExperienceStore({ file });
    await first.add({ kind: 'project', title: '硬件联调', summary: '联调提前完成', instructions: '先锁定接口，再并行验证电源和固件。', workspace: '/w1' });
    await first.add({ kind: 'stage', title: '设计评审', summary: '方案一次通过', instructions: '评审前先冻结边界和验收标准。', workspace: '/w2' });
    const second = createExperienceStore({ file });
    await second.load();
    const entries = second.list();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, 'stage');
    const prompt = second.prompt();
    assert.match(prompt, /全局项目经验/);
    assert.match(prompt, /硬件联调/);
    assert.match(prompt, /先锁定接口/);
    assert.match(prompt, /阶段/);
    await assert.rejects(() => second.add({ kind: 'project', title: '', summary: 'x', instructions: 'y' }), /标题/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
