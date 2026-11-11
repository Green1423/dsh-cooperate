/**
 * Pure organization model for the Agent Org plugin.
 *
 * The organization is user-owned data: the lead reads it as context, the Web
 * panel edits it, and role workers receive their slice of it at dispatch time.
 * Keeping validation and prompt derivation here (rather than in the Cordis
 * wiring) makes both testable without a live Harness.
 */

import orgPatternsData from './content/org-patterns.json' with { type: 'json' };
import roleTemplateData from './content/role-templates.json' with { type: 'json' };
import rolePlaybookData from './content/role-playbooks.json' with { type: 'json' };
import promptData from './content/prompts.json' with { type: 'json' };
import formatData from './content/formats.json' with { type: 'json' };
import defaultData from './content/defaults.json' with { type: 'json' };

export const ORG_VERSION = 1;
export const MAX_ROLES = 80;
export const ROLE_LEVELS = ['captain', 'member'];
export const ROLE_EFFORTS = ['minimal', 'off', 'low', 'medium', 'high', 'xhigh', 'max'];
export const MAX_ROLE_SKILLS = 8;

/** Normalize an effort id. Provider/model-specific levels are validated against the live catalog. */
export function normalizeEffort(value) {
  const effort = String(value ?? '').trim().toLowerCase();
  if (effort === '' || effort === 'default' || effort === 'auto') return 'low';
  return /^[a-z][a-z0-9-]{0,31}$/.test(effort) ? effort : null;
}

/** Built-in organization patterns the lead can adapt before recruiting. */
export const ORG_PATTERNS = orgPatternsData;


/** Accent palette shared by the editor and the defaults. */
export const ACCENTS = ['#7C6CFF', '#2E9E7B', '#D9822B', '#3B82F6', '#D9578A', '#8A6A4B'];

const ROLE_ID = /^[a-z][a-z0-9-]{0,31}$/;
const RESERVED_IDS = new Set(['lead', 'root']);

