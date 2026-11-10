import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';

function seededOrg(org, overrides = {}) {
  return {
    ...org,
    roles: [{
      id: 'designer',
      name: '系统设计师-01',
      title: '系统设计师',
      reportsTo: 'lead',
      level: 'member',
      effort: 'low',
      enabled: true,
      accent: '#7C6CFF',
      responsibilities: '负责实现方案设计。',
      instructions: '先确认目标与约束，再给出模块边界和接口方案。',
      sessionId: null,
      ...overrides,
    }],
  };
}

function makeAgent(id, header = {}) {
  const captured = { sections: [], tools: [], followups: [], restrictions: [] };
  const cleanups = [];
  const eventListeners = new Set();
  const agent = {
    id,
    status: 'idle',
    options: { provider: 'test-provider', model: 'test-model' },
    session: { id, header },
    async whenIdle() {},
    cancel() {},
    followup(message) {
      captured.followups.push(message);
      setTimeout(() => {
        for (const listener of [...eventListeners]) {
          listener(agent.session, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '组长会话已就位' }] } } });
          listener(agent.session, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
        }
      }, 0);
    },
    ctx: {
      on(event, listener) {
        if (event === 'session/event') {
          eventListeners.add(listener);
          return () => eventListeners.delete(listener);
        }
        return () => {};
      },
      systemPrompt: {
        getSectionOrder: () => 600,
        section(options) {
          captured.sections.push(options);
          return () => {};
        },
      },
      tools: {
        register(tool) {
          captured.tools.push(tool);
          return () => {};
        },
        restrict(filter) {
          captured.restrictions.push(filter);
          return () => {};
        },
      },
    },
    captured,
  };
  return { agent, captured, cleanups };
}

function makeCtx(rootAgent, activationFactory) {
  const routes = [];
  const listeners = new Map();
  const cleanups = [];
  const starts = [];
  const sessionCreations = [];
  const commandCreations = [];
  const createRequests = [];
  const attached = [];
  const attachStates = [];
  const detached = [];
  const archived = [];
  const blankSessions = new Set();
  // Sessions whose id still exists in stored organization data but whose row
  // header cannot be read (for example a corrupted or externally removed row).
  const unreadableSessions = new Set();
  const turnOutcomes = new Map();
  const usageEvents = new Map();
  const modelSelections = [];
  const flushed = [];
  const sent = [];
  const childTools = [];
  const childRestrictions = [];
  const childAgents = new Map();
  const childSessions = new Map();
  const sessionTitles = new Map();
  function makeChildAgent(id, header = { parentSession: rootAgent.id, origin: 'subagent', delegationDepth: 1 }) {
    const eventListeners = new Set();
    const agent = {
      id,
      status: 'idle',
      completedTurns: 0,
      session: { id, seq: 0, header: { ...header } },
      ctx: {
        on(event, listener) {
          if (event === 'session/event') {
            eventListeners.add(listener);
            return () => eventListeners.delete(listener);
          }
          return () => {};
        },
        tools: {
          register(tool) {
            childTools.push(tool);
            return () => {};
          },
          restrict(filter) {
            childRestrictions.push(filter);
            return () => {};
          },
        },
      },
      async whenIdle() {},
      cancel() {},
      followup(message) {
        sent.push({ targetId: id, content: message.content });
        setTimeout(() => {
          agent.emit({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '处理完成，结果已返回。' }] } } });
          agent.completedTurns += 1;
          agent.emit({
            type: 'turn/end',
            data: { turn: 1, reason: turnOutcomes.get(id) ?? { kind: 'completed' } },
          });
        }, 0);
      },
      emit(event) {
        for (const listener of [...eventListeners]) listener(agent.session, event);
      },
    };
    childAgents.set(id, agent);
    childSessions.set(id, agent.session);
    return agent;
  }
  const workspace = {
    id: 'workspace-1',
    path: '/workspace',
    title: '测试工作区',
    sessionIds: [rootAgent.id],
    async attachSession(sessionId) {
      if (this.sessionIds.includes(sessionId)) return;
      attached.push(sessionId);
      attachStates.push({
        sessionId,
        promptsBeforeAttach: sent.filter((item) => item.targetId === sessionId).length,
        turnsBeforeAttach: childAgents.get(sessionId)?.completedTurns ?? 0,
      });
      this.sessionIds.push(sessionId);
    },
    async detachSession(sessionId) {
      if (!this.sessionIds.includes(sessionId)) return;
      this.sessionIds = this.sessionIds.filter((id) => id !== sessionId);
      if (!detached.includes(sessionId)) detached.push(sessionId);
    },
    async archiveSession(sessionId, options) {
      archived.push({ sessionId, options });
      this.sessionIds = this.sessionIds.filter((id) => id !== sessionId);
    },
  };
  const ctx = {
    agents: {
      list: () => [rootAgent],
      get: (id) => (id === rootAgent.id ? rootAgent : childAgents.get(id)),
      async create() { throw new Error('direct agent creation must not be used'); },
      async resume() { throw new Error('direct agent resume must not be used'); },
    },
    sessions: {
      get: (id) => (id === rootAgent.id ? rootAgent.session : childSessions.get(id)),
      async flush(session) { flushed.push(session.id); },
    },
    sessionTitle: {
      rename(session, title) {
        sessionTitles.set(session.id, title);
        return { title };
      },
    },
    skills: {
      async list() {
        return [{
          name: 'test-skill',
          description: '测试用技能',
          whenToUse: '需要测试技能时',
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'bundled',
          provider: 'test',
        }];
      },
      async get(name) {
        if (name !== 'test-skill') return undefined;
        return {
          name: 'test-skill',
          description: '测试用技能',
          whenToUse: '需要测试技能时',
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'bundled',
          provider: 'test',
          content: '按测试技能执行：先确认输入，再验证结果。',
        };
      },
    },
    sessionQuery: {
      async readSession(id) {
        if (unreadableSessions.has(id)) return { header: undefined };
        const session = childSessions.get(id) ?? (id === rootAgent.id ? rootAgent.session : undefined);
        if (session === undefined) throw new Error('missing session');
        return { header: session.header, session: session.header, events: usageEvents.get(id) ?? [] };
      },
      async observeSession(id) {
        return {
          projections: { values: { sessionListMetadata: { blank: blankSessions.has(id) } } },
          [Symbol.dispose]() {},
        };
      },
    },
    sessionController: {
      async create(request) {
        createRequests.push(request);
        return ctx.sessionController.commands.create(request);
      },
      agents: {
        presetForSession() { return 'test-preset'; },
        async createSession(request) {
          sessionCreations.push(request);
          const child = makeChildAgent(request.sessionId, { cwd: request.cwd });
          for (const listener of listeners.get('agent/created') ?? []) {
            await listener({ agent: child, source: 'startup' });
          }
          return { agent: child, agentPreset: request.agentPreset };
        },
        async resolveAgent(sessionId) {
          const child = childAgents.get(sessionId);
          return child === undefined ? { error: { code: 'session/not-found' } } : { agent: child };
        },
      },
      commands: {
        async modelCatalog() {
          return {
            default: { provider: 'deepseek', model: 'deepseek-flash' },
            routableProviders: ['deepseek'],
            groups: [{
              id: 'deepseek',
              name: 'DeepSeek',
              models: [
                {
                  id: 'deepseek-flash', name: 'DeepSeek Flash',
                  reasoning: { efforts: [{ id: 'off', name: 'Off' }, { id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' }], defaultEffort: 'high' },
                },
                { id: 'deepseek-v4-pro', name: 'DeepSeek Pro' },
              ],
            }, {
              id: 'opencode-go',
              name: 'OpenCode Go',
              models: [{
                id: 'qwen3.8-max', name: 'Qwen3.8 Max',
                reasoning: { efforts: [{ id: 'minimal', name: 'Minimal' }, { id: 'medium', name: 'Medium' }, { id: 'xhigh', name: 'Xhigh' }], defaultEffort: 'medium' },
              }],
            }],
            failures: [],
          };
        },
        async selectModel(request) {
          modelSelections.push(request);
          return { selected: { provider: request.provider, model: request.model } };
        },
        async create(request) {
          if (request.workspaceId !== undefined && request.cwd !== undefined) {
            throw new Error('session.create accepts workspaceId or cwd, not both');
          }
          commandCreations.push(request);
          const target = request.workspaceId === undefined
            ? undefined
            : ctx.workspaceRegistry.get(request.workspaceId);
          if (request.workspaceId !== undefined && target === undefined) {
            throw new Error(`workspace "${request.workspaceId}" not found`);
          }
          const created = await ctx.sessionController.agents.createSession({
            ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
            cwd: target?.path ?? workspace.path,
            ...(request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset }),
          });
          const sessionId = created.agent.session.id;
          if (target !== undefined) await target.attachSession(sessionId);
          return {
            sessionId,
            ...(created.agentPreset === undefined ? {} : { agentPreset: created.agentPreset }),
          };
        },
      },
    },
    workspaceRegistry: {
      list: () => [workspace],
      get: (id) => (id === workspace.id ? workspace : undefined),
      archiveSession: (sessionId, options) => workspace.archiveSession(sessionId, options),
    },
    webServer: {
      register(route) {
        routes.push(route);
        return () => {};
      },
    },
    tools: {},
    systemPrompt: {},
    subagents: {
      async startActivation(spec) {
        starts.push(spec);
        const activation = await activationFactory(spec);
        if (typeof activation.childId === 'string' && !childAgents.has(activation.childId)) {
          const child = makeChildAgent(activation.childId);
          for (const listener of listeners.get('agent/created') ?? []) {
            await listener({ agent: child, source: 'startup' });
          }
        }
        return activation;
      },
      async sendMessage(_sender, targetId, content) {
        sent.push({ targetId, content });
        const child = childAgents.get(targetId);
        if (child === undefined) throw new Error(`missing child ${targetId}`);
        setTimeout(() => {
          child.emit({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '处理完成，结果已返回。' }] } } });
          child.emit({ type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
        }, 0);
        return 'message-1';
      },
    },
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(listener);
      return () => {};
    },
    effect(fn) {
      const dispose = fn();
      cleanups.push(dispose);
      return () => {
        const value = typeof dispose === 'function' ? dispose() : undefined;
        return value;
      };
    },
  };
  return { ctx, routes, listeners, cleanups, starts, sessionCreations, commandCreations, createRequests, workspace, attached, attachStates, detached, archived, blankSessions, unreadableSessions, usageEvents, turnOutcomes, flushed, sent, childTools, childRestrictions, childAgents, sessionTitles, modelSelections };
}

