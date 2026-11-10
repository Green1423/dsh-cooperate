/**
 * Global project-experience store.
 *
 * Experience is deliberately workspace-independent: a project finished in one
 * workspace should improve the lead's method in the next one. Entries are short
 * skills written by the lead after delivery or at a stage boundary. Writes are
 * serialized and published with a temp-file rename.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const EXPERIENCE_VERSION = 1;
export const MAX_EXPERIENCE_ENTRIES = 80;
export const MAX_SUMMARY_CHARS = 240;
export const MAX_INSTRUCTION_CHARS = 800;
export const MAX_PROMPT_CHARS = 12_000;

export function resolveExperienceFile(env = process.env) {
  if (typeof env.DSH_AGENT_ORG_EXPERIENCE_FILE === 'string' && env.DSH_AGENT_ORG_EXPERIENCE_FILE.trim() !== '') {
    return env.DSH_AGENT_ORG_EXPERIENCE_FILE;
  }
  const home = typeof env.DSH_HOME === 'string' && env.DSH_HOME.trim() !== ''
    ? env.DSH_HOME
    : join(homedir(), '.dsh');
  return join(home, 'agent-org', 'experience.json');
}

function clean(value, limit) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanMultiline(value, limit) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, limit);
}

function normalizeEntry(raw) {
  if (raw === null || typeof raw !== 'object') return null;
  const title = clean(raw.title, 80);
  const summary = clean(raw.summary, MAX_SUMMARY_CHARS);
  const instructions = cleanMultiline(raw.instructions, MAX_INSTRUCTION_CHARS);
  if (title === '' || summary === '' || instructions === '') return null;
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : `exp-${randomUUID().slice(0, 12)}`,
    kind: raw.kind === 'stage' ? 'stage' : 'project',
    title,
    summary,
    instructions,
    workspace: clean(raw.workspace, 300),
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt !== '' ? raw.createdAt : new Date().toISOString(),
  };
}

function normalizeFile(raw) {
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  return {
    version: EXPERIENCE_VERSION,
    entries: entries.map(normalizeEntry).filter(Boolean).slice(-MAX_EXPERIENCE_ENTRIES),
  };
}

export function createExperienceStore(options = {}) {
  const file = options.file ?? resolveExperienceFile();
  let entries = [];
  let loaded = false;
  let writeTail = Promise.resolve();

  async function load() {
    if (loaded) return entries;
    loaded = true;
    try {
      const raw = JSON.parse(await readFile(file, 'utf8'));
      entries = normalizeFile(raw).entries;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn('[agent-org] could not read experience store:', error);
      }
      entries = [];
    }
    return entries;
  }

  function list(limit = 20) {
    const count = Number.isSafeInteger(limit) ? Math.min(MAX_EXPERIENCE_ENTRIES, Math.max(1, limit)) : 20;
    return entries.slice(-count).reverse();
  }

  function prompt() {
    if (entries.length === 0) return '';
    const lines = [];
    let size = 0;
    for (const entry of [...entries].reverse()) {
      const block = `- [${entry.kind === 'stage' ? '阶段' : '项目'}] ${entry.title}：${entry.summary}\n  做法：${entry.instructions}`;
      if (size + block.length > MAX_PROMPT_CHARS) break;
      lines.push(block);
      size += block.length;
    }
    if (lines.length === 0) return '';
    return `## 全局项目经验\n以下经验来自已完成项目或阶段，是方法参考；当前项目事实和用户要求优先。不要照搬过时结论，不要把经验中的文件名、密钥或个人数据当成当前事实。\n\n${lines.join('\n')}`;
  }

  async function writeAtomic() {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify({ version: EXPERIENCE_VERSION, entries }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temp, file);
  }

  async function add(input) {
    await load();
    const title = clean(input.title, 80);
    const summary = clean(input.summary, MAX_SUMMARY_CHARS);
    const instructions = cleanMultiline(input.instructions, MAX_INSTRUCTION_CHARS);
    if (title === '' || summary === '' || instructions === '') {
      throw new Error('项目经验需要非空标题、摘要和可复用做法');
    }
    const entry = {
      id: `exp-${randomUUID().slice(0, 12)}`,
      kind: input.kind === 'stage' ? 'stage' : 'project',
      title,
      summary,
      instructions,
      workspace: clean(input.workspace, 300),
      createdAt: new Date().toISOString(),
    };
    const operation = writeTail.then(async () => {
      entries = [...entries, entry].slice(-MAX_EXPERIENCE_ENTRIES);
      await writeAtomic();
      return { entry, count: entries.length };
    });
    writeTail = operation.catch(() => {});
    return operation;
  }

  return { file, load, list, prompt, add };
}