export class OrgValidationError extends Error {
  constructor(issues) {
    const first = Array.isArray(issues) && issues.length > 0 ? issues[0] : '组织架构配置无效';
    super(typeof first === 'string' ? first : `${first.path}: ${first.message}`);
    this.name = 'OrgValidationError';
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clip(value, limit) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function defaultRole(index, role) {
  return {
    id: role.id,
    name: role.name,
    title: role.title,
    reportsTo: 'lead',
    level: 'member',
    effort: 'low',
    authority: '',
    boundaries: '',
    enabled: true,
    accent: ACCENTS[index % ACCENTS.length],
    responsibilities: role.responsibilities,
    instructions: role.instructions,
    skills: [],
    model: null,
    sessionId: null,
  };
}

const DEFAULT_ROLE_SPECS = [];

export const ROLE_TEMPLATES = roleTemplateData;
const DEFAULT_TEMPLATE_SPECS = ROLE_TEMPLATES;


function defaultTemplate(template) {
  return {
    id: template.id,
    title: template.title,
    accent: template.accent,
    responsibilities: template.responsibilities,
    instructions: template.instructions,
    authority: template.authority || '',
    boundaries: template.boundaries || '',
    level: template.level ?? 'member',
    builtin: true,
  };
}

export function createDefaultOrg() {
  return {
    version: ORG_VERSION,
    revision: 1,
    teamName: defaultData.teamName,
    enabled: false,
    lead: {
      label: defaultData.leadLabel,
      description: defaultData.leadDescription,
      sessionId: null,
      model: null,
      modelPolicy: null,
    },
    roles: DEFAULT_ROLE_SPECS.map((role, index) => defaultRole(index, role)),
    templates: DEFAULT_TEMPLATE_SPECS.map(defaultTemplate),
    relations: [],
    helpRequests: [],
    failureReports: [],
    activeTask: null,
    layout: {},
    audit: [],
    pricing: { inputPerMillion: 0, outputPerMillion: 0, currency: 'CNY' },
    updatedAt: null,
  };
}

/**
 * Remove the legacy HR role from older teams. Members that reported to HR are
 * reassigned to the lead, and HR-only templates/relations are dropped. This is
 * intentionally in-memory normalization: the next organization save persists it.
 */
export function migrateLegacyHr(org) {
  if (!isObject(org) || !Array.isArray(org.roles)) return org;
  const removed = new Set(org.roles
    .filter((role) => role?.id === 'people-ops' || /^hr$/i.test(String(role?.title ?? '').trim()))
    .map((role) => role.id));
  if (removed.size === 0) return org;
  const roles = org.roles
    .filter((role) => !removed.has(role.id))
    .map((role) => (removed.has(role.reportsTo) ? { ...role, reportsTo: 'lead' } : role));
  const relations = Array.isArray(org.relations)
    ? org.relations.filter((relation) => !removed.has(relation.from) && !removed.has(relation.to))
    : [];
  const templates = Array.isArray(org.templates)
    ? org.templates.filter((template) => !/^hr$/i.test(String(template?.title ?? '').trim()))
    : [];
  const layout = isObject(org.layout) ? { ...org.layout } : {};
  for (const id of removed) delete layout[id];
  const leadDescription = String(org.lead?.description ?? '')
    .replace(/委派 HR 建人/g, '直接创建成员')
    .replace(/HR/g, '组长');
  const removedSessions = org.roles
    .filter((role) => removed.has(role.id) && typeof role.sessionId === 'string' && role.sessionId !== '')
    .map((role) => role.sessionId);
  const migrated = {
    ...org,
    roles,
    relations,
    templates,
    layout,
    lead: isObject(org.lead) ? { ...org.lead, description: leadDescription } : org.lead,
  };
  Object.defineProperty(migrated, '__legacyHrSessions', { value: removedSessions, enumerable: false, configurable: true, writable: true });
  return migrated;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

/**
 * Validate and canonicalize an organization document.
 *
 * The input may come from disk, the browser, or a test. Unknown fields are
 * dropped so a stored file can never smuggle behavior into prompts. A
 * nonzero revision is retained (the store owns the next revision).
 *
 * @param {unknown} input
 * @returns {{ok: true, org: object} | {ok: false, issues: Array<{path: string, message: string}>}}
 */
export function validateOrg(input) {
  const issues = [];
  if (!isObject(input)) {
    return { ok: false, issues: [{ path: '$', message: '组织架构必须是一个对象' }] };
  }

  const version = input.version === undefined ? ORG_VERSION : input.version;
  if (version !== ORG_VERSION) pushIssue(issues, 'version', `不支持的版本 ${String(version)}`);

  const revision = input.revision === undefined ? 1 : input.revision;
  if (!Number.isSafeInteger(revision) || revision < 1) pushIssue(issues, 'revision', '修订号必须是正整数');

  const teamName = text(input.teamName);
  if (teamName.length < 1 || teamName.length > 60) pushIssue(issues, 'teamName', '团队名称需要 1–60 个字符');
  // Existing files predate the enable flag and remain enabled; new default
  // templates explicitly carry false until setup is confirmed.
  const enabled = input.enabled !== false;

  const rawLead = input.lead;
  if (!isObject(rawLead)) {
    pushIssue(issues, 'lead', '缺少组长信息');
  }
  const leadLabel = isObject(rawLead) ? text(rawLead.label) : '';
  const leadDescription = isObject(rawLead) ? text(rawLead.description) : '';
  const leadSessionId = isObject(rawLead) && typeof rawLead.sessionId === 'string' && rawLead.sessionId.trim() !== ''
    ? rawLead.sessionId.trim()
    : null;
  if (leadLabel.length < 1 || leadLabel.length > 20) pushIssue(issues, 'lead.label', '组长称呼需要 1–20 个字符');
  if (leadDescription.length > 280) pushIssue(issues, 'lead.description', '组长说明不能超过 280 个字符');
  let leadModel = null;
  if (isObject(rawLead) && rawLead.model !== undefined && rawLead.model !== null) {
    if (!isObject(rawLead.model)) {
      pushIssue(issues, 'lead.model', '组长模型必须是一个对象');
    } else {
      const provider = text(rawLead.model.provider);
      const model = text(rawLead.model.model);
      const effort = text(rawLead.model.reasoningEffort);
      if (provider === '' || provider.length > 80) pushIssue(issues, 'lead.model.provider', '模型 provider 无效');
      if (model === '' || model.length > 160) pushIssue(issues, 'lead.model.model', '模型名称无效');
      if (provider !== '' && model !== '') {
        leadModel = {
          provider,
          model,
          ...(effort === '' ? {} : { reasoningEffort: effort.slice(0, 40) }),
        };
      }
    }
  }

  let leadModelPolicy = null;
  if (isObject(rawLead) && rawLead.modelPolicy !== undefined && rawLead.modelPolicy !== null) {
    if (!Array.isArray(rawLead.modelPolicy)) {
      pushIssue(issues, 'lead.modelPolicy', '可选模型范围必须是数组');
    } else {
      const seen = new Set();
      leadModelPolicy = [];
      for (const [index, item] of rawLead.modelPolicy.slice(0, 200).entries()) {
        if (!isObject(item)) {
          pushIssue(issues, `lead.modelPolicy[${index}]`, '模型项必须是对象');
          continue;
        }
        const provider = text(item.provider);
        const model = text(item.model);
        if (provider === '' || model === '') {
          pushIssue(issues, `lead.modelPolicy[${index}]`, '模型 provider 和 model 不能为空');
          continue;
        }
        const key = `${provider}|${model}`;
        if (seen.has(key)) continue;
        seen.add(key);
        leadModelPolicy.push({ provider, model });
      }
      if (leadModelPolicy.length === 0) pushIssue(issues, 'lead.modelPolicy', '可选模型范围不能为空；不限制请设为 null');
    }
  }

  const rawRoles = Array.isArray(input.roles) ? input.roles : null;
  if (rawRoles === null) pushIssue(issues, 'roles', 'roles 必须是数组');
  if (rawRoles !== null && rawRoles.length > MAX_ROLES) {
    pushIssue(issues, 'roles', `成员数量不能超过 ${MAX_ROLES}`);
  }

  const roles = [];
  const seenIds = new Set();
  const seenNames = new Set();
  for (const [index, rawRole] of (rawRoles ?? []).entries()) {
    const base = `roles[${index}]`;
    if (!isObject(rawRole)) {
      pushIssue(issues, base, '成员必须是对象');
      continue;
    }

    const id = text(rawRole.id).toLowerCase();
    if (!ROLE_ID.test(id)) {
      pushIssue(issues, `${base}.id`, '角色 ID 需以小写字母开头，只含小写字母、数字或连字符，最长 32 位');
    } else if (RESERVED_IDS.has(id)) {
      pushIssue(issues, `${base}.id`, `角色 ID "${id}" 是保留字`);
    } else if (seenIds.has(id)) {
      pushIssue(issues, `${base}.id`, `角色 ID "${id}" 重复`);
    }
    seenIds.add(id);

    const name = text(rawRole.name);
    const nameKey = name.toLocaleLowerCase('zh-CN');
    if (name.length < 1 || name.length > 24) pushIssue(issues, `${base}.name`, '姓名需要 1–24 个字符');
    if (nameKey.length > 0 && seenNames.has(nameKey)) pushIssue(issues, `${base}.name`, `成员姓名 "${name}" 重复`);
    seenNames.add(nameKey);

    const title = text(rawRole.title);
    if (title.length < 1 || title.length > 24) pushIssue(issues, `${base}.title`, '角色名称需要 1–24 个字符');

    const level = text(rawRole.level) || 'member';
    if (!ROLE_LEVELS.includes(level)) pushIssue(issues, `${base}.level`, '角色级别必须是 captain 或 member');

    const rawEffort = text(rawRole.effort).toLowerCase();
    const effort = normalizeEffort(rawEffort);
    if (effort === null) pushIssue(issues, `${base}.effort`, '思考强度必须是模型支持的 effort id');
    const authority = text(rawRole.authority);
    if (authority.length > 300) pushIssue(issues, `${base}.authority`, '职权说明不能超过 300 个字符');
    const boundaries = text(rawRole.boundaries);
    if (boundaries.length > 300) pushIssue(issues, `${base}.boundaries`, '禁止事项不能超过 300 个字符');

    const reportsTo = text(rawRole.reportsTo) || 'lead';
    if (reportsTo !== 'lead' && !ROLE_ID.test(reportsTo)) {
      pushIssue(issues, `${base}.reportsTo`, '汇报对象必须是 “lead” 或有效的角色 ID');
    }

    const accent = (text(rawRole.accent) || ACCENTS[index % ACCENTS.length]).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(accent)) pushIssue(issues, `${base}.accent`, '强调色必须是六位十六进制颜色');

    const responsibilities = text(rawRole.responsibilities);
    if (responsibilities.length > 400) pushIssue(issues, `${base}.responsibilities`, '职责摘要不能超过 400 个字符');

    const instructions = text(rawRole.instructions);
    if (instructions.length > 4000) pushIssue(issues, `${base}.instructions`, '工作准则不能超过 4000 个字符');

    const rawSkills = Array.isArray(rawRole.skills) ? rawRole.skills : [];
    if (rawSkills.length > MAX_ROLE_SKILLS) {
      pushIssue(issues, `${base}.skills`, `每个成员最多注入 ${MAX_ROLE_SKILLS} 个技能`);
    }
    const skills = [];
    for (const [skillIndex, rawSkill] of rawSkills.slice(0, MAX_ROLE_SKILLS).entries()) {
      const skillBase = `${base}.skills[${skillIndex}]`;
      if (!isObject(rawSkill)) {
        pushIssue(issues, skillBase, '技能必须是对象');
        continue;
      }
      const skillName = text(rawSkill.name);
      const skillDescription = text(rawSkill.description);
      const skillInstructions = text(rawSkill.instructions);
      if (skillName.length < 1 || skillName.length > 80) pushIssue(issues, `${skillBase}.name`, '技能名称需要 1–80 个字符');
      if (skillDescription.length > 300) pushIssue(issues, `${skillBase}.description`, '技能描述不能超过 300 个字符');
      if (skillInstructions.length < 1 || skillInstructions.length > 12_000) pushIssue(issues, `${skillBase}.instructions`, '技能内容需要 1–12000 个字符');
      const source = rawSkill.source === 'framework' ? 'framework' : 'custom';
      const injectedAt = typeof rawSkill.injectedAt === 'string' && rawSkill.injectedAt.trim() !== ''
        ? rawSkill.injectedAt.trim()
        : null;
      skills.push({
        name: skillName,
        description: skillDescription,
        instructions: skillInstructions,
        source,
        injectedAt,
        injectedBy: text(rawSkill.injectedBy).slice(0, 40),
      });
    }

    let roleModel = null;
    if (rawRole.model !== undefined && rawRole.model !== null) {
      if (!isObject(rawRole.model)) {
        pushIssue(issues, `${base}.model`, '成员模型必须是一个对象');
      } else {
        const modelProvider = text(rawRole.model.provider);
        const modelName = text(rawRole.model.model);
        const modelEffort = text(rawRole.model.reasoningEffort);
        if (modelProvider === '' || modelProvider.length > 80) pushIssue(issues, `${base}.model.provider`, '模型 provider 无效');
        if (modelName === '' || modelName.length > 160) pushIssue(issues, `${base}.model.model`, '模型名称无效');
        if (modelProvider !== '' && modelName !== '') {
          roleModel = {
            provider: modelProvider,
            model: modelName,
            ...(modelEffort === '' ? {} : { reasoningEffort: modelEffort.slice(0, 40) }),
          };
        }
      }
    }

    const sessionId = typeof rawRole.sessionId === 'string' && rawRole.sessionId.trim() !== ''
      ? rawRole.sessionId.trim()
      : null;

    roles.push({
      id,
      name,
      title,
      reportsTo,
      level,
      effort,
      authority,
      boundaries,
      enabled: rawRole.enabled !== false,
      accent,
      responsibilities,
      instructions,
      skills,
      model: roleModel,
      sessionId,
    });
  }

  const rawTemplates = input.templates === undefined
    ? DEFAULT_TEMPLATE_SPECS.map(defaultTemplate)
    : input.templates;
  const templates = [];
  if (!Array.isArray(rawTemplates)) {
    pushIssue(issues, 'templates', 'templates 必须是数组');
  } else {
    if (rawTemplates.length > 24) pushIssue(issues, 'templates', '角色模板不能超过 24 个');
    const seenTemplateIds = new Set();
    for (const [index, rawTemplate] of rawTemplates.entries()) {
      const base = `templates[${index}]`;
      if (!isObject(rawTemplate)) {
        pushIssue(issues, base, '模板必须是对象');
        continue;
      }
      const id = text(rawTemplate.id).toLowerCase();
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
        pushIssue(issues, `${base}.id`, '模板 ID 需以小写字母开头，只含小写字母、数字或连字符，最长 64 位');
      } else if (seenTemplateIds.has(id)) {
        pushIssue(issues, `${base}.id`, `模板 ID "${id}" 重复`);
      }
      seenTemplateIds.add(id);
      const title = text(rawTemplate.title);
      if (title.length < 1 || title.length > 24) pushIssue(issues, `${base}.title`, '模板名称需要 1–24 个字符');
      const accent = (text(rawTemplate.accent) || ACCENTS[index % ACCENTS.length]).toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(accent)) pushIssue(issues, `${base}.accent`, '模板强调色必须是六位十六进制颜色');
      const level = text(rawTemplate.level) || 'member';
      if (!ROLE_LEVELS.includes(level)) pushIssue(issues, `${base}.level`, '模板级别必须是 captain 或 member');
      const responsibilities = text(rawTemplate.responsibilities);
      if (responsibilities.length > 400) pushIssue(issues, `${base}.responsibilities`, '模板职责不能超过 400 个字符');
      const instructions = text(rawTemplate.instructions);
      if (instructions.length > 4000) pushIssue(issues, `${base}.instructions`, '模板工作准则不能超过 4000 个字符');
      const authority = text(rawTemplate.authority);
      const boundaries = text(rawTemplate.boundaries);
      if (authority.length > 300) pushIssue(issues, `${base}.authority`, '模板职权不能超过 300 个字符');
      if (boundaries.length > 300) pushIssue(issues, `${base}.boundaries`, '模板边界不能超过 300 个字符');
      templates.push({
        id,
        title,
        accent,
        responsibilities,
        instructions,
        authority,
        boundaries,
        level,
        builtin: rawTemplate.builtin === true,
      });
    }
  }

