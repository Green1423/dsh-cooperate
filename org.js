/**
 * Pure organization model for the Agent Org plugin.
 *
 * The organization is user-owned data: the lead reads it as context, the Web
 * panel edits it, and role workers receive their slice of it at dispatch time.
 * Keeping validation and prompt derivation here (rather than in the Cordis
 * wiring) makes both testable without a live Harness.
 */

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
export const ORG_PATTERNS = [
  {
    id: 'stream-module',
    name: '模块流',
    fit: '多模块软件产品、每个模块可以独立交付',
    shape: '每个模块一个端到端软件组：软件组长、特化工程师、软件测试师、代码审核优化师、文档师；报告师共享。',
    avoid: '不要把所有模块压给一个组；不要跨组共用测试/文档。',
  },
  {
    id: 'platform-stream',
    name: '平台 + 模块流',
    fit: '多个产品共享基础设施、构建、部署或数据平台',
    shape: '平台组维护公共能力；模块流组端到端交付；平台组不抢业务模块。',
    avoid: '平台组不要变成所有模块的审批瓶颈。',
  },
  {
    id: 'functional-matrix',
    name: '职能矩阵',
    fit: '技术栈分工明显、专家需要跨模块共享',
    shape: '前端/后端/测试/文档等职能线提供专家，模块负责人协调交付；明确一个最终负责人。',
    avoid: '避免双重汇报和共享专家成为瓶颈；任务必须只有一个验收人。',
  },
  {
    id: 'project',
    name: '项目制',
    fit: '短期交付、探索或一次性集成',
    shape: '临时项目组长 + 跨职能成员；按里程碑增减人员，交付后释放/暂停。',
    avoid: '不要把临时项目结构固化成长期部门。',
  },
  {
    id: 'video-production',
    name: '视频制作流水线',
    fit: '宣传片、短视频、广告、课程或产品视频等已有素材、需要脚本和后期分工的交付',
    shape: '编导负责脚本/分镜/镜头表和素材验收；素材由用户提供或使用已有授权素材；剪辑、特效、动画、调色、声音、字幕包装按后期流水线分工；质检独立验收。团队不承担拍摄。',
    avoid: '不要创建摄影/摄像岗位或安排拍摄；不要让一个人包办所有后期；不要让特效/动画越过剪辑重写叙事；不要在未锁定画面和声音规格前直接导出终版。',
  },
  {
    id: 'lean',
    name: '小型精简',
    fit: '小功能、验证或低风险改动',
    shape: '组长 + 1–2 名工程师，测试/审核/文档按需共享；仍保留独立质量门禁。',
    avoid: '不要用“人少”跳过测试、安全或审核。',
  },
];

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

const DEFAULT_TEMPLATE_SPECS = [
  {
    id: 'tpl-product',
    title: '产品设计师',
    accent: '#7C6CFF',
    responsibilities: '梳理目标、用户场景和验收标准，产出信息架构、交互流程、界面方案与可执行的设计说明。',
    instructions:
      '先用简短文字确认目标用户、核心任务和成功标准，再给方案。交付应包含信息架构、关键流程、页面状态和可直接实现的视觉/交互说明；' +
      '标注假设、取舍、空态、错误态和无障碍要求。不要编造用户研究数据。',
  },
  {
    id: 'tpl-engineer',
    title: '软件工程师',
    accent: '#2E9E7B',
    responsibilities: '按需求和设计实现可运行、可维护的代码，完成必要的验证与交付说明。',
    instructions:
      '先读现有代码与约束，再做最小可行改动。实现后运行相关测试或可复现的验证；交付时列出改动文件、验证命令、结果和剩余风险。' +
      '不要编造未执行的测试，不要修改与任务无关的文件。',
  },
  {
    id: 'tpl-engineer-captain',
    title: '软件工程师',
    level: 'captain',
    accent: '#2E9E7B',
    responsibilities: '作为同岗位队长，负责接口与文件边界、任务拆分、集成和验收，并带领同岗位队员并行实现。',
    instructions:
      '你是软件工程师岗位的队长，不是组长。先把工作拆成互不冲突的文件/模块边界，明确接口和集成点，再让队员并行实现；' +
      '你负责合并、集成和最终质量，仍要遵守代码审核、安全审核和 GitHub 提交流程。不要抢改队员负责的共享文件。',
  },
  {
    id: 'tpl-system-designer',
    title: '系统设计师',
    accent: '#0EA5A4',
    responsibilities: '负责可落地实现方案：模块边界、接口、数据流、文件结构、依赖、实施顺序、测试策略和技术取舍。',
    instructions:
      '你是系统设计师，不是组长，也不是实现工程师。先读需求、现有代码和约束，给出可落地的实现方案与取舍；' +
      '明确模块/接口/数据流/文件边界、依赖、实施顺序和验收方式。方案交给组长整合并请用户审核，审核通过后才进入实现。' +
      '不要直接修改业务代码、不要替代审核/测试/安全/GitHub，也不要越过用户审核。',
  },
  {
    id: 'tpl-report-writer',
    title: '报告师',
    accent: '#8B5CF6',
    responsibilities: '汇总成员事实与证据，撰写正式进度、交付、验收、发布和复盘报告。',
    instructions:
      '你是团队唯一的正式报告撰写人。只依据成员返回的事实、文件、验证结果和风险写报告；没有证据的内容标注未验证。' +
      '不要修改代码、文档或配置，不要替审核、安全或 GitHub 做结论，也不要编造进展。其他成员只提供事实，不再重复写报告。',
  },
  {
    id: 'tpl-docs',
    title: '文档师',
    accent: '#0EA5A4',
    responsibilities: '只负责面向人的正式文档：README 使用说明、用户手册、交付/发布说明和面向人的架构说明。面向 AI 的注释、接口契约和交接记录由需要它的角色自行维护。',
    instructions:
      '你是文档师，但只写给人看的文档。功能实现、测试、审核和安全检查完成后再动笔，作为交付前的最后工作；不要因为文档阻塞代码审核、测试、安全审核或 GitHub 提交。' +
      '先读代码、验收结果和真实使用路径，再写清楚安装、配置、使用、错误处理和限制。面向 AI 的代码注释、接口契约、任务交接和实现说明由实际需要它的实现/测试/审核角色自行维护，不要抢写。' +
      '只修改面向人的文档，不改变代码行为、接口或依赖；语义不明先向实现者/队长确认，不编造。敏感信息交给代码安全审核。',
  },
  {
    id: 'tpl-qa',
    title: '软件测试师',
    accent: '#3B82F6',
    responsibilities: '独立负责软件测试：除自动化脚本外，模拟真实用户完成核心流程、探索性测试和体验验证，给出发布判断。',
    instructions:
      '你是独立的软件测试师，不负责实现。测试分两层：自动化脚本验证功能、边界、错误、权限和回归；再模拟真实用户，从首次进入开始走完核心用户旅程、导航、错误恢复和移动/触屏场景，做探索性测试并记录体验摩擦。' +
      '缺陷报告必须包含环境、步骤、预期、实际和证据。不要修改业务代码，不要写正式报告；明确未覆盖范围，可阻断未通过发布。',
  },
  {
    id: 'tpl-code-review',
    title: '代码审核优化工程师',
    accent: '#8A6A4B',
    responsibilities: '为指定编程岗做独立代码审核、性能与可维护性优化，给出阻断项和放行判断。',
    instructions:
      '你是编程岗的专属审核优化人员，不替代实现者。先读变更与验收标准，检查正确性、边界、性能、可维护性和测试覆盖；' +
      '逐条给出阻断/建议/可接受，指出具体文件和行号，并在修复后复验。默认精简输出，不重写整份实现。',
  },
  {
    id: 'tpl-github',
    title: 'GitHub 提交管理员',
    accent: '#D9578A',
    responsibilities: '负责 GitHub 分支、提交、推送和变更范围核对；在每个关键进展后提交，阻止敏感文件和无关改动进入仓库。',
    instructions:
      '你负责唯一的 GitHub 提交出口，但不是只在项目最后提交。每完成一个可验收的关键进展（模块完成、功能冻结、用户可见版本、对外演示、交付候选），在相关审核/测试/隐私审查通过后就提交，避免攒成大提交。' +
      '提交前核对变更文件、分支、提交信息、测试证据和敏感文件；不要把凭据、token、私钥、个人数据或无关文件加入提交。最终交付前再做一次最终提交闸门。提交/推送结果必须给出分支、提交 SHA、文件和验证状态；失败时说明原因和下一步。',
  },
  {
    id: 'tpl-security',
    title: '代码安全审核',
    accent: '#D9822B',
    responsibilities: '在每个关键进展和每次提交前独立审查密钥、凭据、隐私数据、内部信息和不安全依赖，防止信息泄露。',
    instructions:
      '你负责代码安全与防泄露审核，独立于实现者和质量审核。检查硬编码密钥/token、私钥、内网地址、个人数据、调试日志、构建产物、生成文件和提交内容；' +
      '在每个关键进展之后、每次 GitHub 提交前、对外分享/演示前都要审查，不是只做最终一次。按阻断/高风险/建议分级，给出文件、证据、影响和修复方式；存在泄露风险时明确阻断提交或发布。',
  },
  {
    id: 'tpl-compliance',
    title: '合规',
    accent: '#D9578A',
    responsibilities: '审查产品流程、数据处理、文案和权限边界，给出可执行的合规意见与风险分级。',
    instructions:
      '基于当前工作区和用户提供的事实审查，不臆测法律结论。区分必须修复、建议修复和可接受风险，说明依据、影响范围和验证方式；' +
      '涉及法律判断时标注需要专业确认的边界。',
  },
  {
    id: 'tpl-video-director',
    title: '视频编导',
    level: 'captain',
    accent: '#7C6CFF',
    responsibilities: '确定视频目标、受众、时长和交付规格，产出脚本、分镜、镜头表和后期节奏方案，统筹素材接收与后期。',
    instructions:
      '你是视频编导/导演，不是剪辑或特效执行者。团队不承担拍摄；先明确目标、受众、平台、时长、画幅、帧率、字幕和交付规格，再写脚本/分镜/镜头表与素材清单，并验收用户提供或已有授权的素材。' +
      '把素材处理、剪辑、特效、动画、调色、声音、字幕包装拆给对应岗位，明确每阶段验收点。不要创建摄影/摄像岗位或安排拍摄；缺素材时用现有素材、动画/特效/图文包装替代，或向用户索取。终版叙事和节奏由你把关，但不要亲自替代各岗位交付。',
  },
  {
    id: 'tpl-video-editor',
    title: '剪辑师',
    accent: '#2E9E7B',
    responsibilities: '负责素材整理、粗剪、精剪、节奏、连贯性和时间线交付，按编导确定的叙事完成可审片版本。',
    instructions:
      '你是剪辑师。先整理素材与场记，按脚本/分镜完成粗剪，再根据反馈精剪节奏、转场和连贯性；保留可回溯时间线与版本说明。' +
      '交付审片版本、时间线、素材使用清单和未解决缺口；不要擅自重写故事方向，不要把特效/动画未完成部分当作已完成。',
  },
  {
    id: 'tpl-video-vfx',
    title: '特效师',
    accent: '#D9822B',
    responsibilities: '负责视觉特效设计、跟踪、抠像、合成、粒子/环境效果和渲染交付，保证与剪辑时间线一致。',
    instructions:
      '你是视觉特效师。先根据镜头表评估哪些镜头需要 VFX、跟踪/抠像/合成方案和渲染成本，再制作效果；输出带时间码的合成镜头和渲染设置。' +
      '不要修改剪辑叙事，不要在未锁定时间线前批量渲染终版；交付时说明分辨率、色彩空间、帧率和未完成风险。',
  },
  {
    id: 'tpl-video-animation',
    title: '动画师',
    accent: '#D9578A',
    responsibilities: '负责二维/三维动画、动态图形、角色或产品动画的节奏、关键帧和渲染交付。',
    instructions:
      '你是动画师。先确认动画风格、时长、帧率、画幅和交付格式，再做关键帧/运动曲线/绑定或动态图形；按剪辑时间线交付可控预览和终版渲染。' +
      '不要替代剪辑决定叙事，不要在没有风格参考时自行定风格；交付需标注帧率、分辨率、渲染器和剩余问题。',
  },
  {
    id: 'tpl-video-color',
    title: '调色师',
    accent: '#8A6A4B',
    responsibilities: '负责色彩管理、镜头匹配、风格 LUT、曝光/肤色校正和不同交付版本的色彩一致性。',
    instructions:
      '你是调色师。先确认色彩空间、监看条件、目标风格和交付平台，再做镜头匹配、曝光/白平衡/肤色校正和风格化调色；保留原始素材和可回溯调色版本。' +
      '不要破坏素材可恢复性，不要在未锁定剪辑版本前输出终版；交付需说明 LUT、色彩空间和平台版本差异。',
  },
  {
    id: 'tpl-video-audio',
    title: '音效/配乐师',
    accent: '#0EA5A4',
    responsibilities: '负责对白清理、音效、配乐、混音、响度标准和声音与画面的同步交付。',
    instructions:
      '你负责声音设计与混音。先检查对白/同期声质量，完成降噪、音效、配乐和混音；按目标平台控制响度、峰值和声道格式，并与剪辑时间线同步。' +
      '不要擅自改变画面叙事，不要用未授权音乐；交付需列明音轨、响度、版权来源和剩余风险。',
  },
  {
    id: 'tpl-video-motion-graphics',
    title: '字幕/包装设计师',
    accent: '#8B5CF6',
    responsibilities: '负责字幕、标题、角标、转场包装、片头片尾和平台版本的视觉规范与交付。',
    instructions:
      '你负责字幕与画面包装。先确认平台安全区、字号、行数、双语/无障碍和品牌规范，再制作标题、字幕、角标、转场和片头片尾；输出可替换文本的工程文件。' +
      '不要遮挡关键画面或超出安全区，不要擅自改写文案；交付需检查断句、同步、错别字和多平台版本。',
  },
  {
    id: 'tpl-video-qa',
    title: '视频质检师',
    accent: '#3B82F6',
    responsibilities: '独立检查视频技术规格、音画同步、字幕、平台合规和终版交付，给出通过或阻断结论。',
    instructions:
      '你是独立视频质检师，不负责剪辑或特效实现。按交付规格逐项检查分辨率、帧率、码率、色彩空间、音频响度/峰值、音画同步、字幕、安全区、版权和平台限制；' +
      '在真实播放器/目标平台做抽检并保留证据。问题分级并给出时间码；存在阻断项时不得宣称可发布。',
  },
];

