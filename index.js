/**
 * Agent Org: lead-only delegation over a user-editable organization.
 *
 * Host responsibilities:
 *  - persist the organization and expose a small same-origin HTTP API to the
 *    Web panel;
 *  - install the lead policy and `team_assign` tool on root agents only;
 *  - run each delegated role as an in-process child and return its result.
 *
 * The browser bundle in ./client.js owns the organization editor and activity
 * view. No external runtime dependencies are used so the bundle can be
 * installed into a profile without a build step.
 */
import { createHash, randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { OrgValidationError, ORG_PATTERNS, ROLE_LEVELS, ROLE_TEMPLATES, buildEmployeeIdentityPrompt, buildLeadPrompt, buildRoleBootstrapPrompt, buildMidprojectReportPrompt, buildRoleTaskPrompt, buildTeamDesignPrompt, createDefaultOrg, findRole, normalizeEffort, publicOrg, buildScopeUpdatePrompt, MAX_TASKS, normalizeWriteScope, taskReady, taskScopeWarnings } from './org.js';
import { OrgRevisionError, createOrgStore } from './org-store.js';
import { createExperienceStore } from './experience.js';
import teamHelpData from './content/team-help.json' with { type: 'json' };

export const name = 'agent-org';
export const inject = ['webServer', 'tools', 'systemPrompt', 'subagents', 'agents', 'sessions', 'workspaceRegistry', 'sessionTitle', 'sessionQuery', 'sessionController', 'skills'];

export const ORG_ROUTE = '/dsh-agent-org/state';
const MAX_BODY_BYTES = 256 * 1024;
const MAX_RUNS = 40;
const MAX_RUN_SUMMARY_CHARS = 4_000;
const MAX_TOOL_SUMMARY_CHARS = 6_000;
const PROVIDER = 'spawn';
const TEAM_HELP_VERSION = '2026.11.05';
const TEAM_HELP_TOOLS = teamHelpData.tools;
const TEAM_HELP_NOTES = teamHelpData.notes;

let experienceStore = null;
const MODEL_PRICING_URL = 'https://models.dev/api.json';
const USD_CNY_URL = 'https://open.er-api.com/v6/latest/USD';
const FALLBACK_USD_CNY = 7.2;
const MODEL_PRICING_TTL_MS = 6 * 60 * 60 * 1000;
const DEEPSEEK_OFFPEAK_PRICING = {
  'deepseek-flash': { input: 0.15, output: 0.6, cacheRead: 0.003, currency: 'USD' },
  'deepseek-v4-flash': { input: 0.15, output: 0.6, cacheRead: 0.003, currency: 'USD' },
  'deepseek-v4-flash-vision-exp': { input: 0.15, output: 0.6, cacheRead: 0.003, currency: 'USD' },
  'deepseek-v4-pro': { input: 0.66, output: 1.98, cacheRead: 0.022, currency: 'USD' },
};
const CN_HOLIDAYS_FALLBACK_2026 = new Set([
  '2026-01-01', '2026-02-17', '2026-05-01', '2026-06-19', '2026-09-25', '2026-10-01',
]);
const chinaHolidayCache = new Map();
const FALLBACK_MODEL_PRICING = {
  deepseek: {
    'deepseek-v4-pro': { input: 0.66, output: 1.98, cacheRead: 0.022, currency: 'USD' },
    'deepseek-flash': { input: 0.15, output: 0.6, cacheRead: 0.003, currency: 'USD' },
    'deepseek-v4-flash': { input: 0.15, output: 0.6, cacheRead: 0.003, currency: 'USD' },
    'deepseek-v4-flash-vision-exp': { input: 0.15, output: 0.6, cacheRead: 0.003, currency: 'USD' },
  },
};
let modelPricingCache = { data: null, at: 0, source: 'unavailable' };
let usdCnyCache = { rate: FALLBACK_USD_CNY, at: 0, source: 'fallback' };


async function loadModelPricing() {
  if (modelPricingCache.data !== null && Date.now() - modelPricingCache.at < MODEL_PRICING_TTL_MS) {
    return modelPricingCache;
  }
  try {
    const response = await fetch(MODEL_PRICING_URL, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    modelPricingCache = { data, at: Date.now(), source: 'models.dev' };
  } catch (error) {
    if (modelPricingCache.data === null) {
      modelPricingCache = {
        data: { deepseek: { models: FALLBACK_MODEL_PRICING.deepseek } },
        at: Date.now(),
        source: 'fallback',
      };
    }
  }
  return modelPricingCache;
}

async function loadUsdCnyRate() {
  const ttl = usdCnyCache.source === 'fallback' ? 5 * 60 * 1000 : MODEL_PRICING_TTL_MS;
  if (Date.now() - usdCnyCache.at < ttl) return usdCnyCache;
  try {
    const response = await fetch(USD_CNY_URL, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rate = Number(data?.rates?.CNY);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('invalid USD/CNY rate');
    usdCnyCache = { rate, at: Date.now(), source: 'exchangerate-api' };
  } catch (error) {
    usdCnyCache = { ...usdCnyCache, at: Date.now(), source: usdCnyCache.source === 'fallback' ? 'fallback' : usdCnyCache.source };
  }
  return usdCnyCache;
}

function deepSeekBasePrice(model) {
  const key = String(model ?? '');
  if (DEEPSEEK_OFFPEAK_PRICING[key] !== undefined) return DEEPSEEK_OFFPEAK_PRICING[key];
  if (key.includes('flash')) return DEEPSEEK_OFFPEAK_PRICING['deepseek-flash'];
  if (key.includes('pro')) return DEEPSEEK_OFFPEAK_PRICING['deepseek-v4-pro'];
  return null;
}

function chinaDateKey(date) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

async function loadChinaHolidays(year) {
  if (chinaHolidayCache.has(year)) return chinaHolidayCache.get(year);
  let dates = year === 2026 ? new Set(CN_HOLIDAYS_FALLBACK_2026) : new Set();
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CN`, { signal: AbortSignal.timeout(3_000) });
    if (response.ok) {
      const list = await response.json();
      dates = new Set(list.map((item) => String(item.date)));
    }
  } catch {
    // Keep the bundled dates when the holiday service is unavailable.
  }
  chinaHolidayCache.set(year, dates);
  return dates;
}

function isDeepSeekPeak(date, holidays) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const hour = date.getUTCHours();
  if (!((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10))) return false;
  if (holidays.has(chinaDateKey(date))) return false;
  return true;
}

function deepSeekPriceFor(model, date, holidays) {
  const base = deepSeekBasePrice(model);
  if (base === null) return null;
  const peak = isDeepSeekPeak(date, holidays);
  const multiplier = peak ? 2 : 1;
  return {
    input: base.input * multiplier,
    output: base.output * multiplier,
    cacheRead: base.cacheRead * multiplier,
    currency: 'USD',
    period: peak ? 'peak' : 'off-peak',
    source: 'deepseek-official',
  };
}

function deepSeekPriceForPeriod(model, period) {
  const base = deepSeekBasePrice(model);
  if (base === null) return null;
  const multiplier = period === 'peak' ? 2 : 1;
  return {
    input: base.input * multiplier,
    output: base.output * multiplier,
    cacheRead: base.cacheRead * multiplier,
    currency: 'USD',
    period: period === 'peak' ? 'peak' : 'off-peak',
    source: 'deepseek-official',
  };
}

function lookupModelPrice(catalog, provider, model) {
  let price = catalog?.[provider]?.models?.[model]
    ?? catalog?.deepseek?.models?.[model]
    ?? FALLBACK_MODEL_PRICING[provider]?.[model];
  if (price === undefined || price === null) {
    for (const entry of Object.values(catalog ?? {})) {
      if (entry !== null && typeof entry === 'object' && entry.models?.[model] !== undefined) {
        price = entry.models[model];
        break;
      }
    }
  }
  if (price === undefined || price === null) return null;
  const input = Number(price.input ?? price.cost?.input);
  const output = Number(price.output ?? price.cost?.output);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return {
    input,
    output,
    cacheRead: Number(price.cache_read ?? price.cost?.cache_read) || 0,
    currency: String(price.currency ?? 'USD'),
  };
}


class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function humanizeGroupText(value, depth = 0) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    if (Array.isArray(value)) {
      return value.map((item) => humanizeGroupText(item, depth + 1)).filter(Boolean).join('\n');
    }
    if (typeof value === 'object') {
      const preferred = ['message', 'reply', 'summary', 'report', 'result', 'answer', 'content', 'text', 'description', 'details', 'explanation', 'notes'];
      const parts = [];
      for (const key of preferred) {
        if (value[key] === undefined || value[key] === null || value[key] === '') continue;
        const candidate = humanizeGroupText(value[key], depth + 1).trim();
        if (candidate === '') continue;
        if (parts.some((part) => part === candidate || part.includes(candidate))) continue;
        const covering = parts.findIndex((part) => candidate.includes(part));
        if (covering >= 0) parts[covering] = candidate;
        else parts.push(candidate);
      }
      if (parts.length > 0) return parts.join('\n\n');
      for (const key of ['reason', 'status', 'task']) {
        if (value[key] === undefined || value[key] === null || value[key] === '') continue;
        const candidate = humanizeGroupText(value[key], depth + 1).trim();
        if (candidate !== '') return candidate;
      }
      return '';
    }
    return String(value);
  }
  let text = value.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence !== null) text = fence[1].trim();
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const human = humanizeGroupText(parsed, depth + 1);
      if (human !== '') return human;
    } catch {
      // Not JSON; keep the original natural language below.
    }
  }
  return text;
}

function textOfContent(blocks) {
  if (!Array.isArray(blocks)) return '';
  const parts = [];
  for (const block of blocks) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  return parts.join('\n').trim();
}

function bounded(value, limit) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('content-length', Buffer.byteLength(data));
  res.end(data);
}

async function readJsonBody(req) {
  const declared = Number(req.headers?.['content-length']);
  if (Number.isSafeInteger(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, '请求体过大');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new HttpError(413, '请求体过大');
    chunks.push(buffer);
  }
  if (total === 0) throw new HttpError(400, '缺少请求体');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON');
  }
}

function isSameOriginRequest(req) {
  // The remote gateway rewrites Host/Origin to loopback before forwarding.
  // Sec-Fetch-Site is browser-owned and survives that proxy hop; a custom
  // header also forces a CORS preflight for any cross-origin caller. This is
  // defense in depth, not authentication: the DSH Web listener and the auth
  // gateway remain the outer access boundary.
  const site = req.headers?.['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return false;
  const marker = req.headers?.['x-agent-org'];
  if (marker !== '1') return false;
  const origin = req.headers?.origin;
  if (typeof origin === 'string' && origin !== '') {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    // The auth gateway rewrites Host and Origin to its loopback upstream;
    // compare against the Host the listener actually received, not the
    // original external host preserved in X-Forwarded-Host.
    const host = req.headers?.host;
    if (typeof host === 'string' && host !== '' && originHost !== host) return false;
  }
  return true;
}

export function workspaceFilePath(workspace) {
  const explicit = process.env.DSH_AGENT_ORG_FILE;
  if (typeof explicit === 'string' && explicit.trim() !== '') return explicit;
  const root = process.env.DSH_AGENT_ORG_DIR
    || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'agent-org', 'workspaces');
  const key = createHash('sha256').update(workspace.path).digest('hex').slice(0, 32);
  return join(root, `${key}.json`);
}

function publicWorkspace(workspace) {
  return {
    id: String(workspace.id),
    path: workspace.path,
    title: workspace.title,
  };
}

async function resolveWorkspaceForSession(ctx, sessionId) {
  if (typeof sessionId !== 'string' || sessionId === '') return undefined;
  const registry = ctx.workspaceRegistry;
  if (registry === undefined) return undefined;
  const workspaces = registry.list();
  const direct = workspaces.find((workspace) => workspace.sessionIds.includes(sessionId));
  if (direct !== undefined) return publicWorkspace(direct);

  let cwd = ctx.sessions?.get(sessionId)?.header?.cwd;
  if (typeof cwd !== 'string' || cwd === '') {
    const agent = ctx.agents.get(sessionId);
    cwd = agent?.session?.header?.cwd;
  }
  if (typeof cwd !== 'string' || cwd === '') return undefined;
  const canonical = await realpath(cwd).catch(() => cwd);
  const byPath = workspaces.find((workspace) => workspace.path === canonical);
  if (byPath !== undefined) return publicWorkspace(byPath);
  return {
    id: `cwd-${createHash('sha256').update(canonical).digest('hex').slice(0, 24)}`,
    path: canonical,
    title: basename(canonical) || canonical,
  };
}

function makeRunRecorder() {
  const runs = [];
  let sequence = 0;
  return {
    start({ workspaceId, role, task, agent, childSessionId }) {
      sequence += 1;
      const run = {
        id: `run-${Date.now().toString(36)}-${sequence}`,
        roleId: role.id,
        roleName: role.name,
        roleTitle: role.title,
        status: 'running',
        task: bounded(task, 1200),
        summary: '',
        diagnostic: '',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        childSessionId: String(childSessionId ?? ''),
        parentSessionId: String(agent?.session?.id ?? ''),
        workspaceId: String(workspaceId ?? ''),
      };
      runs.unshift(run);
      if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
      return run;
    },
    finish(run, status, summary, diagnostic, durationMs) {
      run.status = status;
      run.summary = bounded(summary, MAX_RUN_SUMMARY_CHARS);
      run.diagnostic = bounded(diagnostic, 4096);
      run.finishedAt = new Date().toISOString();
      run.durationMs = Math.max(0, Math.round(durationMs));
    },
    snapshot(workspaceId) {
      const scoped = typeof workspaceId === 'string' && workspaceId !== ''
        ? runs.filter((run) => run.workspaceId === workspaceId)
        : runs;
      return scoped.map((run) => ({ ...run }));
    },
  };
}

export function apply(ctx) {
  experienceStore = createExperienceStore();
  console.info('[agent-org] loaded');
  const runs = makeRunRecorder();
  let internalSessionCreations = 0;
  let internalModelSelections = 0;
  async function createInternalSession(request) {
    internalSessionCreations += 1;
    try {
      return await ctx.sessionController.create(request);
    } finally {
      internalSessionCreations -= 1;
    }
  }
  async function sessionCreationWorkspaceLocked(request) {
    let workspace;
    if (typeof request?.workspaceId === 'string' && request.workspaceId !== '') {
      workspace = ctx.workspaceRegistry.get(request.workspaceId);
    } else if (typeof request?.cwd === 'string' && request.cwd !== '') {
      const list = typeof ctx.workspaceRegistry.list === 'function' ? ctx.workspaceRegistry.list() : [];
      workspace = list.find((item) => item?.path === request.cwd);
    }
    if (workspace === undefined || workspace === null || typeof workspace.path !== 'string') return false;
    const store = getWorkspaceStore(workspace);
    await store.load();
    return store.configured && store.current.enabled;
  }

  const installations = new Map();
  const installing = new Set();
  const captainToolsInstalled = new WeakSet();
  const stores = new Map();
  const activeActivations = new Set();
  const employeeSessionIds = new Set();
  let disposed = false;

  function getWorkspaceStore(workspace) {
    const key = workspace.path;
    let store = stores.get(key);
    if (store === undefined) {
      store = createOrgStore({ file: workspaceFilePath(workspace) });
      stores.set(key, store);
    }
    return store;
  }

  const roleQueues = new Map();
  const roleRepairs = new Map();
  const leadInitializations = new Map();

  function enqueueRole(roleId, operation) {
    const previous = roleQueues.get(roleId) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    roleQueues.set(roleId, next.catch(() => {}));
    return next;
  }

  async function persistRoleSession(store, roleId, sessionId) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = store.current;
      if (!current.roles.some((role) => role.id === roleId)) return current;
      const roles = current.roles.map((role) => (
        role.id === roleId ? { ...role, sessionId } : role
      ));
      try {
        return await store.save(current.revision, { ...current, roles });
      } catch (error) {
        if (error instanceof OrgRevisionError) continue;
        console.warn('[agent-org] could not persist role session:', error);
        return current;
      }
    }
    return store.current;
  }

  async function readSessionHeader(sessionId) {
    try {
      const snapshot = await ctx.sessionQuery.readSession(sessionId);
      return snapshot?.header;
    } catch {
      return undefined;
    }
  }

  async function attachRoleSession(workspace, childId) {
    const workspaceRecord = ctx.workspaceRegistry.get(workspace.id);
    if (workspaceRecord === undefined) return false;
    const live = ctx.sessions.get(childId);
    if (live !== undefined) {
      try { await flushLiveSession(live); } catch (error) {
        console.warn('[agent-org] could not flush role session before attach:', error);
      }
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await workspaceRecord.attachSession(childId);
        return true;
      } catch (error) {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
          continue;
        }
        console.warn('[agent-org] could not attach role session to workspace:', error);
      }
    }
    return false;
  }

  function roleTurnText(content) {
    if (!Array.isArray(content)) return '';
    return content
      .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n')
      .trim();
  }

  async function flushLiveSession(session) {
    if (typeof ctx.sessions?.flush !== 'function') return;
    await ctx.sessions.flush(session);
  }

  async function runAgentTurn(agent, prompt, signal) {
    signal.throwIfAborted();
    await agent.whenIdle();
    const completion = Promise.withResolvers();
    completion.promise.catch(() => {});
    let lastText = '';
    let settled = false;
    let dispose = null;
    let onAbort = null;
    const finish = (settle) => {
      if (settled) return;
      settled = true;
      if (onAbort !== null) signal.removeEventListener('abort', onAbort);
      try { dispose?.(); } catch { /* agent may already be disposed */ }
      settle();
    };
    const onEvent = (session, event) => {
      if (event.type === 'assistant/message') {
        const text = roleTurnText(event.data.message?.content);
        if (text !== '') lastText = text;
      }
      if (event.type === 'turn/end') {
        finish(() => completion.resolve(event.data.reason));
      }
    };
    dispose = agent.ctx.on('session/event', onEvent);
    onAbort = () => {
      try { agent.cancel({ kind: 'parent' }); } catch { /* already gone */ }
      finish(() => completion.reject(signal.reason ?? new Error('委派已中止')));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      agent.followup({
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      });
      const reason = await completion.promise;
      return { text: lastText, reason };
    } catch (error) {
      finish(() => {});
      throw error;
    }
  }

  async function ensureEmployeeAgent(sessionId) {
    const live = ctx.agents.get(sessionId);
    if (live !== undefined) return live;
    const resolved = await ctx.sessionController.agents.resolveAgent(sessionId);
    if ('error' in resolved) {
      throw new Error(`无法恢复员工会话：${resolved.error.code}`);
    }
    return resolved.agent;
  }

  function applyRoleEffort(agent, effort) {
    if (agent === undefined || typeof effort !== 'string' || effort.trim() === '') return false;
    if (typeof ctx.sessionController.agents?.selectForNextRequest !== 'function') return false;
    const header = typeof agent.session?.requestHeader === 'function' ? agent.session.requestHeader() : undefined;
    const config = header?.config ?? {};
    const provider = config.provider ?? agent.options?.provider;
    const model = config.model ?? agent.options?.model;
    if (typeof provider !== 'string' || provider === '' || typeof model !== 'string' || model === '') return false;
    const selection = { provider, model };
    if (effort.trim() !== 'default') selection.reasoningEffort = effort.trim();
    try {
      ctx.sessionController.agents.selectForNextRequest(agent, selection);
      return true;
    } catch (error) {
      console.warn('[agent-org] could not apply member reasoning effort:', error);
      return false;
    }
  }
  async function applyRoleModel(agent, role) {
    if (role?.model === undefined || role?.model === null) return false;
    try {
      const effort = role.model.reasoningEffort
        ?? (typeof role.effort === 'string' && role.effort !== 'default' ? role.effort : undefined);
      await selectHostSessionModel({
        sessionId: agent.session.id,
        provider: role.model.provider,
        model: role.model.model,
        ...(effort === undefined ? {} : { reasoningEffort: effort }),
      });
      return true;
    } catch (error) {
      console.warn('[agent-org] could not apply member model:', error);
      return false;
    }
  }

  async function applyRoleModelAndEffort(agent, role) {
    if (role?.model !== undefined && role?.model !== null) {
      return applyRoleModel(agent, role);
    }
    return applyRoleEffort(agent, role?.effort);
  }


  async function createRootRoleSession(store, org, role, workspace, signal, leadSessionId) {
    const sessionId = `session-${randomUUID()}`;
    employeeSessionIds.add(sessionId);
    // Create a root session by cwd only: passing workspaceId would attach a
    // blank member immediately, letting the client's New Session path reuse and
    // hijack it before the identity/bootstrap turn exists.
    //
    // Do not copy the lead session's agent preset: a preset can carry the lead
    // persona/system prompt, and inheriting it would send the lead identity to
    // every member. The standard create path supplies the deployment default
    // model without copying another session's identity.
    const created = await createInternalSession({
      cwd: workspace.path,
      sessionId,
    });
    const createdSessionId = created.sessionId ?? sessionId;
    employeeSessionIds.add(createdSessionId);
    const resolved = await ctx.sessionController.agents.resolveAgent(createdSessionId);
    if ('error' in resolved) {
      throw new Error(`无法解析新建员工会话：${resolved.error.code}`);
    }
    const agent = resolved.agent;
    await applyRoleModelAndEffort(agent, role);
    const roleSessionId = agent.session.id;
    employeeSessionIds.add(roleSessionId);
    await installEmployeeTools(agent, { store, workspace, role });
    try { ctx.sessionTitle.rename(agent.session, role.name); } catch (error) {
      console.warn('[agent-org] could not title role session:', error);
    }
    try { await flushLiveSession(agent.session); } catch (error) {
      console.warn('[agent-org] could not flush new role session:', error);
    }
    // Attach immediately: a newly created role must appear in the current
    // workspace, not in Ungrouped. Keeping it unattached until a successful
    // bootstrap leaves orphaned blank sessions whenever the first turn fails
    // (bad model config, provider error, abort, or a slow startup).
    let attached = await attachRoleSession(workspace, roleSessionId);
    let bootstrapped = false;
    try {
      const bootstrap = await runAgentTurn(agent, buildRoleBootstrapPrompt(org, role, workspace), signal);
      bootstrapped = bootstrap?.reason?.kind === 'completed';
      if (!bootstrapped) {
        console.warn(`[agent-org] role bootstrap for ${role.name} ended with ${bootstrap?.reason?.kind ?? 'unknown'}; session stays unattached:`, roleSessionId);
      }
    } catch (error) {
      console.warn(`[agent-org] role bootstrap for ${role.name} failed; session stays unattached:`, error);
    }
    if (bootstrapped && !attached) {
      attached = await attachRoleSession(workspace, roleSessionId);
    }
    return roleSessionId;
  }

  async function ensureRootRoleSession(store, org, role, workspace, signal, leadSessionId) {
    const repairKey = `${workspace.id}:${role.id}`;
    const inFlight = roleRepairs.get(repairKey);
    if (inFlight !== undefined) return inFlight;
    const operation = (async () => {
      const freshest = store.current.roles.find((candidate) => candidate.id === role.id);
      const effectiveRole = freshest === undefined ? role : { ...role, sessionId: freshest.sessionId };
      const existing = typeof effectiveRole.sessionId === 'string' && effectiveRole.sessionId !== ''
        ? effectiveRole.sessionId
        : null;
      if (existing === null) {
        const childId = await createRootRoleSession(store, org, effectiveRole, workspace, signal, leadSessionId);
        await persistRoleSession(store, role.id, childId);
        return childId;
      }
      const existingHeader = await readSessionHeader(existing);
      if (existingHeader === undefined) {
        // A stored role session that cannot be read is not proof that it is
        // gone. Minting a replacement here is how a single transient read
        // failure became a stream of duplicate role sessions. Refuse automatic
        // replacement: leave the id, workspace attachments, and archive state
        // untouched. Recovery is an explicit user action.
        console.warn(
          `[agent-org] role session ${existing} for ${role.id} is unreadable; refusing automatic replacement. ` +
          'Repair the session manually or clear the stored session id explicitly if replacement is intended.',
        );
        return existing;
      }
      if (existingHeader.origin === 'subagent') {
        // Legacy migration: a subagent session cannot become a root role
        // session. Replace it once and archive the subagent session.
        const childId = await createRootRoleSession(store, org, effectiveRole, workspace, signal, leadSessionId);
        await persistRoleSession(store, role.id, childId);
        if (existing !== childId) {
          await ctx.workspaceRegistry.archiveSession(existing, { stopActivity: true }).catch((error) => {
            console.warn('[agent-org] could not archive replaced role session:', error);
          });
        }
        return childId;
      }
      if (await sessionIsBlank(existing)) {
        // Keep blank role sessions attached too. Detaching them was intended
        // to avoid New Session reuse, but it puts real, registered roles into
        // Ungrouped indefinitely whenever bootstrap is interrupted. The role
        // session is already titled and registered, so it belongs to the
        // workspace from creation onward.
        await attachRoleSession(workspace, existing);
        return existing;
      }
      await attachRoleSession(workspace, existing);
      return existing;
    })();
    roleRepairs.set(repairKey, operation);
    try {
      return await operation;
    } finally {
      roleRepairs.delete(repairKey);
    }
  }

  async function provisionRoleSessions(store, workspace, leadSessionId, onlyRoleId = null) {
    const current = store.current;
    const signal = AbortSignal.timeout(45_000);
    const failures = [];
    for (const role of current.roles) {
      if (onlyRoleId !== null && role.id !== onlyRoleId) continue;
      if (!role.enabled) continue;
      try {
        await ensureRootRoleSession(store, current, role, workspace, signal, leadSessionId);
      } catch (error) {
        failures.push({ role, error });
        console.warn(`[agent-org] could not provision role session for ${role.id}:`, error);
      }
    }
    const leadSession = ctx.sessions.get(leadSessionId);
    if (leadSession !== undefined) {
      try {
        ctx.sessionTitle.rename(leadSession, current.lead.label);
      } catch (error) {
        console.warn('[agent-org] could not title lead session:', error);
      }
    }
    return failures;
  }

  async function repairRoleSessions(store, workspace) {
    const current = store.current;
    const leadSessionId = current.lead.sessionId;
    const signal = AbortSignal.timeout(20_000);
    for (const role of current.roles) {
      if (!role.enabled) continue;
      try {
        await ensureRootRoleSession(store, current, role, workspace, signal, leadSessionId);
      } catch (error) {
        console.warn(`[agent-org] could not repair role session for ${role.id}:`, error);
      }
    }
    await ensureLeadInitialized(store, workspace);
  }

  async function sessionIsBlank(sessionId) {
    try {
      const observation = await ctx.sessionQuery.observeSession(sessionId, { projectionMode: 'all' });
      try {
        return observation.projections?.values?.sessionListMetadata?.blank !== false;
      } finally {
        observation[Symbol.dispose]?.();
      }
    } catch {
      return false;
    }
  }

  async function initializeLeadSession(leadSessionId, org, signal, message = null) {
    if (typeof leadSessionId !== 'string' || leadSessionId === '') return;
    // A member session must never receive the lead onboarding turn. This can
    // happen when setup is confirmed from a member conversation; the stored
    // lead id is authoritative, not whichever session submitted the form.
    if (org.roles.some((role) => role.sessionId === leadSessionId)) {
      console.warn('[agent-org] refusing to initialize member session as lead:', leadSessionId);
      return;
    }
    const inFlight = leadInitializations.get(leadSessionId);
    if (inFlight !== undefined) return inFlight;
    const operation = (async () => {
      let agent = ctx.agents.get(leadSessionId);
      if (agent === undefined) {
        const resolved = await ctx.sessionController.agents.resolveAgent(leadSessionId);
        if ('error' in resolved) {
          console.warn('[agent-org] could not resolve lead session:', resolved.error.code);
          return;
        }
        agent = resolved.agent;
      }
      if (agent.session.id !== leadSessionId) {
        console.warn('[agent-org] resolved lead agent id did not match:', leadSessionId);
        return;
      }
      try {
        await runAgentTurn(agent, message ?? buildTeamDesignPrompt(org), signal);
      } catch (error) {
        console.warn('[agent-org] lead session initialization failed:', error);
      }
    })();
    leadInitializations.set(leadSessionId, operation);
    try {
      await operation;
    } finally {
      leadInitializations.delete(leadSessionId);
    }
  }

  async function ensureLeadInitialized(store, workspace) {
    const leadSessionId = store.current.lead.sessionId;
    if (typeof leadSessionId !== 'string' || leadSessionId === '') return;
    if (!(await sessionIsBlank(leadSessionId))) return;
    await initializeLeadSession(leadSessionId, store.current, AbortSignal.timeout(120_000));
  }

  async function ensureLeadInstalled(sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') return;
    const agent = ctx.agents.get(sessionId);
    if (agent === undefined || installations.has(agent)) return;
    await installLead(agent);
  }

  async function delegateToPersistentRole({ store, org, role, workspace, caller, task, signal }) {
    return enqueueRole(`${workspace.id}:${role.id}`, async () => {
      const childId = await ensureRootRoleSession(store, org, role, workspace, signal, caller.id);
      const blank = await sessionIsBlank(childId);
      // Keep the role session attached even while its first identity turn is
      // running. Blank sessions must not drift into Ungrouped after failures.
      await attachRoleSession(workspace, childId);
      const agent = await ensureEmployeeAgent(childId);
      await applyRoleModelAndEffort(agent, role);
      await installEmployeeTools(agent, { store, workspace, role });
      try { ctx.sessionTitle.rename(agent.session, role.name); } catch { /* best-effort */ }
      if (blank) {
        // A blank stored session has no identity turn yet (an earlier
        // bootstrap may have aborted before delivering it). Inject the role
        // card before the task so the employee never runs without its identity.
        const bootstrap = await runAgentTurn(agent, buildRoleBootstrapPrompt(org, role, workspace), signal);
        if (bootstrap.reason?.kind !== 'completed') return { childId, ...bootstrap };
      }
      const turn = await runAgentTurn(agent, buildRoleTaskPrompt(org, role, task, workspace), signal);
      if (blank && turn.reason?.kind === 'completed') await attachRoleSession(workspace, childId);
      return { childId, ...turn };
    });
  }



  function defaultMemberName(org, title) {
    const prefix = String(title ?? '').trim();
    if (prefix === '') return '';
    const used = new Set(org.roles.map((role) => role.name));
    let index = 1;
    let candidate = `${prefix}-${String(index).padStart(2, '0')}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${prefix}-${String(index).padStart(2, '0')}`;
    }
    return candidate;
  }

  async function resolveEmployeeContext(agent) {
    const sessionId = agent?.session?.id;
    if (typeof sessionId !== 'string') return undefined;
    const workspace = await resolveWorkspaceForSession(ctx, sessionId);
    if (workspace === undefined) {
      return employeeSessionIds.has(sessionId) ? { pending: true } : undefined;
    }
    const store = getWorkspaceStore(workspace);
    await store.load();
    const role = store.current.roles.find((candidate) => candidate.sessionId === sessionId);
    if (role !== undefined) return { workspace, store, role };
    return employeeSessionIds.has(sessionId) ? { pending: true } : undefined;
  }

  function resolveReportsTo(org, value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text === '' || text === 'lead' || text.toLowerCase() === 'lead') return 'lead';
    if (text === org.lead.label || text === '组长') return 'lead';
    const manager = findRole(org, text);
    return manager === null ? null : manager.id;
  }

  function resolveRelationNode(org, value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text === '') return null;
    if (text === 'lead' || text.toLowerCase() === 'lead' || text === org.lead.label || text === '组长') return 'lead';
    const role = findRole(org, text);
    return role === null ? null : role.id;
  }

  function managerChainContains(org, startId, targetId) {
    let cursor = startId;
    const seen = new Set();
    while (cursor !== 'lead' && cursor !== null && cursor !== undefined && !seen.has(cursor)) {
      if (cursor === targetId) return true;
      seen.add(cursor);
      cursor = org.roles.find((role) => role.id === cursor)?.reportsTo ?? 'lead';
    }
    return false;
  }

  function createMyReportsTool(employee) {
    const { store } = employee;
    return {
      name: 'team_my_reports',
      description: 'Read-only. Return the direct reports of the current lead or member: id, name, title, level, enabled state, and effort. Never includes indirect reports or unrelated roles.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            self: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                title: { type: 'string' },
              },
              required: ['id', 'name', 'title'],
            },
            reports: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  title: { type: 'string' },
                  level: { type: 'string' },
                  enabled: { type: 'boolean' },
                  effort: { type: 'string' },
                },
                required: ['id', 'name', 'title', 'level', 'enabled', 'effort'],
              },
            },
            summary: { type: 'string' },
          },
          required: ['self', 'reports', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => true,
      presentCall() {
        return { card: 'generic', title: '查看直属下级', kind: 'other', rawInput: {} };
      },
      async execute(_args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured) {
          return { self: { id: '', name: '', title: '' }, reports: [], summary: '当前工作区尚未建立协作组，暂无直属下级。' };
        }
        const org = store.current;
        let self;
        if (org.lead.sessionId === caller?.session?.id) {
          self = { id: 'lead', name: org.lead.label, title: '组长' };
        } else {
          const role = org.roles.find((candidate) => candidate.sessionId === caller?.session?.id);
          if (role === undefined) throw new Error('当前会话不是协作组成员，无法查询直属下级。');
          self = { id: role.id, name: role.name, title: role.title };
        }
        const reports = org.roles
          .filter((role) => role.reportsTo === self.id)
          .map((role) => ({
            id: role.id,
            name: role.name,
            title: role.title,
            level: role.level === 'captain' ? 'captain' : 'member',
            enabled: role.enabled !== false,
            effort: role.effort || 'low',
          }));
        const summary = reports.length === 0
          ? `${self.name}（${self.title}）当前没有直属下级。`
          : `${self.name}（${self.title}）的直属下级（${reports.length}）：\n${reports.map((role) => `- ${role.id} · ${role.name} · ${role.title} · ${role.level === 'captain' ? '队长' : '队员'} · ${role.enabled ? '启用' : '停用'} · effort=${role.effort}`).join('\n')}`;
        return { self, reports, summary };
      },
    };
  }

  function createRelationTool(employee) {
    const { store } = employee;
    return {
      name: 'team_relation',
      description:
        'Create a temporary graph relation, or (lead only) change a member permanent reporting relationship or manage a directed handoff. ' +
        'Every team member may create temporary relations; only the lead may change reportsTo and handoff order. ' +
        'Use this instead of editing organization files or claiming a relation exists without calling the tool.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            enum: ['create_temporary', 'set_manager', 'add_handoff', 'remove_handoff'],
            description: 'create_temporary: any member; set_manager, add_handoff, remove_handoff: lead only.',
          },
          from: { type: 'string', description: '临时关系起点：角色 id/姓名/职位，或 lead/组长。' },
          to: { type: 'string', description: '临时关系终点：角色 id/姓名/职位，或 lead/组长。' },
          label: { type: 'string', description: '关系说明；临时关系例如「联合评审」，交接关系例如「提交前复核」。' },
          expiresAt: { type: 'string', description: '可选 ISO 到期时间；省略时默认 24 小时。' },
          role: { type: 'string', description: 'set_manager 时要修改的成员：角色 id/姓名/职位。' },
          manager: { type: 'string', description: 'set_manager 时的新固定汇报对象：lead/组长或现有成员。' },
          reason: { type: 'string', description: '为什么需要这项人事/关系改动；必填。' },
        },
        required: ['action', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string' },
            relationId: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['action', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return {
          card: 'generic',
          title: args.action === 'set_manager'
            ? `调整固定汇报：${args.role ?? ''}`
            : args.action === 'add_handoff'
              ? `设置交接顺序：${args.from ?? ''} → ${args.to ?? ''}`
              : args.action === 'remove_handoff'
                ? `移除交接：${args.from ?? ''} → ${args.to ?? ''}`
                : `建立临时关系：${args.from ?? ''} → ${args.to ?? ''}`,
          kind: 'other',
          rawInput: args,
        };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_relation 需要一个团队成员会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) {
          throw new Error('协作组尚未启用，不能修改关系。');
        }
        const current = store.current;
        const callerRole = current.roles.find((role) => role.sessionId === caller.session.id);
        const isLead = current.lead.sessionId === caller.session.id;
        if (!isLead && callerRole === undefined) {
          throw new Error('当前会话不是团队组长或成员，不能修改协作组关系。');
        }
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('修改关系必须填写 reason（至少 2 个字符）。');
        const auditActor = isLead ? current.lead.label : callerRole.name;
        const auditRelation = async (actionName, summary, roleName = '') => {
          try {
            await appendAudit(store, { kind: 'relation', action: actionName, actor: auditActor, roleName, reason, summary, roleId: '' });
          } catch (error) {
            console.warn('[agent-org] could not append relation audit:', error);
          }
        };
        const action = typeof args.action === 'string' ? args.action.trim() : '';
        if (action === 'create_temporary') {
          const from = resolveRelationNode(current, args.from);
          const to = resolveRelationNode(current, args.to);
          if (from === null || to === null) {
            throw new Error('临时关系起点或终点不存在；请使用 lead/组长或现有成员 id/姓名/职位。');
          }
          if (from === to) throw new Error('临时关系的起点和终点不能是同一个人。');
          const label = typeof args.label === 'string' ? args.label.trim() : '';
          if (label.length > 80) throw new Error('关系说明不能超过 80 个字符');
          let expiresAt;
          if (typeof args.expiresAt === 'string' && args.expiresAt.trim() !== '') {
            const parsed = Date.parse(args.expiresAt);
            if (!Number.isFinite(parsed)) throw new Error('expiresAt 必须是合法的 ISO 时间');
            if (parsed <= Date.now()) throw new Error('临时关系的到期时间必须晚于当前时间');
            expiresAt = new Date(parsed).toISOString();
          } else {
            expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          }
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const snapshot = store.current;
            if ((snapshot.relations ?? []).length >= 64) throw new Error('附加关系不能超过 64 条');
            const relation = {
              id: `relation-${randomUUID().slice(0, 8)}`,
              from,
              to,
              type: 'temporary',
              label,
              expiresAt,
            };
            try {
              await store.save(snapshot.revision, {
                ...snapshot,
                relations: [...(snapshot.relations ?? []), relation],
              });
              const summary = `已建立临时关系：${from} → ${to}${label ? `（${label}）` : ''}，有效期至 ${new Date(expiresAt).toLocaleString('zh-CN', { hour12: false })}。`;
              await auditRelation(action, summary);
              return { action, relationId: relation.id, summary };
            } catch (error) {
              if (error instanceof OrgRevisionError) continue;
              throw error;
            }
          }
          throw new Error('临时关系保存失败：组织配置已被其他操作修改，请重试。');
        }
        if (action === 'add_handoff') {
          if (!isLead) throw new Error('只有组长可以调整交接顺序；组员只能发起临时关系。');
          const from = resolveRelationNode(current, args.from);
          const to = resolveRelationNode(current, args.to);
          if (from === null || to === null) {
            throw new Error('交接起点或终点不存在；请使用 lead/组长或现有成员 id/姓名/职位。');
          }
          if (from === to) throw new Error('交接关系的起点和终点不能是同一个人。');
          const label = typeof args.label === 'string' ? args.label.trim() : '';
          if (label.length > 80) throw new Error('交接说明不能超过 80 个字符');
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const snapshot = store.current;
            if ((snapshot.relations ?? []).length >= 64) throw new Error('附加关系不能超过 64 条');
            const relation = {
              id: `relation-${randomUUID().slice(0, 8)}`,
              from,
              to,
              type: 'handoff',
              label,
              expiresAt: null,
            };
            try {
              await store.save(snapshot.revision, {
                ...snapshot,
                relations: [...(snapshot.relations ?? []), relation],
              });
              const summary = `已设置交接顺序：${from} 完成后交给 ${to}${label ? `（${label}）` : ''}。`;
              await auditRelation(action, summary);
              return { action, relationId: relation.id, summary };
            } catch (error) {
              if (error instanceof OrgRevisionError) continue;
              throw error;
            }
          }
          throw new Error('交接关系保存失败：组织配置已被其他操作修改，请重试。');
        }
        if (action === 'remove_handoff') {
          if (!isLead) throw new Error('只有组长可以调整交接顺序；组员只能发起临时关系。');
          const from = resolveRelationNode(current, args.from);
          const to = resolveRelationNode(current, args.to);
          if (from === null || to === null) throw new Error('交接起点或终点不存在。');
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const snapshot = store.current;
            const relations = (snapshot.relations ?? []).filter((relation) => !(
              relation.type === 'handoff' && relation.from === from && relation.to === to
            ));
            if (relations.length === (snapshot.relations ?? []).length) {
              throw new Error('没有找到匹配的交接关系。');
            }
            try {
              await store.save(snapshot.revision, { ...snapshot, relations });
              const summary = `已移除交接关系：${from} → ${to}。`;
              await auditRelation(action, summary);
              return { action, summary };
            } catch (error) {
              if (error instanceof OrgRevisionError) continue;
              throw error;
            }
          }
          throw new Error('交接关系删除失败：组织配置已被其他操作修改，请重试。');
        }
        if (action === 'set_manager') {
          if (!isLead) throw new Error('只有组长可以修改成员的固定汇报关系；组员只能发起临时关系。');
          const role = findRole(current, args.role);
          if (role === null) throw new Error(`找不到成员“${args.role ?? ''}”`);
          const manager = resolveReportsTo(current, args.manager);
          if (manager === null) throw new Error(`无法解析汇报对象“${args.manager ?? ''}”`);
          if (manager === role.id) throw new Error('成员不能汇报给自己');
          if (manager !== 'lead' && managerChainContains(current, manager, role.id)) {
            throw new Error('不能把成员移动到其下属下面，汇报关系会形成环。');
          }
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const snapshot = store.current;
            const roles = snapshot.roles.map((candidate) => (
              candidate.id === role.id ? { ...candidate, reportsTo: manager } : candidate
            ));
            try {
              await store.save(snapshot.revision, { ...snapshot, roles });
              const summary = `已将「${role.name}」的固定汇报对象改为「${manager === 'lead' ? snapshot.lead.label : snapshot.roles.find((item) => item.id === manager)?.name ?? manager}」。`;
              await auditRelation(action, summary, role.name);
              return { action, summary };
            } catch (error) {
              if (error instanceof OrgRevisionError) continue;
              throw error;
            }
          }
          throw new Error('固定汇报关系保存失败：组织配置已被其他操作修改，请重试。');
        }
        throw new Error('action 必须是 create_temporary、set_manager、add_handoff 或 remove_handoff');
      },
    };
  }

  function createEffortTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_set_effort',
      description:
        'Lead/captain only. Set one direct report thinking/reasoning effort for the next and subsequent turns, and persist it in the organization. ' +
        'The accepted levels are read from the target model live catalog (DeepSeek has off/low/high/max; Qwen may have minimal/medium/xhigh). Call team_select_model for the list.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '成员 id/姓名/职位，或唯一的部分职位。' },
          effort: { type: 'string', description: '思考强度 id，必须是目标模型实时目录支持的分级（例如 minimal/off/low/medium/high/xhigh/max）。' },
          reason: { type: 'string', description: '为什么调整该成员思考强度；必填。' },
        },
        required: ['role', 'effort', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleId: { type: 'string' },
            effort: { type: 'string' },
            applied: { type: 'boolean' },
            summary: { type: 'string' },
          },
          required: ['roleId', 'effort', 'applied', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return {
          card: 'generic',
          title: `调整思考强度：${args.role ?? ''} → ${args.effort ?? ''}`,
          kind: 'other',
          rawInput: args,
        };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_set_effort 需要一个组长或队长会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能调整思考强度。');
        const manager = skillCaller(store.current, caller);
        if (manager === null) throw new Error('只有组长或启用中的队长可以调整直属成员思考强度。');
        const role = findRole(store.current, args.role);
        if (role === null) throw new Error(`找不到成员“${args.role ?? ''}”`);
        if (!role.enabled) throw new Error(`成员“${role.name}”已停用，不能调整思考强度。`);
        const managerId = manager.isLead ? 'lead' : manager.id;
        if (role.reportsTo !== managerId) {
          throw new Error(`只能调整直接向自己汇报的成员思考强度；“${role.name}”不是你的直属下级。`);
        }
        const requested = typeof args.effort === 'string' ? args.effort.trim().toLowerCase() : '';
        const normalized = normalizeEffort(requested);
        if (normalized === null) throw new Error('思考强度必须是目标模型支持的有效 effort id。');
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('调整思考强度必须填写 reason（至少 2 个字符）。');
        let agent = undefined;
        if (typeof role.sessionId === 'string' && role.sessionId !== '') {
          agent = ctx.agents.get(role.sessionId);
          if (agent === undefined) {
            const resolved = await ctx.sessionController.agents.resolveAgent(role.sessionId);
            if (!('error' in resolved)) agent = resolved.agent;
          }
        }
        let provider = role.model?.provider;
        let modelName = role.model?.model;
        if (provider === undefined || modelName === undefined) {
          try {
            const currentSelection = agent === undefined ? undefined : ctx.sessionController.agents.selectionFor(agent)?.current;
            provider = currentSelection?.provider ?? agent?.options?.provider;
            modelName = currentSelection?.model ?? agent?.options?.model;
          } catch {
            provider = agent?.options?.provider;
            modelName = agent?.options?.model;
          }
        }
        let modelMeta;
        if (typeof provider === 'string' && provider !== '' && typeof modelName === 'string' && modelName !== '') {
          const catalog = await readHostModelCatalog();
          modelMeta = (catalog.groups ?? []).find((group) => group.id === provider)?.models?.find((model) => model.id === modelName);
          const efforts = modelMeta?.reasoning?.efforts ?? [];
          // Only reject an effort when the live catalog actually advertises a
          // finite effort set. Some providers/models expose no effort metadata;
          // those still accept the id and the adapter decides what to do.
          if (efforts.length > 0 && !efforts.some((effort) => effort.id === normalized)) {
            throw new Error(`模型 ${provider}/${modelName} 不支持思考强度 ${normalized}；可选：${efforts.map((effort) => `${effort.id}(${effort.name})`).join('、')}`);
          }
        }
        const effectiveRole = role.model === null || role.model === undefined
          ? { ...role, effort: normalized }
          : {
            ...role,
            effort: normalized,
            model: { provider, model: modelName, reasoningEffort: normalized },
          };
        let applied = false;
        if (agent !== undefined) {
          applied = role.model === null || role.model === undefined
            ? applyRoleEffort(agent, normalized)
            : await applyRoleModelAndEffort(agent, effectiveRole);
        }
        let saved = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const snapshot = store.current;
          const roles = snapshot.roles.map((candidate) => (
            candidate.id === role.id ? {
              ...candidate,
              effort: normalized,
              model: candidate.model === null || candidate.model === undefined
                ? null
                : {
                  provider,
                  model: modelName,
                  reasoningEffort: normalized,
                },
            } : candidate
          ));
          try {
            await store.save(snapshot.revision, { ...snapshot, roles });
            saved = true;
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError) continue;
            throw error;
          }
        }
        if (!saved) throw new Error('思考强度保存失败：组织配置已被其他操作修改，请重试。');
        const summary = `已设置「${role.name}」思考强度为 ${normalized}${applied ? '，并应用到成员会话' : '，下次任务/会话启动时生效'}。`;
        try {
          await appendAudit(store, { kind: 'personnel', action: 'set_effort', actor: manager.name, roleId: role.id, roleName: role.name, reason, summary });
        } catch (error) {
          console.warn('[agent-org] could not append effort audit:', error);
        }
        return { roleId: role.id, effort: normalized, applied, summary };
      },
    };
  }

  async function performAssignment({ store, workspace, org, role, caller, task, signal, delegatorName, delegatorRoleId = '' }) {
    const startedAt = Date.now();
    const scopedTask = `workspace=${workspace.path}\n${task}`;
    const run = runs.start({
      workspaceId: workspace.id,
      role,
      task: scopedTask,
      agent: caller,
      childSessionId: typeof role.sessionId === 'string' ? role.sessionId : '',
      delegatorName,
      delegatorRoleId,
    });
    try {
      const result = await delegateToPersistentRole({
        store,
        org,
        role,
        workspace,
        caller,
        task: scopedTask,
        signal,
      });
      run.childSessionId = String(result.childId);
      const durationMs = Date.now() - startedAt;
      const summary = bounded(
        result.text || '（成员未返回文本输出）',
        MAX_TOOL_SUMMARY_CHARS,
      );
      const reasonKind = result.reason?.kind;
      const status = signal.aborted || reasonKind === 'aborted'
        ? 'aborted'
        : reasonKind === 'completed'
          ? 'completed'
          : 'failed';
      const diagnostic = status === 'completed' ? '' : JSON.stringify(result.reason ?? { kind: 'unknown' });
      runs.finish(run, status, summary, diagnostic, durationMs);
      const value = {
        roleId: role.id,
        roleName: role.name,
        roleTitle: role.title,
        childSessionId: String(result.childId),
        status,
        summary,
        durationMs,
      };
      if (diagnostic !== '') value.diagnostic = diagnostic;
      return value;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = errorMessage(error);
      const aborted = signal.aborted;
      runs.finish(run, aborted ? 'aborted' : 'failed', '', message, durationMs);
      throw new Error(aborted
        ? `组员“${role.name}”的本次轮次随委派轮次一起被用户中止；成员会话已保留，可以重新委派继续。`
        : `组员“${role.name}”执行失败：${message}`);
    }
  }

  async function waitForAllAssignments(workspaceId, signal) {
    while (runs.snapshot(workspaceId).some((run) => run.status === 'running')) {
      if (signal?.aborted) throw new Error('等待所有委派完成时被中止。');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  function skillCaller(org, caller) {
    if (caller === undefined) return null;
    if (org.lead.sessionId === caller.session.id) {
      return { isLead: true, id: 'lead', name: org.lead.label, title: '组长' };
    }
    const role = org.roles.find((candidate) => candidate.sessionId === caller.session.id);
    if (role === undefined || role.enabled === false) return null;
    return { isLead: false, id: role.id, name: role.name, title: role.title, role };
  }

  function skillTarget(org, manager, textRole) {
    const role = findRole(org, textRole);
    if (role === null) throw new Error(`找不到成员“${textRole ?? ''}”`);
    if (!role.enabled) throw new Error(`成员“${role.name}”已停用，不能注入技能。`);
    const managerId = manager.isLead ? 'lead' : manager.id;
    if (role.reportsTo !== managerId) {
      throw new Error(`只能给直接向自己汇报的成员注入技能；“${role.name}”不是你的直属下级。`);
    }
    return role;
  }

  function createExperienceSummaryTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_project_summary',
      description:
        'Lead only. Record a short reusable lesson after a project is delivered or at an important stage boundary. ' +
        'The lesson is stored globally (across workspaces) and injected into the lead prompt on future sessions. ' +
        'Keep it short and actionable; never store secrets, credentials, personal data, or one-off file names as universal facts.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: ['project', 'stage'], description: 'project=项目完成总结，stage=阶段性进展总结。' },
          title: { type: 'string', description: '简短标题，例如「硬件+固件联调」或「支付模块迁移」。' },
          summary: { type: 'string', description: '这个项目/阶段发生了什么、结果如何，最多 240 字。' },
          instructions: { type: 'string', description: '下次可复用的做法、检查清单或坑点，最多 800 字。' },
        },
        required: ['kind', 'title', 'summary', 'instructions'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            kind: { type: 'string' },
            title: { type: 'string' },
            count: { type: 'integer' },
            summary: { type: 'string' },
          },
          required: ['id', 'kind', 'title', 'count', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `总结项目经验：${args.title ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能记录项目经验。');
        if (store.current.lead.sessionId !== caller?.session?.id) throw new Error('只有组长可以记录项目经验。');
        if (experienceStore === null) throw new Error('全局经验库尚未初始化。');
        const kind = args.kind === 'stage' ? 'stage' : 'project';
        const title = typeof args.title === 'string' ? args.title.trim() : '';
        const summary = typeof args.summary === 'string' ? args.summary.trim() : '';
        const instructions = typeof args.instructions === 'string' ? args.instructions.trim() : '';
        if (title.length < 1 || title.length > 80) throw new Error('经验标题需要 1–80 个字符');
        if (summary.length < 1 || summary.length > 240) throw new Error('经验摘要需要 1–240 个字符');
        if (instructions.length < 1 || instructions.length > 800) throw new Error('可复用做法需要 1–800 个字符');
        const saved = await experienceStore.add({
          kind,
          title,
          summary,
          instructions,
          workspace: workspace.path,
        });
        const resultSummary = `已记录${kind === 'stage' ? '阶段' : '项目'}经验「${title}」，全局经验共 ${saved.count} 条；之后打开组长会话会自动注入。`;
        try {
          await appendAudit(store, {
            kind: 'project',
            action: kind === 'stage' ? 'summarize_stage' : 'summarize_project',
            actor: store.current.lead.label,
            roleId: 'lead',
            roleName: store.current.lead.label,
            reason: `项目经验沉淀：${title}`,
            summary: resultSummary,
          });
        } catch (error) {
          console.warn('[agent-org] could not append experience audit:', error);
        }
        return { id: saved.entry.id, kind: saved.entry.kind, title: saved.entry.title, count: saved.count, summary: resultSummary };
      },
    };
  }

  function createFailureDiagnosisTool() {
    return {
      name: 'team_failure_diagnosis',
      description: 'Lead only, read-only. Group recent failed/aborted team runs by role and show the latest diagnostic, so the lead can distinguish one member session/model failure from a global provider failure before firing and rebuilding that member.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 40, description: '最多检查最近的运行记录，默认 20。' },
        },
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            globalIssue: { type: 'boolean' },
            rebuildRoleId: { type: 'string' },
            roles: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  roleId: { type: 'string' },
                  roleName: { type: 'string' },
                  failures: { type: 'integer' },
                  lastDiagnostic: { type: 'string' },
                },
                required: ['roleId', 'roleName', 'failures', 'lastDiagnostic'],
              },
            },
            recommendation: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['globalIssue', 'rebuildRoleId', 'roles', 'recommendation', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => true,
      presentCall() {
        return { card: 'generic', title: '诊断委派失败', kind: 'other', rawInput: {} };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        if (exec.agent?.session?.id !== undefined) {
          // Authorization is checked against the active organization below.
        }
        const limit = Number.isSafeInteger(args.limit) ? Math.min(40, Math.max(1, args.limit)) : 20;
        const snapshots = runs.snapshot().slice(-limit).filter((run) => run.status === 'failed' || run.status === 'aborted');
        const grouped = new Map();
        for (const run of snapshots) {
          if (typeof run.roleId !== 'string' || run.roleId === '') continue;
          const item = grouped.get(run.roleId) ?? {
            roleId: run.roleId,
            roleName: run.roleName ?? run.roleId,
            failures: 0,
            lastDiagnostic: '',
          };
          item.failures += 1;
          item.lastDiagnostic = run.diagnostic || run.summary || item.lastDiagnostic;
          grouped.set(run.roleId, item);
        }
        const roles = [...grouped.values()].sort((a, b) => b.failures - a.failures);
        const globalIssue = roles.length >= 2;
        const repeated = roles.filter((item) => item.failures >= 2);
        const rebuildRoleId = !globalIssue && repeated.length === 1 ? repeated[0].roleId : '';
        const recommendation = globalIssue
          ? '多个成员同时失败，优先排查全局模型/provider/会话基础设施；不要逐个开除成员。'
          : rebuildRoleId !== ''
            ? `仅“${repeated[0].roleName}”重复失败：先转移其直属下级，再开除并用原职位/职责/instructions/汇报对象/已注入 skills 重建该成员。`
            : roles.length === 0
              ? '最近没有失败记录；先重试一次，不要开除成员。'
              : '目前只有单次失败；先重试并检查诊断，持续失败再重建。';
        const lines = roles.length === 0
          ? '最近没有失败记录。'
          : roles.map((item) => `- ${item.roleId} · ${item.roleName} · 失败 ${item.failures} 次${item.lastDiagnostic ? ` · 最后诊断：${item.lastDiagnostic}` : ''}`).join('\n');
        return {
          globalIssue,
          rebuildRoleId,
          roles,
          recommendation,
          summary: `${recommendation}\n失败聚合：\n${lines}`,
        };
      },
    };
  }

  function contentDirectory() {
    return process.env.DSH_AGENT_ORG_CONTENT_DIR
      || fileURLToPath(new URL('./content/', import.meta.url));
  }

  function writeJsonAtomic(path, value) {
    const temp = `${path}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(temp, path);
  }

  function slugId(prefix) {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }

  function createSaveKnowledgeTool(employee) {
    const { store } = employee;
    return {
      name: 'team_save_knowledge',
      description: 'Lead only. Persist a newly learned role template or organization pattern into categorized JSON under content/, so future teams can reuse it. Requires a reason and validates before writing.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['role_template', 'org_pattern'], description: '要沉淀的分类。' },
          title: { type: 'string', description: 'role_template 的职位名称（1–24 字）。' },
          name: { type: 'string', description: 'org_pattern 的模式名称（1–40 字）。' },
          responsibilities: { type: 'string', description: 'role_template 的职责摘要。' },
          authority: { type: 'string', description: 'role_template 的具体职权；role_template 必填。' },
          boundaries: { type: 'string', description: 'role_template 的禁止边界；role_template 必填。' },
          instructions: { type: 'string', description: 'role_template 的身份提示词/工作准则。' },
          level: { type: 'string', enum: ['member', 'captain'], description: 'role_template 的级别，默认 member。' },
          accent: { type: 'string', description: 'role_template 的六位十六进制强调色。' },
          fit: { type: 'string', description: 'org_pattern 适用场景。' },
          shape: { type: 'string', description: 'org_pattern 的结构说明。' },
          avoid: { type: 'string', description: 'org_pattern 的禁止事项。' },
          reason: { type: 'string', description: '为什么这个知识值得沉淀；必填。' },
        },
        required: ['type', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string' },
            id: { type: 'string' },
            title: { type: 'string' },
            path: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['type', 'id', 'title', 'path', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `沉淀团队知识：${args.title ?? args.name ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能沉淀团队知识。');
        if (store.current.lead.sessionId !== exec.agent?.session?.id) throw new Error('只有组长可以沉淀团队知识。');
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('沉淀知识必须填写 reason。');
        const type = args.type === 'org_pattern' ? 'org_pattern' : 'role_template';
        const dir = contentDirectory();
        if (type === 'role_template') {
          const title = typeof args.title === 'string' ? args.title.trim() : '';
          const responsibilities = typeof args.responsibilities === 'string' ? args.responsibilities.trim() : '';
          const authority = typeof args.authority === 'string' ? args.authority.trim() : '';
          const boundaries = typeof args.boundaries === 'string' ? args.boundaries.trim() : '';
          const instructions = typeof args.instructions === 'string' ? args.instructions.trim() : '';
          if (title.length < 1 || title.length > 24) throw new Error('职位名称需要 1–24 个字符。');
          if (responsibilities.length < 1 || responsibilities.length > 1000) throw new Error('职责需要 1–1000 个字符。');
          if (authority.length < 2 || authority.length > 300) throw new Error('具体职权需要 2–300 个字符。');
          if (boundaries.length < 2 || boundaries.length > 300) throw new Error('禁止边界需要 2–300 个字符。');
          if (instructions.length < 1 || instructions.length > 4000) throw new Error('工作准则需要 1–4000 个字符。');
          if (ROLE_TEMPLATES.some((template) => template.title === title) || store.current.templates.some((template) => template.title === title)) {
            throw new Error(`职位模板「${title}」已存在。`);
          }
          const accent = /^#[0-9A-Fa-f]{6}$/.test(String(args.accent ?? '')) ? String(args.accent).toUpperCase() : '#7C6CFF';
          const template = {
            id: slugId('tpl-learned'),
            title,
            accent,
            responsibilities,
            authority,
            boundaries,
            instructions,
            level: args.level === 'captain' ? 'captain' : 'member',
            builtin: false,
          };
          const path = join(dir, 'role-templates.json');
          const current = JSON.parse(readFileSync(path, 'utf8'));
          if (!Array.isArray(current)) throw new Error('role-templates.json 格式错误，必须是数组。');
          current.push(template);
          writeJsonAtomic(path, current);
          ROLE_TEMPLATES.push(template);
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const snapshot = store.current;
            try {
              await store.save(snapshot.revision, { ...snapshot, templates: [...snapshot.templates, template] });
              break;
            } catch (error) {
              if (error instanceof OrgRevisionError && attempt < 2) continue;
              throw error;
            }
          }
          return { type, id: template.id, title, path, summary: `已把职位「${title}」写入 ${path}，并加入当前团队模板列表。` };
        }
        const name = typeof args.name === 'string' ? args.name.trim() : '';
        const fit = typeof args.fit === 'string' ? args.fit.trim() : '';
        const shape = typeof args.shape === 'string' ? args.shape.trim() : '';
        const avoid = typeof args.avoid === 'string' ? args.avoid.trim() : '';
        if (name.length < 1 || name.length > 40) throw new Error('架构模式名称需要 1–40 个字符。');
        if (fit.length < 1 || fit.length > 300) throw new Error('适用场景需要 1–300 个字符。');
        if (shape.length < 1 || shape.length > 600) throw new Error('结构说明需要 1–600 个字符。');
        if (avoid.length < 1 || avoid.length > 600) throw new Error('禁止事项需要 1–600 个字符。');
        if (ORG_PATTERNS.some((pattern) => pattern.name === name)) throw new Error(`组织架构模式「${name}」已存在。`);
        const pattern = { id: slugId('pattern-learned'), name, fit, shape, avoid };
        const path = join(dir, 'org-patterns.json');
        const current = JSON.parse(readFileSync(path, 'utf8'));
        if (!Array.isArray(current)) throw new Error('org-patterns.json 格式错误，必须是数组。');
        current.push(pattern);
        writeJsonAtomic(path, current);
        ORG_PATTERNS.push(pattern);
        return { type, id: pattern.id, title: name, path, summary: `已把组织架构模式「${name}」写入 ${path}，后续组长可直接参考。` };
      },
    };
  }

  function createTaskStartTool(employee) {
    const { store } = employee;
    return {
      name: 'team_task_start',
      title: '开始任务计时',
      description: 'Lead only. At the beginning of every new user task, write a concise task title and start the total-time timer shown in the Team Org panel. Do not start a new task for clarifications within the same task.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: '一句话概括这次任务的目标，1–80 个字符；不要写“新任务”“继续”等空泛标题。' },
        },
        required: ['title'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            taskId: { type: 'string' },
            title: { type: 'string' },
            startedAt: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['taskId', 'title', 'startedAt', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `任务计时：${args.title ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能开始任务。');
        if (store.current.lead.sessionId !== caller?.session?.id) throw new Error('只有组长可以开始任务计时。');
        const title = typeof args.title === 'string' ? args.title.trim() : '';
        if (title.length < 1 || title.length > 80) throw new Error('任务标题需要 1–80 个字符。');
        const startedAt = new Date().toISOString();
        const task = { id: `task-${randomUUID().slice(0, 8)}`, title, startedAt, finishedAt: null, durationMs: 0 };
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          try {
            await store.save(current.revision, { ...current, activeTask: task });
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        const summary = `已开始任务计时：${title}（${startedAt}）`;
        try {
          await appendAudit(store, { kind: 'work', action: 'start_task', actor: store.current.lead.label, roleId: 'lead', roleName: store.current.lead.label, summary, reason: '任务开始' });
        } catch (error) {
          console.warn('[agent-org] could not append task-start audit:', error);
        }
        return { taskId: task.id, title, startedAt, summary };
      },
    };
  }

  function createTaskFinishTool(employee) {
    const { store } = employee;
    return {
      name: 'team_task_finish',
      title: '结束任务计时',
      description: 'Lead only. Finish the current task timer and persist the final total duration shown in the Team Org panel. Call before the final delivery/answer, or when the task is aborted.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            taskId: { type: 'string' },
            title: { type: 'string' },
            durationMs: { type: 'integer' },
            summary: { type: 'string' },
          },
          required: ['taskId', 'title', 'durationMs', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall() {
        return { card: 'generic', title: '结束任务计时', kind: 'other', rawInput: {} };
      },
      async execute(_args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能结束任务。');
        if (store.current.lead.sessionId !== caller?.session?.id) throw new Error('只有组长可以结束任务计时。');
        const currentTask = store.current.activeTask;
        if (currentTask === null || currentTask === undefined) throw new Error('当前没有正在计时的任务。');
        if (currentTask.finishedAt !== null) throw new Error('当前任务已经结束计时。');
        const finishedAt = new Date().toISOString();
        const durationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(currentTask.startedAt));
        const task = { ...currentTask, finishedAt, durationMs };
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          try {
            await store.save(current.revision, { ...current, activeTask: task });
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        const summary = `任务「${currentTask.title}」结束，总用时 ${formatTaskDuration(durationMs)}。`;
        try {
          await appendAudit(store, { kind: 'work', action: 'finish_task', actor: store.current.lead.label, roleId: 'lead', roleName: store.current.lead.label, summary, reason: '任务结束' });
        } catch (error) {
          console.warn('[agent-org] could not append task-finish audit:', error);
        }
        return { taskId: task.id, title: task.title, durationMs, summary };
      },
    };
  }

  function formatTaskDuration(ms) {
    const value = Math.max(0, Number(ms) || 0);
    const totalMinutes = Math.floor(value / 60_000);
    if (totalMinutes < 1) return `${Math.max(1, Math.round(value / 1000))} 秒`;
    if (totalMinutes < 60) return `${totalMinutes} 分 ${Math.floor((value % 60_000) / 1000)} 秒`;
    return `${Math.floor(totalMinutes / 60)} 小时 ${totalMinutes % 60} 分`;
  }

  function createTeamHelpTool(scope) {
    return {
      name: 'team_help',
      description: 'Read-only guide to the currently available Team Org tools, arguments, recent prompt rules, and team state. Use after plugin updates or whenever unsure how a tool works.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          topic: { type: 'string', enum: ['all', 'tools', 'prompts', 'changelog'], description: '查看范围，默认 all。' },
          query: { type: 'string', description: '可选过滤词，匹配工具名、用途或参数。' },
        },
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            version: { type: 'string' },
            topic: { type: 'string' },
            tools: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  purpose: { type: 'string' },
                  args: { type: 'string' },
                  when: { type: 'string' },
                },
                required: ['name', 'purpose', 'args', 'when'],
              },
            },
            notes: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
          required: ['version', 'topic', 'tools', 'notes', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => true,
      presentCall(args) {
        return { card: 'generic', title: `团队工具说明：${args.topic ?? 'all'}`, kind: 'other', rawInput: args };
      },
      async execute(args) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const topic = ['all', 'tools', 'prompts', 'changelog'].includes(args.topic) ? args.topic : 'all';
        const query = typeof args.query === 'string' ? args.query.trim().toLocaleLowerCase('zh-CN') : '';
        const tools = TEAM_HELP_TOOLS
          .filter((tool) => tool.roles.includes(scope))
          .filter((tool) => query === '' || [tool.name, tool.purpose, tool.args, tool.when].join('\n').toLocaleLowerCase('zh-CN').includes(query));
        const notes = TEAM_HELP_NOTES.filter((note) => query === '' || note.toLocaleLowerCase('zh-CN').includes(query));
        const toolLines = tools.map((tool) => `- ${tool.name}(${tool.args})：${tool.purpose} 适用：${tool.when}`);
        const summary = [
          `TEAM_ORG_TOOLS ${TEAM_HELP_VERSION}`,
          ...(topic === 'prompts' || topic === 'changelog' || topic === 'all' ? notes.map((note) => `- ${note}`) : []),
          ...(topic === 'tools' || topic === 'all' ? toolLines : []),
        ].join('\n');
        return {
          version: TEAM_HELP_VERSION,
          topic,
          tools: topic === 'tools' || topic === 'all'
            ? tools.map(({ name, purpose, args, when }) => ({ name, purpose, args, when }))
            : [],
          notes: topic === 'prompts' || topic === 'changelog' || topic === 'all' ? notes : [],
          summary,
        };
      },
    };
  }

  function createLeadModelTool(employee) {
    const { store } = employee;
    return {
      name: 'team_select_model',
      description:
        'Lead/captain only. List the live models and reasoning efforts available to a lead or direct report, or switch that target within the allowed model policy. ' +
        'Call with role to assign a model to a direct report; omit role only for the lead itself. Every switch needs a reason and should match task complexity and model strengths.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '可选：目标直属成员 id/姓名/职位；省略表示组长本人。队长必须指定直属成员。' },
          provider: { type: 'string', description: '可选：要切换到的 provider；省略则只列出可用模型。' },
          model: { type: 'string', description: '可选：要切换到的 model；省略则只列出可用模型。' },
          reasoningEffort: { type: 'string', description: '可选：思考强度 id，按模型支持的范围。' },
          reason: { type: 'string', description: '切换模型时必填：为什么当前任务需要这个模型。' },
        },
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string', enum: ['list', 'selected'] },
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            provider: { type: 'string' },
            model: { type: 'string' },
            reasoningEffort: { type: 'string' },
            models: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  provider: { type: 'string' },
                  providerName: { type: 'string' },
                  model: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  efforts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        default: { type: 'boolean' },
                      },
                      required: ['id', 'name', 'default'],
                    },
                  },
                },
                required: ['provider', 'providerName', 'model', 'name', 'efforts'],
              },
            },
            summary: { type: 'string' },
          },
          required: ['action', 'roleId', 'roleName', 'provider', 'model', 'reasoningEffort', 'models', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: args.provider ? `分配模型：${args.role ?? '组长'}/${args.provider}/${args.model}` : `查看可选模型：${args.role ?? '组长'}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能选择模型。');
        const manager = skillCaller(store.current, caller);
        if (manager === null) throw new Error('只有组长或岗位队长可以分配模型。');
        const roleArg = typeof args.role === 'string' ? args.role.trim() : '';
        const target = roleArg === '' ? null : skillTarget(store.current, manager, roleArg);
        if (target === null && !manager.isLead) throw new Error('队长必须指定自己的直属成员，不能修改自己的模型。');
        const targetId = target?.id ?? 'lead';
        const targetName = target?.name ?? store.current.lead.label;
        const targetSessionId = target?.sessionId ?? store.current.lead.sessionId;
        const current = target?.model ?? store.current.lead.model;
        const catalog = await readHostModelCatalog();
        const policy = store.current.lead.modelPolicy;
        const allowed = [];
        for (const group of catalog.groups ?? []) {
          for (const model of group.models ?? []) {
            if (leadModelAllowed(policy, group.id, model.id)) {
              allowed.push({
                provider: group.id,
                providerName: group.name,
                model: model.id,
                name: model.name,
                description: model.description ?? '',
                efforts: (model.reasoning?.efforts ?? []).map((effort) => ({
                  id: effort.id,
                  name: effort.name,
                  default: effort.id === model.reasoning?.defaultEffort,
                })),
              });
            }
          }
        }
        const provider = typeof args.provider === 'string' ? args.provider.trim() : '';
        const model = typeof args.model === 'string' ? args.model.trim() : '';
        if (provider === '' || model === '') {
          const lines = allowed.map((item) => `- ${item.provider}/${item.model} · ${item.name}${item.description ? `：${item.description}` : ''}${item.efforts.length > 0 ? ` · effort: ${item.efforts.map((effort) => `${effort.id}(${effort.name})`).join('/')}` : ''}`);
          return {
            action: 'list',
            roleId: targetId,
            roleName: targetName,
            provider: '',
            model: '',
            reasoningEffort: '',
            models: allowed,
            summary: `目标：${targetName}（${targetId}）${current === null || current === undefined ? '；未显式设置模型' : `；当前 ${current.provider}/${current.model}${current.reasoningEffort ? ` (${current.reasoningEffort})` : ''}`}\n可选模型（${allowed.length}）：\n${lines.join('\n')}`,
          };
        }
        if (!leadModelAllowed(policy, provider, model)) throw new Error('该模型不在可选模型范围内。');
        const requested = allowed.find((item) => item.provider === provider && item.model === model);
        if (requested === undefined) throw new Error(`实时模型目录中找不到 ${provider}/${model}；请先重新列出模型，确认 provider 和 model 名称。`);
        const requestedEffort = typeof args.reasoningEffort === 'string' && args.reasoningEffort.trim() !== '' ? args.reasoningEffort.trim() : undefined;
        if (requestedEffort !== undefined && requested.efforts.length > 0 && !requested.efforts.some((effort) => effort.id === requestedEffort)) {
          throw new Error(`模型 ${provider}/${model} 不支持思考强度 ${requestedEffort}；可选：${requested.efforts.map((effort) => `${effort.id}(${effort.name})`).join('、')}`);
        }
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('分配模型必须填写 reason（至少 2 个字符）。');
        let selected;
        if (typeof targetSessionId !== 'string' || targetSessionId === '') {
          selected = { provider, model, ...(requestedEffort === undefined ? {} : { reasoningEffort: requestedEffort }) };
        } else {
          const result = await selectHostSessionModel({
            sessionId: targetSessionId,
            provider,
            model,
            ...(requestedEffort === undefined ? {} : { reasoningEffort: requestedEffort }),
          });
          selected = result.selected;
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const currentOrg = store.current;
          try {
            if (target === null) {
              await store.save(currentOrg.revision, {
                ...currentOrg,
                lead: {
                  ...currentOrg.lead,
                  model: {
                    provider: selected.provider,
                    model: selected.model,
                    ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
                  },
                },
              });
            } else {
              const fresh = currentOrg.roles.find((candidate) => candidate.id === target.id);
              if (fresh === undefined) throw new Error(`找不到成员“${targetName}”`);
              await store.save(currentOrg.revision, {
                ...currentOrg,
                roles: currentOrg.roles.map((candidate) => (candidate.id === target.id ? {
                  ...candidate,
                  model: {
                    provider: selected.provider,
                    model: selected.model,
                    ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
                  },
                } : candidate)),
              });
            }
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        const applied = typeof targetSessionId === 'string' && targetSessionId !== '';
        const summary = `${targetName} 已${applied ? '切换' : '记录'}模型 ${selected.provider}/${selected.model}${selected.reasoningEffort ? ` (${selected.reasoningEffort})` : ''}${applied ? '' : '；成员会话建立后会应用'}。原因：${reason}`;
        try {
          await appendAudit(store, {
            kind: 'personnel',
            action: 'select_model',
            actor: manager.name,
            roleId: targetId,
            roleName: targetName,
            reason,
            summary,
          });
        } catch (error) {
          console.warn('[agent-org] could not append model assignment audit:', error);
        }
        return {
          action: 'selected',
          roleId: targetId,
          roleName: targetName,
          provider: selected.provider,
          model: selected.model,
          reasoningEffort: selected.reasoningEffort ?? '',
          models: allowed,
          summary,
        };
      },
    };
  }

  function createSkillSearchTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_skill_search',
      description:
        'Lead/captain only. Search the live DSH skill catalog for a skill useful to one of your direct reports. ' +
        'Pass role to confirm the target member and validate that it is your direct report; without role it lists eligible direct reports. ' +
        'Use this before team_skill_inject and reuse the confirmed role. It does not inject anything.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '可选：目标成员 id/姓名/职位。传入后会校验它是否是你的直属下级，并确认注入对象。' },
          query: { type: 'string', description: '可选搜索词，匹配 skill 名称、描述和适用场景。' },
          limit: { type: 'integer', minimum: 1, maximum: 30, description: '最多返回数量，默认 12。' },
        },
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string' },
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            members: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  title: { type: 'string' },
                },
                required: ['id', 'name', 'title'],
              },
            },
            total: { type: 'integer' },
            skills: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  whenToUse: { type: 'string' },
                  source: { type: 'string' },
                },
                required: ['name', 'description', 'whenToUse', 'source'],
              },
            },
            summary: { type: 'string' },
          },
          required: ['query', 'roleId', 'roleName', 'members', 'total', 'skills', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => true,
      presentCall(args) {
        return { card: 'generic', title: `搜索技能：${args.query ?? '全部'}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能搜索技能。');
        const manager = skillCaller(store.current, caller);
        if (manager === null) throw new Error('只有组长或岗位队长可以搜索技能。');
        const managerId = manager.isLead ? 'lead' : manager.id;
        const members = store.current.roles
          .filter((role) => role.enabled !== false && role.reportsTo === managerId)
          .map((role) => ({ id: role.id, name: role.name, title: role.title }));
        let target = null;
        if (typeof args.role === 'string' && args.role.trim() !== '') {
          target = skillTarget(store.current, manager, args.role.trim());
        }
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        const limit = Number.isSafeInteger(args.limit) ? Math.min(30, Math.max(1, args.limit)) : 12;
        let catalog = [];
        try {
          catalog = await ctx.skills.list({ cwd: workspace.path, signal: exec.signal, scope: caller });
        } catch (error) {
          throw new Error(`读取技能目录失败：${errorMessage(error)}`);
        }
        const needle = query.toLocaleLowerCase('zh-CN');
        const matched = catalog
          .filter((skill) => skill?.invocation?.modelInvocable !== false)
          .filter((skill) => {
            if (needle === '') return true;
            return [skill.name, skill.description, skill.whenToUse ?? ''].join('\n').toLocaleLowerCase('zh-CN').includes(needle);
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        const skills = matched.slice(0, limit).map((skill) => ({
          name: skill.name,
          description: skill.description,
          whenToUse: skill.whenToUse ?? '',
          source: skill.source,
        }));
        const memberLine = members.length === 0
          ? '当前没有可直接接收 skill 的下属。'
          : `可直接接收 skill 的成员：${members.map((member) => `${member.name}（${member.title}）`).join('、')}。`;
        const targetLine = target === null
          ? '尚未确认目标成员；请先选择一个成员，再把相同 role 传给 team_skill_inject。'
          : `已确认目标成员：${target.name}（${target.title}）。`;
        const skillLines = skills.length === 0
          ? `没有找到匹配“${query || '全部'}”的可用技能。`
          : `找到 ${matched.length} 个技能，返回 ${skills.length} 个：\n${skills.map((skill) => `- ${skill.name}：${skill.description}${skill.whenToUse ? `（适合：${skill.whenToUse}）` : ''}`).join('\n')}`;
        return {
          query,
          roleId: target?.id ?? '',
          roleName: target?.name ?? '',
          members,
          total: matched.length,
          skills,
          summary: `${targetLine}\n${memberLine}\n${skillLines}`,
        };
      },
    };
  }

  function createSkillInjectTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_skill_inject',
      description:
        'Lead/captain only. Inject one skill into a direct report. Either select an installed skill by name (loaded from the live catalog) or author a custom skill with name + instructions. ' +
        'Injected skills become part of the member identity and every subsequent task prompt. Prefer letting the direct captain choose skills for their own team. A reason is required.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '要注入技能的直接下属成员 id/姓名/职位。' },
          skill: { type: 'string', description: '可选：已安装 skill 的名称；与 instructions 二选一。' },
          name: { type: 'string', description: '可选：自定义技能名称；使用已安装 skill 时省略。' },
          description: { type: 'string', description: '可选：技能描述。' },
          instructions: { type: 'string', description: '可选：自定义技能正文；与 skill 二选一，最多 12000 字符。' },
          reason: { type: 'string', description: '为什么这个技能适合该成员；必填。' },
        },
        required: ['role', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            skillName: { type: 'string' },
            source: { type: 'string' },
            skillCount: { type: 'integer' },
            summary: { type: 'string' },
          },
          required: ['roleId', 'roleName', 'skillName', 'source', 'skillCount', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `注入技能：${args.skill ?? args.name ?? args.role}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能注入技能。');
        const manager = skillCaller(store.current, caller);
        if (manager === null) throw new Error('只有组长或岗位队长可以注入技能。');
        const target = skillTarget(store.current, manager, args.role);
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('注入技能必须填写 reason（至少 2 个字符）。');
        let skillName = typeof args.name === 'string' ? args.name.trim() : '';
        let description = typeof args.description === 'string' ? args.description.trim() : '';
        let instructions = typeof args.instructions === 'string' ? args.instructions.trim() : '';
        let source = 'custom';
        if (typeof args.skill === 'string' && args.skill.trim() !== '') {
          const selected = args.skill.trim();
          let definition;
          try {
            definition = await ctx.skills.get(selected, { cwd: workspace.path, signal: exec.signal, scope: caller });
          } catch (error) {
            throw new Error(`读取技能“${selected}”失败：${errorMessage(error)}`);
          }
          if (definition === undefined) throw new Error(`找不到已安装技能“${selected}”；可用 team_skill_search 查找。`);
          if (definition.invocation?.modelInvocable === false) throw new Error(`技能“${selected}”不允许模型调用。`);
          skillName = definition.name;
          description = definition.description || description;
          instructions = definition.content || '';
          source = 'framework';
        }
        if (skillName.length < 1 || skillName.length > 80) throw new Error('技能名称需要 1–80 个字符');
        if (instructions.length < 1) throw new Error('技能内容不能为空；请选择已安装 skill 或填写 instructions。');
        if (instructions.length > 12_000) throw new Error('技能内容不能超过 12000 个字符。');
        const skill = {
          name: skillName,
          description: description.slice(0, 300),
          instructions,
          source,
          injectedAt: new Date().toISOString(),
          injectedBy: manager.name,
        };
        let saved = false;
        let skillCount = 0;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          const existing = current.roles.find((candidate) => candidate.id === target.id);
          if (existing === undefined) throw new Error(`找不到成员“${args.role ?? ''}”`);
          const skills = Array.isArray(existing.skills) ? existing.skills : [];
          const nextSkills = [...skills.filter((candidate) => candidate.name !== skill.name), skill];
          if (nextSkills.length > 8) throw new Error('每个成员最多注入 8 个技能；请先移除不再需要的技能。');
          try {
            await store.save(current.revision, {
              ...current,
              roles: current.roles.map((candidate) => (candidate.id === target.id ? { ...candidate, skills: nextSkills } : candidate)),
            });
            saved = true;
            skillCount = nextSkills.length;
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError) continue;
            throw error;
          }
        }
        if (!saved) throw new Error('技能注入失败：组织配置已被其他操作修改，请重试。');
        const summary = `已向「${target.name}」注入技能「${skillName}」（${source === 'framework' ? '环境 skill' : '自定义'}，共 ${skillCount} 个技能）。原因：${reason}`;
        try {
          await appendAudit(store, {
            kind: 'personnel',
            action: 'inject_skill',
            actor: manager.name,
            roleId: target.id,
            roleName: target.name,
            reason,
            summary,
          });
        } catch (error) {
          console.warn('[agent-org] could not append skill audit:', error);
        }
        return { roleId: target.id, roleName: target.name, skillName, source, skillCount, summary };
      },
    };
  }

  async function addTemporaryRelation(store, from, to, label, actor) {
    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = store.current;
      if ((snapshot.relations ?? []).length >= 64) throw new Error('附加关系不能超过 64 条');
      const relation = {
        id: `relation-${randomUUID().slice(0, 8)}`,
        from,
        to,
        type: 'temporary',
        label: bounded(label, 80),
        expiresAt,
      };
      try {
        await store.save(snapshot.revision, {
          ...snapshot,
          relations: [...(snapshot.relations ?? []), relation],
        });
        try {
          await appendAudit(store, {
            kind: 'relation',
            action: 'create_temporary',
            actor,
            roleName: actor,
            reason: `临时求助：${label}`,
            summary: `已建立临时关系：${from} → ${to}（${label}），本次委托结束即断开。`,
          });
        } catch (error) {
          console.warn('[agent-org] could not append help relation audit:', error);
        }
        return relation;
      } catch (error) {
        if (error instanceof OrgRevisionError) continue;
        throw error;
      }
    }
    throw new Error('临时关系保存失败：组织配置已被其他操作修改，请重试。');
  }

  async function removeTemporaryRelation(store, relationId, actor, reason) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = store.current;
      const relation = (snapshot.relations ?? []).find((candidate) => candidate.id === relationId);
      if (relation === undefined) return false;
      try {
        await store.save(snapshot.revision, {
          ...snapshot,
          relations: (snapshot.relations ?? []).filter((candidate) => candidate.id !== relationId),
        });
        try {
          await appendAudit(store, {
            kind: 'relation',
            action: 'remove_temporary',
            actor,
            roleName: actor,
            reason,
            summary: `委托已结束，临时关系 ${relation.from} → ${relation.to} 已断开。`,
          });
        } catch (error) {
          console.warn('[agent-org] could not append temporary relation removal audit:', error);
        }
        return true;
      } catch (error) {
        if (error instanceof OrgRevisionError) continue;
        throw error;
      }
    }
    throw new Error('临时关系断开失败：组织配置已被其他操作修改，请重试。');
  }

  async function updateHelpRequest(store, requestId, patch) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = store.current;
      const exists = (current.helpRequests ?? []).some((request) => request.id === requestId);
      if (!exists) throw new Error(`找不到求助请求 ${requestId}`);
      try {
        return await store.save(current.revision, {
          ...current,
          helpRequests: current.helpRequests.map((request) => (request.id === requestId ? { ...request, ...patch } : request)),
        });
      } catch (error) {
        if (error instanceof OrgRevisionError && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error('求助请求更新失败：组织配置已被其他操作修改，请重试。');
  }

  function createReportFailureTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_report_failure',
      description: 'Captain only. Report a direct report who keeps failing with model/provider/session errors to the lead. This does not delete or replace the member; the lead reviews and decides.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '持续报错的直属成员 id/姓名/职位。' },
          reason: { type: 'string', description: '为什么需要上报；写明重复失败的事实。' },
        },
        required: ['role', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            requestId: { type: 'string' },
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            failures: { type: 'integer' },
            status: { type: 'string', enum: ['pending'] },
            summary: { type: 'string' },
          },
          required: ['requestId', 'roleId', 'roleName', 'failures', 'status', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `上报失败成员：${args.role ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能上报失败成员。');
        const manager = skillCaller(store.current, caller);
        if (manager === null || manager.isLead) throw new Error('只有队长可以上报直属成员失败。');
        const target = skillTarget(store.current, manager, args.role);
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('上报失败成员必须填写 reason。');
        const recent = runs.snapshot(workspace.id).filter((run) => run.roleId === target.id);
        const failed = recent.filter((run) => run.status === 'failed' || run.status === 'aborted');
        const duplicate = (store.current.failureReports ?? []).find((report) => report.from === manager.id && report.roleId === target.id && report.status === 'pending');
        if (duplicate !== undefined) throw new Error(`该成员已有待审批失败上报：${duplicate.id}`);
        const request = {
          id: `failure-${randomUUID().slice(0, 8)}`,
          from: manager.id,
          roleId: target.id,
          reason,
          failures: failed.length,
          diagnostic: bounded(failed[0]?.diagnostic || failed[0]?.summary || '', 1000),
          status: 'pending',
          createdAt: new Date().toISOString(),
          decidedAt: null,
          decidedBy: '',
          replacementRoleId: '',
        };
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          if ((current.failureReports ?? []).length >= 50) throw new Error('失败上报记录不能超过 50 条。');
          try {
            await store.save(current.revision, { ...current, failureReports: [...(current.failureReports ?? []), request] });
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        const summary = `已把「${target.name}」的失败情况上报组长：近期失败 ${failed.length} 次。组长审批后会决定是否重建。`;
        try {
          await appendAudit(store, { kind: 'personnel', action: 'report_failure', actor: manager.name, roleId: target.id, roleName: target.name, reason, summary });
        } catch (error) {
          console.warn('[agent-org] could not append failure report audit:', error);
        }
        return { requestId: request.id, roleId: target.id, roleName: target.name, failures: failed.length, status: 'pending', summary };
      },
    };
  }

  function createReviewFailureTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_review_failure',
      description: 'Lead only. List, approve, or reject a captain failure report. Approval creates a replacement role with the same identity/skills/reporting line, transfers the failing member children, archives the old session, and removes the old role.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['list', 'approve', 'reject'], description: '默认 list。' },
          requestId: { type: 'string', description: 'approve/reject 时的失败上报编号。' },
          provider: { type: 'string', description: 'approve 时新成员的模型 provider；必填。' },
          model: { type: 'string', description: 'approve 时新成员的模型 id；必填。' },
          reasoningEffort: { type: 'string', description: 'approve 时新成员的思考强度。' },
          reason: { type: 'string', description: 'approve/reject 的理由；必填。' },
        },
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string' },
            requestId: { type: 'string' },
            status: { type: 'string' },
            replacementRoleId: { type: 'string' },
            summary: { type: 'string' },
            requests: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  requestId: { type: 'string' },
                  from: { type: 'string' },
                  fromName: { type: 'string' },
                  roleId: { type: 'string' },
                  roleName: { type: 'string' },
                  failures: { type: 'integer' },
                  diagnostic: { type: 'string' },
                  reason: { type: 'string' },
                  createdAt: { type: 'string' },
                },
                required: ['requestId', 'from', 'fromName', 'roleId', 'roleName', 'failures', 'diagnostic', 'reason', 'createdAt'],
              },
            },
          },
          required: ['action', 'requestId', 'status', 'replacementRoleId', 'summary', 'requests'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `失败成员审批：${args.action ?? 'list'}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能审批失败成员。');
        if (store.current.lead.sessionId !== caller?.session?.id) throw new Error('只有组长可以审批失败成员上报。');
        const action = ['list', 'approve', 'reject'].includes(args.action) ? args.action : 'list';
        const pending = (store.current.failureReports ?? []).filter((report) => report.status === 'pending');
        const roleName = (id) => store.current.roles.find((role) => role.id === id)?.name ?? id;
        const requests = action === 'list' ? pending.map((report) => ({
          requestId: report.id,
          from: report.from,
          fromName: roleName(report.from),
          roleId: report.roleId,
          roleName: roleName(report.roleId),
          failures: report.failures,
          diagnostic: report.diagnostic,
          reason: report.reason,
          createdAt: report.createdAt,
        })) : [];
        if (action === 'list') {
          const lines = requests.length === 0
            ? '当前没有待审批的失败成员上报。'
            : requests.map((request) => `- ${request.requestId} · ${request.fromName} → ${request.roleName}：失败 ${request.failures} 次${request.diagnostic ? ` · ${request.diagnostic}` : ''}（原因：${request.reason}）`).join('\n');
          return { action, requestId: '', status: '', replacementRoleId: '', requests, summary: `待审批失败成员（${requests.length}）：\n${lines}` };
        }
        const requestId = typeof args.requestId === 'string' ? args.requestId.trim() : '';
        const report = pending.find((candidate) => candidate.id === requestId);
        if (report === undefined) throw new Error(`找不到待审批失败上报 ${requestId}`);
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('审批/拒绝必须填写 reason。');
        if (action === 'reject') {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const current = store.current;
            try {
              await store.save(current.revision, {
                ...current,
                failureReports: current.failureReports.map((item) => (item.id === requestId ? { ...item, status: 'rejected', decidedAt: new Date().toISOString(), decidedBy: current.lead.label } : item)),
              });
              break;
            } catch (error) {
              if (error instanceof OrgRevisionError && attempt < 2) continue;
              throw error;
            }
          }
          try {
            await appendAudit(store, { kind: 'personnel', action: 'reject_failure', actor: store.current.lead.label, roleId: report.roleId, roleName: roleName(report.roleId), reason, summary: `拒绝失败上报 ${requestId}` });
          } catch (error) {
            console.warn('[agent-org] could not append failure rejection audit:', error);
          }
          return { action, requestId, status: 'rejected', replacementRoleId: '', requests: [], summary: `已拒绝失败上报 ${requestId}。原因：${reason}` };
        }
        const selectedModel = await validateNewRoleModel(store, args.provider, args.model, args.reasoningEffort);
        const target = store.current.roles.find((role) => role.id === report.roleId);
        if (target === undefined) throw new Error('上报的成员已不存在。');
        const replacementId = `member-${randomUUID().slice(0, 8)}`;
        const replacement = {
          ...target,
          id: replacementId,
          name: target.name,
          sessionId: null,
          model: selectedModel,
          skills: Array.isArray(target.skills) ? target.skills : [],
        };
        let saved = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          const roles = current.roles
            .filter((role) => role.id !== target.id)
            .map((role) => (role.reportsTo === target.id ? { ...role, reportsTo: replacementId } : role));
          roles.push(replacement);
          const relations = (current.relations ?? []).filter((relation) => relation.from !== target.id && relation.to !== target.id);
          const layout = { ...(current.layout ?? {}) };
          delete layout[target.id];
          try {
            await store.save(current.revision, {
              ...current,
              roles,
              relations,
              layout,
              // Reports/help requests that reference the removed role cannot
              // remain in the validated active lists. The audit retains the
              // replacement decision.
              helpRequests: (current.helpRequests ?? []).filter((item) => item.from !== target.id && item.to !== target.id),
              failureReports: (current.failureReports ?? []).filter((item) => item.id !== requestId && item.from !== target.id && item.roleId !== target.id),
            });
            saved = true;
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        if (!saved) throw new Error('失败成员重建保存失败，请重试。');
        const oldSessionId = typeof target.sessionId === 'string' ? target.sessionId : '';
        if (oldSessionId !== '') {
          employeeSessionIds.delete(oldSessionId);
          const oldAgent = ctx.agents.get(oldSessionId);
          if (oldAgent !== undefined) uninstallLead(oldAgent);
          try {
            await ctx.workspaceRegistry.archiveSession(oldSessionId, { stopActivity: true });
          } catch (error) {
            console.warn('[agent-org] could not archive replaced member session:', error);
          }
        }
        const failures = await provisionRoleSessions(store, workspace, store.current.lead.sessionId, replacementId);
        const summary = `已用新成员「${replacement.name}」（${selectedModel.provider}/${selectedModel.model}）替换持续失败的「${target.name}」，转移了其直属成员并归档旧会话。${failures.length > 0 ? ' 新会话建立失败，可稍后修复。' : ''}`;
        try {
          await appendAudit(store, {
            kind: 'personnel',
            action: 'replace_failure',
            actor: store.current.lead.label,
            roleId: replacementId,
            roleName: replacement.name,
            reason,
            summary,
          });
        } catch (error) {
          console.warn('[agent-org] could not append replacement audit:', error);
        }
        return { action, requestId, status: 'completed', replacementRoleId: replacementId, requests: [], summary };
      },
    };
  }

  function createReviewHelpTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_review_help',
      description:
        'Lead only. Review pending temporary-help requests. Call without action (or action=list) to see pending requests; approve creates the temporary relation and delegates the help task, then removes the relation when the delegation ends; reject records a decision without delegating.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['list', 'approve', 'reject'], description: '默认 list。' },
          requestId: { type: 'string', description: 'approve/reject 时的求助请求编号。' },
          reason: { type: 'string', description: '审批/拒绝理由；approve/reject 必填。' },
        },
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string' },
            requestId: { type: 'string' },
            status: { type: 'string' },
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            childSessionId: { type: 'string' },
            summary: { type: 'string' },
            requests: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  requestId: { type: 'string' },
                  from: { type: 'string' },
                  fromName: { type: 'string' },
                  to: { type: 'string' },
                  toName: { type: 'string' },
                  task: { type: 'string' },
                  reason: { type: 'string' },
                  createdAt: { type: 'string' },
                },
                required: ['requestId', 'from', 'fromName', 'to', 'toName', 'task', 'reason', 'createdAt'],
              },
            },
          },
          required: ['action', 'requestId', 'status', 'roleId', 'roleName', 'childSessionId', 'summary', 'requests'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `求助审批：${args.action ?? 'list'}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能审批求助。');
        if (store.current.lead.sessionId !== caller?.session?.id) throw new Error('只有组长可以审批临时求助。');
        const action = ['list', 'approve', 'reject'].includes(args.action) ? args.action : 'list';
        const pending = (store.current.helpRequests ?? []).filter((request) => request.status === 'pending');
        const roleName = (id) => store.current.roles.find((role) => role.id === id)?.name ?? id;
        const requests = action === 'list'
          ? pending.map((request) => ({
            requestId: request.id,
            from: request.from,
            fromName: roleName(request.from),
            to: request.to,
            toName: roleName(request.to),
            task: request.task,
            reason: request.reason,
            createdAt: request.createdAt,
          }))
          : [];
        if (action === 'list') {
          const lines = requests.length === 0
            ? '当前没有待审批的临时求助。'
            : requests.map((request) => `- ${request.requestId} · ${request.fromName} → ${request.toName}：${request.task}（原因：${request.reason}）`).join('\n');
          return { action, requestId: '', status: '', roleId: '', roleName: '', childSessionId: '', requests, summary: `待审批求助（${requests.length}）：\n${lines}` };
        }
        const requestId = typeof args.requestId === 'string' ? args.requestId.trim() : '';
        if (requestId === '') throw new Error('请提供 requestId。');
        const request = pending.find((candidate) => candidate.id === requestId);
        if (request === undefined) throw new Error(`找不到待审批求助 ${requestId}`);
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('审批/拒绝必须填写 reason（至少 2 个字符）。');
        if (action === 'reject') {
          await updateHelpRequest(store, requestId, {
            status: 'rejected',
            decidedAt: new Date().toISOString(),
            decidedBy: store.current.lead.label,
          });
          try {
            await appendAudit(store, { kind: 'work', action: 'reject_help', actor: store.current.lead.label, roleId: request.to, roleName: roleName(request.to), reason, summary: `拒绝求助 ${requestId}` });
          } catch (error) {
            console.warn('[agent-org] could not append help rejection audit:', error);
          }
          return { action, requestId, status: 'rejected', roleId: request.to, roleName: roleName(request.to), childSessionId: '', requests: [], summary: `已拒绝求助 ${requestId}。原因：${reason}` };
        }
        const target = store.current.roles.find((role) => role.id === request.to);
        if (target === undefined || target.enabled === false) throw new Error('求助目标角色已不存在或已停用，无法审批。');
        const from = store.current.roles.find((role) => role.id === request.from);
        if (from === undefined || from.enabled === false) throw new Error('求助发起角色已不存在或已停用，无法审批。');
        let relation = null;
        let outcome = null;
        let failure = null;
        try {
          relation = await addTemporaryRelation(store, request.from, request.to, `求助：${bounded(request.task, 48)}`, from.name);
          const helpTask = `来自「${from.name} · ${from.title}」的临时求助（组长已审批）。\n原因：${request.reason}\n请求：${request.task}\n请只在你职责和授权范围内提供可执行帮助，不要修改未授权文件，也不要替代组长或审核/验收。`;
          try {
            outcome = await performAssignment({
              store,
              workspace,
              org: store.current,
              role: target,
              caller,
              task: helpTask,
              signal: exec.signal,
              delegatorName: from.name,
              delegatorRoleId: from.id,
            });
          } catch (error) {
            failure = error;
          }
        } finally {
          if (relation !== null) {
            try {
              await removeTemporaryRelation(store, relation.id, from.name, `求助委托结束：${bounded(reason, 160)}`);
            } catch (error) {
              console.warn('[agent-org] could not disconnect approved help relation:', error);
            }
          }
        }
        const status = failure !== null ? (exec.signal.aborted ? 'aborted' : 'failed') : (outcome?.status ?? 'failed');
        await updateHelpRequest(store, requestId, {
          status,
          decidedAt: new Date().toISOString(),
          decidedBy: store.current.lead.label,
          relationId: relation?.id ?? '',
          resultSummary: bounded(failure !== null ? errorMessage(failure) : (outcome?.summary ?? ''), 1000),
        });
        try {
          await appendAudit(store, {
            kind: 'work',
            action: 'approve_help',
            actor: store.current.lead.label,
            roleId: target.id,
            roleName: target.name,
            reason,
            summary: `审批求助 ${requestId}：${from.name} → ${target.name}`,
          });
        } catch (error) {
          console.warn('[agent-org] could not append help approval audit:', error);
        }
        if (failure !== null) throw failure;
        return {
          action,
          requestId,
          status,
          roleId: target.id,
          roleName: target.name,
          childSessionId: outcome?.childSessionId ?? '',
          requests: [],
          summary: `已审批并通过求助 ${requestId}：${from.name} → ${target.name}。${outcome?.summary ?? ''}`,
        };
      },
    };
  }

  function createHelpRequestTool(employee) {
    const { store } = employee;
    return {
      name: 'team_request_help',
      description:
        'Any team member. Submit a temporary-help request to the lead for approval. The lead must approve it before any temporary relation is created or work is delegated. ' +
        'It does not change reporting lines or bypass code review, testing, security, or user approval.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '要求助的角色 id/姓名/职位；不能是自己。' },
          task: { type: 'string', description: '自包含的求助任务：需要对方回答/产出什么、边界、验收标准。' },
          reason: { type: 'string', description: '为什么需要该角色协助；必填。' },
        },
        required: ['role', 'task', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            requestId: { type: 'string' },
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            roleTitle: { type: 'string' },
            status: { type: 'string', enum: ['pending'] },
            summary: { type: 'string' },
          },
          required: ['requestId', 'roleId', 'roleName', 'roleTitle', 'status', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: `HELP_REQUEST=${value.requestId} STATUS=${value.status}\n${value.summary}` }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `提交求助审批：${args.role}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能发起求助。');
        const org = store.current;
        const callerRole = org.roles.find((candidate) => candidate.sessionId === caller?.session?.id && candidate.enabled !== false);
        if (callerRole === undefined) throw new Error('只有启用中的团队成员可以发起临时求助。');
        const target = findRole(org, args.role);
        if (target === null) throw new Error(`找不到求助角色“${args.role ?? ''}”`);
        if (target.id === callerRole.id) throw new Error('不能向自己发起求助。');
        if (!target.enabled) throw new Error(`角色“${target.name}”当前已停用。`);
        const task = typeof args.task === 'string' ? args.task.trim() : '';
        if (task.length < 3) throw new Error('求助任务说明不能为空。');
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('求助必须填写 reason（至少 2 个字符）。');
        const request = {
          id: `help-${randomUUID().slice(0, 8)}`,
          from: callerRole.id,
          to: target.id,
          task: bounded(task, 2000),
          reason: bounded(reason, 500),
          status: 'pending',
          createdAt: new Date().toISOString(),
          decidedAt: null,
          decidedBy: '',
          relationId: '',
          resultSummary: '',
        };
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const snapshot = store.current;
          if ((snapshot.helpRequests ?? []).length >= 50) throw new Error('待审批/历史求助记录不能超过 50 条。');
          try {
            await store.save(snapshot.revision, {
              ...snapshot,
              helpRequests: [...(snapshot.helpRequests ?? []), request],
            });
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        const summary = `已把给「${target.name}（${target.title}）」的临时求助提交给组长审批；审批通过后才会建立临时关系并委派。请求编号：${request.id}。`;
        try {
          await appendAudit(store, {
            kind: 'work',
            action: 'request_help_approval',
            actor: callerRole.name,
            roleId: target.id,
            roleName: target.name,
            reason,
            summary,
          });
        } catch (error) {
          console.warn('[agent-org] could not append help approval audit:', error);
        }
        return {
          requestId: request.id,
          roleId: target.id,
          roleName: target.name,
          roleTitle: target.title,
          status: 'pending',
          summary,
        };
      },
    };
  }

  function createMemberAssignTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_assign',
      description:
        'Delegate one self-contained task to a direct report. As a same-position captain, you may split your assigned work among your own direct reports; ' +
        'do not assign to teammates, managers, or anyone outside your direct reports. This waits and returns a compact JSON result. ' +
        'Call several independent assignments in the same turn when they have no shared files or ordering dependency. Set waitForAll=true to wait for every currently running delegation in this workspace.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '直属下级的 id/姓名/职位。' },
          task: { type: 'string', description: '紧凑任务字段：goal=...; workspace=<绝对路径>; files=...; accept=...; deps=...。' },
          reason: { type: 'string', description: '为什么把这项工作安排给该直属下级；必填。' },
          waitForAll: { type: 'boolean', description: '可选：是否等当前工作区所有正在运行的委派都完成后再返回，默认 false（只等本次）。' },
        },
        required: ['role', 'task', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            roleTitle: { type: 'string' },
            childSessionId: { type: 'string' },
            status: { type: 'string', enum: ['completed', 'failed', 'aborted'] },
            summary: { type: 'string' },
            diagnostic: { type: 'string' },
            durationMs: { type: 'integer' },
            waitedForAll: { type: 'boolean' },
          },
          required: ['roleId', 'roleName', 'roleTitle', 'childSessionId', 'status', 'summary', 'durationMs', 'waitedForAll'],
        },
        render(_args, value) {
          const detail = value.diagnostic ? `\nDIAGNOSTIC=${value.diagnostic}` : '';
          return [{ type: 'text', text: `AGENT=${value.roleId} STATUS=${value.status} MS=${value.durationMs}\n${value.summary}${detail}` }];
        },
      },
      isConcurrencySafe: () => true,
      presentCall(args) {
        return { card: 'generic', title: `委派给直属下级 ${args.role}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_assign 需要一个成员会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能委派。');
        const org = store.current;
        const currentCaller = findRole(org, employee.role.id);
        if (currentCaller === null || currentCaller.sessionId !== caller.session.id) {
          throw new Error('当前会话不是该队长/负责人，不能委派。');
        }
        const role = findRole(org, args.role);
        if (role === null) throw new Error(`找不到直属下级“${args.role ?? ''}”`);
        if (role.id === currentCaller.id) throw new Error('不能把任务委派给自己。');
        if (role.reportsTo !== currentCaller.id) {
          throw new Error(`“${role.name}”不是你的直属下级；你只能委派给直接向你汇报的成员。`);
        }
        if (!role.enabled) throw new Error(`成员“${role.name}”当前已停用。`);
        const task = typeof args.task === 'string' ? args.task.trim() : '';
        if (task.length < 3) throw new Error('任务说明不能为空');
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('工作安排必须填写 reason（至少 2 个字符）。');
        const value = await performAssignment({
          store,
          workspace,
          org,
          role,
          caller,
          task,
          signal: exec.signal,
          delegatorName: currentCaller.name,
          delegatorRoleId: currentCaller.id,
        });
        if (args.waitForAll === true) await waitForAllAssignments(workspace.id, exec.signal);
        value.waitedForAll = args.waitForAll === true;
        try {
          await appendAudit(store, { kind: 'work', action: 'assign', actor: currentCaller.name, roleId: role.id, roleName: role.name, reason, summary: task });
        } catch (error) {
          console.warn('[agent-org] could not append assignment audit:', error);
        }
        return value;
      },
    };
  }

  function uniqueGroupName(org, module, suffix) {
    const prefix = String(module).trim().slice(0, 12) || '模块';
    let name = `${prefix}-${suffix}`.slice(0, 24);
    let index = 2;
    while (org.roles.some((role) => role.name.toLowerCase() === name.toLowerCase())) {
      const tail = `-${index}`;
      name = `${`${prefix}-${suffix}`.slice(0, 24 - tail.length)}${tail}`;
      index += 1;
    }
    return name;
  }

  async function appendAudit(store, entry) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = store.current;
      const event = {
        id: `audit-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
        at: new Date().toISOString(),
        kind: entry.kind,
        action: entry.action,
        actor: entry.actor,
        roleId: entry.roleId ?? '',
        roleName: entry.roleName ?? '',
        reason: entry.reason,
        summary: entry.summary ?? '',
      };
      const audit = [event, ...(current.audit ?? [])].slice(0, 1000);
      try {
        await store.save(current.revision, { ...current, audit });
        return event;
      } catch (error) {
        if (error instanceof OrgRevisionError) continue;
        throw error;
      }
    }
    throw new Error('安排记录保存失败，请重试');
  }

  function createActiveTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_set_member_active',
      description:
        'Lead only. Park or restore one member as the live workload changes. Parking disables assignment but preserves the member session and organization record; it refuses when the member still has enabled direct reports. Reassign reports first with team_relation set_manager.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '成员 id/姓名/职位，或唯一的部分职位。' },
          active: { type: 'boolean', description: 'true 恢复参与委派，false 暂停参与委派。' },
          reason: { type: 'string', description: '为什么暂停或恢复该成员；必填。' },
        },
        required: ['role', 'active', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleId: { type: 'string' },
            active: { type: 'boolean' },
            summary: { type: 'string' },
          },
          required: ['roleId', 'active', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `${args.active === false ? '暂停' : '恢复'}成员 ${args.role ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_set_member_active 需要一个组长会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能调整成员状态。');
        if (store.current.lead.sessionId !== caller.session.id) throw new Error('只有组长可以暂停/恢复成员。');
        const org = store.current;
        const role = findRole(org, args.role);
        if (role === null) throw new Error(`找不到成员“${args.role ?? ''}”`);
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('暂停/恢复成员必须填写 reason（至少 2 个字符）。');
        if (args.active === false) {
          const reports = org.roles.filter((candidate) => candidate.reportsTo === role.id && candidate.enabled !== false);
          if (reports.length > 0) {
            throw new Error(`“${role.name}”仍有直属下级：${reports.map((item) => item.name).join('、')}。请先用 team_relation set_manager 转移，再暂停。`);
          }
        }
        let saved = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          const roles = current.roles.map((candidate) => (
            candidate.id === role.id ? { ...candidate, enabled: args.active === true } : candidate
          ));
          try {
            await store.save(current.revision, { ...current, roles });
            saved = true;
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError) continue;
            throw error;
          }
        }
        if (!saved) throw new Error('成员状态保存失败，请重试');
        const summary = args.active === true
          ? `已恢复「${role.name}」参与委派；原成员会话仍保留。`
          : `已暂停「${role.name}」参与委派；组织记录和成员会话保留，可随时恢复。`;
        try {
          await appendAudit(store, { kind: 'personnel', action: args.active === true ? 'restore_member' : 'park_member', actor: store.current.lead.label, roleId: role.id, roleName: role.name, reason, summary });
        } catch (error) {
          console.warn('[agent-org] could not append member-status audit:', error);
        }
        return { roleId: role.id, active: args.active === true, summary };
      },
    };
  }

  function createFireTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_fire_member',
      description:
        'Lead only, destructive. Remove one member from the organization and archive/delete their member session from the workspace. ' +
        'The member must have no enabled direct reports; transfer them first with team_relation set_manager. The lead cannot fire itself. ' +
        'The user must explicitly ask to fire someone and the reason must be specific. Confirm must be true.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '要开除的成员 id/姓名/职位。' },
          reason: { type: 'string', description: '开除原因；必须写明具体原因，不能为空。' },
          confirm: { type: 'boolean', description: '必须为 true，确认这是不可逆的破坏性操作。' },
        },
        required: ['role', 'reason', 'confirm'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            sessionRemoved: { type: 'boolean' },
            summary: { type: 'string' },
          },
          required: ['roleId', 'roleName', 'sessionRemoved', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `开除成员：${args.role ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        if (args.confirm !== true) throw new Error('开除成员必须明确确认（confirm=true）。');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_fire_member 需要一个组长会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能开除成员。');
        const org = store.current;
        if (org.lead.sessionId !== caller.session.id) throw new Error('只有组长可以开除成员。');
        const role = findRole(org, args.role);
        if (role === null) throw new Error(`找不到成员“${args.role ?? ''}”`);
        const reports = org.roles.filter((candidate) => candidate.reportsTo === role.id && candidate.enabled !== false);
        if (reports.length > 0) {
          throw new Error(`“${role.name}”仍有直属下级：${reports.map((item) => item.name).join('、')}。请先用 team_relation set_manager 转移，再开除。`);
        }
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('必须填写开除原因。');
        const sessionId = typeof role.sessionId === 'string' ? role.sessionId : '';
        if (sessionId !== '') {
          try {
            await ctx.workspaceRegistry.archiveSession(sessionId, { stopActivity: true });
          } catch (error) {
            throw new Error(`成员会话无法归档/删除：${errorMessage(error)}；组织角色未改动。`);
          }
        }
        let saved = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          const exists = current.roles.some((candidate) => candidate.id === role.id);
          if (!exists) {
            saved = true;
            break;
          }
          const roles = current.roles.filter((candidate) => candidate.id !== role.id);
          const relations = (current.relations ?? []).filter((relation) => relation.from !== role.id && relation.to !== role.id);
          const layout = { ...(current.layout ?? {}) };
          delete layout[role.id];
          try {
            await store.save(current.revision, {
              ...current,
              roles,
              relations,
              layout,
              helpRequests: (current.helpRequests ?? []).filter((item) => item.from !== role.id && item.to !== role.id),
              failureReports: (current.failureReports ?? []).filter((item) => item.from !== role.id && item.roleId !== role.id),
            });
            saved = true;
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError) continue;
            throw error;
          }
        }
        if (!saved) throw new Error('成员删除失败：组织配置已被其他操作修改，请重试。');
        employeeSessionIds.delete(sessionId);
        const agent = sessionId === '' ? undefined : ctx.agents.get(sessionId);
        if (agent !== undefined) uninstallLead(agent);
        const summary = `已开除「${role.name}」：组织角色已删除${sessionId === '' ? '（无成员会话）' : '，成员会话已从工作区删除并归档'}。原因：${reason}`;
        try {
          await appendAudit(store, { kind: 'personnel', action: 'fire_member', actor: org.lead.label, roleId: role.id, roleName: role.name, reason, summary });
        } catch (error) {
          console.warn('[agent-org] could not append firing audit:', error);
        }
        return { roleId: role.id, roleName: role.name, sessionRemoved: sessionId !== '', summary };
      },
    };
  }

  async function validateNewRoleModel(store, providerValue, modelValue, effortValue) {
    const provider = typeof providerValue === 'string' ? providerValue.trim() : '';
    const model = typeof modelValue === 'string' ? modelValue.trim() : '';
    if (provider === '' || model === '') {
      throw new Error('新建成员必须选择模型：请传 provider 和 model（默认推荐 opencode-go/deepseek-v4.1-flash）。');
    }
    if (!leadModelAllowed(store.current.lead.modelPolicy, provider, model)) {
      throw new Error(`模型 ${provider}/${model} 不在当前可选模型范围内。`);
    }
    const catalog = await readHostModelCatalog();
    const meta = (catalog.groups ?? []).find((group) => group.id === provider)?.models?.find((entry) => entry.id === model);
    if (meta === undefined) throw new Error(`实时模型目录中找不到 ${provider}/${model}；请重新选择模型。`);
    const requestedEffort = typeof effortValue === 'string' && effortValue.trim() !== '' ? effortValue.trim().toLowerCase() : '';
    const efforts = meta.reasoning?.efforts ?? [];
    if (requestedEffort !== '' && efforts.length > 0 && !efforts.some((effort) => effort.id === requestedEffort)) {
      throw new Error(`模型 ${provider}/${model} 不支持思考强度 ${requestedEffort}；可选：${efforts.map((effort) => `${effort.id}(${effort.name})`).join('、')}`);
    }
    return {
      provider,
      model,
      ...(requestedEffort === '' ? {} : { reasoningEffort: requestedEffort }),
    };
  }

  function createModuleGroupTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_create_module_group',
      description:
        'Lead only. Create one software module group in a single call: a software captain, a specialized software engineer, a software tester, a code-review optimizer, and a documentation specialist. ' +
        'All five report structure is established immediately and each gets an independent session. Use this instead of collapsing module roles into one person.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          module: { type: 'string', description: '功能模块名称，例如「用户中心」「支付」「前端工作台」。' },
          specialty: { type: 'string', description: '该组工程师的专长，例如「React 前端」「Node 后端」「数据管道」。' },
          manager: { type: 'string', description: '可选：软件组长的汇报对象，默认组长；可写 lead/组长或现有成员。' },
          files: { type: 'string', description: '可选：该模块的文件/目录边界，供组长和工程师约定。' },
          provider: { type: 'string', description: '新成员模型 provider；创建前必须实时选择，推荐 opencode-go。' },
          model: { type: 'string', description: '新成员模型 id；创建前必须实时选择，推荐 deepseek-v4.1-flash。' },
          reasoningEffort: { type: 'string', description: '可选：该模型支持的思考强度。' },
          reason: { type: 'string', description: '为什么需要这个软件模块组及这些岗位；必填。' },
        },
        required: ['module', 'provider', 'model', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            module: { type: 'string' },
            captainId: { type: 'string' },
            roles: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  title: { type: 'string' },
                  sessionId: { type: 'string' },
                },
                required: ['id', 'name', 'title', 'sessionId'],
              },
            },
            failureCount: { type: 'integer' },
            summary: { type: 'string' },
          },
          required: ['module', 'captainId', 'roles', 'failureCount', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: `GROUP=${value.module} ROLES=${value.roles.length} SESSIONS=${value.roles.filter((role) => role.sessionId !== '').length} FAILURES=${value.failureCount}\n${value.summary}` }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `创建软件模块组：${args.module ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_create_module_group 需要一个组长会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能创建模块组。');
        if (store.current.lead.sessionId !== caller.session.id) throw new Error('只有组长可以创建模块组。');
        const module = typeof args.module === 'string' ? args.module.trim() : '';
        if (module.length < 1 || module.length > 20) throw new Error('模块名称需要 1–20 个字符');
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('创建模块组必须填写 reason（至少 2 个字符）。');
        const specialty = typeof args.specialty === 'string' && args.specialty.trim() !== '' ? args.specialty.trim().slice(0, 80) : '通用软件工程';
        const files = typeof args.files === 'string' && args.files.trim() !== '' ? args.files.trim().slice(0, 240) : '由软件组长在接到任务后划定';
        const chosenModel = await validateNewRoleModel(store, args.provider, args.model, args.reasoningEffort);
        let manager = 'lead';
        if (typeof args.manager === 'string' && args.manager.trim() !== '') {
          const resolved = resolveReportsTo(store.current, args.manager);
          if (resolved === null) throw new Error(`未能解析模块组长的汇报对象「${args.manager}」`);
          manager = resolved;
        }
        const captainId = `member-${randomUUID().slice(0, 8)}`;
        let created = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          const names = {
            captain: uniqueGroupName({ roles: [...current.roles] }, module, '组长'),
            engineer: uniqueGroupName({ roles: [...current.roles, { name: uniqueGroupName({ roles: [...current.roles] }, module, '组长') }] }, module, '工程师'),
            tester: uniqueGroupName({ roles: [...current.roles, { name: uniqueGroupName({ roles: [...current.roles] }, module, '组长') }, { name: uniqueGroupName({ roles: [...current.roles] }, module, '工程师') }] }, module, '测试'),
            optimizer: uniqueGroupName({ roles: [...current.roles, { name: uniqueGroupName({ roles: [...current.roles] }, module, '组长') }, { name: uniqueGroupName({ roles: [...current.roles] }, module, '工程师') }, { name: uniqueGroupName({ roles: [...current.roles] }, module, '测试') }] }, module, '优化'),
            docs: uniqueGroupName({ roles: [...current.roles, { name: uniqueGroupName({ roles: [...current.roles] }, module, '组长') }, { name: uniqueGroupName({ roles: [...current.roles] }, module, '工程师') }, { name: uniqueGroupName({ roles: [...current.roles] }, module, '测试') }, { name: uniqueGroupName({ roles: [...current.roles] }, module, '优化') }] }, module, '文档'),
          };
          const palette = ['#7C6CFF', '#2E9E7B', '#D9822B', '#3B82F6', '#D9578A', '#8A6A4B'];
          const roles = [
            {
              id: captainId, name: names.captain, title: '软件工程师', level: 'captain', reportsTo: manager,
              enabled: true, accent: palette[current.roles.length % palette.length], model: chosenModel,
              authority: `可决定「${module}」模块的接口、文件边界、任务拆分、合并和验收；可要求队员澄清。`,
              boundaries: `不可跳过独立测试/审核/安全，不可自行提交 GitHub，不可修改未分配文件。`,
              responsibilities: `负责「${module}」模块组的接口约定、文件边界、拆分、并行实现、集成和验收。`,
              instructions: `你是「${module}」模块组的软件组长。先与组长确认目标、接口、文件边界和验收标准，再把实现、测试、审核优化、文档分给本组直属成员；你负责集成和最终质量，不能跳过软件测试、代码审核、安全审核和 GitHub 提交。模块边界：${files}`,
            },
            {
              id: `member-${randomUUID().slice(0, 8)}`, name: names.engineer, title: '软件工程师', level: 'member', reportsTo: captainId,
              enabled: true, accent: palette[(current.roles.length + 1) % palette.length], model: chosenModel,
              authority: `可在「${module}」模块分配给你的文件和接口内决定实现细节并交付。`,
              boundaries: `不可修改共享文件，不可审批自己的代码，不可提交 GitHub，不可跳过测试。`,
              responsibilities: `作为「${module}」模块组的特化软件工程师，负责 ${specialty} 的实现。`,
              instructions: `你是「${module}」模块组的特化软件工程师，专长：${specialty}。只修改组内约定给你的文件/模块；实现完成后交给本组软件测试师、代码审核优化工程师和文档师，按组长安排并行。不要承担正式测试、审核、文档或提交。`,
            },
            {
              id: `member-${randomUUID().slice(0, 8)}`, name: names.tester, title: '软件测试师', level: 'member', reportsTo: captainId,
              enabled: true, accent: palette[(current.roles.length + 2) % palette.length], model: chosenModel,
              authority: `可对「${module}」执行独立测试、记录缺陷并阻断未通过发布。`,
              boundaries: `不可修改业务代码，不可写正式报告，不可用自测替代独立测试。`,
              responsibilities: `独立负责「${module}」模块的软件测试、回归和发布验证。`,
              instructions: `你是「${module}」模块组的软件测试师。除自动化测试外，必须模拟真实用户使用：从首次进入开始走完该模块的核心用户旅程、导航、错误恢复、权限和移动/触屏场景，做探索性测试并记录体验摩擦；缺陷必须可复现并附证据；不得修改业务代码，不得写正式报告；可阻断未通过发布。`,
            },
            {
              id: `member-${randomUUID().slice(0, 8)}`, name: names.optimizer, title: '代码审核优化工程师', level: 'member', reportsTo: captainId,
              enabled: true, accent: palette[(current.roles.length + 3) % palette.length], model: chosenModel,
              authority: `可审核「${module}」变更并给出阻断/建议/可接受结论，可要求实现者修复。`,
              boundaries: `不可重写整份实现，不可跳过安全审核或自行提交 GitHub。`,
              responsibilities: `独立审核「${module}」模块的代码与优化建议。`,
              instructions: `你是「${module}」模块组的代码审核优化工程师。独立审核该模块变更，逐项给出阻断/建议/可接受和文件行号；不替代实现者重写整份代码，不提交 GitHub。`,
            },
            {
              id: `member-${randomUUID().slice(0, 8)}`, name: names.docs, title: '文档师', level: 'member', reportsTo: captainId,
              enabled: true, accent: palette[(current.roles.length + 4) % palette.length], model: chosenModel,
              authority: `可整理「${module}」面向人的 README、使用/架构说明并要求实现者澄清。`,
              boundaries: `不可改变代码行为或接口，不可阻塞测试/审核/提交，AI 注释和交接由需要的人维护。`,
              responsibilities: `负责「${module}」模块的 README、使用/架构说明和必要注释。`,
              instructions: `你是「${module}」模块组的文档师。实现完成后整理该模块的 README、使用/架构说明和必要代码注释；只改文档和注释，不改代码行为；语义不明向本组工程师/组长确认；文档完成后交代码审核。`,
            },
          ];
          try {
            await store.save(current.revision, { ...current, roles: [...current.roles, ...roles] });
            created = roles;
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError) continue;
            throw error;
          }
        }
        if (created === null) throw new Error('模块组创建失败：组织配置已被其他操作修改，请重试');
        const failures = [];
        for (const role of created) {
          try {
            const result = await provisionRoleSessions(store, workspace, store.current.lead.sessionId, role.id);
            failures.push(...result);
          } catch (error) {
            failures.push({ role, error });
          }
        }
        const latest = created.map((role) => store.current.roles.find((item) => item.id === role.id) ?? role);
        const failureCount = failures.length;
        const summary = `已创建「${module}」模块组：软件组长、特化工程师、软件测试师、优化师、文档师共 5 人，统一使用 ${chosenModel.provider}/${chosenModel.model}${chosenModel.reasoningEffort ? ` (${chosenModel.reasoningEffort})` : ''}${failureCount === 0 ? '，5 个独立会话已建立' : `，${5 - failureCount} 个会话已建立，${failureCount} 个待修复`}。`;
        try {
          await appendAudit(store, { kind: 'personnel', action: 'create_module_group', actor: store.current.lead.label, roleId: captainId, roleName: `${module} 软件组`, reason, summary });
        } catch (error) {
          console.warn('[agent-org] could not append module-group audit:', error);
        }
        return {
          module,
          captainId,
          roles: latest.map((role) => ({
            id: role.id,
            name: role.name,
            title: role.title,
            sessionId: typeof role.sessionId === 'string' ? role.sessionId : '',
          })),
          failureCount,
          summary,
        };
      },
    };
  }

  function createScopeTool(employee) {
    const { store } = employee;
    return {
      name: 'team_set_scope',
      description: 'Lead only. Set one existing member concrete authority and boundaries so the member identity states what they may decide and what is forbidden. Use when authority is empty or generic.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', description: '成员 id/姓名/职位。' },
          authority: { type: 'string', description: '具体可决定/负责的事项，2–300 字。' },
          boundaries: { type: 'string', description: '明确禁止或需升级的事项，2–300 字。' },
          reason: { type: 'string', description: '为什么调整权限；必填。' },
        },
        required: ['role', 'authority', 'boundaries', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            sessionNotified: { type: 'boolean' },
            notificationError: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['roleId', 'roleName', 'sessionNotified', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: value.summary }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `调整职权：${args.role ?? ''}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_set_scope 需要一个组长会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能调整职权。');
        if (store.current.lead.sessionId !== caller.session.id) throw new Error('只有组长可以调整成员职权。');
        const role = findRole(store.current, args.role);
        if (role === null) throw new Error(`找不到成员“${args.role ?? ''}”`);
        const authority = typeof args.authority === 'string' ? args.authority.trim() : '';
        const boundaries = typeof args.boundaries === 'string' ? args.boundaries.trim() : '';
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (authority.length < 2 || authority.length > 300) throw new Error('具体职权需要 2–300 个字符');
        if (boundaries.length < 2 || boundaries.length > 300) throw new Error('禁止边界需要 2–300 个字符');
        if (reason.length < 2) throw new Error('必须填写 reason');
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          const roles = current.roles.map((item) => item.id === role.id ? { ...item, authority, boundaries } : item);
          try {
            await store.save(current.revision, { ...current, roles });
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        let sessionNotified = false;
        let notificationError = '';
        if (typeof role.sessionId === 'string' && role.sessionId !== '') {
          try {
            let agent = ctx.agents.get(role.sessionId);
            if (agent === undefined) {
              const resolved = await ctx.sessionController.agents.resolveAgent(role.sessionId);
              if (!('error' in resolved)) agent = resolved.agent;
            }
            if (agent !== undefined && typeof agent.followup === 'function') {
              agent.followup({
                id: randomUUID(),
                role: 'user',
                content: [{ type: 'text', text: buildScopeUpdatePrompt(authority, boundaries) }],
                source: { kind: 'user' },
              });
              sessionNotified = true;
            }
          } catch (error) {
            notificationError = errorMessage(error);
            console.warn('[agent-org] could not inject updated scope into role session:', error);
          }
        }
        const summary = `已更新「${role.title} · ${role.name}」的具体职权和边界${sessionNotified ? '，已向会话发送一次更新' : notificationError !== '' ? `，但会话通知失败：${notificationError}` : '，角色当前无会话'}。`;
        try {
          await appendAudit(store, { kind: 'personnel', action: 'set_scope', actor: store.current.lead.label, roleId: role.id, roleName: role.name, reason, summary });
        } catch (error) {
          console.warn('[agent-org] could not append scope audit:', error);
        }
        return { roleId: role.id, roleName: role.name, sessionNotified, notificationError, summary };
      },
    };
  }

  function createHrTool(employee) {
    const { store, workspace } = employee;
    return {
      name: 'team_create_member',
      description:
        'Lead only. Create one new team member with concrete authority and boundaries, write the member identity prompt, assign a manager, and initialize the member session in the current workspace. ' +
        'For multiple people in the same position, create one captain and member-level teammates. Do not use this to edit existing members.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: '新成员的职位，例如「软件工程师」「合规」。' },
          name: { type: 'string', description: '可选姓名；省略时按「职位-编号」生成。' },
          level: { type: 'string', enum: ['captain', 'member'], description: '同一岗位可选队长 captain 或队员 member；默认 member。' },
          responsibilities: { type: 'string', description: '成员的职责范围。' },
          instructions: { type: 'string', description: '写入成员会话的身份提示词和工作准则。' },
          authority: { type: 'string', description: '该成员具体可决定/负责的事项，例如文件/模块范围、接口、验收或审批权；不能只写泛化职责。' },
          boundaries: { type: 'string', description: '该成员明确禁止或需升级的事项。' },
          reportsTo: { type: 'string', description: '可选汇报对象：默认组长；可写 lead/组长，或现有成员 id/姓名/职位。' },
          provider: { type: 'string', description: '新成员模型 provider；创建前必须实时选择，推荐 opencode-go。' },
          model: { type: 'string', description: '新成员模型 id；创建前必须实时选择，推荐 deepseek-v4.1-flash。' },
          reasoningEffort: { type: 'string', description: '可选：该模型支持的思考强度。' },
          reason: { type: 'string', description: '为什么需要新增这个岗位/成员；必填。' },
        },
        required: ['title', 'responsibilities', 'instructions', 'authority', 'boundaries', 'provider', 'model', 'reason'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleId: { type: 'string' },
            roleName: { type: 'string' },
            roleTitle: { type: 'string' },
            childSessionId: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['roleId', 'roleName', 'roleTitle', 'summary'],
        },
        render(_args, value) {
          return [{ type: 'text', text: `成员已建立：${value.roleTitle} · ${value.roleName}${value.childSessionId ? `（会话 ${value.childSessionId}）` : ''}` }];
        },
      },
      isConcurrencySafe: () => false,
      presentCall(args) {
        return { card: 'generic', title: `新建成员：${args.title}`, kind: 'other', rawInput: args };
      },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const caller = exec.agent;
        if (caller === undefined) throw new Error('team_create_member 需要一个组长会话');
        await store.refresh();
        if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用，不能创建成员。');
        if (store.current.lead.sessionId !== caller.session.id) throw new Error('只有组长可以创建成员。');
        const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
        if (reason.length < 2) throw new Error('创建成员必须填写 reason（至少 2 个字符）。');
        const chosenModel = await validateNewRoleModel(store, args.provider, args.model, args.reasoningEffort);
        const title = typeof args.title === 'string' ? args.title.trim() : '';
        const responsibilities = typeof args.responsibilities === 'string' ? args.responsibilities.trim() : '';
        const instructions = typeof args.instructions === 'string' ? args.instructions.trim() : '';
        const authority = typeof args.authority === 'string' ? args.authority.trim() : '';
        const boundaries = typeof args.boundaries === 'string' ? args.boundaries.trim() : '';
        if (title.length < 1 || title.length > 24) throw new Error('职位需要 1–24 个字符');
        if (responsibilities.length < 1) throw new Error('成员职责不能为空');
        if (instructions.length < 1) throw new Error('成员身份提示词不能为空');
        if (responsibilities.length > 1000) throw new Error('成员职责不能超过 1000 个字符');
        if (instructions.length > 4000) throw new Error('身份提示词不能超过 4000 个字符');
        if (authority.length < 2 || authority.length > 300) throw new Error('具体职权需要 2–300 个字符');
        if (boundaries.length < 2 || boundaries.length > 300) throw new Error('禁止边界需要 2–300 个字符');
        const level = typeof args.level === 'string' && ROLE_LEVELS.includes(args.level.trim()) ? args.level.trim() : 'member';
        const name = typeof args.name === 'string' && args.name.trim() !== ''
          ? args.name.trim()
          : defaultMemberName(store.current, title);
        if (name.length > 24) throw new Error('成员名称不能超过 24 个字符');
        let reportsTo = 'lead';
        if (typeof args.reportsTo === 'string' && args.reportsTo.trim() !== '') {
          const resolved = resolveReportsTo(store.current, args.reportsTo);
          if (resolved === null) throw new Error(`未能按文本「${args.reportsTo.trim()}」解析负责人；请使用组长、lead 或现有成员 ID/姓名/职位`);
          reportsTo = resolved;
        }
        let created = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = store.current;
          if (current.roles.some((role) => role.name.toLowerCase() === name.toLowerCase())) {
            throw new Error(`成员名称“${name}”已存在`);
          }
          const palette = ['#7C6CFF', '#2E9E7B', '#D9822B', '#3B82F6', '#D9578A', '#8A6A4B'];
          const role = {
            id: `member-${randomUUID().slice(0, 8)}`,
            name,
            title,
            level,
            reportsTo,
            enabled: true,
            accent: palette[current.roles.length % palette.length],
            responsibilities,
            instructions,
            authority,
            boundaries,
            model: chosenModel,
            sessionId: null,
          };
          try {
            await store.save(current.revision, { ...current, roles: [...current.roles, role] });
            created = role;
            break;
          } catch (error) {
            if (error instanceof OrgRevisionError) continue;
            throw error;
          }
        }
        if (created === null) throw new Error('成员创建失败：组织配置已被其他操作修改，请重试');
        let failures = [];
        try {
          failures = await provisionRoleSessions(store, workspace, store.current.lead.sessionId, created.id);
        } catch (error) {
          failures = [{ role: created, error }];
          console.warn('[agent-org] could not provision created member session:', error);
        }
        const latest = store.current.roles.find((role) => role.id === created.id) ?? created;
        if (typeof latest.sessionId !== 'string' || latest.sessionId === '') {
          const failure = failures.find((item) => item.role.id === created.id)?.error;
          throw new Error(
            `成员「${latest.title} · ${latest.name}」已登记，但成员会话未能建立：${errorMessage(failure ?? new Error('未知原因'))}。` +
            '请检查工作区与会话预设后重新委派；系统会为已登记成员自动补建会话。',
          );
        }
        const summary = `已创建 ${latest.title} · ${latest.name}（${latest.level === 'captain' ? '队长' : '队员'}），身份提示词已写入成员会话。`;
        try {
          await appendAudit(store, { kind: 'personnel', action: 'create_member', actor: store.current.lead.label, roleId: latest.id, roleName: latest.name, reason, summary });
        } catch (error) {
          console.warn('[agent-org] could not append member-creation audit:', error);
        }
        return { roleId: latest.id, roleName: latest.name, roleTitle: latest.title, childSessionId: latest.sessionId, summary };
      },
    };
  }

  function ensureCaptainTools(agent, employee) {
    if (agent === undefined || employee?.role === undefined || captainToolsInstalled.has(agent)) return;
    const disposers = installations.get(agent);
    if (!Array.isArray(disposers)) return;
    const current = employee.store?.current;
    const role = current?.roles?.find((item) => item.id === employee.role.id) ?? employee.role;
    const hasReports = (current?.roles ?? []).some((item) => item.reportsTo === role.id && item.enabled !== false);
    if (role.level !== 'captain' && !hasReports) return;
    captainToolsInstalled.add(agent);
    disposers.push(agent.ctx.tools.register(createMemberAssignTool(employee)));
    disposers.push(agent.ctx.tools.register(createSkillSearchTool(employee)));
    disposers.push(agent.ctx.tools.register(createSkillInjectTool(employee)));
    disposers.push(agent.ctx.tools.register(createTeamHelpTool('captain')));
    disposers.push(agent.ctx.tools.register(createLeadModelTool(employee)));
    disposers.push(agent.ctx.tools.register(createEffortTool(employee)));
    disposers.push(agent.ctx.tools.register(createReportFailureTool(employee)));
  }

  async function installEmployeeTools(agent, employee) {
    if (employee?.role === undefined) return;
    if (disposed || installing.has(agent)) return;
    if (installations.has(agent)) {
      ensureCaptainTools(agent, employee);
      return;
    }
    installing.add(agent);
    await applyRoleModelAndEffort(agent, employee.role);
    try {
      // Tool policy is prompt-level. Do not install a global allow-list here:
      // it would strip the user's global tools rather than merely denying
      // file/terminal execution.
      const disposers = [];
      if (typeof agent.ctx.systemPrompt?.section === 'function') {
        disposers.push(agent.ctx.systemPrompt.section({
          name: 'agent-org:employee-identity',
          order: 600,
          interpolate: false,
          text: () => {
            const current = employee.store?.current ?? { roles: [employee.role], lead: { label: '组长' }, teamName: '团队' };
            const currentRole = current.roles.find((role) => role.id === employee.role.id) ?? employee.role;
            return buildEmployeeIdentityPrompt(current, currentRole, employee.workspace);
          },
        }));
      }
      disposers.push(agent.ctx.tools.register(createRelationTool(employee)));
      disposers.push(agent.ctx.tools.register(createMyReportsTool(employee)));
      disposers.push(agent.ctx.tools.register(createHelpRequestTool(employee)));
      for (const tool of createTaskTools(employee)) disposers.push(agent.ctx.tools.register(tool));
      installations.set(agent, disposers);
      ensureCaptainTools(agent, employee);
    } finally {
      installing.delete(agent);
    }
  }

  function createTaskTools(employee) {
    const { store, workspace } = employee;
    const taskSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        subject: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'deleted'] },
        ownerId: { type: 'string' },
        dependsOn: { type: 'array', items: { type: 'string' } },
        writeScopes: { type: 'array', items: { type: 'string' } },
        revision: { type: 'integer' },
        createdBy: { type: 'string' },
        result: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
      required: ['id', 'subject', 'description', 'status', 'ownerId', 'dependsOn', 'writeScopes', 'revision', 'createdBy', 'result', 'createdAt', 'updatedAt'],
    };
    const actorFor = (org, caller) => {
      if (caller === undefined) return null;
      if (org.lead.sessionId === caller.session.id) return { id: 'lead', name: org.lead.label, isLead: true };
      const role = org.roles.find((item) => item.sessionId === caller.session.id && item.enabled !== false);
      return role === undefined ? null : { id: role.id, name: role.name, isLead: false };
    };
    const load = async (caller) => {
      await store.refresh();
      if (!store.configured || !store.current.enabled) throw new Error('协作组尚未启用。');
      const org = store.current;
      const actor = actorFor(org, caller);
      if (actor === null) throw new Error('当前会话不是协作组成员。');
      return { org, actor };
    };
    const saveTasks = async (mutator) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = store.current;
        const result = mutator(current);
        if (result === null) throw new Error('任务不存在或状态已变化，请刷新后重试。');
        try {
          const saved = await store.save(current.revision, { ...current, tasks: result.tasks });
          return { org: saved, tasks: result.tasks, warnings: taskScopeWarnings(result.tasks), value: result.value };
        } catch (error) {
          if (error instanceof OrgRevisionError && attempt < 2) continue;
          throw error;
        }
      }
      throw new Error('任务保存失败，请重试。');
    };
    const audit = async (entry) => {
      try { await appendAudit(store, entry); } catch (error) { console.warn('[agent-org] could not append task audit:', error); }
    };
    const create = {
      name: 'team_task_create',
      description: 'Any team member can add a shared task. Dependencies must be completed before the task can be claimed. writeScopes are workspace-relative path hints; overlaps produce warnings, never locks.',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: {
          subject: { type: 'string', description: '任务标题，1–120 字。' },
          description: { type: 'string', description: '任务详情，最多 2000 字。' },
          dependsOn: { type: 'array', items: { type: 'string' }, description: '依赖的任务 id，全部完成后才能 claim。' },
          writeScopes: { type: 'array', items: { type: 'string' }, description: '工作区相对写范围，例如 src/chat.js；仅作重叠警告。' },
        },
        required: ['subject'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { task: taskSchema, warnings: { type: 'array', items: { type: 'string' } } }, required: ['task', 'warnings'] },
        render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; },
      },
      isConcurrencySafe: () => false,
      presentCall(args) { return { card: 'generic', title: `新建任务：${args.subject ?? ''}`, kind: 'other', rawInput: args }; },
      async execute(args, exec) {
        if (disposed) throw new Error('Agent Org 插件已卸载');
        const { org, actor } = await load(exec.agent);
        const subject = typeof args.subject === 'string' ? args.subject.trim().slice(0, 120) : '';
        if (subject === '') throw new Error('任务标题不能为空。');
        const description = typeof args.description === 'string' ? args.description.trim().slice(0, 2000) : '';
        const dependsOn = Array.isArray(args.dependsOn) ? [...new Set(args.dependsOn.map((item) => String(item ?? '').trim()).filter(Boolean))].slice(0, 32) : [];
        for (const id of dependsOn) {
          const dependency = org.tasks.find((task) => task.id === id);
          if (dependency === undefined || dependency.status === 'deleted') throw new Error(`找不到可依赖的任务“${id}”。`);
        }
        const rawScopes = Array.isArray(args.writeScopes) ? args.writeScopes : [];
        const writeScopes = [...new Set(rawScopes.map(normalizeWriteScope).filter(Boolean))].slice(0, 20);
        if (writeScopes.length !== rawScopes.filter((item) => String(item ?? '').trim() !== '').length) throw new Error('写范围必须是不越出工作区的相对路径。');
        const active = org.tasks.filter((task) => task.status !== 'deleted').length;
        if (active >= MAX_TASKS) throw new Error(`任务数量不能超过 ${MAX_TASKS}。`);
        const nextNumber = org.tasks.reduce((max, task) => Math.max(max, Number(task.id.slice(5)) || 0), 0) + 1;
        if (nextNumber > 999999999) throw new Error('任务 id 空间已耗尽。');
        const now = new Date().toISOString();
        const task = { id: `task-${nextNumber}`, subject, description, status: 'pending', ownerId: '', dependsOn, writeScopes, revision: 1, createdBy: actor.id, result: '', createdAt: now, updatedAt: now };
        const saved = await saveTasks((current) => ({ tasks: [...current.tasks, task], value: task }));
        await audit({ kind: 'work', action: 'task_create', actor: actor.name, roleId: actor.id, roleName: actor.name, reason: subject, summary: `新建任务 ${task.id}：${subject}` });
        return { task: saved.value, warnings: saved.warnings };
      },
    };
    const list = {
      name: 'team_task_list',
      description: 'List shared tasks with dependency readiness and advisory write-scope overlap warnings.',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'deleted'], description: '可选状态过滤。' },
          includeDeleted: { type: 'boolean', description: '是否包含已删除任务。' },
          mine: { type: 'boolean', description: '只显示分配给当前成员的任务。' },
        },
        required: [],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { tasks: { type: 'array', items: taskSchema }, warnings: { type: 'array', items: { type: 'string' } } }, required: ['tasks', 'warnings'] },
        render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; },
      },
      isConcurrencySafe: () => true,
      presentCall() { return { card: 'generic', title: '任务板', kind: 'other' }; },
      async execute(args, exec) {
        const { org, actor } = await load(exec.agent);
        let tasks = org.tasks;
        if (args.status !== undefined) tasks = tasks.filter((task) => task.status === args.status);
        else if (args.includeDeleted !== true) tasks = tasks.filter((task) => task.status !== 'deleted');
        if (args.mine === true) tasks = tasks.filter((task) => task.ownerId === actor.id);
        return { tasks, warnings: taskScopeWarnings(org.tasks) };
      },
    };
    const update = {
      name: 'team_task_update',
      description: 'Claim, release, complete, reopen, reassign, edit, or delete a shared task. expectedRevision is required; stale updates are rejected.',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: {
          taskId: { type: 'string', description: '任务 id，例如 task-1。' },
          expectedRevision: { type: 'integer', description: '调用方看到的任务 revision。' },
          action: { type: 'string', enum: ['claim', 'release', 'complete', 'reopen', 'reassign', 'edit', 'delete'] },
          owner: { type: 'string', description: 'reassign 时的成员 id/姓名/职位；传空字符串可释放。' },
          subject: { type: 'string', description: 'edit 时的新标题。' },
          description: { type: 'string', description: 'edit 时的新详情。' },
          writeScopes: { type: 'array', items: { type: 'string' }, description: 'edit 时的新写范围。' },
          result: { type: 'string', description: 'complete 时的结果摘要。' },
        },
        required: ['taskId', 'expectedRevision', 'action'],
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { task: taskSchema, warnings: { type: 'array', items: { type: 'string' } } }, required: ['task', 'warnings'] },
        render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; },
      },
      isConcurrencySafe: () => false,
      presentCall(args) { return { card: 'generic', title: `任务 ${args.taskId ?? ''}：${args.action ?? ''}`, kind: 'other', rawInput: args }; },
      async execute(args, exec) {
        const { org, actor } = await load(exec.agent);
        const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';
        const expectedRevision = Number(args.expectedRevision);
        const action = String(args.action ?? '');
        const saved = await saveTasks((current) => {
          const index = current.tasks.findIndex((task) => task.id === taskId);
          if (index < 0) return null;
          const tasks = current.tasks.map((item) => (item.id === taskId
            ? { ...item, dependsOn: [...item.dependsOn], writeScopes: [...item.writeScopes] }
            : item));
          const task = tasks[index];
          if (task.revision !== expectedRevision) throw new Error(`任务 ${taskId} 已更新（当前 revision ${task.revision}），请刷新后重试。`);
          if (action === 'claim') {
            if (task.status !== 'pending') throw new Error('只有 pending 任务可以 claim。');
            if (task.ownerId !== '' && task.ownerId !== actor.id) throw new Error('任务已被其他成员认领。');
            if (!taskReady(task, current.tasks)) throw new Error('任务依赖尚未全部完成。');
            task.ownerId = actor.id;
            task.status = 'in_progress';
          } else if (action === 'release') {
            if (task.ownerId !== actor.id && !actor.isLead) throw new Error('只有负责人或组长可以释放任务。');
            if (task.status !== 'in_progress') throw new Error('只有进行中的任务可以释放。');
            task.ownerId = '';
            task.status = 'pending';
          } else if (action === 'complete') {
            if (task.ownerId !== actor.id && !actor.isLead) throw new Error('只有负责人或组长可以完成任务。');
            if (task.status !== 'in_progress') throw new Error('只有进行中的任务可以完成。');
            task.status = 'completed';
            task.result = typeof args.result === 'string' ? args.result.trim().slice(0, 2000) : '';
          } else if (action === 'reopen') {
            if (task.ownerId !== actor.id && !actor.isLead) throw new Error('只有负责人或组长可以重开任务。');
            if (task.status !== 'completed') throw new Error('只有已完成的任务可以重开。');
            task.status = 'pending';
            task.ownerId = '';
          } else if (action === 'reassign') {
            if (!actor.isLead) throw new Error('只有组长可以改派任务。');
            if (task.status === 'deleted') throw new Error('已删除任务不能改派。');
            const ownerValue = typeof args.owner === 'string' ? args.owner.trim() : '';
            const ownerRole = ownerValue === '' ? null : findRole(current, ownerValue);
            if (ownerValue !== '' && ownerRole === null) throw new Error(`找不到成员“${ownerValue}”。`);
            task.ownerId = ownerRole?.id ?? '';
            task.status = ownerRole === null ? 'pending' : 'pending';
          } else if (action === 'edit') {
            if (task.ownerId !== actor.id && !actor.isLead) throw new Error('只有负责人或组长可以编辑任务。');
            if (typeof args.subject === 'string') {
              const subject = args.subject.trim().slice(0, 120);
              if (subject === '') throw new Error('任务标题不能为空。');
              task.subject = subject;
            }
            if (typeof args.description === 'string') task.description = args.description.trim().slice(0, 2000);
            if (Array.isArray(args.writeScopes)) {
              const raw = args.writeScopes;
              const scopes = [...new Set(raw.map(normalizeWriteScope).filter(Boolean))].slice(0, 20);
              if (scopes.length !== raw.filter((item) => String(item ?? '').trim() !== '').length) throw new Error('写范围必须是不越出工作区的相对路径。');
              task.writeScopes = scopes;
            }
          } else if (action === 'delete') {
            if (task.ownerId !== actor.id && !actor.isLead) throw new Error('只有负责人或组长可以删除任务。');
            task.status = 'deleted';
            task.ownerId = '';
          } else {
            throw new Error(`不支持的任务操作“${action}”。`);
          }
          task.revision += 1;
          task.updatedAt = new Date().toISOString();
          return { tasks, value: task };
        });
        await audit({ kind: 'work', action: `task_${action}`, actor: actor.name, roleId: actor.id, roleName: actor.name, reason: action, summary: `任务 ${taskId} ${action}` });
        return { task: saved.value, warnings: saved.warnings };
      },
    };
    return [create, list, update];
  }

  async function installLead(agent) {
    if (disposed || installing.has(agent)) return;
    const employee = await resolveEmployeeContext(agent);
    if (employee?.pending === true) return;
    if (employee?.role !== undefined) {
      await installEmployeeTools(agent, employee);
      return;
    }
    if (agent?.session?.header?.origin === 'subagent' || (agent?.session?.header?.delegationDepth ?? 0) > 0) return;
    if (installations.has(agent)) return;

    installing.add(agent);
    const disposers = [];
    try {
      const workspace = await resolveWorkspaceForSession(ctx, agent.session.id);
      if (disposed) return;
      if (workspace === undefined) {
        console.warn('[agent-org] session has no workspace; lead tools were not installed:', agent.session.id);
        return;
      }
      const store = getWorkspaceStore(workspace);
      await store.load();
      await retireLegacyHrSessions(workspace, store);
      if (disposed) return;
      const persistedLeadModel = store.configured && store.current.lead.sessionId === agent.session.id
        ? store.current.lead.model
        : null;
      if (persistedLeadModel !== null && persistedLeadModel !== undefined) {
        try {
          await selectHostSessionModel({
            sessionId: agent.session.id,
            provider: persistedLeadModel.provider,
            model: persistedLeadModel.model,
            ...(persistedLeadModel.reasoningEffort === undefined ? {} : { reasoningEffort: persistedLeadModel.reasoningEffort }),
          });
        } catch (error) {
          console.warn('[agent-org] could not apply persisted lead model:', error);
        }
      }
      if (typeof ctx.agents.get === 'function' && ctx.agents.get(agent.session.id) !== agent) return;
      if (store.configured && store.current.lead.sessionId !== agent.session.id) {
        // Never turn a member or an ordinary workspace session into a second
        // lead. The stored lead id is the only authority once setup exists;
        // a newly-created replacement lead is installed after the setup save.
        console.warn('[agent-org] refusing lead policy for non-lead session:', agent.session.id);
        return;
      }

      let order = 600;
      try {
        const configured = agent.ctx.systemPrompt.getSectionOrder('TEAM_POLICY');
        if (Number.isFinite(configured)) order = configured;
      } catch {
        // Keep the documented TEAM_POLICY position when this Harness release
        // does not expose the order helper.
      }
      disposers.push(agent.ctx.systemPrompt.section({
        name: 'agent-org:lead-policy',
        order,
        interpolate: false,
        text: () => buildLeadPrompt(store.current, {
          configured: store.configured,
          enabled: store.current.enabled,
          workspace,
        }),
      }));
      if (experienceStore !== null) {
        await experienceStore.load();
        disposers.push(agent.ctx.systemPrompt.section({
          name: 'agent-org:experience',
          order: order + 1,
          interpolate: false,
          text: () => experienceStore.prompt(),
        }));
      }

      disposers.push(agent.ctx.tools.register({
        name: 'team_assign',
        description:
          'Delegate one self-contained work item to a member of the user-maintained organization. ' +
          'Use the role id from the current 协作组 system section; this waits for the member and returns its result. ' +
          'For independent tasks with no shared files or ordering dependency, call several team_assign tools in the same turn so they run in parallel. ' +
          'Set waitForAll=true to wait for every currently running delegation in this workspace; omit it to wait only for this assignment. ' +
          'Do not parallelize dependent work or shared-file edits. Only the lead may call this tool.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            role: {
              type: 'string',
              description: '角色 id（优先），或唯一的成员姓名/角色名称，来自当前协作组名单。',
            },
            task: {
              type: 'string',
              description:
                '紧凑任务字段：goal=...; scope=...; files=...; accept=...; deps=...。组员看不到当前会话历史，必须自包含。',
            },
            reason: { type: 'string', description: '为什么把这项工作安排给该成员；必填。' },
            waitForAll: { type: 'boolean', description: '可选：是否等当前工作区所有正在运行的委派都完成后再返回，默认 false（只等本次）。' },
          },
          required: ['role', 'task', 'reason'],
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              roleId: { type: 'string' },
              roleName: { type: 'string' },
              roleTitle: { type: 'string' },
              childSessionId: { type: 'string' },
              status: {
                type: 'string',
                enum: ['completed', 'failed', 'aborted'],
              },
              summary: { type: 'string' },
              diagnostic: { type: 'string' },
              durationMs: { type: 'integer' },
              waitedForAll: { type: 'boolean' },
            },
            required: ['roleId', 'roleName', 'roleTitle', 'childSessionId', 'status', 'summary', 'durationMs', 'waitedForAll'],
          },
          render(_args, value) {
            const detail = value.diagnostic ? `\nDIAGNOSTIC=${value.diagnostic}` : '';
            return [{
              type: 'text',
              text: `AGENT=${value.roleId} STATUS=${value.status} MS=${value.durationMs}\n${value.summary}${detail}`,
            }];
          },
        },
        isConcurrencySafe: () => true,
        presentCall(args) {
          return {
            card: 'generic',
            title: `委派任务给 ${args.role}`,
            kind: 'other',
            rawInput: args,
          };
        },
        async execute(args, exec) {
          if (disposed) throw new Error('Agent Org 插件已卸载');
          const caller = exec.agent;
          if (caller === undefined) throw new Error('team_assign 需要一个组长会话');
          if (caller.session?.header?.origin === 'subagent' || (caller.session?.header?.delegationDepth ?? 0) > 0) {
            throw new Error('只有组长可以委派任务；当前会话是组员。');
          }
          await store.refresh();
          if (!store.configured) {
            throw new Error('当前工作区尚未建立协作组。请让用户在对话头部的「协作组」面板完成初始团队关系并启用后再委派。');
          }
          if (!store.current.enabled) {
            throw new Error('当前工作区的协作组已停用。请让用户从工作区文件夹菜单重新启用。');
          }

          const org = store.current;
          const role = findRole(org, args.role);
          if (role === null) {
            const known = org.roles.map((item) => `${item.id}（${item.name} / ${item.title}）`).join('、') || '无';
            throw new Error(`找不到角色“${args.role}”。当前角色：${known}`);
          }
          if (!role.enabled) {
            throw new Error(`角色“${role.title} / ${role.name}”当前已停用，不能接受委派。请选择其他启用角色或由你自行完成。`);
          }
          if (role.reportsTo !== 'lead') {
            const manager = org.roles.find((candidate) => candidate.id === role.reportsTo);
            throw new Error(`只能直接委派向组长汇报的成员；“${role.name}”向“${manager?.name ?? role.reportsTo}”汇报，请先把任务交给其直属上级，由上级逐级委派。`);
          }
          const task = typeof args.task === 'string' ? args.task.trim() : '';
          if (task.length < 3) throw new Error('任务说明不能为空');
          const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
          if (reason.length < 2) throw new Error('工作安排必须填写 reason（至少 2 个字符）。');

          const value = await performAssignment({
            store,
            workspace,
            org,
            role,
            caller,
            task,
            signal: exec.signal,
            delegatorName: org.lead.label,
          });
          if (args.waitForAll === true) await waitForAllAssignments(workspace.id, exec.signal);
          value.waitedForAll = args.waitForAll === true;
          try {
            await appendAudit(store, { kind: 'work', action: 'assign', actor: org.lead.label, roleId: role.id, roleName: role.name, reason, summary: task });
          } catch (error) {
            console.warn('[agent-org] could not append assignment audit:', error);
          }
          return value;
        },
      }));
      disposers.push(agent.ctx.tools.register(createRelationTool({ store })));
      disposers.push(agent.ctx.tools.register(createEffortTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createActiveTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createHrTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createScopeTool({ store })));
      for (const tool of createTaskTools({ store, workspace })) disposers.push(agent.ctx.tools.register(tool));
      disposers.push(agent.ctx.tools.register(createModuleGroupTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createFireTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createSkillSearchTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createSkillInjectTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createExperienceSummaryTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createLeadModelTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createTeamHelpTool('lead')));
      disposers.push(agent.ctx.tools.register(createTaskStartTool({ store })));
      disposers.push(agent.ctx.tools.register(createTaskFinishTool({ store })));
      disposers.push(agent.ctx.tools.register(createMyReportsTool({ store })));
      disposers.push(agent.ctx.tools.register(createSaveKnowledgeTool({ store })));
      disposers.push(agent.ctx.tools.register(createFailureDiagnosisTool()));
      disposers.push(agent.ctx.tools.register(createReviewHelpTool({ store, workspace })));
      disposers.push(agent.ctx.tools.register(createReviewFailureTool({ store, workspace })));
      // Role boundaries live in the prompt. No broad tool allow-list is
      // installed: it would remove the user's global tools for the lead.
    } catch (error) {
      for (const dispose of disposers.reverse()) {
        try {
          dispose();
        } catch {
          // A partial install must not block the user's agent creation.
        }
      }
      throw error;
    } finally {
      installing.delete(agent);
    }
    if (disposers.length > 0) installations.set(agent, disposers);
  }

  function uninstallLead(agent) {
    const disposers = installations.get(agent);
    if (disposers === undefined) return;
    installations.delete(agent);
    for (const dispose of disposers.reverse()) {
      try {
        dispose();
      } catch {
        // Agent-scope disposal may already have removed the contribution.
      }
    }
  }

  const installSafely = async (agent) => {
    try {
      await installLead(agent);
    } catch (error) {
      console.warn('[agent-org] could not install lead tools:', error);
    }
  };

  async function retireLegacyHrSessions(workspace, store) {
    const sessions = store?.current?.__legacyHrSessions;
    if (!Array.isArray(sessions) || sessions.length === 0) return;
    for (const sessionId of sessions) {
      try {
        await ctx.workspaceRegistry.archiveSession(sessionId, { stopActivity: true });
      } catch (error) {
        console.warn('[agent-org] could not archive legacy HR session:', sessionId, error);
      }
    }
    store.current.__legacyHrSessions = [];
  }

  async function contextFor(sessionId, workspaceId) {
    let workspace;
    if (typeof workspaceId === 'string' && workspaceId !== '') {
      const record = ctx.workspaceRegistry.get(workspaceId);
      if (record !== undefined) workspace = publicWorkspace(record);
    }
    if (workspace === undefined) workspace = await resolveWorkspaceForSession(ctx, sessionId);
    if (workspace === undefined) return undefined;
    const store = getWorkspaceStore(workspace);
    await store.load();
    await retireLegacyHrSessions(workspace, store);
    return { workspace, store };
  }

  async function collectUsage(org) {
    const targets = [
      { id: 'lead', roleId: 'lead', name: org.lead.label, title: '组长', sessionId: org.lead.sessionId },
      ...org.roles.map((role) => ({ id: role.id, roleId: role.id, name: role.name, title: role.title, sessionId: role.sessionId })),
    ];
    const [pricing, exchange] = await Promise.all([loadModelPricing(), loadUsdCnyRate()]);
    const usdToCny = exchange.rate;
    const holidays = await loadChinaHolidays(new Date().getUTCFullYear());
    const entries = [];
    for (const target of targets) {
      const tokens = { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, turns: 0, cost: 0 };
      const byModel = new Map();
      let currentProvider = '';
      let currentModel = '';
      if (typeof target.sessionId === 'string' && target.sessionId !== '') {
        try {
          const snapshot = await ctx.sessionQuery.readSession(target.sessionId);
          for (const event of snapshot.events ?? []) {
            if (event?.type === 'request/header') {
              const config = event.data?.header?.config;
              if (config !== undefined && config !== null) {
                currentProvider = String(config.provider ?? currentProvider);
                currentModel = String(config.model ?? currentModel);
              }
              continue;
            }
            if (event?.type === 'request/context') {
              if (typeof event.data?.provider === 'string') currentProvider = event.data.provider;
              if (typeof event.data?.model === 'string') currentModel = event.data.model;
              continue;
            }
            if (event?.type !== 'assistant/message') continue;
            const usage = event.data?.usage;
            if (usage === undefined || usage === null) continue;
            const input = Number(usage.inputTokens) || 0;
            const output = Number(usage.outputTokens) || 0;
            const cacheRead = Number(usage.cacheReadTokens) || 0;
            const cacheWrite = Number(usage.cacheWriteTokens) || 0;
            const reasoning = Number(usage.reasoningTokens) || 0;
            const total = Number(usage.totalTokens) || input + output;
            tokens.input += input;
            tokens.output += output;
            tokens.total += total;
            tokens.cacheRead += cacheRead;
            tokens.cacheWrite += cacheWrite;
            tokens.reasoning += reasoning;
            tokens.turns += 1;
            const eventDate = Number.isFinite(Number(event.time)) ? new Date(Number(event.time)) : new Date();
            const isDeepSeek = currentProvider === 'deepseek' || deepSeekBasePrice(currentModel) !== null;
            const period = isDeepSeek && isDeepSeekPeak(eventDate, holidays) ? 'peak' : isDeepSeek ? 'off-peak' : 'standard';
            const key = `${currentProvider}/${currentModel}/${period}`;
            const bucket = byModel.get(key) ?? {
              provider: currentProvider, model: currentModel, period, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0, currency: 'USD',
            };
            bucket.input += input;
            bucket.output += output;
            bucket.cacheRead += cacheRead;
            bucket.cacheWrite += cacheWrite;
            bucket.total += total;
            byModel.set(key, bucket);
          }
        } catch (error) {
          console.warn('[agent-org] could not read usage for session:', target.sessionId, error);
        }
      }
      for (const bucket of byModel.values()) {
        const deepseekRate = bucket.provider === 'deepseek' || deepSeekBasePrice(bucket.model) !== null
          ? deepSeekPriceForPeriod(bucket.model, bucket.period)
          : null;
        const rate = deepseekRate ?? lookupModelPrice(pricing.data, bucket.provider, bucket.model);
        if (rate !== null) {
          const inputRate = rate.input * usdToCny;
          const outputRate = rate.output * usdToCny;
          const cacheRate = (rate.cacheRead > 0 ? rate.cacheRead : rate.input) * usdToCny;
          const uncachedInput = Math.max(0, bucket.input - bucket.cacheRead);
          bucket.cost = (uncachedInput / 1_000_000) * inputRate
            + (bucket.cacheRead / 1_000_000) * cacheRate
            + (bucket.output / 1_000_000) * outputRate;
          bucket.currency = 'CNY';
          if (rate.period !== undefined) bucket.period = rate.period;
          if (rate.source !== undefined) bucket.priceSource = rate.source;
        }
        tokens.cost += bucket.cost;
      }
      const models = [...byModel.values()].map((bucket) => ({ ...bucket }));
      entries.push({ ...target, ...tokens, models });
    }
    const total = entries.reduce((sum, entry) => ({
      input: sum.input + entry.input,
      output: sum.output + entry.output,
      total: sum.total + entry.total,
      cacheRead: sum.cacheRead + entry.cacheRead,
      cacheWrite: sum.cacheWrite + entry.cacheWrite,
      reasoning: sum.reasoning + entry.reasoning,
      turns: sum.turns + entry.turns,
      cost: sum.cost + entry.cost,
    }), { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, turns: 0, cost: 0 });
    const modelTotals = new Map();
    for (const entry of entries) {
      for (const bucket of entry.models ?? []) {
        const key = `${bucket.provider}/${bucket.model}`;
        const model = modelTotals.get(key) ?? {
          provider: bucket.provider,
          model: bucket.model,
          input: 0,
          output: 0,
          total: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          currency: 'CNY',
        };
        model.input += bucket.input;
        model.output += bucket.output;
        model.total += bucket.total;
        model.cacheRead += bucket.cacheRead;
        model.cacheWrite += bucket.cacheWrite;
        model.cost += bucket.cost;
        modelTotals.set(key, model);
      }
    }
    return {
      entries,
      models: [...modelTotals.values()].sort((a, b) => b.cost - a.cost),
      total,
      pricing: {
        source: pricing.source,
        fetchedAt: new Date(pricing.at).toISOString(),
        currency: 'CNY',
        usdToCny,
        exchangeSource: exchange.source,
        exchangeFetchedAt: new Date(exchange.at).toISOString(),
        peakRule: {
          timeZone: 'UTC',
          peakHours: [[1, 4], [6, 10]],
          weekdaysOnly: true,
          excludeChinaHolidays: true,
          offPeakMultiplier: 0.5,
          source: 'DeepSeek API pricing',
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  let groupChatCache = { workspaceId: null, at: 0, data: null };

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  }

  async function collectGroupMessages(org, relevantRoleIds = null) {
    const targets = [
      { kind: 'lead', roleId: 'lead', name: org.lead.label, title: '组长', sessionId: org.lead.sessionId },
      ...org.roles
        .filter((role) => relevantRoleIds === null || relevantRoleIds.has(role.id))
        .map((role) => ({ kind: 'member', roleId: role.id, name: role.name, title: role.title, sessionId: role.sessionId })),
    ];
    const batches = await Promise.all(targets.map(async (target) => {
      const messages = [];
      if (typeof target.sessionId !== 'string' || target.sessionId === '') return messages;
      try {
        // A single large session must not block the whole collaboration view.
        // Partial history is preferable to a multi-second blank panel; the
        // next cache window retries the full read.
        const snapshot = await withTimeout(ctx.sessionQuery.readSession(target.sessionId), 700);
        if (snapshot === null) {
          console.warn('[agent-org] group-message read timed out:', target.sessionId);
          return messages;
        }
        const events = (snapshot.events ?? []).slice(-160);
        for (const event of events) {
          if (event?.type !== 'user/message' && event?.type !== 'assistant/message') continue;
          const text = humanizeGroupText(String(textOfContent(event.data?.message?.content) ?? '')).trim();
          if (text === '') continue;
          const user = event.type === 'user/message';
          const eventTime = Number(event.time);
          messages.push({
            id: `${target.sessionId}-${event.seq ?? messages.length}`,
            sessionId: target.sessionId,
            roleId: target.roleId,
            roleName: target.name,
            roleTitle: target.title,
            kind: user ? (target.kind === 'lead' ? 'user' : 'assignment') : (target.kind === 'lead' ? 'lead' : 'member'),
            at: Number.isFinite(eventTime) ? new Date(eventTime).toISOString() : null,
            text,
          });
        }
      } catch (error) {
        console.warn('[agent-org] could not read group messages for session:', target.sessionId, error);
      }
      return messages;
    }));
    return batches.flat()
      .filter((message) => message.at !== null)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .slice(-150);
  }

  const groupMessagesCache = new Map();
  const groupMessagesInFlight = new Map();

  async function collectGroupChat(workspaceId) {
    const cacheKey = typeof workspaceId === 'string' && workspaceId !== '' ? workspaceId : '*';
    if (groupChatCache.data !== null && groupChatCache.workspaceId === cacheKey && Date.now() - groupChatCache.at < 1500) {
      return groupChatCache.data;
    }
    const groups = new Map();
    for (const run of runs.snapshot()) {
      const runWorkspaceId = run.workspaceId;
      if (typeof runWorkspaceId !== 'string' || runWorkspaceId === '') continue;
      if (cacheKey !== '*' && runWorkspaceId !== cacheKey) continue;
      if (!groups.has(runWorkspaceId)) {
        const workspace = ctx.workspaceRegistry.get(runWorkspaceId);
        groups.set(runWorkspaceId, {
          workspaceId: runWorkspaceId,
          workspaceTitle: workspace?.title ?? runWorkspaceId,
          workspacePath: workspace?.path ?? '',
          runs: [],
          messages: [],
          leadLabel: '组长',
          teamName: '',
        });
      }
      groups.get(runWorkspaceId).runs.push({
        ...run,
        task: humanizeGroupText(run.task),
        summary: humanizeGroupText(run.summary),
        diagnostic: humanizeGroupText(run.diagnostic),
      });
    }
    let workspaces = [];
    try {
      workspaces = typeof ctx.workspaceRegistry.list === 'function' ? ctx.workspaceRegistry.list() : [];
    } catch {
      workspaces = [];
    }
    if (cacheKey !== '*') workspaces = workspaces.filter((workspace) => workspace?.id === cacheKey);
    for (const workspace of workspaces) {
      if (workspace === undefined || typeof workspace.path !== 'string') continue;
      let store;
      try {
        store = getWorkspaceStore(workspace);
        await store.load();
      } catch {
        continue;
      }
      if (!store.configured || !store.current.enabled) continue;
      const org = store.current;
      if (!groups.has(workspace.id)) {
        groups.set(workspace.id, {
          workspaceId: workspace.id,
          workspaceTitle: workspace.title ?? workspace.id,
          workspacePath: workspace.path ?? '',
          runs: [],
          messages: [],
          leadLabel: org.lead.label,
          teamName: org.teamName,
        });
      }
      const group = groups.get(workspace.id);
      group.leadLabel = org.lead.label;
      group.teamName = org.teamName;
      const hasActive = group.runs.some((run) => run.status === 'running');
      const relevantRoleIds = new Set(group.runs.map((run) => run.roleId).filter((id) => typeof id === 'string' && id !== ''));
      const messageKey = `${workspace.id}:${[...relevantRoleIds].sort().join(',')}`;
      const messageTtl = hasActive ? 5_000 : 20_000;
      const cached = groupMessagesCache.get(messageKey);
      if (cached === undefined || Date.now() - cached.at > messageTtl) {
        let pending = groupMessagesInFlight.get(messageKey);
        if (pending === undefined) {
          pending = collectGroupMessages(org, relevantRoleIds).finally(() => { groupMessagesInFlight.delete(messageKey); });
          groupMessagesInFlight.set(messageKey, pending);
        }
        group.messages = await pending;
        groupMessagesCache.set(messageKey, { at: Date.now(), data: group.messages });
      } else {
        group.messages = cached.data;
      }
    }
    const list = [...groups.values()].map((group) => {
      const messageTime = group.messages.length > 0 ? Date.parse(group.messages[group.messages.length - 1].at) : 0;
      const runTime = group.runs.length > 0 ? Date.parse(group.runs[0].startedAt) : 0;
      return { ...group, lastActivity: Math.max(messageTime || 0, runTime || 0) };
    }).sort((a, b) => b.lastActivity - a.lastActivity);
    groupChatCache = { workspaceId: cacheKey, at: Date.now(), data: list };
    return list;
  }

  async function readHostModelCatalog() {
    const controller = ctx.sessionController;
    if (controller !== undefined && typeof controller.modelCatalog === 'function') {
      return controller.modelCatalog();
    }
    if (controller?.commands !== undefined && typeof controller.commands.modelCatalog === 'function') {
      return controller.commands.modelCatalog();
    }
    throw new Error('当前 Host 不提供模型目录接口');
  }

  async function selectHostSessionModel(request) {
    internalModelSelections += 1;
    try {
      const controller = ctx.sessionController;
      if (controller !== undefined && typeof controller.selectModel === 'function') {
        return await controller.selectModel(request);
      }
      if (controller?.commands !== undefined && typeof controller.commands.selectModel === 'function') {
        return await controller.commands.selectModel(request);
      }
      throw new Error('当前 Host 不提供模型切换接口');
    } finally {
      internalModelSelections -= 1;
    }
  }

  async function applyStoredLeadModel(store) {
    const lead = store?.current?.lead;
    if (lead?.model === null || lead?.model === undefined) return;
    if (typeof lead.sessionId !== 'string' || lead.sessionId === '') return;
    try {
      await selectHostSessionModel({
        sessionId: lead.sessionId,
        provider: lead.model.provider,
        model: lead.model.model,
        ...(lead.model.reasoningEffort === undefined ? {} : { reasoningEffort: lead.model.reasoningEffort }),
      });
    } catch (error) {
      console.warn('[agent-org] could not apply stored lead model:', error);
    }
  }

  async function enforceStoredSelectionForPrompt(sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') return;
    try {
      const workspace = await resolveWorkspaceForSession(ctx, sessionId);
      if (workspace === undefined) return;
      const store = getWorkspaceStore(workspace);
      await store.load();
      if (!store.configured || !store.current.enabled) return;
      const lead = store.current.lead;
      const role = store.current.roles.find((candidate) => candidate.sessionId === sessionId);
      const stored = lead.sessionId === sessionId ? lead.model : role?.model;
      if (stored === null || stored === undefined) return;
      let agent = ctx.agents.get(sessionId);
      if (agent === undefined) {
        const resolved = await ctx.sessionController.agents.resolveAgent(sessionId);
        if ('error' in resolved) return;
        agent = resolved.agent;
      }
      let current;
      try {
        current = ctx.sessionController.agents.selectionFor(agent)?.current;
      } catch {
        current = undefined;
      }
      if (current?.provider === stored.provider
        && current?.model === stored.model
        && (stored.reasoningEffort === undefined || current?.reasoningEffort === stored.reasoningEffort)) {
        return;
      }
      await selectHostSessionModel({
        sessionId,
        provider: stored.provider,
        model: stored.model,
        ...(stored.reasoningEffort === undefined ? {} : { reasoningEffort: stored.reasoningEffort }),
      });
    } catch (error) {
      console.warn('[agent-org] could not re-apply stored model before prompt:', error);
    }
  }

  async function rememberModelSelection(sessionId, selected) {
    if (typeof sessionId !== 'string' || sessionId === '' || selected === null || selected === undefined) return;
    try {
      const workspace = await resolveWorkspaceForSession(ctx, sessionId);
      if (workspace === undefined) return;
      const store = getWorkspaceStore(workspace);
      await store.load();
      if (!store.configured || !store.current.enabled) return;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = store.current;
        const selection = {
          provider: selected.provider,
          model: selected.model,
          ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
        };
        if (current.lead.sessionId === sessionId) {
          if (JSON.stringify(current.lead.model) === JSON.stringify(selection)) return;
          try {
            await store.save(current.revision, { ...current, lead: { ...current.lead, model: selection } });
            return;
          } catch (error) {
            if (error instanceof OrgRevisionError && attempt < 2) continue;
            throw error;
          }
        }
        const role = current.roles.find((candidate) => candidate.sessionId === sessionId);
        if (role === undefined) return;
        if (JSON.stringify(role.model) === JSON.stringify(selection)) return;
        try {
          await store.save(current.revision, {
            ...current,
            roles: current.roles.map((candidate) => (candidate.id === role.id ? { ...candidate, model: selection } : candidate)),
          });
          return;
        } catch (error) {
          if (error instanceof OrgRevisionError && attempt < 2) continue;
          throw error;
        }
      }
    } catch (error) {
      console.warn('[agent-org] could not remember model selection:', error);
    }
  }

  function leadModelAllowed(policy, provider, model) {
    if (!Array.isArray(policy) || policy.length === 0) return true;
    return policy.some((item) => item.provider === provider && item.model === model);
  }

  async function enforceTeamModelSelection(request) {
    try {
      const workspace = await resolveWorkspaceForSession(ctx, request.sessionId);
      if (workspace === undefined) return;
      const store = getWorkspaceStore(workspace);
      await store.load();
      if (!store.configured) return;
      const role = store.current.roles.find((candidate) => candidate.sessionId === request.sessionId);
      const lead = store.current.lead;
      const isLead = lead.sessionId === request.sessionId || (role === undefined && lead.sessionId !== request.sessionId);
      if (role !== undefined && role.model?.provider && role.model?.model) {
        const assigned = role.model;
        if (request.provider !== assigned.provider || request.model !== assigned.model
          || (assigned.reasoningEffort !== undefined && request.reasoningEffort !== assigned.reasoningEffort)) {
          throw new Error('模型选择被拒绝：成员模型由组长/队长统一分配，不能在成员会话内自行切换。');
        }
      }
      if (isLead && !leadModelAllowed(lead.modelPolicy, request.provider, request.model)) {
        throw new Error('模型选择被拒绝：该模型不在组长可选模型范围内。');
      }
      if (role === undefined && !isLead) return;
      const catalog = await readHostModelCatalog();
      const meta = (catalog.groups ?? [])
        .find((group) => group.id === request.provider)?.models
        ?.find((entry) => entry.id === request.model);
      if (meta === undefined) {
        throw new Error(`模型选择被拒绝：实时模型目录中找不到 ${request.provider}/${request.model}。`);
      }
      const efforts = meta.reasoning?.efforts ?? [];
      if (typeof request.reasoningEffort === 'string' && request.reasoningEffort !== ''
        && efforts.length > 0 && !efforts.some((effort) => effort.id === request.reasoningEffort)) {
        throw new Error(`模型选择被拒绝：模型 ${request.provider}/${request.model} 不支持思考强度 ${request.reasoningEffort}。`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('模型选择被拒绝')) throw error;
      console.warn('[agent-org] could not enforce model selection policy:', error);
    }
  }


  async function searchUserSkills(workspace, query) {
    const needleText = typeof query === 'string' ? query.trim() : '';
    let catalog = [];
    try {
      catalog = await ctx.skills.list({ cwd: workspace.path });
    } catch (error) {
      throw new HttpError(500, `读取技能目录失败：${errorMessage(error)}`);
    }
    const needle = needleText.toLocaleLowerCase('zh-CN');
    const matched = catalog
      .filter((skill) => skill?.invocation?.modelInvocable !== false)
      .filter((skill) => needle === '' || [skill.name, skill.description, skill.whenToUse ?? ''].join('\n').toLocaleLowerCase('zh-CN').includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      skills: matched.slice(0, 30).map((skill) => ({
        name: skill.name,
        description: skill.description,
        whenToUse: skill.whenToUse ?? '',
        source: skill.source,
      })),
      total: matched.length,
    };
  }

  async function injectUserSkill(workspace, store, body) {
    const roleId = typeof body.roleId === 'string' ? body.roleId.trim() : '';
    const role = store.current.roles.find((candidate) => candidate.id === roleId);
    if (role === undefined) throw new HttpError(404, '找不到要注入技能的角色');
    if (role.enabled === false) throw new HttpError(409, '角色已停用，不能注入技能');
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 2) throw new HttpError(400, '注入技能必须填写原因（至少 2 个字符）');
    let skillName = typeof body.name === 'string' ? body.name.trim() : '';
    let description = typeof body.description === 'string' ? body.description.trim() : '';
    let instructions = typeof body.instructions === 'string' ? body.instructions.trim() : '';
    let source = 'custom';
    if (typeof body.skill === 'string' && body.skill.trim() !== '') {
      const selected = body.skill.trim();
      let definition;
      try {
        definition = await ctx.skills.get(selected, { cwd: workspace.path });
      } catch (error) {
        throw new HttpError(500, `读取技能失败：${errorMessage(error)}`);
      }
      if (definition === undefined) throw new HttpError(404, `找不到已安装技能“${selected}”`);
      if (definition.invocation?.modelInvocable === false) throw new HttpError(400, `技能“${selected}”不允许模型调用`);
      skillName = definition.name;
      description = definition.description || description;
      instructions = definition.content || '';
      source = 'framework';
    }
    if (skillName.length < 1 || skillName.length > 80) throw new HttpError(400, '技能名称需要 1–80 个字符');
    if (instructions.length < 1) throw new HttpError(400, '技能内容不能为空');
    if (instructions.length > 12_000) throw new HttpError(400, '技能内容不能超过 12000 个字符');
    const skill = {
      name: skillName,
      description: description.slice(0, 300),
      instructions,
      source,
      injectedAt: new Date().toISOString(),
      injectedBy: '用户',
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = store.current;
      const existing = current.roles.find((candidate) => candidate.id === roleId);
      if (existing === undefined) throw new HttpError(404, '找不到要注入技能的角色');
      const skills = Array.isArray(existing.skills) ? existing.skills : [];
      const nextSkills = [...skills.filter((candidate) => candidate.name !== skill.name), skill];
      if (nextSkills.length > 8) throw new HttpError(409, '每个角色最多注入 8 个技能');
      try {
        await store.save(current.revision, {
          ...current,
          roles: current.roles.map((candidate) => (candidate.id === roleId ? { ...candidate, skills: nextSkills } : candidate)),
        });
        break;
      } catch (error) {
        if (error instanceof OrgRevisionError && attempt < 2) continue;
        throw error;
      }
    }
    const summary = `用户向「${role.name}」注入技能「${skillName}」（${source === 'framework' ? '环境 skill' : '自定义'}）。`;
    try {
      await appendAudit(store, {
        kind: 'personnel',
        action: 'inject_skill',
        actor: '用户',
        roleId: role.id,
        roleName: role.name,
        reason,
        summary,
      });
    } catch (error) {
      console.warn('[agent-org] could not append user skill audit:', error);
    }
    return { role: store.current.roles.find((candidate) => candidate.id === roleId), summary };
  }

  function statePayload(workspace, store, extra = {}) {
    const configured = store.configured;
    const currentOrg = configured ? store.current : createDefaultOrg();
    return {
      ok: true,
      configured,
      enabled: configured && currentOrg.enabled !== false,
      setupRequired: !configured,
      revision: configured ? currentOrg.revision : 0,
      org: publicOrg(currentOrg),
      defaults: configured ? null : publicOrg(createDefaultOrg()),
      workspace,
      runs: runs.snapshot(workspace.id),
      warning: store.warning,
      serverTime: new Date().toISOString(),
      ...extra,
    };
  }

  ctx.effect(() => {
    const controller = ctx.sessionController;
    if (controller === undefined || typeof controller.prompt !== 'function') return undefined;
    const original = controller.prompt;
    const wrapped = async function wrappedPrompt(request, signal) {
      await enforceStoredSelectionForPrompt(request?.sessionId);
      return original.call(this, request, signal);
    };
    controller.prompt = wrapped;
    return () => {
      if (controller.prompt === wrapped) controller.prompt = original;
    };
  }, 'agent-org:stored-model-before-prompt');

  ctx.effect(() => {
    const commands = ctx.sessionController?.commands;
    if (commands === undefined || typeof commands.create !== 'function') return undefined;
    const original = commands.create.bind(commands);
    const wrapped = async (request) => {
      if (internalSessionCreations > 0) return original(request);
      if (await sessionCreationWorkspaceLocked(request)) {
        throw new Error('该工作区已启用协作组，禁止新建会话；请使用组长会话下达任务。');
      }
      return original(request);
    };
    commands.create = wrapped;
    return () => {
      if (commands.create === wrapped) commands.create = original;
    };
  }, 'agent-org:session-creation-lock');

  ctx.effect(() => {
    const commands = ctx.sessionController?.commands;
    if (commands === undefined || typeof commands.selectModel !== 'function') return undefined;
    const original = commands.selectModel.bind(commands);
    const wrapped = async (request) => {
      if (internalModelSelections > 0) return original(request);
      await enforceTeamModelSelection(request);
      const result = await original(request);
      await rememberModelSelection(request.sessionId, result?.selected);
      return result;
    };
    commands.selectModel = wrapped;
    return () => {
      if (commands.selectModel === wrapped) commands.selectModel = original;
    };
  }, 'agent-org:lead-model-policy');

  ctx.effect(() => {
    const controller = ctx.sessionController;
    if (controller === undefined || typeof controller.selectModel !== 'function') return undefined;
    const original = controller.selectModel.bind(controller);
    const wrapped = async (request) => {
      if (internalModelSelections > 0) return original(request);
      await enforceTeamModelSelection(request);
      return original(request);
    };
    controller.selectModel = wrapped;
    return () => {
      if (controller.selectModel === wrapped) controller.selectModel = original;
    };
  }, 'agent-org:controller-model-policy');

  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: ORG_ROUTE,
      async handler(req, res) {
        try {
          const requestUrl = new URL(req.url ?? '/', 'http://agent-org.local');
          const requestedSession = requestUrl.searchParams.get('sessionId');
          const requestedWorkspace = requestUrl.searchParams.get('workspaceId');
          if (req.method === 'GET') {
            if (!isSameOriginRequest(req)) {
              sendJson(res, 403, { ok: false, code: 'forbidden', error: '只接受来自协作组面板的请求' });
              return;
            }
            if (requestUrl.searchParams.get('group') === '1') {
              sendJson(res, 200, {
                ok: true,
                serverTime: new Date().toISOString(),
                groups: await collectGroupChat(requestedWorkspace),
              });
              return;
            }
            if (requestUrl.searchParams.get('models') === '1') {
              const context = await contextFor(requestedSession, requestedWorkspace);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法读取模型目录');
              }
              await context.store.refresh();
              let catalog;
              try {
                catalog = await readHostModelCatalog();
              } catch (error) {
                throw new HttpError(500, `读取模型目录失败：${errorMessage(error)}`);
              }
              sendJson(res, 200, {
                ok: true,
                groups: catalog.groups ?? [],
                failures: catalog.failures ?? [],
                default: catalog.default ?? null,
                selected: context.store.configured ? (context.store.current.lead.model ?? null) : null,
                policy: context.store.configured ? (context.store.current.lead.modelPolicy ?? null) : null,
                serverTime: new Date().toISOString(),
              });
              return;
            }
            if (requestUrl.searchParams.get('skills') === '1') {
              const context = await contextFor(requestedSession, requestedWorkspace);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法搜索技能');
              }
              await context.store.refresh();
              if (!context.store.configured || !context.store.current.enabled) {
                throw new HttpError(409, '协作组尚未启用，不能搜索技能');
              }
              const result = await searchUserSkills(context.workspace, requestUrl.searchParams.get('query') ?? '');
              sendJson(res, 200, { ok: true, ...result, serverTime: new Date().toISOString() });
              return;
            }
            if (requestUrl.searchParams.get('usage') === '1') {
              const context = await contextFor(requestedSession, requestedWorkspace);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法读取用量');
              }
              await context.store.refresh();
              const usage = context.store.configured
                ? await collectUsage(context.store.current)
                : await collectUsage({ lead: { label: '组长', sessionId: null }, roles: [], pricing: { inputPerMillion: 0, outputPerMillion: 0, currency: 'CNY' } });
              sendJson(res, 200, { ok: true, usage, workspace: context.workspace, serverTime: new Date().toISOString() });
              return;
            }
            const context = await contextFor(requestedSession, requestedWorkspace);
            if (context === undefined) {
              throw new HttpError(400, '当前会话未关联工作区，无法读取协作组');
            }
            // GET is a pure read: it never detaches, repairs, creates, or
            // initializes sessions. Explicit repair is a separate POST action.
            await context.store.refresh();
            sendJson(res, 200, statePayload(context.workspace, context.store));
            return;
          }
          if (req.method === 'POST') {
            if (!isSameOriginRequest(req)) {
              sendJson(res, 403, { ok: false, code: 'forbidden', error: '只接受来自协作组面板的同源请求' });
              return;
            }
            const contentType = String(req.headers?.['content-type'] ?? '');
            if (!contentType.toLowerCase().startsWith('application/json')) {
              sendJson(res, 415, { ok: false, code: 'unsupported-media-type', error: 'Content-Type 必须是 application/json' });
              return;
            }
            const body = await readJsonBody(req);
            if (body !== null && typeof body === 'object' && body.action === 'workspace-deleted') {
              const deletedPath = typeof body.path === 'string' ? body.path.trim() : '';
              if (deletedPath === '' || !isAbsolute(deletedPath)) {
                throw new HttpError(400, '工作区路径必须是绝对路径');
              }
              const deletedStore = getWorkspaceStore({ path: deletedPath });
              await deletedStore.load();
              const changed = deletedStore.configured;
              if (changed) await deletedStore.remove();
              sendJson(res, 200, {
                ok: true,
                configured: false,
                enabled: false,
                changed,
              });
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'repair') {
              const repairSessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const repairWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(repairSessionId, repairWorkspaceId);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法修复成员会话');
              }
              await context.store.refresh();
              if (context.store.configured && context.store.current.enabled) {
                await repairRoleSessions(context.store, context.workspace);
              }
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'design-team') {
              const designSessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const designWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(designSessionId, designWorkspaceId);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法设计团队关系');
              }
              await context.store.refresh();
              if (!context.store.configured || !context.store.current.enabled) {
                throw new HttpError(409, '协作组尚未启用，不能设计团队关系');
              }
              const leadSessionId = context.store.current.lead.sessionId;
              if (typeof leadSessionId !== 'string' || leadSessionId === '') {
                throw new HttpError(409, '组长会话尚未建立，无法设计团队关系');
              }
              await ensureLeadInstalled(leadSessionId);
              await initializeLeadSession(leadSessionId, context.store.current, AbortSignal.timeout(120_000));
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'midproject-report') {
              const reportSessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const reportWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(reportSessionId, reportWorkspaceId);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法生成中期汇报');
              }
              await context.store.refresh();
              if (!context.store.configured || !context.store.current.enabled) {
                throw new HttpError(409, '协作组尚未启用，不能生成中期汇报');
              }
              const leadSessionId = context.store.current.lead.sessionId;
              if (typeof leadSessionId !== 'string' || leadSessionId === '') {
                throw new HttpError(409, '组长会话尚未建立，无法生成中期汇报');
              }
              await ensureLeadInstalled(leadSessionId);
              await initializeLeadSession(
                leadSessionId,
                context.store.current,
                AbortSignal.timeout(120_000),
                buildMidprojectReportPrompt(context.store.current),
              );
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'lead-model-policy') {
              const policySessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const policyWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(policySessionId, policyWorkspaceId);
              if (context === undefined) throw new HttpError(400, '当前会话未关联工作区，无法保存模型范围');
              await context.store.refresh();
              if (!context.store.configured) throw new HttpError(409, '协作组尚未建立，不能保存模型范围');
              const requested = Array.isArray(body.policy) ? body.policy : [];
              if (requested.length === 0) throw new HttpError(400, '至少保留一个可选模型');
              let catalog;
              try {
                catalog = await readHostModelCatalog();
              } catch (error) {
                throw new HttpError(500, `读取模型目录失败：${errorMessage(error)}`);
              }
              const allowed = new Set();
              for (const group of catalog.groups ?? []) {
                for (const model of group.models ?? []) allowed.add(`${group.id}|${model.id}`);
              }
              const policy = [];
              const seen = new Set();
              for (const item of requested) {
                if (item === null || typeof item !== 'object') continue;
                const provider = typeof item.provider === 'string' ? item.provider.trim() : '';
                const model = typeof item.model === 'string' ? item.model.trim() : '';
                const key = `${provider}|${model}`;
                if (!allowed.has(key) || seen.has(key)) continue;
                seen.add(key);
                policy.push({ provider, model });
              }
              if (policy.length === 0) throw new HttpError(400, '所选模型均不在当前 DSH 模型目录中');
              await context.store.save(context.store.current.revision, {
                ...context.store.current,
                lead: { ...context.store.current.lead, modelPolicy: policy },
              });
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'lead-model') {
              const modelSessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const modelWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(modelSessionId, modelWorkspaceId);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法切换组长模型');
              }
              await context.store.refresh();
              if (!context.store.configured) {
                throw new HttpError(409, '协作组尚未建立，不能切换组长模型');
              }
              const provider = typeof body.provider === 'string' ? body.provider.trim() : '';
              const model = typeof body.model === 'string' ? body.model.trim() : '';
              const reasoningEffort = typeof body.reasoningEffort === 'string' && body.reasoningEffort.trim() !== ''
                ? body.reasoningEffort.trim()
                : undefined;
              if (provider === '' || model === '') throw new HttpError(400, '模型 provider 和 model 不能为空');
              if (!leadModelAllowed(context.store.current.lead.modelPolicy, provider, model)) {
                throw new HttpError(409, '该模型不在组长可选模型范围内');
              }
              const leadSessionId = context.store.current.lead.sessionId;
              if (typeof leadSessionId !== 'string' || leadSessionId === '') {
                throw new HttpError(409, '组长会话尚未建立，不能切换模型');
              }
              let selected;
              try {
                const result = await selectHostSessionModel({
                  sessionId: leadSessionId,
                  provider,
                  model,
                  ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
                });
                selected = result.selected;
              } catch (error) {
                throw new HttpError(400, `切换组长模型失败：${errorMessage(error)}`);
              }
              for (let attempt = 0; attempt < 3; attempt += 1) {
                const current = context.store.current;
                try {
                  await context.store.save(current.revision, {
                    ...current,
                    lead: {
                      ...current.lead,
                      model: {
                        provider: selected.provider,
                        model: selected.model,
                        ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
                      },
                    },
                  });
                  break;
                } catch (error) {
                  if (error instanceof OrgRevisionError && attempt < 2) continue;
                  throw error;
                }
              }
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'layout') {
              const layoutSessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const layoutWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(layoutSessionId, layoutWorkspaceId);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法保存布局');
              }
              await context.store.refresh();
              if (!context.store.configured) {
                throw new HttpError(409, '协作组尚未建立，不能保存布局');
              }
              const expectedRevision = Number(body.revision);
              if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== context.store.current.revision) {
                throw new HttpError(409, `组织架构已被修改（期望修订号 ${expectedRevision}，当前 ${context.store.current.revision}）`);
              }
              let nextLayout;
              if (body.clear === true) {
                nextLayout = {};
              } else {
                const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : '';
                const x = Number(body.position?.x);
                const y = Number(body.position?.y);
                if (nodeId === '' || !Number.isFinite(x) || !Number.isFinite(y)) {
                  throw new HttpError(400, '布局位置无效');
                }
                if (nodeId !== 'lead' && !context.store.current.roles.some((role) => role.id === nodeId)) {
                  throw new HttpError(404, '找不到图谱节点');
                }
                nextLayout = {
                  ...(context.store.current.layout ?? {}),
                  [nodeId]: { x: Math.max(0, Math.min(10_000, x)), y: Math.max(0, Math.min(10_000, y)) },
                };
              }
              try {
                await context.store.save(context.store.current.revision, {
                  ...context.store.current,
                  layout: nextLayout,
                });
              } catch (error) {
                if (error instanceof OrgRevisionError) throw new HttpError(409, error.message);
                throw error;
              }
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'skill-inject') {
              const skillSessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const skillWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(skillSessionId, skillWorkspaceId);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法注入技能');
              }
              await context.store.refresh();
              if (!context.store.configured || !context.store.current.enabled) {
                throw new HttpError(409, '协作组尚未启用，不能注入技能');
              }
              await injectUserSkill(context.workspace, context.store, body);
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body !== null && typeof body === 'object' && body.action === 'provision') {
              const provisionSessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
                ? body.sessionId
                : requestedSession;
              const provisionWorkspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
                ? body.workspaceId
                : requestedWorkspace;
              const context = await contextFor(provisionSessionId, provisionWorkspaceId);
              if (context === undefined) {
                throw new HttpError(400, '当前会话未关联工作区，无法创建员工会话');
              }
              await context.store.refresh();
              if (!context.store.configured || !context.store.current.enabled) {
                throw new HttpError(409, '协作组尚未启用，不能创建员工会话');
              }
              const leadSessionId = typeof body.leadSessionId === 'string' && body.leadSessionId !== ''
                ? body.leadSessionId
                : context.store.current.lead.sessionId;
              const onlyRoleId = typeof body.roleId === 'string' && body.roleId !== '' ? body.roleId : null;
              if (typeof leadSessionId === 'string' && leadSessionId !== '') {
                await provisionRoleSessions(context.store, context.workspace, leadSessionId, onlyRoleId);
              }
              sendJson(res, 200, statePayload(context.workspace, context.store));
              return;
            }
            if (body === null || typeof body !== 'object' || typeof body.org !== 'object' || body.org === null) {
              throw new HttpError(400, '请求必须包含 org 对象');
            }
            const sessionId = typeof body.sessionId === 'string' && body.sessionId !== ''
              ? body.sessionId
              : requestedSession;
            const workspaceId = typeof body.workspaceId === 'string' && body.workspaceId !== ''
              ? body.workspaceId
              : requestedWorkspace;
            const context = await contextFor(sessionId, workspaceId);
            if (context === undefined) {
              throw new HttpError(400, '当前会话未关联工作区，无法保存协作组');
            }
            const expectedRevision = Number(body.revision);
            const wasConfigured = context.store.configured;
            const previousLeadSessionId = context.store.current.lead.sessionId;
            let candidate = wasConfigured
              ? body.org
              : { ...body.org, enabled: true };
            if (!wasConfigured && typeof sessionId === 'string' && sessionId !== '') {
              candidate = {
                ...candidate,
                lead: { ...candidate.lead, sessionId },
              };
            }
            try {
              await context.store.save(expectedRevision, candidate);
              const storedLeadSessionId = context.store.current.lead.sessionId;
              try {
                await ensureLeadInstalled(storedLeadSessionId);
              } catch (error) {
                console.warn('[agent-org] lead tool installation after setup failed:', error);
              }
              await applyStoredLeadModel(context.store);
              if (!wasConfigured && typeof storedLeadSessionId === 'string' && storedLeadSessionId !== '') {
                try {
                  await provisionRoleSessions(context.store, context.workspace, storedLeadSessionId);
                } catch (error) {
                  console.warn('[agent-org] initial role session provisioning failed:', error);
                }
                try {
                  await initializeLeadSession(storedLeadSessionId, context.store.current, AbortSignal.timeout(120_000));
                } catch (error) {
                  console.warn('[agent-org] initial lead session setup failed:', error);
                }
              } else if (typeof storedLeadSessionId === 'string' && storedLeadSessionId !== '' && storedLeadSessionId !== previousLeadSessionId) {
                try {
                  await initializeLeadSession(storedLeadSessionId, context.store.current, AbortSignal.timeout(120_000));
                } catch (error) {
                  console.warn('[agent-org] lead session setup failed:', error);
                }
              }
              sendJson(res, 200, statePayload(context.workspace, context.store));
            } catch (error) {
              if (error instanceof OrgRevisionError) {
                const payload = statePayload(context.workspace, context.store, {
                  ok: false,
                  code: 'revision-conflict',
                  error: error.message,
                });
                sendJson(res, 409, payload);
                return;
              }
              if (error instanceof OrgValidationError) {
                sendJson(res, 400, {
                  ok: false,
                  code: 'invalid-org',
                  error: error.message,
                  issues: error.issues,
                  revision: context.store.revision,
                  configured: context.store.configured,
                  workspace: context.workspace,
                });
                return;
              }
              throw error;
            }
            return;
          }
          res.setHeader('allow', 'GET, POST');
          sendJson(res, 405, { ok: false, code: 'method-not-allowed', error: '仅支持 GET 或 POST' });
        } catch (error) {
          const status = error instanceof HttpError ? error.status : 500;
          if (status === 500) console.warn('[agent-org] organization API failed:', error);
          sendJson(res, status, {
            ok: false,
            code: status === 500 ? 'internal-error' : 'bad-request',
            error: status === 500 ? '组织架构服务暂时不可用' : errorMessage(error),
          });
        }
      },
    });
    return () => {
      disposed = true;
      disposeRoute();
      for (const agent of [...installations.keys()]) uninstallLead(agent);
      for (const activation of [...activeActivations]) {
        void activation.dispose().catch(() => {});
      }
      activeActivations.clear();
    };
  }, 'agent-org:routesAndLeadTools');

  // Install only after the route effect has claimed its path. If registration
  // throws, no agent-scoped section or tool is left behind.
  void (async () => {
    const liveAgents = typeof ctx.agents?.list === 'function' ? ctx.agents.list() : [];
    for (const agent of liveAgents) {
      if (typeof ctx.agents.get !== 'function' || ctx.agents.get(agent.id) === agent) await installSafely(agent);
    }
  })();
  ctx.on('agent/created', async ({ agent }) => {
    if (!disposed) await installSafely(agent);
  });
  ctx.on('agent/disposed', ({ agent }) => uninstallLead(agent));
}