  // Primary reporting lines remain a tree. Additional graph relations may
  // cross levels, form loops, or expire; they are validated as a separate set.
  const relations = [];
  const rawRelations = input.relations === undefined ? [] : input.relations;
  if (!Array.isArray(rawRelations)) {
    pushIssue(issues, 'relations', 'relations 必须是数组');
  } else {
    if (rawRelations.length > 64) pushIssue(issues, 'relations', '附加关系不能超过 64 条');
    const nodeIds = new Set(['lead', ...roles.map((role) => role.id)]);
    const seenRelationIds = new Set();
    for (const [index, rawRelation] of rawRelations.entries()) {
      const base = `relations[${index}]`;
      if (!isObject(rawRelation)) {
        pushIssue(issues, base, '关系必须是对象');
        continue;
      }
      const id = text(rawRelation.id).toLowerCase();
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
        pushIssue(issues, `${base}.id`, '关系 ID 需以小写字母开头，只含小写字母、数字或连字符，最长 64 位');
      } else if (id.startsWith('primary-')) {
        pushIssue(issues, `${base}.id`, '关系 ID 不能以 primary- 开头');
      } else if (seenRelationIds.has(id)) {
        pushIssue(issues, `${base}.id`, `关系 ID "${id}" 重复`);
      }
      seenRelationIds.add(id);
      const from = text(rawRelation.from);
      const to = text(rawRelation.to);
      if (!nodeIds.has(from)) pushIssue(issues, `${base}.from`, `找不到关系起点 "${from}"`);
      if (!nodeIds.has(to)) pushIssue(issues, `${base}.to`, `找不到关系终点 "${to}"`);
      if (from === to) pushIssue(issues, `${base}.to`, '关系不能指向自身');
      const type = text(rawRelation.type) || 'collaborates';
      if (!['reports', 'collaborates', 'temporary', 'handoff'].includes(type)) {
        pushIssue(issues, `${base}.type`, '关系类型必须是 reports、collaborates 或 temporary');
      }
      const label = text(rawRelation.label);
      if (label.length > 60) pushIssue(issues, `${base}.label`, '关系说明不能超过 60 个字符');
      let expiresAt = null;
      if (type === 'temporary' && rawRelation.expiresAt !== undefined && rawRelation.expiresAt !== null) {
        const parsed = Date.parse(String(rawRelation.expiresAt));
        if (!Number.isFinite(parsed)) pushIssue(issues, `${base}.expiresAt`, '临时关系到期时间必须是有效时间');
        else expiresAt = new Date(parsed).toISOString();
      }
      relations.push({ id, from, to, type, label, expiresAt });
    }
  }

  // Additional graph/temporary relations may cross levels or form cycles.
  // The primary reportsTo edges are still the layout backbone.
  const helpRequests = [];
  const rawHelpRequests = input.helpRequests === undefined ? [] : input.helpRequests;
  if (!Array.isArray(rawHelpRequests)) {
    pushIssue(issues, 'helpRequests', 'helpRequests 必须是数组');
  } else {
    if (rawHelpRequests.length > 50) pushIssue(issues, 'helpRequests', '求助审批记录不能超过 50 条');
    const roleIds = new Set(roles.map((role) => role.id));
    const seenHelpIds = new Set();
    const statuses = ['pending', 'approved', 'rejected', 'completed', 'failed', 'aborted'];
    for (const [index, rawRequest] of rawHelpRequests.slice(-50).entries()) {
      const base = `helpRequests[${index}]`;
      if (!isObject(rawRequest)) {
        pushIssue(issues, base, '求助记录必须是对象');
        continue;
      }
      const id = text(rawRequest.id);
      if (!/^help-[a-z0-9-]{4,40}$/.test(id) || seenHelpIds.has(id)) {
        pushIssue(issues, `${base}.id`, '求助记录 id 无效或重复');
        continue;
      }
      seenHelpIds.add(id);
      const from = text(rawRequest.from);
      const to = text(rawRequest.to);
      if (!roleIds.has(from) || !roleIds.has(to) || from === to) {
        pushIssue(issues, base, '求助双方必须是不同的现有成员');
        continue;
      }
      const task = text(rawRequest.task);
      const reason = text(rawRequest.reason);
      if (task.length < 3 || task.length > 2000) pushIssue(issues, `${base}.task`, '求助任务需要 3–2000 个字符');
      if (reason.length < 2 || reason.length > 500) pushIssue(issues, `${base}.reason`, '求助原因需要 2–500 个字符');
      const status = text(rawRequest.status) || 'pending';
      if (!statuses.includes(status)) pushIssue(issues, `${base}.status`, '求助状态无效');
      const createdAt = typeof rawRequest.createdAt === 'string' && Number.isFinite(Date.parse(rawRequest.createdAt))
        ? new Date(Date.parse(rawRequest.createdAt)).toISOString()
        : new Date(0).toISOString();
      const decidedAt = typeof rawRequest.decidedAt === 'string' && Number.isFinite(Date.parse(rawRequest.decidedAt))
        ? new Date(Date.parse(rawRequest.decidedAt)).toISOString()
        : null;
      helpRequests.push({
        id,
        from,
        to,
        task,
        reason,
        status,
        createdAt,
        decidedAt,
        decidedBy: text(rawRequest.decidedBy).slice(0, 40),
        relationId: text(rawRequest.relationId).slice(0, 64),
        resultSummary: text(rawRequest.resultSummary).slice(0, 1000),
      });
    }
  }

  const failureReports = [];
  const rawFailureReports = input.failureReports === undefined ? [] : input.failureReports;
  if (!Array.isArray(rawFailureReports)) {
    pushIssue(issues, 'failureReports', 'failureReports 必须是数组');
  } else {
    if (rawFailureReports.length > 50) pushIssue(issues, 'failureReports', '失败上报记录不能超过 50 条');
    const roleIds = new Set(roles.map((role) => role.id));
    const seenFailureIds = new Set();
    const failureStatuses = ['pending', 'approved', 'rejected', 'completed', 'failed'];
    for (const [index, rawReport] of rawFailureReports.slice(-50).entries()) {
      const base = `failureReports[${index}]`;
      if (!isObject(rawReport)) {
        pushIssue(issues, base, '失败上报必须是对象');
        continue;
      }
      const id = text(rawReport.id);
      if (!/^failure-[a-z0-9-]{4,40}$/.test(id) || seenFailureIds.has(id)) {
        pushIssue(issues, `${base}.id`, '失败上报 id 无效或重复');
        continue;
      }
      seenFailureIds.add(id);
      const from = text(rawReport.from);
      const roleId = text(rawReport.roleId);
      if (!roleIds.has(from) || !roleIds.has(roleId) || from === roleId) {
        pushIssue(issues, base, '失败上报双方必须是不同的现有成员');
        continue;
      }
      const reason = text(rawReport.reason);
      if (reason.length < 2 || reason.length > 1000) pushIssue(issues, `${base}.reason`, '上报原因需要 2–1000 个字符');
      const status = text(rawReport.status) || 'pending';
      if (!failureStatuses.includes(status)) pushIssue(issues, `${base}.status`, '失败上报状态无效');
      const failures = Number.isFinite(rawReport.failures) && rawReport.failures >= 0 ? Math.round(rawReport.failures) : 0;
      const createdAt = typeof rawReport.createdAt === 'string' && Number.isFinite(Date.parse(rawReport.createdAt))
        ? new Date(Date.parse(rawReport.createdAt)).toISOString()
        : new Date(0).toISOString();
      const decidedAt = typeof rawReport.decidedAt === 'string' && Number.isFinite(Date.parse(rawReport.decidedAt))
        ? new Date(Date.parse(rawReport.decidedAt)).toISOString()
        : null;
      failureReports.push({
        id,
        from,
        roleId,
        reason,
        failures,
        diagnostic: text(rawReport.diagnostic).slice(0, 1000),
        status,
        createdAt,
        decidedAt,
        decidedBy: text(rawReport.decidedBy).slice(0, 40),
        replacementRoleId: text(rawReport.replacementRoleId).slice(0, 64),
      });
    }
  }

  let activeTask = null;
  if (input.activeTask !== undefined && input.activeTask !== null) {
    if (!isObject(input.activeTask)) {
      pushIssue(issues, 'activeTask', 'activeTask 必须是对象');
    } else {
      const id = text(input.activeTask.id);
      const title = text(input.activeTask.title);
      const startedAt = typeof input.activeTask.startedAt === 'string' && Number.isFinite(Date.parse(input.activeTask.startedAt))
        ? new Date(Date.parse(input.activeTask.startedAt)).toISOString()
        : '';
      const finishedAt = typeof input.activeTask.finishedAt === 'string' && Number.isFinite(Date.parse(input.activeTask.finishedAt))
        ? new Date(Date.parse(input.activeTask.finishedAt)).toISOString()
        : null;
      const durationMs = Number.isFinite(input.activeTask.durationMs) && input.activeTask.durationMs >= 0
        ? Math.round(input.activeTask.durationMs)
        : (finishedAt === null ? 0 : Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)));
      if (!/^task-[a-z0-9-]{4,40}$/.test(id)) pushIssue(issues, 'activeTask.id', '任务 id 无效');
      if (title.length < 1 || title.length > 80) pushIssue(issues, 'activeTask.title', '任务标题需要 1–80 个字符');
      if (startedAt === '') pushIssue(issues, 'activeTask.startedAt', '任务开始时间无效');
      activeTask = { id, title, startedAt, finishedAt, durationMs };
    }
  }

  const layout = {};
  const rawLayout = input.layout === undefined ? {} : input.layout;
  if (!isObject(rawLayout)) {
    pushIssue(issues, 'layout', 'layout 必须是对象');
  } else {
    const nodeIds = new Set(['lead', ...roles.map((role) => role.id)]);
    for (const [nodeId, point] of Object.entries(rawLayout)) {
      if (!nodeIds.has(nodeId)) {
        pushIssue(issues, `layout.${nodeId}`, `找不到图谱节点 "${nodeId}"`);
        continue;
      }
      if (!isObject(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        pushIssue(issues, `layout.${nodeId}`, '节点位置必须包含有限数字 x/y');
        continue;
      }
      layout[nodeId] = { x: point.x, y: point.y };
    }
  }

  const pricing = { inputPerMillion: 0, outputPerMillion: 0, currency: 'CNY' };
  if (input.pricing !== undefined) {
    if (!isObject(input.pricing)) pushIssue(issues, 'pricing', 'pricing 必须是对象');
    else {
      const inputPrice = Number(input.pricing.inputPerMillion);
      const outputPrice = Number(input.pricing.outputPerMillion);
      if (!Number.isFinite(inputPrice) || inputPrice < 0 || inputPrice > 1_000_000) pushIssue(issues, 'pricing.inputPerMillion', '输入价格必须是非负有限数字');
      else pricing.inputPerMillion = inputPrice;
      if (!Number.isFinite(outputPrice) || outputPrice < 0 || outputPrice > 1_000_000) pushIssue(issues, 'pricing.outputPerMillion', '输出价格必须是非负有限数字');
      else pricing.outputPerMillion = outputPrice;
      const currency = text(input.pricing.currency).toUpperCase();
      if (currency !== '' && !/^[A-Z]{3}$/.test(currency)) pushIssue(issues, 'pricing.currency', '货币必须是三位字母代码');
      else if (currency !== '') pricing.currency = currency;
    }
  }

  const audit = [];
  const rawAudit = input.audit === undefined ? [] : input.audit;
  if (!Array.isArray(rawAudit)) pushIssue(issues, 'audit', 'audit 必须是数组');
  else {
    for (const entry of rawAudit.slice(0, 1000)) {
      if (!isObject(entry)) continue;
      const reason = text(entry.reason);
      if (reason.length < 2) continue;
      audit.push({
        id: text(entry.id).slice(0, 64) || `audit-${audit.length + 1}`,
        at: typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at)) ? new Date(Date.parse(entry.at)).toISOString() : new Date(0).toISOString(),
        kind: ['work', 'personnel', 'relation'].includes(text(entry.kind)) ? text(entry.kind) : 'personnel',
        action: text(entry.action).slice(0, 48),
        actor: text(entry.actor).slice(0, 40),
        roleId: text(entry.roleId).slice(0, 64),
        roleName: text(entry.roleName).slice(0, 40),
        reason: reason.slice(0, 1000),
        summary: text(entry.summary).slice(0, 500),
      });
    }
  }

  // References and cycles are checked after the whole roster is known.
  const byId = new Map(roles.map((role) => [role.id, role]));
  for (const role of roles) {
    if (role.reportsTo !== 'lead' && !byId.has(role.reportsTo)) {
      pushIssue(issues, `roles.${role.id}.reportsTo`, `找不到汇报对象 "${role.reportsTo}"`);
    }
    if (role.reportsTo === role.id) {
      pushIssue(issues, `roles.${role.id}.reportsTo`, '成员不能汇报给自己');
    }
  }
  for (const role of roles) {
    const path = [];
    let cursor = role;
    while (cursor && cursor.reportsTo !== 'lead') {
      if (path.includes(cursor.id)) {
        pushIssue(issues, 'roles', `汇报关系存在循环：${[...path, cursor.id].join(' → ')}`);
        break;
      }
      path.push(cursor.id);
      cursor = byId.get(cursor.reportsTo);
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    org: {
      version: ORG_VERSION,
      revision,
      teamName,
      lead: { label: leadLabel, description: leadDescription, sessionId: leadSessionId, model: leadModel, modelPolicy: leadModelPolicy },
      enabled,
      roles,
      templates,
      relations,
      helpRequests,
      failureReports,
      activeTask,
      layout,
      audit,
      pricing,
      updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
    },
  };
}

