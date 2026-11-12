/**
 * Durable storage for Agent Org.
 *
 * The file is owned by the Host plugin, not the browser. Writes are serialized
 * with an exclusive lock file, revision-checked against the file on disk, and
 * published with a temp-file rename so a crash never leaves a partially written
 * organization. A malformed existing file is reported, preserved as a `.corrupt-*`
 * backup before an explicit replacement, and never silently discarded.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { OrgValidationError, createDefaultOrg, migrateLegacyHr, validateOrg } from './org.js';

export class OrgRevisionError extends Error {
  constructor(expected, actual) {
    super(`组织架构已被修改（期望修订号 ${expected}，当前 ${actual}）`);
    this.name = 'OrgRevisionError';
    this.code = 'revision-conflict';
    this.expected = expected;
    this.actual = actual;
  }
}

export class OrgStorageError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'OrgStorageError';
    this.code = 'storage-error';
  }
}

const LOCK_STALE_MS = 60_000;
const LOCK_TIMEOUT_MS = 8_000;
const LOCK_RETRY_MS = 25;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveOrgFile(env = process.env) {
  if (typeof env.DSH_AGENT_ORG_FILE === 'string' && env.DSH_AGENT_ORG_FILE.trim() !== '') {
    return env.DSH_AGENT_ORG_FILE;
  }
  const home = typeof env.DSH_HOME === 'string' && env.DSH_HOME.trim() !== ''
    ? env.DSH_HOME
    : join(homedir(), '.dsh');
  return join(home, 'agent-org', 'org.json');
}

async function readDisk(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return { kind: 'missing' };
    return { kind: 'error', error };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { kind: 'invalid', reason: `不是合法 JSON：${error instanceof Error ? error.message : String(error)}`, raw };
  }
  const result = validateOrg(parsed);
  if (!result.ok) {
    return { kind: 'invalid', reason: result.issues[0]?.message ?? '格式无效', raw };
  }
  return { kind: 'ok', org: result.org };
}

/** Rehydrate the latest committed journal snapshot; top-level fields are a cache. */
function hydrateJournal(org) {
  if (!Array.isArray(org?.journal) || org.journal.length === 0) return org;
  for (let index = org.journal.length - 1; index >= 0; index -= 1) {
    const snapshot = org.journal[index]?.snapshot;
    if (snapshot === null || typeof snapshot !== 'object') continue;
    const validated = validateOrg(snapshot);
    if (validated.ok) return { ...validated.org, journal: org.journal.slice(-20) };
  }
  return org;
}

async function acquireFileLock(file) {
  const lockPath = `${file}.lock`;
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const started = Date.now();
  while (true) {
    let handle;
    try {
      handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: Date.now() }), 'utf8');
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await handle.close().catch(() => {});
        await unlink(lockPath).catch((error) => {
          if (error?.code !== 'ENOENT') throw error;
        });
      };
    } catch (error) {
      if (handle !== undefined) await handle.close().catch(() => {});
      if (error?.code !== 'EEXIST') {
        throw new OrgStorageError(`无法获取组织架构写锁：${error instanceof Error ? error.message : String(error)}`, error);
      }
    }

    try {
      const info = await stat(lockPath);
      if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
        await unlink(lockPath).catch(() => {});
        continue;
      }
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw new OrgStorageError(`无法检查组织架构写锁：${error instanceof Error ? error.message : String(error)}`, error);
    }
    if (Date.now() - started > LOCK_TIMEOUT_MS) {
      throw new OrgStorageError('组织架构正被另一个进程写入，请稍后重试');
    }
    await delay(LOCK_RETRY_MS);
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.file] absolute storage file
 * @param {() => Date} [options.now]
 */
