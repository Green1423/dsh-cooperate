import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORG_PATTERNS,
  ROLE_EFFORTS,
  activeRelations,
  buildEmployeeIdentityPrompt,
  buildLeadPrompt,
  buildRoleBootstrapPrompt,
  buildMidprojectReportPrompt,
  buildRoleTaskPrompt,
  buildScopeUpdatePrompt,
  createDefaultOrg,
  migrateLegacyHr,
  findRole,
  managerLabel,
  validateOrg,
} from '../org.js';

function orgWith(roles) {
  return {
    ...createDefaultOrg(),
    roles,
  };
}

function sampleRole(overrides = {}) {
  return {
    id: 'designer',
    name: '产品设计师-01',
    title: '产品设计师',
    reportsTo: 'lead',
    level: 'member',
    effort: 'low',
    enabled: true,
    accent: '#7C6CFF',
    responsibilities: '梳理需求并产出可实现的设计方案。',
    instructions: '先确认目标与验收标准，再给出信息架构和交互方案。',
    sessionId: null,
    ...overrides,
  };
}

test('default organization validates and contains the requested role taxonomy', () => {
  const result = validateOrg(createDefaultOrg());
  assert.equal(result.ok, true);
  assert.deepEqual(result.org.roles, []);
  assert.equal(result.org.lead.sessionId, null);
  assert.deepEqual(result.org.templates.map((template) => template.title), ['产品设计师', '软件工程师', '软件工程师', '系统设计师', '报告师', '文档师', '软件测试师', '代码审核优化工程师', 'GitHub 提交管理员', '代码安全审核', '合规', '视频编导', '剪辑师', '特效师', '动画师', '调色师', '音效/配乐师', '字幕/包装设计师', '视频质检师']);
  assert.ok(result.org.templates.every((template) => template.builtin === true));
  assert.deepEqual(result.org.pricing, { inputPerMillion: 0, outputPerMillion: 0, currency: 'CNY' });
  assert.deepEqual(ROLE_EFFORTS, ['minimal', 'off', 'low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(result.org.templates.find((template) => template.level === 'captain').title, '软件工程师');
  assert.ok(result.org.templates.some((template) => template.title === '文档师'));
  assert.ok(result.org.templates.some((template) => template.title === '报告师'));
  assert.ok(result.org.templates.some((template) => template.title === '剪辑师'));
  assert.ok(result.org.templates.some((template) => template.title === '特效师'));
  assert.ok(result.org.templates.some((template) => template.title === '动画师'));
  assert.equal(result.org.templates.filter((template) => template.builtin).length, 19);
  assert.ok(!result.org.templates.some((template) => template.title.includes('摄影')));
  const systemDesignerTemplate = result.org.templates.find((template) => template.title === '系统设计师');
  assert.ok(systemDesignerTemplate);
  assert.match(systemDesignerTemplate.instructions, /模块\/接口/);
  const testerTemplate = result.org.templates.find((template) => template.title === '软件测试师');
  assert.match(testerTemplate.instructions, /模拟真实用户/);
  const custom = validateOrg({
    ...result.org,
    templates: [...result.org.templates, {
      id: 'template-custom',
      title: '数据工程师',
      accent: '#3B82F6',
      responsibilities: '构建数据管道。',
      instructions: '交付可验证的数据处理结果。',
      builtin: false,
    }],
  });
  assert.equal(custom.ok, true);
  assert.equal(custom.org.templates.at(-1).id, 'template-custom');
});

test('reporting cycles and dangling managers are rejected', () => {
  const org = orgWith([
    { id: 'a', name: '甲', title: 'A', reportsTo: 'b' },
    { id: 'b', name: '乙', title: 'B', reportsTo: 'a' },
  ]);
  const cyclic = validateOrg(org);
  assert.equal(cyclic.ok, false);
  assert.ok(cyclic.issues.some((issue) => issue.message.includes('循环')));

  const dangling = validateOrg(orgWith([{ id: 'a', name: '甲', title: 'A', reportsTo: 'missing' }]));
  assert.equal(dangling.ok, false);
  assert.ok(dangling.issues.some((issue) => issue.message.includes('找不到汇报对象')));
});

test('duplicate names and reserved ids are rejected', () => {
  const result = validateOrg(orgWith([
    { id: 'lead', name: '甲', title: 'A' },
    { id: 'other', name: '甲', title: 'B' },
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path.endsWith('.id')));
  assert.ok(result.issues.some((issue) => issue.message.includes('重复')));
});

test('findRole resolves id, exact name/title, and a unique partial title', () => {
  const org = orgWith([sampleRole()]);
  assert.equal(findRole(org, 'designer').id, 'designer');
  assert.equal(findRole(org, '产品设计师-01').id, 'designer');
  assert.equal(findRole(org, '产品设计师').id, 'designer');
  assert.equal(findRole(org, '不存在'), null);
});

test('lead prompt reports live status, hierarchy, and the no-self-edit boundary', () => {
  const org = orgWith([
    { id: 'product-designer', name: '林知夏', title: '产品设计师', reportsTo: 'lead', enabled: false },
    { id: 'software-engineer', name: '陈一鸣', title: '软件工程师', reportsTo: 'product-designer', enabled: true },
  ]);
  const prompt = buildLeadPrompt(org);
  assert.match(prompt, /北极星产品组/);
  assert.match(prompt, /product-designer/);
  assert.match(prompt, /停用/);
  assert.match(prompt, /software-engineer/);
  assert.match(prompt, /汇报给: 林知夏/);
  assert.match(prompt, /不参与任何实际执行/);
  assert.match(prompt, /web_search/);
  assert.match(prompt, /即使任务看起来很小/);
  assert.match(prompt, /缺少合适职业的成员/);
  assert.match(prompt, /team_create_member/);
  assert.match(prompt, /组长只能调度直接向自己汇报的成员/);
  assert.match(prompt, /不要自行创建、修改或删除角色/);
  assert.match(prompt, /专职产品设计师/);
  assert.match(prompt, /职权分工/);
  assert.match(prompt, /组织模板与网络调研/);
  assert.match(prompt, /模拟真实用户使用/);
  assert.match(prompt, /实现方案归属/);
  assert.match(prompt, /可以只读工作区文件/);
  assert.match(prompt, /不得写入/);
  assert.match(prompt, /pdf_extract_text/);
  assert.match(prompt, /pdf_render_page/);
  assert.match(prompt, /系统设计师/);
  assert.match(prompt, /web_search/);
  assert.equal(ORG_PATTERNS.length, 6);
  const midproject = buildMidprojectReportPrompt(createDefaultOrg());
  assert.match(midproject, /中期汇报/);
  assert.match(midproject, /报告师/);
  assert.match(midproject, /没有问题了/);
  assert.match(prompt, /禁止/);
  assert.match(prompt, /并行任务规划/);
  assert.match(prompt, /同一轮并行调用/);
  assert.match(prompt, /主动拆分/);
  assert.match(prompt, /队长/);
});


test('designer identity includes concrete authority, boundaries, and workflow', () => {
  const role = sampleRole({
    authority: '可决定首页信息架构、筛选交互和设计验收',
    boundaries: '不可改业务代码，不可自行批准发布',
  });
  const org = orgWith([role]);
  const prompt = buildEmployeeIdentityPrompt(org, role, { path: '/workspace', title: 'demo' });
  assert.match(prompt, /可决定首页信息架构、筛选交互和设计验收/);
  assert.match(prompt, /不可改业务代码，不可自行批准发布/);
  assert.match(prompt, /设计工作流/);
  assert.match(prompt, /专职设计师/);
  const task = buildRoleTaskPrompt(org, role, '交付首页', { path: '/workspace', title: 'demo' });
  assert.doesNotMatch(task, /AUTHORITY=/);
  assert.doesNotMatch(task, /BOUNDARY=/);
  const scope = buildScopeUpdatePrompt('可决定首页信息架构', '不可改业务代码');
  assert.match(scope, /可决定首页信息架构/);
  assert.match(scope, /不可改业务代码/);
});


test('validation canonicalizes unknown fields and accent colors', () => {
  const org = orgWith([sampleRole()]);
  org.extra = 'do not keep';
  org.roles[0].accent = '#abcdef';
  org.roles[0].unknown = 'drop';
  const result = validateOrg(org);
  assert.equal(result.ok, true);
  assert.equal(result.org.extra, undefined);
  assert.equal(result.org.roles[0].unknown, undefined);
  assert.equal(result.org.roles[0].accent, '#ABCDEF');
});


test('the lead prompt gates delegation until the workspace team is enabled', () => {
  const org = createDefaultOrg();
  const prompt = buildLeadPrompt(org, {
    configured: false,
    workspace: { title: '新工作区', path: '/workspace/new' },
  });
  assert.match(prompt, /尚未启用/);
  assert.match(prompt, /新工作区/);
  assert.match(prompt, /建立团队并启用/);
  assert.match(prompt, /不要调用 team_assign/);
  assert.doesNotMatch(prompt, /当前组织架构/);

  const enabled = buildLeadPrompt(org, {
    configured: true,
    workspace: { title: '新工作区', path: '/workspace/new' },
  });
  assert.match(enabled, /当前工作区：新工作区/);
  assert.match(enabled, /独立 AI 会话/);
});


test('graph relations allow cross-level, cyclic, and temporary links', () => {
  const org = orgWith([
    { id: 'product-designer', name: '林知夏', title: '产品设计师', reportsTo: 'lead' },
    { id: 'software-engineer', name: '陈一鸣', title: '软件工程师', reportsTo: 'product-designer' },
    { id: 'compliance', name: '周明远', title: '合规', reportsTo: 'lead' },
  ]);
  const future = new Date(Date.now() + 3_600_000).toISOString();
  org.relations = [
    { id: 'cross-check', from: 'compliance', to: 'software-engineer', type: 'collaborates', label: '发布审查', expiresAt: null },
    { id: 'cycle-back', from: 'software-engineer', to: 'product-designer', type: 'reports', label: '虚线汇报', expiresAt: null },
    { id: 'temp-help', from: 'compliance', to: 'product-designer', type: 'temporary', label: '临时支援', expiresAt: future },
    { id: 'review-before-push', from: 'compliance', to: 'software-engineer', type: 'handoff', label: '提交前复核', expiresAt: null },
  ];
  const result = validateOrg(org);
  assert.equal(result.ok, true);
  assert.equal(result.org.relations.length, 4);
  assert.match(buildLeadPrompt(result.org), /周明远 与 陈一鸣 协作/);
  assert.match(buildLeadPrompt(result.org), /周明远 完成后交接给 陈一鸣/);
  assert.match(buildLeadPrompt(result.org), /周明远 与 林知夏 临时协作/);
  const rolePrompt = buildEmployeeIdentityPrompt(result.org, result.org.roles.find((role) => role.id === 'software-engineer'), { path: '/w', title: 'W' });
  assert.match(rolePrompt, /周明远 与 陈一鸣 协作/);
  assert.match(rolePrompt, /陈一鸣 向 林知夏 汇报/);
});

test('expired temporary relations are excluded from collaboration prompts', () => {
  const org = orgWith([
    { id: 'compliance', name: '周明远', title: '合规', reportsTo: 'lead' },
    { id: 'software-engineer', name: '陈一鸣', title: '软件工程师', reportsTo: 'lead' },
  ]);
  org.relations = [{
    id: 'expired-temp',
    from: 'compliance',
    to: 'software-engineer',
    type: 'temporary',
    label: '过期支援',
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  }];
  const result = validateOrg(org);
  assert.equal(result.ok, true);
  const prompt = buildLeadPrompt(result.org);
  assert.doesNotMatch(prompt, /过期支援/);
  assert.match(prompt, /已过期|附加关系/);
  assert.equal(activeRelations(result.org).length, 0);
});

test('relation validation rejects self-links and unknown nodes', () => {
  const org = orgWith([sampleRole()]);
  org.relations = [
    { id: 'self', from: 'designer', to: 'designer', type: 'collaborates' },
    { id: 'missing', from: 'designer', to: 'nobody', type: 'temporary' },
  ];
  const result = validateOrg(org);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.message.includes('自身')));
  assert.ok(result.issues.some((issue) => issue.message.includes('找不到关系终点')));
});


test('disabled organizations reject delegation guidance and layout positions validate', () => {
  const org = createDefaultOrg();
  org.enabled = false;
  const prompt = buildLeadPrompt(org, {
    configured: true,
    enabled: false,
    workspace: { title: 'W', path: '/w' },
  });
  assert.match(prompt, /已停用/);
  assert.match(prompt, /工作区文件夹菜单/);
  assert.doesNotMatch(prompt, /### 调度规则/);

  org.enabled = true;
  org.roles = [sampleRole()];
  org.layout = { lead: { x: 120, y: 30 }, designer: { x: 280, y: 180 } };
  const valid = validateOrg(org);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.org.layout.lead, { x: 120, y: 30 });

  org.layout.nobody = { x: 1, y: 2 };
  const invalid = validateOrg(org);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.message.includes('找不到图谱节点')));
});