/**
 * Resolve a model-supplied role reference.
 * Exact id, name, or title wins; otherwise a unique substring of a title/name
 * is accepted so “工程师” can reach “软件工程师”.
 *
 * @param {object} org
 * @param {string} query
 * @returns {object | null}
 */
export function findRole(org, query) {
  const needle = text(query).toLocaleLowerCase('zh-CN');
  if (needle.length === 0) return null;
  const roles = Array.isArray(org?.roles) ? org.roles : [];
  const exact = roles.find(
    (role) =>
      role.id.toLowerCase() === needle ||
      role.name.toLocaleLowerCase('zh-CN') === needle ||
      role.title.toLocaleLowerCase('zh-CN') === needle,
  );
  if (exact !== undefined) return exact;
  const partial = roles.filter(
    (role) =>
      role.name.toLocaleLowerCase('zh-CN').includes(needle) ||
      role.title.toLocaleLowerCase('zh-CN').includes(needle),
  );
  return partial.length === 1 ? partial[0] : null;
}

/** Display name for a graph node (`lead` or a role id). */
export function nodeLabel(org, id) {
  if (id === 'lead') return org.lead.label;
  return org.roles.find((role) => role.id === id)?.name ?? id;
}

/** Active graph relations, excluding expired temporary relations. */
export function activeRelations(org, now = Date.now()) {
  return (org.relations ?? []).filter((relation) => {
    if (relation.type !== 'temporary' || relation.expiresAt === null) return true;
    const expiry = Date.parse(relation.expiresAt);
    return Number.isFinite(expiry) && expiry > now;
  });
}