function makeRequest(method, body, headers = {}, url = '/dsh-agent-org/state?sessionId=session-root') {
  const chunks = body === undefined ? [] : [Buffer.from(body)];
  const request = Readable.from(chunks);
  request.method = method;
  request.headers = headers;
  request.url = url;
  return request;
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value) {
      this.body = value ?? '';
    },
  };
}

async function callRoute(route, method, body, headers, url) {
  const response = makeResponse();
  await route.handler(makeRequest(method, body, headers, url), response);
  return { status: response.statusCode, headers: response.headers, json: JSON.parse(response.body) };
}

async function waitFor(predicate, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('apply installs lead policy and a waiting team_assign tool', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const root = makeAgent('session-root');
    let disposed = false;
    const { ctx, routes, starts, sessionCreations, commandCreations, createRequests, attached, attachStates, flushed, sent, childTools, childRestrictions, childAgents, sessionTitles, usageEvents } = makeCtx(root.agent, (spec) => ({
      childId: 'child-1',
      messageId: 'message-1',
      result: Promise.resolve({
        output: [{ type: 'text', text: '实现完成，测试通过。' }],
        stopReason: 'completed',
      }),
      async dispose() {
        disposed = true;
      },
    }));

    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && root.captured.tools.length >= 1);

    assert.equal(root.captured.sections.length, 2);
    assert.equal(root.captured.sections[0].interpolate, false);
    assert.match(root.captured.sections[0].text(), /尚未启用/);
    assert.equal(root.captured.tools.length, 20);
    assert.equal(root.captured.tools[0].name, 'team_assign');
    assert.equal(root.captured.tools[0].isConcurrencySafe(), true);
    assert.equal(root.captured.tools[1].name, 'team_relation');
    assert.equal(root.captured.tools[2].name, 'team_set_effort');
    assert.equal(root.captured.tools[3].name, 'team_set_member_active');

    const beforeSetup = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(beforeSetup.status, 200);
    assert.equal(beforeSetup.json.configured, false);
    assert.equal(beforeSetup.json.revision, 0);
    assert.equal(beforeSetup.json.org.roles.length, 0);
    await assert.rejects(
      () => root.captured.tools[0].execute(
        { role: 'designer', task: '初始化前不应委派' },
        { agent: root.agent, signal: new AbortController().signal },
      ),
      /尚未建立协作组/,
    );
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(beforeSetup.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    assert.equal(setup.json.configured, true);
    assert.equal(setup.json.enabled, true);
    assert.equal(setup.json.revision, 2);
    const roleSessionId = setup.json.org.roles[0].sessionId;
    assert.match(roleSessionId, /^session-/);
    assert.equal(setup.json.org.lead.sessionId, 'session-root');
    assert.equal(childAgents.get(roleSessionId).session.header.origin, undefined);
    await assert.rejects(
      () => ctx.sessionController.commands.create({ cwd: '/workspace' }),
      /禁止新建会话/,
    );
    // The member session must not become a visible workspace member until the
    // identity/bootstrap prompt has been delivered and completed.
    assert.deepEqual(attached, [roleSessionId]);
    assert.deepEqual(attachStates, [{ sessionId: roleSessionId, promptsBeforeAttach: 0, turnsBeforeAttach: 0 }]);
    assert.equal(sessionCreations[0].agentPreset, undefined);
    assert.equal(sessionCreations[0].cwd, '/workspace');
    // The plugin must never call the Agent-level createSession directly: every
    // creation is one user-side Session Controller `create` call.
    assert.equal(sessionCreations.length, 1);
    assert.equal(sessionCreations.length, createRequests.length);
    assert.equal(createRequests.length, 1);
    assert.equal(createRequests[0].sessionId, roleSessionId);
    assert.equal(createRequests[0].cwd, '/workspace');
    assert.equal(createRequests[0].workspaceId, undefined);
    assert.equal(createRequests[0].agentPreset, undefined);
    assert.equal(commandCreations.length, 1);
    assert.equal(commandCreations[0].sessionId, roleSessionId);
    assert.equal(commandCreations[0].workspaceId, undefined);
    assert.equal(commandCreations[0].cwd, '/workspace');
    assert.equal(commandCreations[0].agentPreset, undefined);
    assert.equal(childTools[0].name, 'team_relation');
    // Role boundaries are prompt-level: no broad tool allow-list is installed
    // on the member or the lead, because that would strip global tools.
    assert.equal(childRestrictions.length, 0);
    assert.equal(root.captured.restrictions.length, 0);
    assert.match(root.captured.followups[0].content[0].text, /团队关系设计任务/);
    const policy = root.captured.sections[0].text();
    assert.match(policy, /北极星产品组/);
    assert.match(policy, /designer/);
    assert.match(policy, /独立 AI 会话/);

    const relationTool = childTools.find((candidate) => candidate.name === 'team_relation');
    const relationExec = { agent: childAgents.get(roleSessionId), signal: new AbortController().signal };
    const temporary = await relationTool.execute(
      { action: 'create_temporary', from: 'lead', to: 'designer', label: '联调', reason: '需要 HR 协作联调' },
      relationExec,
    );
    assert.match(temporary.summary, /临时关系/);
    await assert.rejects(
      () => relationTool.execute(
        { action: 'set_manager', role: 'designer', manager: 'lead', reason: '统一由组长管理' },
        relationExec,
      ),
      /只有组长/,
    );
    const fixed = await root.captured.tools[1].execute(
      { action: 'set_manager', role: 'designer', manager: 'lead', reason: '统一由组长管理' },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.match(fixed.summary, /固定汇报/);
    const handoff = await root.captured.tools[1].execute(
      { action: 'add_handoff', from: 'lead', to: 'designer', label: '审核后提交', reason: '建立审核后提交流程' },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.match(handoff.summary, /交接顺序/);
    await assert.rejects(
      () => relationTool.execute(
        { action: 'add_handoff', from: 'lead', to: 'designer', reason: '建立审核后提交流程' },
        relationExec,
      ),
      /只有组长/,
    );
    const removed = await root.captured.tools[1].execute(
      { action: 'remove_handoff', from: 'lead', to: 'designer', reason: '移除临时交接' },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.match(removed.summary, /已移除交接/);
    const effortResult = await root.captured.tools[2].execute(
      { role: 'designer', effort: 'max', reason: '复杂人事分析需要高强度' },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.match(effortResult.summary, /max/);
    const afterEffort = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(afterEffort.json.org.roles[0].effort, 'max');
    assert.ok(afterEffort.json.org.audit.some((entry) => entry.action === 'set_effort' && entry.reason.includes('高强度')));
    assert.ok(afterEffort.json.org.audit.some((entry) => entry.action === 'create_temporary' && entry.reason.includes('联调')));
    usageEvents.set('session-root', [{ type: 'assistant/message', data: { usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 } } }]);
    usageEvents.set(roleSessionId, [
      { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-flash' } } } },
      { type: 'assistant/message', time: Date.UTC(2026, 10, 3, 2, 0, 0), data: { usage: { inputTokens: 300, outputTokens: 200, totalTokens: 500, cacheReadTokens: 50 } } },
      { type: 'assistant/message', time: Date.UTC(2026, 10, 3, 12, 0, 0), data: { usage: { inputTokens: 300, outputTokens: 200, totalTokens: 500, cacheReadTokens: 50 } } },
    ]);
    const usage = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' }, '/dsh-agent-org/state?sessionId=session-root&usage=1');
    assert.equal(usage.status, 200);
    assert.equal(usage.json.usage.total.input, 1600);
    assert.equal(usage.json.usage.total.output, 900);
    assert.equal(usage.json.usage.total.total, 2500);
    assert.ok(usage.json.usage.entries.some((entry) => entry.id === 'designer' && entry.cacheRead === 100));
    const peopleUsage = usage.json.usage.entries.find((entry) => entry.id === 'designer');
    assert.ok(peopleUsage.cost > 0);
    const peak = peopleUsage.models.find((item) => item.period === 'peak');
    const offPeak = peopleUsage.models.find((item) => item.period === 'off-peak');
    assert.ok(peak && offPeak);
    assert.ok(peak.cost > offPeak.cost);
    assert.equal(usage.json.usage.pricing.currency, 'CNY');
    assert.ok(usage.json.usage.pricing.usdToCny > 0);
    assert.equal(usage.json.usage.models[0].model, 'deepseek-flash');
    assert.ok(usage.json.usage.models[0].total > 0);
    assert.ok(usage.json.usage.models[0].cost > 0);

    const tool = root.captured.tools[0];
    const controller = new AbortController();
    const value = await tool.execute(
      { role: '系统设计师-01', task: '实现登录并运行测试', reason: '需要完成登录实现与验证' },
      { agent: root.agent, signal: controller.signal },
    );
    assert.equal(value.status, 'completed');
    assert.equal(value.summary, '处理完成，结果已返回。');
    assert.equal(value.roleId, 'designer');
    assert.equal(starts.length, 0);
    assert.equal(sent.length, 2);
    assert.equal(sessionTitles.get(roleSessionId), '系统设计师-01');
    assert.equal(sent[0].targetId, roleSessionId);
    assert.match(sent[0].content[0].text, /固定身份/);
    assert.equal(sent[1].targetId, roleSessionId);
    assert.match(sent[1].content[0].text, /实现登录并运行测试/);
    assert.deepEqual(attached, [roleSessionId]);
    assert.ok(flushed.includes(roleSessionId));

    const second = await tool.execute(
      { role: '系统设计师-01', task: '继续整理交接清单', reason: '继续整理交接材料' },
      { agent: root.agent, signal: controller.signal },
    );
    assert.equal(second.childSessionId, roleSessionId);
    assert.equal(starts.length, 0);
    assert.equal(sent.length, 3);
    assert.equal(sent[2].targetId, roleSessionId);

    const unauthorized = await callRoute(routes[0], 'GET', undefined, {});
    assert.equal(unauthorized.status, 403);

    const state = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(state.status, 200);
    assert.equal(state.json.ok, true);
    assert.equal(state.json.configured, true);
    assert.equal(state.json.runs.length, 2);
    assert.equal(state.json.runs[0].status, 'completed');
    assert.equal(state.json.runs[0].roleName, '系统设计师-01');

    const scoped = await callRoute(
      routes[0],
      'GET',
      undefined,
      { 'x-agent-org': '1' },
      '/dsh-agent-org/state?sessionId=session-root',
    );
    assert.equal(scoped.json.runs.length, 2);
    const otherSession = await callRoute(
      routes[0],
      'GET',
      undefined,
      { 'x-agent-org': '1' },
      '/dsh-agent-org/state?sessionId=another-session',
    );
    assert.equal(otherSession.status, 400);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('team_assign rejects a non-lead, unknown role, disabled role, and empty task', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const child = makeAgent('session-child', { origin: 'subagent', delegationDepth: 1 });
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'child-x',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const tool = lead.captured.tools[0];
    const signal = new AbortController().signal;

    await assert.rejects(
      () => tool.execute({ role: 'designer', task: '实现登录' }, { agent: child.agent, signal }),
      /只有组长/,
    );
    await assert.rejects(
      () => tool.execute({ role: 'nobody', task: '做点事' }, { agent: lead.agent, signal }),
      /找不到角色/,
    );
    const org = (await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' })).json.org;
    org.roles = org.roles.map((role) => (
      role.id === 'designer' ? { ...role, enabled: false } : role
    ));
    const save = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: setup.json.revision, org }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(save.status, 200);
    await assert.rejects(
      () => tool.execute({ role: 'designer', task: '实现登录' }, { agent: lead.agent, signal }),
      /已停用/,
    );
    const current = (await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' })).json;
    const reenabledOrg = { ...current.org, roles: current.org.roles.map((role) => ({ ...role, enabled: true })) };
    const reenabled = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: current.revision, org: reenabledOrg }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(reenabled.status, 200);
    await assert.rejects(
      () => tool.execute({ role: 'designer', task: ' ' }, { agent: lead.agent, signal }),
      /不能为空/,
    );
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('organization API validates writes, enforces revisions, and persists to disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const file = join(dir, 'nested', 'org.json');
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = file;
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'child-x',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1);
    const route = routes[0];

    const forbidden = await callRoute(route, 'POST', '{}', { 'content-type': 'application/json' });
    assert.equal(forbidden.status, 403);

    const wrongType = await callRoute(
      route,
      'POST',
      '{}',
      { 'content-type': 'text/plain', 'x-agent-org': '1' },
    );
    assert.equal(wrongType.status, 415);

    const initial = await callRoute(route, 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(initial.status, 200);
    assert.equal(initial.json.revision, 0);

    const nextOrg = seededOrg(initial.json.org);
    nextOrg.teamName = 'API 测试组';
    const setup = await callRoute(
      route,
      'POST',
      JSON.stringify({ revision: 0, org: nextOrg }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    assert.equal(setup.json.revision, 2);
    assert.match(setup.json.org.roles[0].sessionId, /^session-/);
    assert.equal(setup.json.org.lead.sessionId, 'session-root');
    assert.equal(setup.json.org.teamName, 'API 测试组');
    const disk = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(disk.revision, 2);

    const saved = await callRoute(
      route,
      'POST',
      JSON.stringify({ revision: 2, org: nextOrg }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.json.revision, 3);

    const stale = await callRoute(
      route,
      'POST',
      JSON.stringify({ revision: 1, org: nextOrg }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(stale.status, 409);
    assert.equal(stale.json.code, 'revision-conflict');

    const invalid = await callRoute(
      route,
      'POST',
      JSON.stringify({ revision: 3, org: { ...nextOrg, roles: [{ id: 'bad id', name: 'X', title: 'Y' }] } }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.code, 'invalid-org');
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


test('deleting a workspace retires the organization so re-adding initializes again', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'child-delete',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    assert.equal(setup.json.enabled, true);
    const deleted = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'workspace-deleted', path: '/workspace' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(deleted.status, 200);
    assert.equal(deleted.json.changed, true);
    assert.equal(deleted.json.configured, false);
    const state = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(state.json.configured, false);
    assert.equal(state.json.setupRequired, true);
    assert.equal(state.json.revision, 0);
    assert.equal(state.json.org.roles.length, 0);
    const reinitialized = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(state.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(reinitialized.status, 200);
    assert.equal(reinitialized.json.configured, true);
    assert.equal(reinitialized.json.enabled, true);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('lead creates a member, writes its identity prompt, and initializes its session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes, childTools, childAgents } = makeCtx(lead.agent, () => ({
      childId: 'unused-child',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const hrSessionId = setup.json.org.roles[0].sessionId;
    const hrTool = lead.captured.tools.find((tool) => tool.name === 'team_create_member');
    assert.ok(hrTool);
    const created = await hrTool.execute(
      {
        title: '软件工程师',
        responsibilities: '实现并验证软件功能。',
        instructions: '你是软件工程师，只完成实现、测试和证据交付。',
        reportsTo: '组长',
        provider: 'deepseek',
        model: 'deepseek-flash',
        authority: '可在 src/feature 内实现并交付，可提交实现自检结果',
        boundaries: '不可修改共享文件，不可批准自己的代码',
        reason: '需要新增软件工程师承担实现',
      },
      { agent: lead.agent, signal: new AbortController().signal },
    );
    assert.match(created.roleId, /^member-/);
    assert.equal(created.roleName, '软件工程师-01');
    assert.match(created.childSessionId, /^session-/);
    const state = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(state.json.org.roles.length, 2);
    const role = state.json.org.roles.find((candidate) => candidate.id === created.roleId);
    assert.equal(role.sessionId, created.childSessionId);
    assert.equal(role.title, '软件工程师');
    assert.equal(role.reportsTo, 'lead');
    assert.match(role.instructions, /身份|软件工程师/);
    assert.equal(role.authority, '可在 src/feature 内实现并交付，可提交实现自检结果');
    assert.equal(role.boundaries, '不可修改共享文件，不可批准自己的代码');
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('a failing route registration leaves no lead contributions behind', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx } = makeCtx(lead.agent, () => {
      throw new Error('should not start');
    });
    ctx.webServer.register = () => {
      throw new Error('duplicate route');
    };
    const { apply } = await import('../index.js');
    assert.throws(() => apply(ctx), /duplicate route/);
    assert.equal(lead.captured.sections.length, 0);
    assert.equal(lead.captured.tools.length, 0);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


test('a configured workspace can be disabled and re-enabled through the workspace API', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'child-x',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    assert.equal(setup.json.enabled, true);
    const disabled = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: setup.json.revision, workspaceId: 'workspace-1', org: { ...setup.json.org, enabled: false } }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(disabled.status, 200);
    assert.equal(disabled.json.enabled, false);
    await assert.rejects(
      () => lead.captured.tools[0].execute(
        { role: 'software-engineer', task: '停用后不应委派' },
        { agent: lead.agent, signal: new AbortController().signal },
      ),
      /已停用/,
    );
    const enabledAgain = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: disabled.json.revision, workspaceId: 'workspace-1', org: { ...disabled.json.org, enabled: true } }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(enabledAgain.status, 200);
    assert.equal(enabledAgain.json.enabled, true);
    const menuState = await callRoute(
      routes[0],
      'GET',
      undefined,
      { 'x-agent-org': '1' },
      '/dsh-agent-org/state?workspaceId=workspace-1',
    );
    assert.equal(menuState.status, 200);
    assert.equal(menuState.json.workspace.id, 'workspace-1');
    assert.equal(menuState.json.enabled, true);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('GET state is read-only and explicit repair keeps a blank role session attached', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const {
      ctx, routes, workspace, sessionCreations, attached, attachStates, detached, blankSessions,
    } = makeCtx(lead.agent, () => ({
      childId: 'unused-child',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const roleSessionId = setup.json.org.roles[0].sessionId;
    assert.ok(workspace.sessionIds.includes(roleSessionId));
    assert.deepEqual(attached, [roleSessionId]);
    assert.deepEqual(attachStates, [{ sessionId: roleSessionId, promptsBeforeAttach: 0, turnsBeforeAttach: 0 }]);

    // The stored role session and the lead session are blank again (for
    // example after an aborted bootstrap). GET must neither detach the role
    // session nor initialize the lead: it is a pure read.
    blankSessions.add(roleSessionId);
    blankSessions.add('session-root');
    const creationsBefore = sessionCreations.length;
    const attachesBefore = attached.length;
    const followupsBefore = lead.captured.followups.length;

    const read = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(read.status, 200);
    assert.equal(read.json.org.roles[0].sessionId, roleSessionId);
    assert.equal(sessionCreations.length, creationsBefore);
    assert.equal(attached.length, attachesBefore);
    assert.equal(lead.captured.followups.length, followupsBefore);
    assert.ok(workspace.sessionIds.includes(roleSessionId));
    assert.deepEqual(detached, []);

    // Explicit repair requires the same-origin marker and JSON content type.
    const forbiddenRepair = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'repair', workspaceId: 'workspace-1' }),
      { 'content-type': 'application/json' },
    );
    assert.equal(forbiddenRepair.status, 403);
    const wrongTypeRepair = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'repair', workspaceId: 'workspace-1' }),
      { 'content-type': 'text/plain', 'x-agent-org': '1' },
    );
    assert.equal(wrongTypeRepair.status, 415);
    assert.deepEqual(detached, []);

    // Explicit repair keeps the blank stored session attached instead of
    // detaching it, and initializes the blank lead session.
    const repaired = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'repair', workspaceId: 'workspace-1' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(repaired.status, 200);
    assert.equal(repaired.json.ok, true);
    assert.equal(repaired.json.configured, true);
    assert.equal(repaired.json.org.roles[0].sessionId, roleSessionId);
    assert.equal(sessionCreations.length, creationsBefore);
    assert.equal(attached.length, attachesBefore);
    assert.deepEqual(attachStates, [{ sessionId: roleSessionId, promptsBeforeAttach: 0, turnsBeforeAttach: 0 }]);
    assert.ok(workspace.sessionIds.includes(roleSessionId));
    assert.deepEqual(detached, []);
    assert.equal(lead.captured.followups.length, followupsBefore + 1);
    assert.match(lead.captured.followups.at(-1).content[0].text, /团队关系设计任务/);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('repair and provision refuse to replace a role session whose header is unreadable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const {
      ctx, routes, workspace, sessionCreations, attached, attachStates, detached, archived,
      unreadableSessions,
    } = makeCtx(lead.agent, () => ({
      childId: 'unused-child',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const roleSessionId = setup.json.org.roles[0].sessionId;
    assert.equal(sessionCreations.length, 1);

    // The stored organization still points at a session the query layer cannot
    // resolve to a header. This is the exact shape that used to trigger a new
    // session on every provision/repair pass.
    const missingSessionId = 'session-missing-header';
    unreadableSessions.add(missingSessionId);
    const org = setup.json.org;
    org.roles = org.roles.map((role) => (
      role.id === 'designer' ? { ...role, sessionId: missingSessionId } : role
    ));
    const saved = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: setup.json.revision, org }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.json.org.roles[0].sessionId, missingSessionId);

    const creationsBefore = sessionCreations.length;
    const attachedBefore = attached.length;
    const attachStatesBefore = attachStates.length;
    const detachedBefore = detached.length;
    const archivedBefore = archived.length;
    const sessionIdsBefore = [...workspace.sessionIds];
    assert.ok(sessionIdsBefore.includes(roleSessionId));
    const assertNoReplacement = () => {
      assert.equal(sessionCreations.length, creationsBefore);
      assert.equal(attached.length, attachedBefore);
      assert.equal(attachStates.length, attachStatesBefore);
      assert.equal(detached.length, detachedBefore);
      assert.equal(archived.length, archivedBefore);
      assert.deepEqual(workspace.sessionIds, sessionIdsBefore);
    };

    const repaired = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'repair', workspaceId: 'workspace-1' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(repaired.status, 200);
    assert.equal(repaired.json.org.roles[0].sessionId, missingSessionId);
    assertNoReplacement();

    const provisioned = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'provision', workspaceId: 'workspace-1' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(provisioned.status, 200);
    assert.equal(provisioned.json.org.roles[0].sessionId, missingSessionId);
    assertNoReplacement();

    // A later read still reports the preserved id, so the guard cannot be
    // mistaken for a transient in-memory value.
    const state = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(state.json.org.roles[0].sessionId, missingSessionId);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('delegation keeps a blank member grouped while identity and task turns run', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const {
      ctx, routes, workspace, attached, attachStates, detached, blankSessions, turnOutcomes, sent,
    } = makeCtx(lead.agent, () => ({
      childId: 'unused-child',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const roleSessionId = setup.json.org.roles[0].sessionId;
    blankSessions.add(roleSessionId);
    const tool = lead.captured.tools[0];
    const signal = new AbortController().signal;

    const completed = await tool.execute(
      { role: '系统设计师-01', task: '实现登录并运行测试', reason: '需要完成登录实现与验证' },
      { agent: lead.agent, signal },
    );
    assert.equal(completed.status, 'completed');
    assert.deepEqual(detached, []);
    assert.ok(workspace.sessionIds.includes(roleSessionId));
    assert.equal(attached.filter((id) => id === roleSessionId).length, 1);
    assert.equal(attachStates.length, 1);
    assert.equal(sent.filter((item) => item.targetId === roleSessionId).length, 3);
    assert.match(sent[1].content[0].text, /固定身份/);
    assert.match(sent[2].content[0].text, /实现登录/);

    // A blank session whose next turn is aborted must not be left attached,
    // and the delegated task must not run without the identity card.
    turnOutcomes.set(roleSessionId, { kind: 'aborted' });
    const aborted = await tool.execute(
      { role: '系统设计师-01', task: '再次尝试', reason: '继续未完成的人事工作' },
      { agent: lead.agent, signal },
    );
    assert.equal(aborted.status, 'aborted');
    assert.ok(workspace.sessionIds.includes(roleSessionId));
    assert.equal(attached.filter((id) => id === roleSessionId).length, 1);
    assert.equal(attachStates.length, 1);
    assert.deepEqual(detached, []);
    assert.equal(sent.filter((item) => item.targetId === roleSessionId).length, 4);
    assert.match(sent[3].content[0].text, /固定身份/);
    assert.doesNotMatch(sent[3].content[0].text, /再次尝试/);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('host source creates members through the Session Controller create contract and never navigates', async () => {
  const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
  // The forbidden Agent-level path bypasses the workspace-aware Session
  // Controller create handler used by the Workspace New Session control.
  assert.doesNotMatch(source, /sessionController\.agents\.createSession\s*\(/);
  assert.match(source, /sessionController\.create\s*\(/);
  // Member creation, repair, and delegation must not select or open a session;
  // the user's active conversation is preserved by never navigating.
  assert.doesNotMatch(source, /\.openSession\s*\(|\.startSession\s*\(/);
});

test('team_create_member reports a clear error when the user-side session cannot be created and a later assignment recovers it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-host-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes, childTools, childAgents, sessionCreations } = makeCtx(lead.agent, () => ({
      childId: 'unused-child',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const hrAgent = childAgents.get(setup.json.org.roles[0].sessionId);
    const hrTool = lead.captured.tools.find((tool) => tool.name === 'team_create_member');
    assert.ok(hrTool);

    const originalCreate = ctx.sessionController.create;
    const creationsBefore = sessionCreations.length;
    ctx.sessionController.create = async () => {
      throw new Error('测试预设不可用');
    };
    await assert.rejects(
      () => hrTool.execute(
        {
          title: '合规专员',
          responsibilities: '检查并报告合规要求。',
          instructions: '你是合规专员，只输出合规结论和证据。',
          provider: 'deepseek',
          model: 'deepseek-flash',
          authority: '可审查合规风险并给出结论',
          boundaries: '不可修改业务代码，不可批准发布',
          reason: '需要独立合规检查岗位',
        },
        { agent: lead.agent, signal: new AbortController().signal },
      ),
      (error) => {
        assert.match(error.message, /已登记/);
        assert.match(error.message, /成员会话未能建立/);
        assert.match(error.message, /测试预设不可用/);
        return true;
      },
    );
    // The failed member session must not fall back to the Agent-level API.
    assert.equal(sessionCreations.length, creationsBefore);
    const failedState = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const failedRole = failedState.json.org.roles.find((role) => role.title === '合规专员');
    assert.ok(failedRole);
    assert.equal(failedRole.sessionId, null);

    // The member is registered, so a later assignment provisions the missing
    // session through the same user-side create path and recovers.
    ctx.sessionController.create = originalCreate;
    const recovered = await lead.captured.tools[0].execute(
      { role: failedRole.id, task: '检查合规要求并给出结论。', reason: '恢复后完成合规检查' },
      { agent: lead.agent, signal: new AbortController().signal },
    );
    assert.equal(recovered.status, 'completed');
    assert.match(recovered.childSessionId, /^session-/);
    const recoveredState = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(
      recoveredState.json.org.roles.find((role) => role.id === failedRole.id).sessionId,
      recovered.childSessionId,
    );
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('a same-position captain can delegate only to a direct report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-captain-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const root = makeAgent('session-root');
    const { ctx, routes, childAgents, childTools, archived } = makeCtx(root.agent, (spec) => ({
      childId: spec.sessionId ?? `child-${Math.random().toString(36).slice(2)}`,
      messageId: `message-${Math.random().toString(36).slice(2)}`,
      result: Promise.resolve({
        output: [{ type: 'text', text: '{"status":"ok","summary":"done","files":[],"verify":"ok","risks":[]}' }],
        stopReason: 'completed',
      }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && root.captured.tools.length >= 1);
    const org = {
      version: 1,
      revision: 0,
      teamName: '队长测试组',
      enabled: true,
      lead: { label: '组长', description: '', sessionId: 'session-root' },
      roles: [
        {
          id: 'captain', name: '软件队长', title: '软件工程师', level: 'captain',
          reportsTo: 'lead', enabled: true, accent: '#7C6CFF',
          responsibilities: '带队实现', instructions: '带队实现', sessionId: null,
        },
        {
          id: 'optimizer', name: '优化师', title: '代码审核优化工程师', level: 'member',
          reportsTo: 'captain', enabled: true, accent: '#2E9E7B',
          responsibilities: '审核优化', instructions: '审核优化', sessionId: null,
        },
      ],
      templates: [],
      relations: [],
      layout: {},
    };
    const setup = await callRoute(routes[0], 'POST', JSON.stringify({ revision: 0, org }), {
      'content-type': 'application/json', 'x-agent-org': '1',
    });
    assert.equal(setup.status, 200);
    const captainRole = setup.json.org.roles.find((role) => role.id === 'captain');
    const optimizerRole = setup.json.org.roles.find((role) => role.id === 'optimizer');
    assert.ok(captainRole.sessionId);
    assert.ok(optimizerRole.sessionId);
    const captainAgent = childAgents.get(captainRole.sessionId);
    assert.ok(captainAgent);
    const assign = childTools.find((tool) => tool.name === 'team_assign');
    assert.ok(assign, 'captain should receive team_assign');
    const captainSkill = childTools.find((tool) => tool.name === 'team_skill_inject');
    assert.ok(captainSkill, 'captain should receive team_skill_inject');
    const reportsTool = childTools.find((tool) => tool.name === 'team_my_reports');
    assert.ok(reportsTool, 'captain should receive team_my_reports');
    const reports = await reportsTool.execute({}, { agent: captainAgent, signal: new AbortController().signal });
    assert.equal(reports.self.id, 'captain');
    assert.ok(reports.reports.some((role) => role.id === 'optimizer'));
    const captainModelTool = childTools.find((tool) => tool.name === 'team_select_model');
    assert.ok(captainModelTool, 'captain should receive team_select_model');
    const assignedModel = await captainModelTool.execute(
      { role: 'optimizer', provider: 'deepseek', model: 'deepseek-flash', reason: '直属优化师使用轻量模型完成日常审核' },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(assignedModel.roleId, 'optimizer');
    const captainEffort = childTools.find((tool) => tool.name === 'team_set_effort');
    assert.ok(captainEffort, 'captain should receive team_set_effort');
    const effortResult = await captainEffort.execute(
      { role: 'optimizer', effort: 'high', reason: '审核任务需要更高思考强度' },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(effortResult.effort, 'high');
    const afterModel = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.deepEqual(afterModel.json.org.roles.find((role) => role.id === 'optimizer').model, { provider: 'deepseek', model: 'deepseek-flash', reasoningEffort: 'high' });
    const qwenModel = await captainModelTool.execute(
      { role: 'optimizer', provider: 'opencode-go', model: 'qwen3.8-max', reason: '审核任务需要 Qwen 的视觉能力' },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(qwenModel.model, 'qwen3.8-max');
    const dynamicEffort = await captainEffort.execute(
      { role: 'optimizer', effort: 'xhigh', reason: 'Qwen 审核任务使用 xhigh' },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(dynamicEffort.effort, 'xhigh');
    const afterDynamic = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.deepEqual(afterDynamic.json.org.roles.find((role) => role.id === 'optimizer').model, { provider: 'opencode-go', model: 'qwen3.8-max', reasoningEffort: 'xhigh' });
    const captainSkillResult = await captainSkill.execute(
      { role: 'optimizer', skill: 'test-skill', reason: '优化师需要统一测试流程' },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(captainSkillResult.skillName, 'test-skill');
    await assert.rejects(
      () => assign.execute({ role: 'captain', task: 'self assignment', reason: '测试自委派拒绝' }, { agent: captainAgent, signal: new AbortController().signal }),
      /自己|直属下级/,
    );
    await assert.rejects(
      () => root.captured.tools[0].execute(
        { role: 'optimizer', task: 'lead bypasses captain', reason: '测试跨层委派' },
        { agent: root.agent, signal: new AbortController().signal },
      ),
      /只能直接委派|直属上级/,
    );
    const result = await assign.execute(
      { role: 'optimizer', task: 'goal=optimize; scope=src/a.js; accept=tests pass', reason: '队长把优化交给直属优化师' },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(result.roleId, 'optimizer');
    assert.equal(result.status, 'completed');
    assert.equal(result.waitedForAll, false);
    const waited = await assign.execute(
      { role: 'optimizer', task: 'goal=optimize again; accept=all results', reason: '需要等待所有并行委派完成', waitForAll: true },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(waited.waitedForAll, true);
    const helpTool = childTools.find((tool) => tool.name === 'team_request_help');
    assert.ok(helpTool, 'captain should receive team_request_help');
    const helped = await helpTool.execute(
      { role: 'optimizer', task: '请复核这个接口的边界条件并给出建议', reason: '需要同岗位优化师临时协助' },
      { agent: captainAgent, signal: new AbortController().signal },
    );
    assert.equal(helped.status, 'pending');
    assert.ok(helped.requestId.startsWith('help-'));
    const reviewTool = root.captured.tools.find((tool) => tool.name === 'team_review_help');
    assert.ok(reviewTool, 'lead should receive team_review_help');
    const pending = await reviewTool.execute({ action: 'list' }, { agent: root.agent, signal: new AbortController().signal });
    assert.ok(pending.requests.some((request) => request.requestId === helped.requestId));
    const approved = await reviewTool.execute(
      { action: 'approve', requestId: helped.requestId, reason: '临时协助范围清楚，同意' },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.equal(approved.status, 'completed');
    const afterHelp = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(afterHelp.json.org.helpRequests.find((request) => request.id === helped.requestId).status, 'completed');
    assert.ok(!afterHelp.json.org.relations.some((relation) => relation.label.includes('求助')));
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('lead creates a five-person software module group with sessions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-group-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const root = makeAgent('session-root');
    const { ctx, routes, childAgents, childTools, archived } = makeCtx(root.agent, (spec) => ({
      childId: spec.sessionId ?? `child-${Math.random().toString(36).slice(2)}`,
      messageId: `message-${Math.random().toString(36).slice(2)}`,
      result: Promise.resolve({
        output: [{ type: 'text', text: '{"status":"ready"}' }],
        stopReason: 'completed',
      }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && root.captured.tools.length >= 1);
    const org = {
      version: 1,
      revision: 0,
      teamName: '模块组测试',
      enabled: true,
      lead: { label: '组长', description: '', sessionId: 'session-root' },
      roles: [{
        id: 'designer', name: '系统设计师-01', title: '系统设计师', level: 'member', reportsTo: 'lead',
        enabled: true, accent: '#7C6CFF', responsibilities: '建人', instructions: '建人', sessionId: null,
      }],
      templates: [], relations: [], layout: {},
    };
    const setup = await callRoute(routes[0], 'POST', JSON.stringify({ revision: 0, org }), {
      'content-type': 'application/json', 'x-agent-org': '1',
    });
    assert.equal(setup.status, 200);
    const groupTool = root.captured.tools.find((tool) => tool.name === 'team_create_module_group');
    assert.ok(groupTool);
    const created = await groupTool.execute(
      { module: '支付', specialty: 'Node 后端', files: 'src/payments', provider: 'deepseek', model: 'deepseek-flash', reason: '支付模块需要独立软件组' },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.equal(created.roles.length, 5);
    assert.ok(created.roles.every((role) => typeof role.sessionId === 'string' && role.sessionId !== ''));
    const after = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const captain = after.json.org.roles.find((role) => role.id === created.captainId);
    assert.equal(captain.level, 'captain');
    assert.equal(captain.title, '软件工程师');
    const members = after.json.org.roles.filter((role) => role.reportsTo === captain.id);
    assert.equal(members.length, 4);
    assert.ok(members.some((role) => role.title === '软件测试师'));
    assert.ok(members.some((role) => role.title === '代码审核优化工程师'));
    assert.ok(members.some((role) => role.title === '文档师'));
    assert.ok(members.some((role) => role.title === '软件工程师' && role.level === 'member'));
    const engineer = members.find((role) => role.title === '软件工程师' && role.level === 'member');
    const fireTool = root.captured.tools.find((tool) => tool.name === 'team_fire_member');
    assert.ok(fireTool);
    const fired = await fireTool.execute(
      { role: engineer.id, reason: '模块合并后不再需要该岗位', confirm: true },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.equal(fired.roleId, engineer.id);
    assert.equal(fired.sessionRemoved, true);
    assert.ok(archived.some((entry) => entry.sessionId === engineer.sessionId));
    const final = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.ok(!final.json.org.roles.some((role) => role.id === engineer.id));
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


test('group chat shows the natural-language part of member messages', async () => {
  const { humanizeGroupText } = await import('../index.js');
  assert.equal(humanizeGroupText('{"status":"done","summary":"已完成登录页调整","taskId":"t1"}'), '已完成登录页调整');
  assert.equal(humanizeGroupText('```json\n{"message":"接口已通过测试","status":"done"}\n```'), '接口已通过测试');
  assert.equal(humanizeGroupText('这里是普通中文汇报。'), '这里是普通中文汇报。');
  assert.equal(humanizeGroupText('{"summary":"第一段","details":"第二段"}'), '第一段\n\n第二段');
});

test('a workspace can enable a lead-only team and the lead owns hiring tools', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-lead-only-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 7);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(initial.json.org.roles.length, 0);
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: initial.json.org }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    assert.equal(setup.json.enabled, true);
    assert.equal(setup.json.org.roles.length, 0);
    assert.equal(setup.json.org.lead.sessionId, 'session-root');
    const names = lead.captured.tools.map((tool) => tool.name);
    assert.ok(names.includes('team_create_member'));
    assert.ok(names.includes('team_create_module_group'));
    assert.ok(names.includes('team_fire_member'));
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('lead searches and injects a framework skill into a direct report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-skill-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 9);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const searchTool = lead.captured.tools.find((tool) => tool.name === 'team_skill_search');
    const search = await searchTool.execute(
      { role: 'designer', query: '测试' },
      { agent: lead.agent, signal: new AbortController().signal },
    );
    assert.equal(search.skills[0].name, 'test-skill');
    assert.equal(search.roleId, 'designer');
    assert.ok(search.members.some((member) => member.id === 'designer'));
    assert.match(search.summary, /已确认目标成员/);
    await assert.rejects(
      () => searchTool.execute({ role: 'lead', query: '测试' }, { agent: lead.agent, signal: new AbortController().signal }),
      /找不到成员/,
    );
    const injected = await lead.captured.tools.find((tool) => tool.name === 'team_skill_inject').execute(
      { role: 'designer', skill: 'test-skill', reason: '成员需要按统一测试流程验证方案' },
      { agent: lead.agent, signal: new AbortController().signal },
    );
    assert.equal(injected.skillName, 'test-skill');
    assert.equal(injected.skillCount, 1);
    const state = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const role = state.json.org.roles.find((candidate) => candidate.id === 'designer');
    assert.equal(role.skills.length, 1);
    assert.match(role.skills[0].instructions, /先确认输入/);
    assert.ok(state.json.org.audit.some((entry) => entry.action === 'inject_skill' && entry.reason.includes('统一测试流程')));
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('lead project summaries are stored globally and injected into later lead prompts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-exp-host-'));
  const previousFile = process.env.DSH_AGENT_ORG_FILE;
  const previousExperience = process.env.DSH_AGENT_ORG_EXPERIENCE_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  process.env.DSH_AGENT_ORG_EXPERIENCE_FILE = join(dir, 'experience.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 10);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const summaryTool = lead.captured.tools.find((tool) => tool.name === 'team_project_summary');
    assert.ok(summaryTool);
    const result = await summaryTool.execute(
      { kind: 'project', title: '登录模块交付', summary: '登录模块按计划交付并通过测试。', instructions: '先冻结接口，再并行实现和测试；提交前集中跑一次真实用户流程。' },
      { agent: lead.agent, signal: new AbortController().signal },
    );
    assert.equal(result.count, 1);
    const experienceSection = lead.captured.sections.find((section) => section.name === 'agent-org:experience');
    assert.ok(experienceSection);
    assert.match(experienceSection.text(), /登录模块交付/);
    assert.match(experienceSection.text(), /先冻结接口/);
    const state = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.ok(state.json.org.audit.some((entry) => entry.action === 'summarize_project'));
  } finally {
    if (previousFile === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previousFile;
    if (previousExperience === undefined) delete process.env.DSH_AGENT_ORG_EXPERIENCE_FILE;
    else process.env.DSH_AGENT_ORG_EXPERIENCE_FILE = previousExperience;
    await rm(dir, { recursive: true, force: true });
  }
});

test('user API can search installed skills and inject one into a role', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-user-skill-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 10);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const search = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' }, '/dsh-agent-org/state?skills=1&sessionId=session-root');
    assert.equal(search.status, 200);
    assert.equal(search.json.skills[0].name, 'test-skill');
    const injected = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'skill-inject', sessionId: 'session-root', roleId: 'designer', skill: 'test-skill', reason: '用户要求成员遵循测试技能' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(injected.status, 200);
    const role = injected.json.org.roles.find((candidate) => candidate.id === 'designer');
    assert.equal(role.skills.length, 1);
    assert.equal(role.skills[0].name, 'test-skill');
    assert.equal(role.skills[0].injectedBy, '用户');
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('graph layout saves use a small node-position request instead of the full organization', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-layout-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const layout = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'layout', revision: setup.json.revision, sessionId: 'session-root', nodeId: 'designer', position: { x: 320, y: 210 } }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(layout.status, 200);
    assert.deepEqual(layout.json.org.layout.designer, { x: 320, y: 210 });
    const cleared = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'layout', revision: layout.json.revision, sessionId: 'session-root', clear: true }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.json.org.layout, {});
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


test('user can switch and persist the lead model', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-model-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes, modelSelections } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const setup = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(setup.status, 200);
    const catalog = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' }, '/dsh-agent-org/state?models=1&sessionId=session-root');
    assert.equal(catalog.status, 200);
    assert.equal(catalog.json.groups[0].models.length, 2);
    const switched = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'lead-model', sessionId: 'session-root', provider: 'deepseek', model: 'deepseek-v4-pro' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(switched.status, 200);
    assert.deepEqual(switched.json.org.lead.model, { provider: 'deepseek', model: 'deepseek-v4-pro' });
    assert.deepEqual(modelSelections[0], { sessionId: 'session-root', provider: 'deepseek', model: 'deepseek-v4-pro' });
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('lead model policy limits the models the lead can select', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-model-policy-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    const policy = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'lead-model-policy', sessionId: 'session-root', policy: [{ provider: 'deepseek', model: 'deepseek-flash' }] }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(policy.status, 200);
    assert.deepEqual(policy.json.org.lead.modelPolicy, [{ provider: 'deepseek', model: 'deepseek-flash' }]);
    const modelTool = lead.captured.tools.find((tool) => tool.name === 'team_select_model');
    assert.ok(modelTool);
    const listed = await modelTool.execute({}, { agent: lead.agent, signal: new AbortController().signal });
    assert.equal(listed.models.length, 1);
    assert.equal(listed.models[0].model, 'deepseek-flash');
    const deniedByTool = await modelTool.execute(
      { provider: 'deepseek', model: 'deepseek-v4-pro', reason: '复杂任务需要更强模型' },
      { agent: lead.agent, signal: new AbortController().signal },
    ).then(() => null, (error) => error);
    assert.match(deniedByTool.message, /可选模型范围/);
    const selectedByTool = await modelTool.execute(
      { provider: 'deepseek', model: 'deepseek-flash', reason: '日常任务使用轻量模型' },
      { agent: lead.agent, signal: new AbortController().signal },
    );
    assert.equal(selectedByTool.action, 'selected');
    const denied = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'lead-model', sessionId: 'session-root', provider: 'deepseek', model: 'deepseek-v4-pro' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(denied.status, 409);
    assert.match(denied.json.error, /可选模型范围/);
    const allowed = await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ action: 'lead-model', sessionId: 'session-root', provider: 'deepseek', model: 'deepseek-flash' }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    assert.equal(allowed.status, 200);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('setup applies the persisted lead model to the lead session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-setup-model-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes, modelSelections } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 1);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const org = seededOrg(initial.json.org);
    org.lead.model = { provider: 'opencode-go', model: 'deepseek-v4.1-flash', reasoningEffort: 'max' };
    org.lead.modelPolicy = [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }];
    const setup = await callRoute(routes[0], 'POST', JSON.stringify({ revision: 0, org }), {
      'content-type': 'application/json', 'x-agent-org': '1',
    });
    assert.equal(setup.status, 200);
    assert.ok(modelSelections.some((selection) => selection.sessionId === 'session-root'
      && selection.provider === 'opencode-go' && selection.model === 'deepseek-v4.1-flash'));
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


test('team_help exposes current tools and prompt notes to the lead and a subset to captains', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-help-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes, childTools } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 12);
    const help = lead.captured.tools.find((tool) => tool.name === 'team_help');
    assert.ok(help);
    const result = await help.execute({ topic: 'tools' }, { agent: lead.agent, signal: new AbortController().signal });
    assert.equal(result.version, '2026.11.05');
    assert.ok(result.tools.some((tool) => tool.name === 'team_select_model'));
    assert.ok(result.tools.every((tool) => !Object.prototype.hasOwnProperty.call(tool, 'roles')));
    const prompts = await help.execute({ topic: 'prompts' }, { agent: lead.agent, signal: new AbortController().signal });
    assert.ok(prompts.notes.some((note) => note.includes('team_skill_search')));
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});


test('lead can query its direct reports', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-reports-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 13);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    await callRoute(
      routes[0],
      'POST',
      JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }),
      { 'content-type': 'application/json', 'x-agent-org': '1' },
    );
    const tool = lead.captured.tools.find((candidate) => candidate.name === 'team_my_reports');
    assert.ok(tool);
    const result = await tool.execute({}, { agent: lead.agent, signal: new AbortController().signal });
    assert.equal(result.self.id, 'lead');
    assert.ok(result.reports.some((role) => role.id === 'designer'));
    assert.match(result.summary, /直属下级/);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('lead can title and time a task from start to finish', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-task-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const lead = makeAgent('session-root');
    const { ctx, routes } = makeCtx(lead.agent, () => ({
      childId: 'unused',
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && lead.captured.tools.length >= 17);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    await callRoute(routes[0], 'POST', JSON.stringify({ revision: 0, org: seededOrg(initial.json.org) }), {
      'content-type': 'application/json', 'x-agent-org': '1',
    });
    const start = lead.captured.tools.find((tool) => tool.name === 'team_task_start');
    const finish = lead.captured.tools.find((tool) => tool.name === 'team_task_finish');
    assert.ok(start);
    assert.ok(finish);
    const started = await start.execute({ title: '支付模块上线' }, { agent: lead.agent, signal: new AbortController().signal });
    assert.equal(started.title, '支付模块上线');
    const running = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.equal(running.json.org.activeTask.title, '支付模块上线');
    assert.equal(running.json.org.activeTask.finishedAt, null);
    const finished = await finish.execute({}, { agent: lead.agent, signal: new AbortController().signal });
    assert.equal(finished.title, '支付模块上线');
    assert.ok(finished.durationMs >= 0);
    const done = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.ok(done.json.org.activeTask.finishedAt);
    assert.ok(done.json.org.activeTask.durationMs >= 0);
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('captain reports a failing direct report and the lead replaces it after approval', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-org-failure-'));
  const previous = process.env.DSH_AGENT_ORG_FILE;
  process.env.DSH_AGENT_ORG_FILE = join(dir, 'org.json');
  try {
    const root = makeAgent('session-root');
    const { ctx, routes, childAgents, childTools } = makeCtx(root.agent, () => ({
      childId: `child-${Math.random().toString(36).slice(2)}`,
      result: Promise.resolve({ output: [{ type: 'text', text: 'ok' }], stopReason: 'completed' }),
      async dispose() {},
    }));
    const { apply } = await import('../index.js');
    apply(ctx);
    await waitFor(() => routes.length === 1 && root.captured.tools.length >= 18);
    const initial = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    const org = {
      ...seededOrg(initial.json.org),
      roles: [
        {
          id: 'captain-team', name: '软件队长-01', title: '软件工程师', level: 'captain',
          reportsTo: 'lead', enabled: true, accent: '#7C6CFF', responsibilities: '带队实现', instructions: '带队实现', sessionId: null,
        },
        {
          id: 'worker-team', name: '软件工程师-01', title: '软件工程师', level: 'member',
          reportsTo: 'captain-team', enabled: true, accent: '#2E9E7B', responsibilities: '实现', instructions: '实现', sessionId: null,
        },
      ],
    };
    const setup = await callRoute(routes[0], 'POST', JSON.stringify({ revision: 0, org }), {
      'content-type': 'application/json', 'x-agent-org': '1',
    });
    assert.equal(setup.status, 200);
    const captain = childAgents.get(setup.json.org.roles.find((role) => role.id === 'captain-team').sessionId);
    assert.ok(captain);
    const reportTool = childTools.find((tool) => tool.name === 'team_report_failure');
    assert.ok(reportTool);
    const report = await reportTool.execute(
      { role: 'worker-team', reason: '该成员连续出现模型错误，需要重建' },
      { agent: captain, signal: new AbortController().signal },
    );
    assert.equal(report.status, 'pending');
    const reviewTool = root.captured.tools.find((tool) => tool.name === 'team_review_failure');
    assert.ok(reviewTool);
    const reviewed = await reviewTool.execute(
      {
        action: 'approve',
        requestId: report.requestId,
        provider: 'deepseek',
        model: 'deepseek-flash',
        reason: '确认是该成员会话问题，批准重建',
      },
      { agent: root.agent, signal: new AbortController().signal },
    );
    assert.equal(reviewed.status, 'completed');
    const after = await callRoute(routes[0], 'GET', undefined, { 'x-agent-org': '1' });
    assert.ok(!after.json.org.roles.some((role) => role.id === 'worker-team'));
    const replacement = after.json.org.roles.find((role) => role.id === reviewed.replacementRoleId);
    assert.ok(replacement);
    assert.equal(replacement.reportsTo, 'captain-team');
    assert.deepEqual(replacement.model, { provider: 'deepseek', model: 'deepseek-flash' });
  } finally {
    if (previous === undefined) delete process.env.DSH_AGENT_ORG_FILE;
    else process.env.DSH_AGENT_ORG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