export function createOrgStore(options = {}) {
  const file = options.file ?? resolveOrgFile();
  const now = options.now ?? (() => new Date());
  let org = createDefaultOrg();
  let warning = null;
  let degraded = false;
  let configured = false;
  let loaded = false;
  let writeTail = Promise.resolve();
  let lastBackup = null;

  async function load() {
    if (loaded) return org;
    loaded = true;
    const disk = await readDisk(file);
    if (disk.kind === 'ok') {
      org = hydrateJournal(migrateLegacyHr(disk.org));
      warning = null;
      degraded = false;
      configured = true;
    } else if (disk.kind === 'invalid') {
      warning = `组织架构文件未通过校验，已显示默认值：${disk.reason}`;
      degraded = true;
      configured = false;
    } else if (disk.kind === 'error') {
      warning = `读取组织架构失败，已显示默认值：${disk.error instanceof Error ? disk.error.message : String(disk.error)}`;
      degraded = true;
      configured = false;
    } else {
      configured = false;
    }
    return org;
  }

  /**
   * Re-read a valid file written by another Host process. Keeps the current
   * value when the file is missing or unreadable; never resets a live value.
   * @returns {Promise<object>} the freshest usable organization
   */
  async function refresh() {
    await load();
    const disk = await readDisk(file);
    if (disk.kind === 'ok') {
      configured = true;
      if (disk.org.revision >= org.revision) {
        org = hydrateJournal(migrateLegacyHr(disk.org));
        warning = null;
        degraded = false;
      }
    } else if (disk.kind === 'missing') {
      configured = false;
      warning = null;
    } else if (disk.kind === 'invalid') {
      configured = false;
      warning = `组织架构文件未通过校验：${disk.reason}`;
    }
    return org;
  }

  async function writeAtomic(next) {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temp, file);
  }

  /**
   * Replace the organization at an exact revision.
   * @param {number} expectedRevision
   * @param {unknown} candidate
   * @returns {Promise<object>} the stored organization
   */
  async function save(expectedRevision, candidate) {
    await load();
    const operation = writeTail.then(async () => {
      const release = await acquireFileLock(file);
      try {
        const disk = await readDisk(file);
        let base = org;
        let backupPath = null;

        if (disk.kind === 'ok') {
          base = disk.org;
          org = disk.org;
          degraded = false;
          warning = null;
          configured = true;
        } else if (disk.kind === 'invalid' || disk.kind === 'missing') {
          // No usable organization exists yet: the setup revision is 0.
          base = { ...org, revision: 0 };
          configured = false;
        } else if (disk.kind === 'error') {
          throw new OrgStorageError(`无法读取组织架构文件：${disk.error instanceof Error ? disk.error.message : String(disk.error)}`, disk.error);
        }

        if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== base.revision) {
          throw new OrgRevisionError(expectedRevision, base.revision);
        }
        const validated = validateOrg({ ...candidate, revision: Math.max(1, base.revision) });
        if (!validated.ok) throw new OrgValidationError(validated.issues);

        // Validate before touching the old file. The write lock makes this
        // backup-and-replace sequence exclusive across Host processes.
        if (disk.kind === 'invalid') {
          const stamp = now().toISOString().replace(/[:.]/g, '-');
          backupPath = `${file}.corrupt-${stamp}-${randomUUID().slice(0, 8)}`;
          await rename(file, backupPath).catch((error) => {
            if (error?.code !== 'ENOENT') {
              throw new OrgStorageError(`无法备份损坏的组织架构文件：${error instanceof Error ? error.message : String(error)}`, error);
            }
          });
          warning = `组织架构文件损坏或版本不兼容，原文件已备份为 ${backupPath}`;
        }

        const next = {
          ...validated.org,
          version: validated.org.version,
          revision: base.revision + 1,
          updatedAt: now().toISOString(),
        };
        const snapshot = { ...next };
        delete snapshot.journal;
        const journal = [...(base.journal ?? []), {
          seq: (base.journal?.length ?? 0) + 1,
          at: next.updatedAt,
          snapshot,
        }].slice(-20);
        next.journal = journal;
        await writeAtomic(next);
        org = next;
        configured = true;
        lastBackup = backupPath;
        degraded = false;
        if (backupPath === null) warning = null;
        return org;
      } finally {
        await release();
      }
    });
    writeTail = operation.catch(() => {});
    return operation;
  }

  /**
   * Retire the organization for a deleted workspace.
   *
   * The file is moved aside rather than unlinked so the previous configuration
   * remains recoverable, while a re-added workspace starts unconfigured and
   * goes through initialization again.
   */
  async function remove() {
    await load();
    const operation = writeTail.then(async () => {
      const release = await acquireFileLock(file);
      try {
        const stamp = now().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${file}.deleted-${stamp}-${randomUUID().slice(0, 8)}`;
        try {
          await rename(file, backupPath);
        } catch (error) {
          if (error?.code !== 'ENOENT') {
            throw new OrgStorageError(`无法归档已删除工作区的组织架构：${error instanceof Error ? error.message : String(error)}`, error);
          }
        }
        org = createDefaultOrg();
        warning = null;
        degraded = false;
        configured = false;
        loaded = true;
        lastBackup = backupPath;
      } finally {
        await release();
      }
    });
    writeTail = operation.catch(() => {});
    return operation;
  }

  return {
    file,
    load,
    refresh,
    save,
    remove,
    get current() {
      return org;
    },
    get warning() {
      return warning;
    },
    get degraded() {
      return degraded;
    },
    get configured() {
      return configured;
    },
    get revision() {
      return configured ? org.revision : 0;
    },
    get lastBackup() {
      return lastBackup;
    },
  };
}