/** One human-readable graph edge, including temporary expiry. */
export function relationText(org, relation, now = Date.now()) {
  const from = nodeLabel(org, relation.from);
  const to = nodeLabel(org, relation.to);
  const tail = relation.label ? renderPrompt(formatData.relation.label, { label: relation.label }) : '';
  if (relation.type === 'reports') return renderPrompt(formatData.relation.reports, { from, to, tail });
  if (relation.type === 'handoff') return renderPrompt(formatData.relation.handoff, { from, to, tail });
  if (relation.type === 'temporary') {
    const expiry = relation.expiresAt === null
      ? formatData.relation.expiryManual
      : renderPrompt(formatData.relation.expiry, { date: new Date(relation.expiresAt).toLocaleString('zh-CN', { hour12: false }) });
    const expired = relation.expiresAt !== null && Date.parse(relation.expiresAt) <= now;
    return renderPrompt(formatData.relation.temporary, { from, to, tail, expiry, expired: expired ? formatData.relation.expired : '' });
  }
  return renderPrompt(formatData.relation.collaborates, { from, to, tail });
}

/** Human-readable manager for a role. */
export function managerLabel(org, role) {
  if (!role || role.reportsTo === 'lead') return org.lead.label;
  return org.roles.find((candidate) => candidate.id === role.reportsTo)?.name ?? org.lead.label;
}