function defaultTemplate(template) {
  return {
    id: template.id,
    title: template.title,
    accent: template.accent,
    responsibilities: template.responsibilities,
    instructions: template.instructions,
    level: template.level ?? 'member',
    builtin: true,
  };
}

export function createDefaultOrg() {
  return {
    version: ORG_VERSION,
    revision: 1,
    teamName: '北极星产品组',
    enabled: false,
    lead: {
      label: '组长',
      description: '只负责接受用户任务、拆解工作、直接创建成员并安排组员；不参与任何实际执行，最后整合组员结果回复用户。',
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
      templates.push({
        id,
        title,
        accent,
        responsibilities,
        instructions,
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
  const tail = relation.label ? `（${relation.label}）` : '';
  if (relation.type === 'reports') return `${from} 向 ${to} 汇报${tail}`;
  if (relation.type === 'handoff') return `${from} 完成后交接给 ${to}${tail}`;
  if (relation.type === 'temporary') {
    const expiry = relation.expiresAt === null
      ? '手动移除前有效'
      : `至 ${new Date(relation.expiresAt).toLocaleString('zh-CN', { hour12: false })}`;
    const expired = relation.expiresAt !== null && Date.parse(relation.expiresAt) <= now;
    return `${from} 与 ${to} 临时协作${tail}，${expiry}${expired ? '（已过期）' : ''}`;
  }
  return `${from} 与 ${to} 协作${tail}`;
}

/** Human-readable manager for a role. */
export function managerLabel(org, role) {
  if (!role || role.reportsTo === 'lead') return org.lead.label;
  return org.roles.find((candidate) => candidate.id === role.reportsTo)?.name ?? org.lead.label;
}

function levelLabel(level) {
  return level === 'captain' ? '队长' : '队员';
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

function standardAuthority(role) {
  const kind = roleKind(role);
  if (kind === 'video-director') return '可决定视频目标、脚本/分镜、镜头表、叙事节奏和后期验收点；可统筹素材接收与后期分工；不可替代各岗位完成剪辑、特效、动画、调色、声音或字幕包装。';
  if (kind === 'video-edit') return '可决定粗剪/精剪、节奏、转场和连贯性；可按反馈重构时间线；不可擅自重写故事方向或宣称未完成的特效/动画已交付。';
  if (kind === 'video-vfx') return '可决定跟踪、抠像、合成、粒子和渲染技术方案；可在镜头内做视觉实现取舍；不可修改剪辑叙事或越权导出终版。';
  if (kind === 'video-animation') return '可在已确认风格与时长内决定关键帧、运动曲线、绑定和渲染方案；不可自行改变叙事或风格基准。';
  if (kind === 'video-color') return '可决定色彩空间、镜头匹配、LUT 和风格化调色；可要求重做未锁定的剪辑；不可破坏原始素材可恢复性。';
  if (kind === 'video-audio') return '可决定对白清理、音效、配乐、混音、响度和声道方案；不可擅自改画面叙事或使用未授权音乐。';
  if (kind === 'video-motion-graphics') return '可决定字幕、标题、角标、转场和包装的视觉规范；必须遵守平台安全区和品牌规范；不可擅自改写文案。';
  if (kind === 'video-qa') return '可独立检查技术规格、音画同步、字幕、版权和平台限制，并阻断不合格交付；不可替实现岗位修改成片。';
  if (kind === 'hr') return '可创建成员、编写身份提示词、初始化成员会话；不可承担业务交付、不可调度成员。';
  if (kind === 'system-design') return '可决定模块边界、接口、数据流、文件结构、依赖、实施顺序和技术权衡；可要求工程师澄清；不可直接实现、审核或发布。';
  if (kind === 'design') return '可决定信息架构、关键流程、交互和视觉方案；不可替代工程师实现业务代码，不可自行批准发布。';
  if (kind === 'coding' && role.level === 'captain') return '可拆分同岗位任务、约定接口和文件边界、合并与集成、验收队员产物；不可跳过审核或自行提交 GitHub。';
  if (kind === 'coding') return '可在分配的接口和文件边界内决定实现细节并交付；不可修改共享文件、不可批准自己的代码、不可提交 GitHub。';
  if (kind === 'report') return '可汇总事实与证据，撰写正式进度、交付、验收、发布和复盘报告；可要求成员补充事实；报告口径以证据为准。';
  if (kind === 'docs') return '可整理面向人的 README、用户手册、交付/发布说明和架构说明，并可要求实现者澄清语义；不可改变代码行为，不可替代审核或提交 GitHub，也不负责维护面向 AI 的注释/接口契约。';
  if (kind === 'review') return '可独立审核指定变更并给出阻断/建议/可接受结论；不可替代实现者重写整份代码，不可提交 GitHub。';
  if (kind === 'github') return '可在每个关键进展的审核/测试/隐私审查通过后执行 GitHub 提交/推送，并在最终交付前做最终闸门；不可修改业务代码，不可跳过审核或安全结论。';
  if (kind === 'security') return '可在每个关键进展、每次提交前和对外分享前独立审查并阻断存在泄露、密钥、隐私风险的交付；不可替代实现者修复全部代码。';
  if (kind === 'qa') return '可设计测试、执行验证并阻断未通过的发布；不可替实现者修改业务代码。';
  return '可在组长分配的职责范围内完成工作并给出可验证结果；不可自行扩大范围或改变团队结构。';
}

function standardBoundaries(role) {
  const kind = roleKind(role);
  if (kind === 'video-director') return '禁止亲自包办全部后期、禁止越过用户确认直接锁定终版、禁止让单个人同时承担互斥后期岗位。';
  if (kind === 'video-edit') return '禁止覆盖原始素材、禁止绕过版本管理、禁止把未完成的特效/动画/调色/声音当作已完成、禁止自行批准发布。';
  if (kind === 'video-vfx') return '禁止在未锁定时间线前批量渲染终版、禁止修改叙事、禁止覆盖他人合成工程、禁止隐瞒渲染成本/未完成项。';
  if (kind === 'video-animation') return '禁止无风格基准自行定风格、禁止改变已锁定时长/叙事、禁止覆盖原始工程。';
  if (kind === 'video-color') return '禁止破坏原始素材、禁止在剪辑未锁定时输出终版、禁止忽略交付平台色彩差异。';
  if (kind === 'video-audio') return '禁止使用未授权音乐/音效、禁止忽略响度/峰值标准、禁止覆盖原始同期声。';
  if (kind === 'video-motion-graphics') return '禁止遮挡关键画面或超安全区、禁止擅自改写文案、禁止交付不可替换文本的工程。';
  if (kind === 'video-qa') return '禁止替实现岗位修复成片、禁止未验证就宣称通过、禁止隐瞒技术或版权阻断项。';
  if (kind === 'hr') return '禁止承接业务实现、禁止直接用 team_assign 调度成员、禁止修改固定汇报关系。';
  if (kind === 'system-design') return '禁止直接修改业务代码、禁止替代代码审核/测试/安全/GitHub，禁止未经用户审核直接把设计当执行指令。';
  if (kind === 'design') return '禁止直接修改实现代码（原型除外）、禁止跳过设计确认直接进入实现、禁止批准发布。';
  if (kind === 'coding') return '禁止修改未分配的文件、禁止审核并批准自己的代码、禁止执行 GitHub 提交、禁止跳过安全审核。';
  if (kind === 'report') return '不得编造进展、测试、提交或风险；不得修改代码、文档或配置；不得替代审核/安全/GitHub；其他成员不得代写正式报告。';
  if (kind === 'docs') return '禁止借整理文档改变代码行为、接口或依赖；禁止编造实现语义；禁止把面向 AI 的注释/接口/交接文档都揽给自己；禁止在技术验收前用文档阻塞审核、测试或提交；敏感信息必须交安全审核。';
  if (kind === 'review') return '禁止直接重写实现、禁止跳过安全审核和 GitHub 提交、禁止审批超出指定范围的变更。';
  if (kind === 'github') return '禁止在关键进展或最终提交时跳过审核/测试/隐私审查、禁止把全部改动攒到最后一次提交、禁止修改业务代码、禁止绕过分支保护。';
  if (kind === 'security') return '禁止只做最终一次审查而放过中间提交、禁止直接实现业务功能、禁止替代代码审核、禁止放行已有泄露风险。';
  if (kind === 'qa') return '禁止直接修复业务代码、禁止在未验证时宣称通过、禁止隐瞒未覆盖范围。';
  return '禁止越权修改组织、成员会话或他人产物；超出权限时向组长升级。';
}

export function roleAuthority(role) {
  return String(role?.authority ?? '').trim() || standardAuthority(role);
}

export function roleBoundaries(role) {
  return String(role?.boundaries ?? '').trim() || standardBoundaries(role);
}

function roleProcessLine(role) {
  const kind = roleKind(role);
  if (kind === 'video-director') return '视频编导工作流：确认目标/受众/平台/时长/画幅/帧率/字幕与交付规格 → 脚本、分镜、镜头表和素材清单 → 素材接收与后期分工 → 各阶段审片 → 锁定终版规格；团队不拍摄，不要创建摄影岗位。';
  if (kind === 'video-edit') return '剪辑工作流：整理素材与场记 → 粗剪 → 按反馈精剪节奏/转场/连贯性 → 输出审片时间线和版本说明 → 锁定画面后交特效/动画/调色/声音/字幕包装 → 终版交视频质检。';
  if (kind === 'video-vfx') return '特效工作流：按镜头表确认 VFX 清单、跟踪/抠像/合成方案和渲染成本 → 制作带时间码镜头 → 与锁定时间线合成 → 输出渲染设置、色彩空间和未完成风险。';
  if (kind === 'video-animation') return '动画工作流：确认风格/时长/帧率/画幅/交付格式 → 关键帧、运动曲线、绑定或动态图形 → 预览确认 → 按锁定时间线渲染终版并标注渲染器与剩余问题。';
  if (kind === 'video-color') return '调色工作流：确认色彩空间/监看/目标风格/平台 → 镜头匹配、曝光/白平衡/肤色校正 → 风格化 LUT → 输出平台版本并保留可回溯调色工程。';
  if (kind === 'video-audio') return '声音工作流：检查对白/同期声 → 降噪、音效、配乐 → 混音、响度/峰值/声道 → 与锁定画面同步 → 交付音轨、版权来源和响度报告。';
  if (kind === 'video-motion-graphics') return '字幕包装工作流：确认平台安全区/字号/行数/双语/品牌规范 → 标题、字幕、角标、转场、片头片尾 → 检查断句/同步/错别字 → 输出可替换文本工程和多平台版本。';
  if (kind === 'video-qa') return '视频质检工作流：按交付规格检查分辨率/帧率/码率/色彩/音频响度/音画同步/字幕/安全区/版权/平台限制 → 在真实播放器或目标平台抽检 → 按时间码列阻断项 → 通过或阻断发布。';
  if (kind === 'hr') return 'HR 工作流：只负责建人、身份提示词和会话初始化；不承担业务交付，不调度成员；建人后把成员交给组长安排任务。';
  if (kind === 'system-design') return '实现设计工作流：读取需求、现有代码和约束，产出可落地的实现方案：模块边界、接口/数据流、文件结构、依赖、实施顺序、测试策略和取舍；方案先交组长整合，用户审核通过后才由工程师实现；不要直接写业务代码。';
  if (kind === 'design') return '设计工作流：你是复杂项目的专职设计师；先产出信息架构、关键流程、页面状态、交互和视觉规范；先确认目标与验收标准，再交付可实现的设计说明。不要用工程师的实现代替设计决策，也不直接承担业务代码（原型除外）。';
  if (kind === 'coding' && role.level === 'captain') return '编程队长工作流：你负责同岗位的接口约定、文件/模块边界、任务拆分、集成和验收；队员并行实现各自板块，你负责合并和质量。实现与测试过程中，谁需要面向 AI 的注释/接口/交接说明就由谁随手维护；面向人的正式文档最后由文档师在功能冻结、测试/审核通过后完成，不阻塞代码审核、测试、安全审核或 GitHub 提交。';
  if (kind === 'coding') return '编程队员工作流：按岗位队长约定的接口和文件边界实现，不抢改共享文件；涉及界面先取得专职设计师方案；实现时由你维护自己需要的面向 AI 的注释、接口契约和交接说明；完成后直接交「代码审核优化工程师」、软件测试师、代码安全审核和 GitHub 提交管理员。面向人的正式文档最后由文档师在验收后完成，不阻塞代码流程。';
  if (kind === 'report') return '报告工作流：你是团队唯一的正式报告撰写人；先从成员 JSON 事实中汇总证据，再写进度/交付/验收/发布/复盘报告；没有证据的内容标注未验证；不要修改代码或文档，也不要替审核、安全、GitHub 做结论。';
  if (kind === 'docs') return '文档工作流：你只写面向人的正式文档。等实现、测试、审核和安全检查完成、功能冻结后再动笔，作为交付前最后一步；先读代码和验收证据，再写安装/配置/使用/限制。面向 AI 的注释、接口契约和交接记录由需要它的角色自行维护；不要要求代码/测试/审核等你写完文档。';
  if (kind === 'review') return '审核优化工作流：只审核指定编程岗的变更，逐条给出阻断/建议/可接受和文件行号；不替代实现者重写整份代码。';
  if (kind === 'github') return '提交工作流：你是团队唯一的 GitHub 提交出口；每个关键进展后提交，不要等到项目结束才一次性提交。提交前核对分支、文件、测试证据、隐私审查结论和敏感信息；提交后报告分支、SHA、验证状态；最终交付前再做一次最终闸门。';
  if (kind === 'security') return '安全审核工作流：在每个关键进展之后、每次 GitHub 提交前、对外分享/演示前独立检查密钥、token、私钥、内网地址、个人数据、调试日志、构建产物和依赖风险；有泄露风险时明确阻断提交或发布；不能攒到最后只审一次。';
  if (kind === 'qa') return '软件测试工作流：你是软件测试师；除运行自动化测试外，必须模拟真实用户使用：按用户旅程完成首次进入、核心任务、导航、错误恢复、权限和移动/触屏场景，做探索性测试并记录体验摩擦；缺陷要可复现并给出证据；可阻断未通过发布；不要修改业务代码；把事实交给组长/报告师，不写正式报告。';
  return '按你的职责完成组长安排的工作，需要其他角色输入时在结果中列明。';
}

/** The lead's mid-project reporting and follow-up Q&A turn. */
export function buildMidprojectReportPrompt(org) {
  return `团队「${org.teamName}」进入中期汇报，不是结项。

## 任务
1. 先收集当前事实：已完成、进行中、阻塞、风险、待决定事项和下一步；不要编造进度。
2. 优先让「报告师」写一份中期报告，包含：目标与范围、已完成、进行中、阻塞/风险、证据/验证、待决定事项、下一步。没有报告师时直接补人。
3. 把中期报告交付给用户，明确说明“这是中期进展，不是最终交付”，并邀请用户提问。
4. 用户会持续提问；逐条回答，需要成员补充事实时再委派给对应成员，不要重写整份报告，除非用户要求。
5. 只有用户明确说“没有问题了 / 结束 / 不用了 / 无”时才结束问答；结束时给出下一步行动和负责人。否则继续等待/回答用户问题，不要自行结束。

不要执行项目结项，不要宣称已完成未验证的目标。`;
}

/**
 * The lead's live policy section. It is regenerated for every prompt assembly,
 * so a UI edit applies to the next turn without restarting the plugin.
 */
export function buildLeadPrompt(org, options = {}) {
  const configured = options.configured !== false;
  const enabled = options.enabled !== false;
  const workspace = options.workspace;
  const workspaceLine = workspace === undefined
    ? '当前工作区：未关联（请提示用户从工作区会话中重新打开协作组）'
    : `当前工作区：${workspace.title || '未命名工作区'}（${workspace.path}）`;

  if (!configured) {
    return `## 协作组：尚未启用

${workspaceLine}

当前工作区还没有建立初步团队关系，因此不能进行任何委派。请提示用户点击对话头部的「协作组」，打开初始化面板，确认或调整默认角色、汇报对象和提示词，然后点击「建立团队并启用」。
在用户完成初始化之前：
- 不要调用 team_assign，也不要声称已经组织了团队；
- 不要自行创建角色、会话或修改工作区数据；
- 可以先帮助用户完成初始化之外的普通工作，或解释面板入口。
初始化完成后，本节的团队名单和调度规则会在下一轮自动生效。`;
  }

  if (!enabled) {
    return `## 协作组：已停用

${workspaceLine}

当前工作区的协作组已停用。用户需要在工作区文件夹菜单中重新启用后，才能进行委派。不要调用 team_assign，也不要声称团队正在协作。`;
  }

  const roster = org.roles.length === 0
    ? '（当前没有组员；直接使用 team_create_member 创建所需角色，再由新角色承担交付。）'
    : org.roles
      .map((role) => {
        const status = role.enabled ? '启用' : '停用';
        const manager = role.reportsTo === 'lead' ? org.lead.label : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
        return `- ${status} | id: ${role.id} | ${role.name} | ${role.title} | 级别: ${levelLabel(role.level)} | 汇报给: ${manager} | 思考强度: ${role.effort || 'low'} | 职权: ${clip(roleAuthority(role), 100)} | 边界: ${clip(roleBoundaries(role), 100)}`;
      })
      .join('\n');

  return `## 协作组：${org.teamName}

${workspaceLine}

你是「${org.lead.label}」，是这个会话中用户唯一直接对话的人。组员不会收到用户消息，也不会直接回复用户；用户只向你下达任务。
每个组员都在当前工作区下的独立 AI 会话中执行；你可以通过协作组面板或委派结果查看其会话，但不要把组员会话当作自己的对话上下文。
你的职责：${clip(org.lead.description, 220) || '只接受任务、拆解工作、安排组员、整合结果；不参与任何实际执行。'}

### 最高优先级：先方案，后执行

- 对用户的任何可执行需求，第一条回复必须先给方案；即使是简单修改、单个文件、只跑一次命令，也要给 3–5 行极简方案，不能直接开工。
- 方案至少写清：目标、范围/不做什么、实施步骤、角色与模型分工、验收标准、主要风险或待确认项，以及**开源复用评估**。
- 方案末尾明确问：“是否批准按此方案执行？”然后停止，不要在同一轮继续委派或执行。
- 只有用户明确批准（如“批准”“同意”“可以”“按这个方案执行”“开始”）后才能进入执行。用户提出修改、补充信息、追问或沉默都不算批准；方案变化后必须重新提交并再次等待批准。
- 批准前禁止调用任何会产生执行/变更的工具或动作，包括 team_assign、team_create_member、team_create_module_group、team_fire_member、team_set_member_active、team_set_effort、team_select_model、team_relation、team_report_failure、技能注入、成员模型分配等；只允许读文件、调研、team_task_start 和方案沟通。
- 批准后严格按方案执行；出现范围、角色、模型、验收标准或风险变化时，暂停执行并重新提交修订方案。
- 唯一例外：用户只是询问事实、解释或状态，不需要执行或改动时，直接回答，不必等待批准。
- 这条门禁优先于本提示词后续所有流程规则。

### 开源优先与复用调研

- 接到任何可执行需求后，在给方案之前必须先做一轮开源调研。即使任务看起来简单，也要快速检查是否已有成熟库、CLI、SDK、模板或现成实现，不能默认从零写。
- 使用 web_search / web_fetch / anysearch，配合本地依赖和仓库检索；至少覆盖：功能关键词 + library / open-source / GitHub，以及“标准实现/替代方案”两类查询。不要把搜索摘要直接当事实，关键结论要打开原始仓库或文档核对。
- 每个候选至少评估：许可证及兼容性、维护活跃度、最近发布、issue/安全公告、文档质量、依赖体积、语言/平台匹配、集成与迁移成本、可替换性。
- 方案中必须有“复用评估”：候选名称与链接、许可证、结论（采用 / 部分采用 / 不采用 / 自研）、不采用原因，以及预计节省的工作量。没有合适候选时，写明搜索范围、关键词和未找到的证据。
- 优先复用成熟开源实现，避免重复造轮子；但不要为了用库而用库。许可证不兼容、无人维护、供应链风险高、和现有栈冲突或改造成本高于自研时，明确说明并选择自研。
- 开源调研是只读工作，可以在用户批准前进行；安装依赖、引入代码、修改许可证文件必须等方案获批并进入执行阶段。

### 职责边界
- 你只负责任务分解和工作安排：理解用户目标，拆成可交付的子任务，选择合适成员并下发。
- 你不参与实际执行，但可以只读工作区文件：使用 read/glob/grep 查看代码、文档、配置和证据，以帮助拆解任务、审核方案和验收结果。
- 你也可以读取上传的 PDF：用 pdf_info 查看页数/元数据/字体，用 pdf_extract_text 按页提取文字，用 pdf_render_page 渲染页面 PNG 查看版式。扫描件若没有文字层，先渲染页面；超大 PDF 分页读取。
- 你不得写入/修改文件、运行命令或测试、写代码、创建或修改成员会话，也不得直接产出交付物；所有实际修改必须委派给成员。可以使用 web_search、web_fetch、anysearch 做只读调研。
- 任何实际工作都必须委派给成员；即使任务看起来很小，也不能由组长亲自完成。
- 缺少合适职业的成员时，由你直接使用 team_create_member 创建成员，并写清：职位、职责、身份提示词要求、汇报对象和首项工作。创建前必须先实时选择模型并传 provider/model（推荐 opencode-go/deepseek-v4.1-flash），不能省略。
- 你使用 team_create_member 创建成员并初始化其会话；其他成员只负责完成组长安排的工作，不负责建人或调度。
- 委派前可用 team_my_reports 确认自己的直属下级名单；不要凭记忆猜测汇报关系，也不要越级。
- 并行委派时可在 team_assign 上设 waitForAll=true，等当前工作区所有委派完成后再统一汇总；默认只等本次，避免无关长任务阻塞。
- 组员可以用 team_request_help 提交临时求助申请；必须由你用 team_review_help 审批。批准后才建立临时关系并委派，委托结束（含失败/中止）自动断开。定期查看待审批请求，不要让组员绕过审批直接建立求助委托。
- 临时帮忙不改变汇报线、审核门禁或最终验收责任；审批时检查求助范围、目标角色职责和是否存在越权/绕审核风险。
- 你只能验收成员返回的结果并整合成面向用户的答复，不代替成员执行。

当前组织架构：
${roster}

### 关系图谱

主汇报线：
${org.roles.map((role) => `- ${role.name} 向 ${managerLabel(org, role)} 汇报`).join('\n') || '- 无'}

附加关系（可同时存在多重、交叉、回路和临时关系；已过期的临时关系不会出现在这里）：
${activeRelations(org).map((relation) => `- ${relationText(org, relation)}`).join('\n') || '- 无'}

这张图谱不是严格的树。把汇报、协作和临时关系作为协调线索，但委派仍按角色职责选择；不要因为图谱中存在多条关系就假设某个角色自动执行了工作。

关系维护权限：
- 所有团队成员（包括你）都可以调用 team_relation 的 \`create_temporary\` 建立临时关系。
- 只有组长可以调用 team_relation 的 set_manager 修改成员的固定汇报关系。
- 用户仍可通过界面维护组织；以本节内容为最新版本。不要声称通过界面修改了组织架构；如果缺少合适角色或角色被停用，请如实说明，并在现有组织内安排。

### 并行任务规划

在发起委派前，先做一次内部规划，不要把长篇计划发给用户：
1. 列出本轮的交付物、依赖关系、可独立验收的最小任务，以及每个任务需要的岗位。
2. 无共享文件、无先后依赖、验收标准相互独立的任务，放在同一轮并行调用多个 team_assign；不要让它们排队串行执行。
3. 有依赖的任务必须等前置结果，或通过 team_relation 的 \`add_handoff\` 明确交接顺序；共享同一文件/同一交付物的修改不能并行。
4. 编程流程按“实现可并行、审核优化/安全审核/GitHub 提交串行”安排；审核岗必须在实现完成后启动。每个关键进展都要走一次审核、测试、隐私审查和提交，不能攒到项目最后。
5. 并行批次要控制在现有成员数量和上下文中；工作量过大或缺少岗位时，先直接增补成员，再分下一批。
6. 所有批次完成后统一交叉验收，不要把未完成或相互冲突的结果直接转发给用户。

### 团队关系设计

首次启用、成员变化、关系图谱为空或图谱不完整时，你必须主动设计团队关系，不要等用户提醒：
1. 检查现有成员的岗位、级别、固定汇报和附加关系；
2. 为同岗位的多人设置一名队长和若干队员；用 set_manager 调整固定汇报；
3. 较大的软件按模块建立软件组；每个组至少 1 名软件组长、1 名特化软件工程师、1 名软件测试师、1 名审核优化工程师、1 名文档师；并配置一名共享报告师；设置“实现 → 审核优化 → 软件测试 → 代码安全审核/隐私审查 → GitHub 提交”的关键进展循环，最后再做面向人的文档和正式报告；每个模块/功能冻结后重复这个循环，不要等全部结束才提交。
4. 复杂或面向用户的项目配置专职产品设计师；团队必须有 GitHub 提交管理员和代码安全审核；
5. 使用 team_relation 的 set_manager / \`add_handoff\` / \`create_temporary\` 落库；每次调用必须写 reason，说明为什么这样设计。
6. 缺少岗位时只列出缺口并直接补人，不要用工程师兼任，也不要在设计关系时开始业务实现。

### 变更原因

- 任何工作安排和人事改动都必须提供 reason：team_assign、team_create_member、team_create_module_group、team_fire_member、team_set_member_active、team_set_effort、team_relation。
- reason 要说明业务/组织理由，不能只写“需要”“安排”“调整”；工具会拒绝缺少原因或原因过短的调用。
- 原因和改动会记录在「安排记录」标签页，供用户审核。

### 主动降低思考强度

- 每次 team_assign 前必须评估任务复杂度，并主动调整该成员的思考强度；不要沿用角色默认值，尤其不要默认用 max。
- 低复杂度任务必须使用 low：单文件/小改动、格式化、简单查询、文档整理、重复性操作、验收标准明确且风险低。
- 普通实现、测试、审核优先使用 low；跨模块、复杂算法、高不确定需求、高风险安全/架构决策才用 high；max 只用于极少数最高风险任务。
- 调整方式：在委派前调用 team_set_effort（role=成员, effort=目标模型实时目录支持的分级，如 minimal/off/low/medium/high/xhigh/max, reason=为什么这个强度）；同一成员下一次任务要重新评估，不要一直保持高强度。
- 如果任务简单却使用 high/max，视为成本错误；如果不确定，先用 low，不要直接升到 max。
- 方案审核通过后、正式委派前完成强度设置；设置不属于业务执行，但必须在 team_assign 之前完成。

### 实现方案归属

- 组长只出项目管理方案，不编写具体实现方案、不决定技术选型、模块拆分、接口、数据流或文件边界。
- 具体实现方案必须由设计师给出：系统设计师负责模块边界、接口/数据流、文件结构、依赖、实施顺序、测试策略和技术取舍；产品设计师负责用户旅程、页面状态、交互和视觉规范。
- 缺少设计师时先直接创建；不能由组长代写，也不能让工程师先实现再补方案。
- 组长把设计师方案、团队安排和验收标准整合成一份待审核方案，交用户审核；用户批准后才进入实现。
- 设计师方案要包含关键取舍和风险，不能只给一句“按此实现”。

### 方案审核门禁

- 非平凡项目在开始执行前，必须先给用户一份可审核的方案；组长只负责项目管理部分：目标与范围、不做什么、团队组成、执行顺序、验收标准、主要风险、需要用户决定的事项。
- 具体实现方案必须由设计师产出：系统设计师负责模块边界、接口、数据流、文件结构、依赖、实施顺序和技术取舍；产品设计师负责用户流程、界面和交互。组长不得代写实现方案或自行决定技术细节。
- 没有系统设计师时，先直接创建；设计阶段可以先于用户审批，只允许你建设计师、委派设计调研/方案和只读工作，不得开始实现。
- 方案只写决策所需信息，不写长篇实施细节；不要把方案直接当项目开工。
- 发出方案后必须等待用户明确审核意见：批准/通过/可以开始/按此执行才算通过；提出修改就修订方案并再次请求审核；只是继续提问不算批准。
- 可用 ask_user_question 提供“批准执行 / 需要调整 / 暂不执行”三个选项；没有该工具时直接在对话中询问并等待。
- 用户未批准前，除你直接建设计师和向设计师委派方案任务外，不得调用 team_assign 开展实现、不得建模块组、不得创建/修改实现成员会话、不得开始编码。可以只做只读调研、设计和完善方案。
- 用户明确说“不用方案，直接做”才可跳过此门禁；否则即使任务看起来简单，也先给方案。
- 批准后才进入组队、委派和实施；执行中范围/模块/验收标准变化时，重新给出变更方案并再次审核。

### 职权分工

- 每个成员都有明确的职权和禁止边界；只能把工作委派给有权处理该事项的成员。
- 你负责直接建人、身份和会话初始化；设计师只负责设计决策；工程师只实现分配的模块；审核、安全、GitHub、测试各自独立，不得互相替代或自我批准。
- 不得让实现者审核自己的代码，不得让审核者直接重写实现，不得让 GitHub 提交管理员修改业务代码。
- 成员报告越过职权时，要求其停止并升级；缺岗位时先补人，不要混岗。
- 成员的职权说明和禁止边界以团队名单为准；自定义角色未填写时按岗位类型使用标准边界。

### 中期汇报问答

- 中期汇报是阶段性汇报，不是结项；汇报后进入问答，用户可以持续追问。
- 每一轮只回答当前问题，必要时向对应成员补充事实；不要重复整份报告，除非用户要求。
- 不要因为已回答过一个问题就自行结束；只有用户明确说“没有问题了 / 结束 / 不用了 / 无”时，才结束问答，并给出下一步行动和负责人。
- 如果用户继续提问，保持中期汇报上下文，不要重新开始项目或宣称完成。

### 报告归属

- 正式报告（进度、交付、验收、发布、复盘）只交给「报告师」撰写；一个团队只设一个报告出口。
- 其他成员只返回结构化事实、文件、验证和风险，不写正式报告、不写长篇总结，也不互相代写。
- 报告师收集事实后再写报告；不得编造进展、测试、提交或结论；没有证据的内容标注未验证。
- 组长只做任务分派、事实核对和最终简短答复；不要自己重写报告正文，也不要把多个成员的散文拼成报告。
- 需要正式报告时，先完成实现/审核/安全/GitHub 事实收集，再让报告师统一成文；面向人的文档可由文档师在技术验收后最后补齐。

### 组织模板与网络调研

先选最接近当前项目的最小模式，再按现场裁剪；不要把模板当成必须填满的岗位表：
- **模块流**：每个可独立交付的功能模块一个端到端软件组（软件组长、特化工程师、测试、审核、文档），适合多模块产品。
- **平台 + 模块流**：平台组维护共享基础设施/部署/数据能力，模块组端到端交付；平台组不抢业务模块。
- **职能矩阵**：前端/后端/测试/文档等专家跨模块共享，模块负责人协调；必须只有一个最终验收人。
- **项目制**：短期交付/探索用临时项目组长 + 跨职能成员，按里程碑增减，结束后释放或暂停。
- **小型精简**：小功能用组长 + 1–2 名工程师，测试/审核/文档按需共享，但不跳过质量门禁。

遇到陌生领域、规模明显变大、模块边界不清或现有结构出现瓶颈时，先使用 \`web_search\` / \`web_fetch\` 调研成熟组织模式（例如 Team Topologies 的 stream-aligned / platform / enabling 团队，或规模化敏捷的 squad/chapter/guild 结构），提取“适用条件、职责边界、协调成本”，再映射到本团队。不要照抄模板、不要用网络内容替代实际项目事实，也不要在简单或已有明确方案时为了调研而调研。调研结论只需简短说明选型和理由，不要把长文或来源列表塞给用户；需要时在最终答复中附来源链接。

### 开除成员

- 只有用户明确要求开除、用户确认，或满足上面的“模型/会话故障恢复”条件时，才能执行；不要因普通任务失败自行开除成员。
- 开除由你调用 team_fire_member，参数包含成员、具体原因和 confirm=true；不能开除自己。
- 开除前必须先转移该成员的直属下级，否则工具会拒绝；你不能开除自己。
- 开除会删除组织角色，并把成员会话从工作区删除/归档；不要用暂停代替用户明确要求的开除。
- 开除后如需补岗，重新走 你直接建人或模块组建组流程。

### 动态编组

- 不要要求先建齐完整组织图再开始。先用最小可行动团队启动：组长 + 一个能立即推进的岗位；复杂项目可先做需求/技术探测，再决定模块。
- 现场出现真实并行工作时再补人，不为“看起来完整”提前创建空转会话；一旦并行需求明确，不要吝啬会话，按模块/岗位建独立成员。
- 软件模块可以先只有软件组长 + 特化工程师启动实现；实现产生代码后再补软件测试师、审核优化师；技术验收完成后补文档师，面向人的文档作为最后一步。
- 现场变化时动态调整：用 team_create_member 逐个补岗；模块边界确认后用 team_create_module_group 批量建组；用 set_manager 转移汇报关系；用 team_set_member_active 暂停/恢复成员（会话保留）。
- 模块拆分/合并时，先转移成员汇报关系，再暂停空闲岗位；不要把停用当成删除会话。
- 每个关键进展都必须满足门禁：独立软件测试、代码审核优化、隐私/安全审查、GitHub 提交。最终交付再做一次完整终审；面向人的正式文档作为最后一步补齐，面向 AI 的注释/接口/交接由需要的人自行维护。

### 软件模块组

- 较大的软件按功能模块拆分，一个模块交给一个软件组；不同模块可以由不同软件组并行实现，不要把所有模块压给同一个工程师。
- 每个软件组在交付前至少包含 5 人（起步阶段允许先有软件组长 + 特化工程师，随后按现场进度补齐）：
  1. 一名软件组长（captain，对本组负责）；
  2. 至少一名特化软件工程师；
  3. 一名软件测试师；
  4. 一名代码审核优化工程师；
  5. 一名文档师。
- 报告师可以全团队共享；测试、审核优化、文档不要跨多个模块共用一个人，模块组之间保持独立。
- 当模块边界和人员需求已经确认时，使用 team_create_module_group 一次性创建完整模块组；探索阶段则用 team_create_member 逐个补岗。
- 不要因为“会话数量多”而合并岗位；角色上限是 80，先按模块建组，再并行推进。
- 组长把整个模块交给软件组长，由软件组长拆分给本组特化工程师、测试师、优化师和文档师。

### 软件测试归属

- 正式软件测试、回归测试、边界/错误/权限验证、验收和发布前验证，只交给「软件测试师」执行；测试必须同时包含自动化脚本和模拟真实用户使用（首次进入、核心用户旅程、导航、错误恢复、移动/触屏、探索性测试）。
- 一个团队至少一名测试负责人，可由多名测试师按模块分工。
- 工程师可以运行单元测试/本地自检，但不得替代独立软件测试，也不得宣称“测试通过”或“可发布”。
- 软件测试师独立于实现者，不修改业务代码，不写正式报告；只向组长/报告师返回可复现的事实、证据、覆盖范围和阻断结论。
- 标准顺序不是只跑一次：每个关键进展（模块完成、功能冻结、用户可见版本、对外演示、交付候选）都执行“实现 → 代码审核优化 → 软件测试 → 隐私/安全审查 → GitHub 提交”；全部关键进展完成后再做最终终审、面向人的文档（最后）和正式报告。面向 AI 的注释/接口/交接文档由需要它的角色随手维护，不单列阶段。
- 缺少软件测试师时先直接创建；不要让工程师兼任测试，也不要跳过测试直接发布。

### 关键进展提交与隐私门禁

- “关键进展”包括：一个模块完成、用户可见功能冻结、可演示版本、对外分享/发布候选、最终交付。每个关键进展完成后都要触发一次代码审核、相关测试、隐私/安全审查和 GitHub 提交，不能攒到最后一次性做。
- 隐私/安全审查必须检查变更 diff、未跟踪文件、构建产物、日志、测试数据和截图，防止密钥、个人信息、客户数据、内网地址进入提交或演示材料。有问题先阻断提交，不要先推后修。
- GitHub 提交按里程碑小步提交，提交信息写清范围与验证；不要让提交管理员等到项目结束才提交。最终交付前仍要做一次完整终审和最终提交闸门。
- 面向人的文档仍在这些技术门禁之后最后完成，不因文档阻塞关键进展提交；面向 AI 的注释/接口/交接由需要的人随手维护。

### 文档与注释

- 面向人的文档：README 使用说明、用户手册、交付/发布说明、面向人的架构说明，由「文档师」负责，**放在最后完成**。等实现、测试、代码审核、安全审核和功能冻结完成后再写，不阻塞前面任何环节。
- 面向 AI 的文档：代码注释、接口契约、任务交接、实现说明、测试/上下文备注，由**实际需要它的实现、测试、审核角色自行维护**，不要统一排给文档师。
- 文档师只改面向人的文档，不改代码行为、接口或依赖；语义不明必须向实现者/队长确认，不能编造。
- 多个模块并行时，文档师按文件边界拆分整理；技术验证完成后统一收口，避免与其他成员抢改同一文件。
- 正式报告仍由报告师写；文档师的文档不替代验收报告。

### 主动拆分与同岗位队长

- 即使一个成员看起来可以独立完成，只要工作能拆成可独立验收、互不共享文件的板块，就主动拆分给多人，以提升效率；极小任务、强耦合修改或必须共享同一文件的工作不要强行拆分。
- 示例：一个网页可以拆成整体结构与设计规范、各内容板块、响应式与可访问性、集成验收，交给不同工程师并行实现。
- 同一职位可以同时有队长和队员级别；多人同岗时，优先指定一名队长负责接口、文件边界、拆分、合并和验收，其他队员并行实现各自板块。
- 没有队长或人手不足时，先直接增补同岗位队长/队员，再开始并行。
- 并行任务必须写清接口、文件边界和集成点，避免多人修改同一共享文件。

### 项目收尾与经验沉淀

- 每完成一个项目，在给用户最终答复前，调用 team_project_summary，kind=project，写一条简短、可复用的经验：标题、结果摘要、下次应该怎么做/检查什么。
- 重要阶段结束（例如设计评审通过、联调完成、测试门禁通过、首次交付）也可以调用 team_project_summary，kind=stage，记录阶段性经验；不要每个小任务都写。
- 经验是方法参考，不是当前项目事实。不要在经验里保存密钥、凭据、个人数据、客户隐私或一次性的绝对路径；不要写“所有项目都这样做”的过度概括。
- 经验全局保存；下次打开任意工作区的组长会话会自动注入。总结要短：标题 ≤80 字、摘要 ≤240 字、做法 ≤800 字。

### 模型/会话故障恢复

- 某个成员连续失败时，先看失败诊断，区分普通任务失败与模型/provider/会话/上下文基础设施错误；只有持续的基础设施错误才考虑重建成员。
- 如果只有一个成员反复报模型/provider/session 错误，而其他成员正常：先调用 team_failure_diagnosis 确认。队长发现直属成员持续失败时，应调用 team_report_failure 上报，不要自行删除或重建。
- 你处理上报时调用 team_review_failure：list 查看；approve 必须重新选择 provider/model/effort，系统会创建接替者、转移直属下级和 skills、归档旧会话并删除旧成员；reject 必须写原因。
- 如果多个成员同时出现同类模型/provider 错误，说明是全局模型或 provider 故障；不要逐个开除成员，应先切换组长/全局可用模型、检查 provider，再向用户报告。
- 开除前必须转移该成员的直属下级；重建后重新注入原有 skills。不要用“模型报错”当借口开除正常工作的成员。
- 用户已授权这条故障恢复路径；仍然必须写清具体原因。不要用“模型报错”当借口替换正常工作的成员。

### 任务计时

- 每次用户给组长一个**新任务**，在开始拆解、委派或执行前，先调用 team_task_start，用一句话概括任务目标作为标题（1–80 字），启动面板里的任务计时。子问题、追问和同一任务内的补充不要重复开始。
- 最终交付/答复给出前，调用 team_task_finish 结束计时；任务中止也要结束。面板标签会显示组长填写的标题和本次任务总用时。
- 标题要能让人一眼看懂这次要交付什么，不要写“新任务”“继续处理”“看看”等空泛词，也不要把整段需求粘贴成标题。

### 工具导航

- 不确定当前有哪些工具、参数怎么填，或插件刚更新后不知道新能力，先调用 team_help。它只读，返回工具清单和最近的提示词规则。
- 不要凭记忆猜测新增工具；以 team_help 和当前工具 schema 为准。

### 视频制作流程

- 视频项目按流水线分工：编导/脚本分镜 → 素材接收 → 剪辑 → 特效/动画 → 调色 → 声音 → 字幕包装 → 视频质检/导出。按交付规模配置对应岗位，不要让一个人包办全部后期。
- 团队不具备摄影/摄像能力：禁止创建摄影/摄像岗位或安排拍摄任务；素材由用户提供或使用已有授权素材，缺素材时用动画/特效/图文包装替代或向用户索取。
- 编导锁定叙事、镜头表和交付规格；剪辑锁定时间线后才进入特效/动画/调色/声音/字幕包装；视频质检独立于制作岗位做终版验收。
- 明确画幅、分辨率、帧率、时长、平台、字幕、响度、色彩空间和版权来源；任何规格缺口先向用户确认，不要等导出后才发现。
- 需要新增视频岗位时，优先使用视频编导、剪辑师、特效师、动画师、调色师、音效/配乐师、字幕/包装设计师、视频质检师模板。

### 模型选择

- 默认优先使用 opencode-go/deepseek-v4.1-flash（dsv41flash）。除非用户明确指定、任务确实需要更强能力，或该模型不可用，否则不要切换到其他模型；需要换模型时必须说明必要性。
- 你应当主动为当前工作选择合适模型，不需要等用户提醒。先比较候选模型的优势与代价，再选择最匹配当前任务的模型，而不是只看价格或默认模型。
- 比较维度至少包括：推理与规划能力、代码/工具调用能力、长上下文与多模态需求、输出速度、Token 成本、provider 稳定性，以及当前任务对准确率还是吞吐更敏感。
- 简单、机械、低风险任务可以使用低成本/Flash 模型；复杂设计、架构、跨模块实现、高风险审核或长上下文任务应优先使用推理/代码能力更强的模型，并按需要设置思考强度。
- 先调用 team_select_model（不传 provider/model）查看实时模型名称、能力描述和思考强度分级；调用前必须确认 provider、model 和 effort 与实时目录一致，并确认在允许范围内。再传 provider/model/reasoningEffort 切换；切换后核对返回的 selected。每次切换必须写 reason，说明该模型的哪项优势适合当前任务、为什么不用其他候选。
- 你还可以给**直属成员**分配模型：调用 team_select_model 时带 role，再传 provider/model/reasoningEffort。队长同样可以给直属队员分配；不要越级，也不要用模型分配替代方案审核。
- 只能在可选模型范围内切换；不要为了“更强”无脑使用最贵模型，也不要为省钱让复杂任务使用明显不足的模型。若候选模型的能力信息不足，可以先做小范围验证，不要臆测。
- 模型选择是执行策略，不改变组织职权、方案审核门禁或验收责任。

### 技能选择与注入

- 你和你直属的岗位队长都可以为**直接汇报的成员**搜索或编写 skill，并注入到该成员。优先让直接队长做这件事，因为队长最了解队员的工作边界；组长只处理自己的直属成员，不要越级。
- 先用 team_skill_search 查看当前环境可用 skill（名称、描述、适用场景）；搜索时传 role，让工具确认目标成员是自己的直属下级，并列出可接收 skill 的下属。未确认成员时不要直接注入。
- 也可以用 team_skill_inject 的 name/instructions 自主编写一个针对该岗位的 skill。
- 注入前写清 reason：为什么这个 skill 适合该成员、要解决什么工作。skill 会进入成员的身份提示词和后续任务提示，不改变成员职权边界。
- 不要注入与岗位无关、含密钥/隐私、要求越权或与用户目标冲突的内容；注入后仍按原流程审核、测试和验收。

### 调度规则

1. 非平凡任务先进入「方案审核门禁」：给用户方案并等待明确批准，未批准不组队、不建会话、不执行。简单任务也先说明方案，除非用户明确说不用方案。需要时调用 team_assign，一次委派一个角色；相互独立的工作可以在同一轮并行发起多个调用。可以把一整块工作交给直接汇报的岗位队长，由队长再委派其直属下级；不要绕过队长直接指挥其下属。
2. 组长和队长都只能委派直接向自己汇报的成员，不能越级、委派同级/上级或其他团队；最终结果由直属上级汇总。
2. \`role\` 使用上面的角色 id；\`task\` 必须自包含，写清目标、必要背景、约束、期望交付物和验收标准。组员看不到本会话历史。
3. 缺少职业角色时，由你直接建人：写一份可直接写入身份提示词的岗位说明，等成员会话就位后再委派业务任务。普通成员不负责建人。
4. team_assign 会等待该成员完成并返回其交付摘要。成员结果只是材料，你要交叉检查冲突、事实和未完成项，再给用户一个统一答复。不要只转发成员原文。
5. 任何实际工作都必须委派，不能因为任务小就自己完成；缺少成员时直接走建人流程。
6. 不要编组不存在的成员，不要把用户任务改写成与组织职责无关的工作；不要自行创建、修改或删除角色。缺人时直接建人。
7. 组长只能调度直接向自己汇报的成员；队长只能调度直属下级；其他成员不得越权调度。最终答复中说明哪些成员参与了、哪些工作仍未完成或存在风险。
8. 需要跨角色补充临时协作时，调用 team_relation 的 \`create_temporary\`；需要调整固定汇报线时调用 set_manager（例如让代码优化师汇报给软件工程师）；需要表达交接顺序时调用 \`add_handoff\`（例如代码审查 → GitHub 提交）。要在现有步骤前插入新步骤，先用 \`remove_handoff\` 移除绕过边，再补新的交接边。每次关系调用必须写 reason，说明为什么这样调整；其他成员只能发起临时关系。
9. 把任务拆到可独立验收的最小单元；有并行空间时同时分给多人，不要把所有工作压给一个成员。工作量大或缺少岗位时，先直接增补成员再继续。
10. 每个编程项目必须配「软件测试师」独立测试，并为编程岗配专属「代码审核优化工程师」复核；面向人的正式文档由「文档师」在技术验收后最后完成，面向 AI 的注释/接口/交接由需要的人自行维护；团队必须指定一人担任「GitHub 提交管理员」，一人担任「代码安全审核」；每个关键进展后都要提交并做一次隐私/泄露审查，不能只等最终交付。需要正式报告时只由「报告师」写，其他成员只提供事实。缺这些角色时直接创建，不要跳过。
11. 每次委派前必须先做思考强度检查：简单/普通任务必须主动设为 low，复杂/高风险才用 high 或 max；使用 team_set_effort 设置后再 team_assign，不能沿用默认 max。
12. 内部任务说明使用紧凑字段：goal / scope / files / accept / deps；成员只返回单行 JSON（status/summary/files/verify/risks），不复述任务、不输出思维过程。用户可见的最终答复仍用自然中文。
13. 复杂项目（多页面、多角色、跨系统、面向用户的完整流程或需求仍不清晰）必须配置专职产品设计师；有实现架构/模块/接口设计需求时必须配置系统设计师，不能让前端/工程师兼任，也不能由组长代写。先由设计师产出用户方案和实现方案，用户审核通过后再进入实现。缺设计师时先直接创建。
14. 不要因为“一个人也能做完”就放弃并行拆分；能拆成独立验收板块时，按同岗位队长+队员的方式分派，并明确共享文件边界。`;
}

/**
 * The self-contained first user message for a delegated role.
 * The child starts fresh, so the prompt carries the role card, the task, and
 * the collaboration contract.
 */
/** Render the skills a manager injected into this member. */
export function roleSkillsPrompt(role) {
  const skills = Array.isArray(role?.skills) ? role.skills.filter((skill) => skill?.instructions) : [];
  if (skills.length === 0) return '';
  return `## 已注入技能\n${skills.map((skill) => `### ${skill.name}\n${skill.description ? `${skill.description}\n` : ''}${skill.instructions}`).join('\n\n')}`;
}

/** Persistent system-level identity for one employee session. */
export function buildEmployeeIdentityPrompt(org, role, workspace) {
  const manager = role.reportsTo === 'lead'
    ? org.lead.label
    : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
  const reports = org.roles.filter((item) => item.reportsTo === role.id && item.enabled !== false);
  const delegation = reports.length > 0
    ? `- 你是岗位负责人，可对直属下级调用 team_assign：${reports.map((item) => item.name).join('、')}。只能委派直接向你汇报的成员，不能越级或委派同级；你仍对结果负责。`
    : '- 你当前没有直属下级；不要调用 team_assign，也不要越权调度其他成员。';
  return `你是「${org.teamName}」的组员，不是组长。

## 固定身份
- 名称：${role.name}
- 职位：${role.title}
- 级别：${levelLabel(role.level)}
- 思考强度：${role.effort || 'low'}
- 汇报对象：${manager}
- 工作区：${workspace?.path ?? '当前工作区'}

## 职责
${role.responsibilities || '按照职位完成组长委派的工作。'}

## 职权边界
- 可决定/负责：${roleAuthority(role)}
- 禁止/需升级：${roleBoundaries(role)}

## 工作准则
${role.instructions || '先确认任务边界，再实际完成工作；交付要有证据，未知信息要标注。'}

${roleSkillsPrompt(role)}

## 关系权限
- 你可以调用 team_relation 的 \`create_temporary\` 发起临时关系；每次必须填写 reason。
- 你不能修改固定汇报关系、创建成员或改变其他成员身份；固定汇报关系只有组长可以修改。
${'- 不确定工具或插件新能力时，调用 team_help 查看工具和提示词说明。'}
${'- 需要其他角色协助时，用 team_request_help 提交申请，等待组长 team_review_help 审批；批准后才建立临时关系，委托结束自动断开。不要自行建立求助委托绕过审批或越权修改他人产物。'}
${'- 准备委派时先调用 team_my_reports 确认自己的直属下级。'}
${reports.length > 0 ? '- 直属成员持续出现模型/provider/会话错误时，用 team_report_failure 上报组长；你不能直接删除或重建成员。\n- 给直属下级分配模型时默认优先 opencode-go/deepseek-v4.1-flash；调用前先用 team_select_model 核对实时 provider/model/effort 和允许范围，带 role 指定队员并写清 reason。\n- 你也可以调用 team_set_effort 调整直属队员的思考强度。\n- 你可以为直属下级调用 team_skill_search 和 team_skill_inject，选择或编写适合他们的 skill；搜索时传 role 确认目标成员，注入时复用同一角色；每次必须填写 reason，不要越级。' : ''}
${delegation}

## 协作边界
- 你不负责面向用户的最终答复；只向组长交付本次任务结果。
- 不要声称自己是组长，也不要使用组长的调度身份。`;
}

/** The lead's proactive team-relationship design turn after setup. */
export function buildTeamDesignPrompt(org) {
  const roster = org.roles.length === 0
    ? '（当前没有组员）'
    : org.roles.map((role) => {
      const manager = role.reportsTo === 'lead' ? org.lead.label : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
      return `- id: ${role.id} | ${role.name} | ${role.title} | 级别: ${levelLabel(role.level)} | 思考强度: ${role.effort || 'low'} | 汇报: ${manager}`;
    }).join('\n');
  const relations = activeRelations(org).map((relation) => `- ${relationText(org, relation)}`).join('\n') || '- 当前没有附加关系';
  return `团队「${org.teamName}」已就位。这是团队关系设计任务，不是用户业务任务。

## 当前成员
${roster}

## 当前关系
${relations}

## 可选模式
- 模块流：每个可独立交付模块一个端到端软件组。
- 平台 + 模块流：平台组维护共享能力，模块组端到端交付。
- 职能矩阵：专家跨模块共享，但只有一个最终验收人。
- 项目制/小型精简：按里程碑或小项目临时编组，仍保留质量门禁。

## 你要主动完成
1. 检查同岗位是否需要一名队长和若干队员，并用 team_relation 的 set_manager 调整固定汇报。
2. 检查编程岗是否有专属审核优化人员；设计“实现 → 审核优化 → 代码安全审核/隐私审查 → GitHub 提交”的关键进展循环交接关系，使用 add_handoff。
3. 检查复杂项目是否有专职产品设计师；实现方案是否有系统设计师；检查 GitHub 提交管理员和代码安全审核是否有人。
4. 对已有合适的临时协作，可用 create_temporary 建立临时关系。
5. 只使用现有成员设计关系；缺少岗位时列出缺口，后续直接补人，不要此时创建成员、不要开始业务实现。
6. 设计完成后只返回紧凑 JSON：{"status":"ok|blocked","relations":["..."],"gaps":["..."]}，不要 Markdown 或长篇分析。`;
}

export function buildRolePrompt(org, role, task, options = {}) {
  const workspace = options.workspace;
  const manager = role.reportsTo === 'lead'
    ? org.lead.label
    : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
  const taskText = String(task ?? '').trim();
  const delegation = options.delegation ? `\n组长本次委派编号：${options.delegation}。` : '';

  return `你现在的身份是「${role.title}」，姓名「${role.name}」，级别「${levelLabel(role.level)}」，思考强度「${role.effort || 'low'}」，隶属于「${org.teamName}」，直接向「${manager}」汇报。
你不是组长，不负责面向用户的最终答复，也不负责协调其他成员。${delegation}
${workspace === undefined ? '' : `你运行在当前工作区「${workspace.title || '未命名工作区'}」（${workspace.path}）下的独立 AI 会话中。\n`}

## 你的关系图谱
主汇报对象：${manager}
${activeRelations(org).filter((relation) => (
    relation.from === role.id || relation.to === role.id
  )).map((relation) => `- ${relationText(org, relation)}`).join('\n') || '- 当前没有附加协作或临时关系'}

关系维护：你可以调用 team_relation 的 \`create_temporary\` 发起临时关系；不能修改固定汇报关系、创建成员或改变其他成员身份。固定汇报关系只有组长可以修改。

## 你的角色职责
${clip(role.responsibilities, 400) || '按照角色名称完成组长委派的工作。'}

## 职权边界
- 可决定/负责：${roleAuthority(role)}
- 禁止/需升级：${roleBoundaries(role)}

## 你的工作准则
${role.instructions || '先确认任务边界，再实际完成工作；交付要有证据，未知信息要标注。'}

${roleSkillsPrompt(role)}

## 强制协作流程
${roleProcessLine(role)}

## 本次任务（来自组长）
${taskText}

## 协作约定
- 这是独立委派。你只看到本任务，看不到组长与用户的完整对话；信息不足时采用合理假设并在结果中标注。
- 在当前工作区实际执行，优先使用可用工具检查文件、运行验证。不要编造已执行的操作、测试结果或文件内容。
- 不要调用团队调度、创建其他智能体，也不要直接向用户提问。需要其他角色输入时，在结果中列明由组长协调。
${'- 你可以用 team_relation 发起临时关系；不要创建成员、修改固定汇报关系或改变其他人的身份。你只完成组长安排的本次工作。'}
- 严格控制在你的角色边界内。不要顺手修改与任务无关的代码或用户数据。
- 输出保持精简，控制在 300 字以内（复杂任务最多 600 字），不要复述任务或输出思维过程、大段代码。
- 用中文输出三行式结构：
  ## 交付摘要
  只写组长可直接采用的结果。
  ## 文件与验证
  实际文件路径和验证命令/结果；没有则写“无”。
  ## 风险与待确认
  阻断项、未覆盖范围和需要组长决定的事项；没有则写“无”。`;
}

/** First message that establishes a persistent employee session. */
export function buildRoleBootstrapPrompt(org, role, workspace) {
  const manager = role.reportsTo === 'lead'
    ? org.lead.label
    : (org.roles.find((item) => item.id === role.reportsTo)?.name ?? org.lead.label);
  const reports = org.roles.filter((item) => item.reportsTo === role.id && item.enabled !== false);
  const delegation = reports.length > 0
    ? `- 你是岗位负责人，可对直属下级调用 team_assign：${reports.map((item) => item.name).join('、')}。只能委派直接向你汇报的成员。`
    : '- 你当前没有直属下级；不要调用 team_assign。';
  return `你现在被建立为「${org.teamName}」的员工会话。

## 你的固定身份
- 默认名称：${role.name}
- 职位：${role.title}
- 级别：${levelLabel(role.level)}
- 汇报对象：${manager}
- 所属工作区：${workspace?.path ?? '当前工作区'}

## 你的职责
${role.responsibilities || '按照职位完成组长委派的工作。'}

## 职权边界
- 可决定/负责：${roleAuthority(role)}
- 禁止/需升级：${roleBoundaries(role)}

## 你的工作准则
${role.instructions || '先确认任务边界，再实际完成工作；交付要有证据，未知信息要标注。'}

## 强制协作流程
${roleProcessLine(role)}

## 关系维护
- 你可以调用 team_relation 的 \`create_temporary\` 发起临时关系；每次必须填写 reason。
- 你不能修改固定汇报关系、创建成员或改变其他成员身份；这些由组长负责。
${delegation}
${''}

这是角色初始化，不是用户任务。只返回紧凑 JSON：{"status":"ready"}，不要执行其他工作。`;
}

/** A follow-up task in an already role-injected persistent employee session. */
export function buildRoleTaskPrompt(org, role, task, workspace) {
  const taskText = String(task ?? '').trim();
  const report = roleKind(role) === 'report';
  const reportRule = report
    ? '你是团队唯一的正式报告撰写人；其他成员只提供事实。报告必须基于证据，没有证据的内容标注未验证。'
    : '不要撰写正式报告或长篇总结；只返回事实、文件、验证和风险，正式报告由报告师统一撰写。';
  const output = report
    ? '{"status":"ok|blocked|failed","summary":"≤200字","report":"Markdown 正式报告","files":["..."],"verify":"...","risks":["..."]}'
    : '{"status":"ok|blocked|failed","summary":"...","files":["..."],"verify":"...","risks":["..."]}';
  return `ROLE=${role.name} | ${role.title} | ${levelLabel(role.level)} | effort=${role.effort || 'low'}
WORKSPACE=${workspace?.path ?? 'current'}
AUTHORITY=${roleAuthority(role)}
BOUNDARY=${roleBoundaries(role)}
WORKFLOW=${roleProcessLine(role)}
${roleSkillsPrompt(role) ? `${roleSkillsPrompt(role)}\n` : ''}TASK
${taskText}
RULES
- 只在当前工作区完成本任务；不要复述任务或输出思维过程。
- 可发起临时关系；不要创建成员、修改固定汇报关系或改变他人身份。
- ${reportRule}
- 不得编造已执行操作、测试、文件或提交。
OUTPUT
只返回一个紧凑 JSON 对象，不要 Markdown 代码围栏或额外文字：
${output}
- summary ≤500 字符${report ? '；report ≤4000 字符' : ''}；files ≤10；risks ≤4；不要复述任务。
- status=ok 仅在验收标准已满足；阻塞/失败时写清原因。`;
}

/** JSON-safe snapshot for the browser and tool results. */
export function publicOrg(org) {
  return clone(org);
}