test('role bootstrap and follow-up task prompts preserve employee identity', () => {
  const org = orgWith([sampleRole()]);
  const role = org.roles[0];
  const workspace = { title: 'W', path: '/w' };
  const bootstrap = buildRoleBootstrapPrompt(org, role, workspace);
  assert.match(bootstrap, /产品设计师-01/);
  assert.match(bootstrap, /职位：产品设计师/);
  assert.match(bootstrap, /角色初始化/);
  const task = buildRoleTaskPrompt(org, role, '安排入职', workspace);
  assert.match(task, /产品设计师-01/);
  assert.match(task, /安排入职/);
  assert.match(task, /紧凑 JSON/);
  assert.match(task, /"status":"ok\|blocked\|failed"/);
});


test('legacy HR roles are migrated away and their reports move to the lead', () => {
  const legacy = createDefaultOrg();
  legacy.roles = [
    { id: 'people-ops', name: 'HR-01', title: 'HR', reportsTo: 'lead', level: 'member', enabled: true, accent: '#7C6CFF', responsibilities: '建人', instructions: '建人', sessionId: 'session-hr' },
    { id: 'worker', name: '工程师-01', title: '软件工程师', reportsTo: 'people-ops', level: 'member', enabled: true, accent: '#2E9E7B', responsibilities: '实现', instructions: '实现', sessionId: null },
  ];
  legacy.relations = [{ id: 'rel', from: 'people-ops', to: 'worker', type: 'collaborates' }];
  legacy.templates = [{ id: 'tpl-hr', title: 'HR', accent: '#D9822B', responsibilities: '', instructions: '', level: 'member', builtin: true }];
  const migrated = migrateLegacyHr(legacy);
  assert.deepEqual(migrated.roles.map((role) => role.id), ['worker']);
  assert.equal(migrated.roles[0].reportsTo, 'lead');
  assert.equal(migrated.relations.length, 0);
  assert.equal(migrated.templates.length, 0);
  assert.equal(migrated.lead.description.includes('HR'), false);
});

test('injected skills are rendered into the employee identity and task prompts', () => {
  const role = sampleRole({
    skills: [{
      name: 'safe-change',
      description: '安全变更流程',
      instructions: '修改前先读现有代码，修改后给出验证证据。',
      source: 'framework',
      injectedAt: new Date().toISOString(),
      injectedBy: '组长',
    }],
  });
  const org = orgWith([role]);
  const identity = buildEmployeeIdentityPrompt(org, role, { path: '/w', title: 'W' });
  assert.match(identity, /已注入技能/);
  assert.match(identity, /safe-change/);
  assert.match(identity, /修改前先读现有代码/);
  const task = buildRoleTaskPrompt(org, role, '修改登录页', { path: '/w', title: 'W' });
  assert.doesNotMatch(task, /safe-change/);
  assert.match(task, /修改登录页/);
});