function levelLabel(level) {
  return level === 'captain' ? promptText(promptData.text.levelCaptain) : promptText(promptData.text.levelMember);
}

function roleKind(role) {
  const title = String(role?.title ?? '');
  if (/视频编导|视频导演|编导|导演/i.test(title)) return 'video-director';
  if (/剪辑师|剪辑/i.test(title)) return 'video-edit';
  if (/特效师|视觉特效|VFX|合成师/i.test(title)) return 'video-vfx';
  if (/动画师|动画|动态图形/i.test(title)) return 'video-animation';
  if (/调色师|调色|colorist/i.test(title)) return 'video-color';
  if (/音效|配乐|声音设计|混音/i.test(title)) return 'video-audio';
  if (/字幕|画面包装|包装设计/i.test(title)) return 'video-motion-graphics';
  if (/视频质检|视频质量/i.test(title)) return 'video-qa';
  if (/^HR$|人力|招聘|people/i.test(title)) return 'hr';
  if (/GitHub|Git\s*提交|提交管理员/i.test(title)) return 'github';
  if (/安全审核|代码安全|防泄露/i.test(title)) return 'security';
  if (/审核优化|代码审核/i.test(title)) return 'review';
  if (/软件测试|测试师|测试工程师|QA/i.test(title)) return 'qa';
  if (/系统设计|架构师|技术设计|solution\s*architect/i.test(title)) return 'system-design';
  if (/设计师|产品设计|UI|UX|交互设计|视觉设计/i.test(title)) return 'design';
  if (/报告师|报告撰写|报告员|report\s*writer/i.test(title)) return 'report';
  if (/文档师|技术文档|文档工程|technical\s*writer/i.test(title)) return 'docs';
  if (/工程师|开发|编程|前端|后端|软件|算法/i.test(title)) return 'coding';
  return 'general';
}

function playbookKey(role) {
  const kind = roleKind(role);
  return kind === 'coding' && role.level === 'captain' ? 'coding-captain' : kind;
}

function standardAuthority(role) {
  const playbook = rolePlaybookData[playbookKey(role)] ?? rolePlaybookData.default;
  return playbook.authority;
}

function standardBoundaries(role) {
  const playbook = rolePlaybookData[playbookKey(role)] ?? rolePlaybookData.default;
  return playbook.boundaries;
}

export function roleAuthority(role) {
  const own = String(role?.authority ?? '').trim();
  if (own !== '') return own;
  const base = standardAuthority(role);
  const scope = clip(role?.responsibilities, 120);
  return scope === '' ? base : `${base} 具体负责：${scope}`;
}

export function roleBoundaries(role) {
  return String(role?.boundaries ?? '').trim() || standardBoundaries(role);
}

export function roleWorkflow(role) {
  return roleProcessLine(role);
}

function roleProcessLine(role) {
  const playbook = rolePlaybookData[playbookKey(role)] ?? rolePlaybookData.default;
  return playbook.workflow;
}

function promptText(value) {
  return Array.isArray(value) ? value.join('\n') : String(value ?? '');
}

export function renderPrompt(template, values) {
  return promptText(template).replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? promptText(values[key]) : ''
  ));
}

export function buildMidprojectReportPrompt(org) {
  return renderPrompt(promptData.midproject, { teamName: org.teamName });
}

export function buildLeadPrompt(org, options = {}) {
  const configured = options.configured !== false;
  const enabled = options.enabled !== false;
  const workspace = options.workspace;
  const workspaceLine = workspace === undefined
    ? promptText(promptData.text.workspaceUnlinked)
    : renderPrompt(promptData.text.workspaceLinked, { title: workspace.title || promptData.text.workspaceTitleFallback, path: workspace.path });

  if (!configured) return renderPrompt(promptData.lead.setup, { workspaceLine });
  if (!enabled) return renderPrompt(promptData.lead.disabled, { workspaceLine });

  const roster = org.roles.length === 0
    ? promptData.text.rosterEmpty
    : org.roles
      .map((role) => {
        const status = role.enabled ? promptData.text.statusEnabled : promptData.text.statusDisabled;
        const manager = role.reportsTo === 'lead' ? org.lead.label : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
        return renderPrompt(formatData.roster.lead, { status, id: role.id, name: role.name, title: role.title, level: levelLabel(role.level), manager, effort: role.effort || 'low', authority: clip(roleAuthority(role), 100), boundaries: clip(roleBoundaries(role), 100) });
      })
      .join('\n');
  const reportingLines = org.roles.map((role) => `- ${role.name} 向 ${managerLabel(org, role)} 汇报`).join('\n') || promptData.text.reportingEmpty;
  const relations = activeRelations(org).map((relation) => `- ${relationText(org, relation)}`).join('\n') || promptData.text.relationsEmpty;

  const hasVideo = org.roles.some((role) => /视频|剪辑|特效|动画|调色|音效|字幕|包装/.test(role.title));
  const core = renderPrompt(promptData.lead.body, {
    teamName: org.teamName,
    workspaceLine,
    leadLabel: org.lead.label,
    leadDescription: clip(org.lead.description, 220) || promptData.text.leadDescriptionFallback,
    roster,
    reportingLines,
    relations,
  });
  if (!hasVideo) return core;
  return `${core}\n\n${renderPrompt(promptData.lead.video, {})}`;
}

/** Render the skills a manager injected into this member. */
export function roleSkillsPrompt(role) {
  const skills = Array.isArray(role?.skills) ? role.skills.filter((skill) => skill?.instructions) : [];
  if (skills.length === 0) return '';
  return renderPrompt(promptData.skills, {
    skills: skills.map((skill) => renderPrompt(formatData.skills.entry, { name: skill.name, description: skill.description ? `${skill.description}\n` : '', instructions: skill.instructions })).join('\n\n'),
  });
}

export function buildEmployeeIdentityPrompt(org, role, workspace) {
  const manager = role.reportsTo === 'lead'
    ? org.lead.label
    : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
  const reports = org.roles.filter((item) => item.reportsTo === role.id && item.enabled !== false);
  const delegation = reports.length > 0
    ? renderPrompt(promptData.text.identityDelegationYes, { names: reports.map((item) => item.name).join('、') })
    : promptData.text.identityDelegationNo;
  const leadershipRules = reports.length > 0 ? promptData.text.leadershipRules : '';
  return renderPrompt(promptData.identity, {
    teamName: org.teamName,
    roleName: role.name,
    roleTitle: role.title,
    level: levelLabel(role.level),
    effort: role.effort || 'low',
    manager,
    workspacePath: workspace?.path ?? promptData.text.workspacePathFallback,
    responsibilities: role.responsibilities || promptData.text.responsibilitiesFallback,
    authority: roleAuthority(role),
    boundaries: roleBoundaries(role),
    instructions: role.instructions || promptData.text.instructionsFallback,
    skillsBlock: roleSkillsPrompt(role),
    workflow: roleProcessLine(role),
    relationLines: activeRelations(org).filter((relation) => relation.from === role.id || relation.to === role.id).map((relation) => `- ${relationText(org, relation)}`).join('\n') || promptData.text.roleRelationEmpty,
    helpRule: promptData.text.helpRule,
    requestHelpRule: promptData.text.requestHelpRule,
    reportsRule: reports.length > 0 ? promptData.text.reportsRule : '',
    leadershipRules,
    delegation,
  });
}

/** The lead's proactive team-relationship design turn after setup. */
export function buildScopeUpdatePrompt(authority, boundaries) {
  return renderPrompt(promptData.scopeUpdate, { authority, boundaries });
}

export function buildTeamDesignPrompt(org) {
  const roster = org.roles.length === 0
    ? promptData.text.teamDesignRosterEmpty
    : org.roles.map((role) => {
      const manager = role.reportsTo === 'lead' ? org.lead.label : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
      return renderPrompt(formatData.roster.teamDesign, { id: role.id, name: role.name, title: role.title, level: levelLabel(role.level), effort: role.effort || 'low', manager });
    }).join('\n');
  const relations = activeRelations(org).map((relation) => `- ${relationText(org, relation)}`).join('\n') || promptData.text.teamDesignRelationsEmpty;
  return renderPrompt(promptData.teamDesign, { teamName: org.teamName, roster, relations });
}


/** First message that establishes a persistent employee session. */
export function buildRoleBootstrapPrompt(org, role, workspace) {
  const manager = role.reportsTo === 'lead'
    ? org.lead.label
    : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
  return renderPrompt(promptData.bootstrap, {
    teamName: org.teamName,
    roleName: role.name,
    roleTitle: role.title,
    level: levelLabel(role.level),
    manager,
  });
}

/** A follow-up task in an already role-injected persistent employee session. */
export function buildRoleTaskPrompt(org, role, task, workspace) {
  const taskText = String(task ?? '').trim();
  const report = roleKind(role) === 'report';
  const uiTestRule = ['coding', 'coding-captain', 'design', 'qa', 'review'].includes(roleKind(role)) ? promptData.text.uiTestRule : '';
  return renderPrompt(promptData.task, {
    workspacePath: workspace?.path ?? promptData.text.workspacePathFallback,
    taskText,
    uiTestRule,
    reportRule: report ? promptData.text.reportRule : promptData.text.normalReportRule,
    output: report ? promptData.text.reportOutput : promptData.text.normalOutput,
    reportSuffix: report ? promptData.text.reportSuffix : '',
  });
}

/** JSON-safe snapshot for the browser and tool results. */
export function publicOrg(org) {
  return clone(org);
}
