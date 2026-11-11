window.__ModuleLoader__.load({
  id: '@local/dsh-agent-org',
  factory(require) {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const h = React.createElement;
    let FrameworkMarkdownText = null;
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
      FrameworkMarkdownText = primitives?.MarkdownText ?? null;
    } catch {
      // The host always provides primitives; fall back to plain text if not.
    }
    const NS = 'agent-org';
    const ENDPOINT = '/dsh-agent-org/state';
    let archiveMemberSession = async () => {};
    let pendingOnboarding = null;
    const onboardingListeners = new Set();
    function requestOnboarding(detail) {
      pendingOnboarding = detail;
      for (const listener of onboardingListeners) {
        try { listener(detail); } catch { /* an overlay failure must not break enablement */ }
      }
    }

    const zh = {
      trigger: '协作组',
      workspaceLabel: '工作区',
      workspaceUnknown: '未关联工作区',
      setupTitle: '建立初步团队关系',
      setupPreviewShow: '查看关系图',
      setupPreviewHide: '收起关系图',
      setupIntro: '这个工作区还没有启用协作组。先确认团队名称、角色与汇报关系；启用后，用户只需向组长下达任务。',
      setupWorkspace: '当前工作区',
      setupTeamName: '团队名称',
      setupRoles: '初始角色',
      setupRolesHint: '默认角色提示词已预置，可展开修改；创建后仍可调整。',
      setupPrompts: '默认提示词',
      setupResponsibilities: '职责摘要',
      setupInstructions: '角色提示词',
      setupEnable: '建立团队并启用',
      setupEnabling: '正在启用…',
      setupAtLeastOne: '至少启用一个角色',
      setupDefaultNote: '初始团队只有组长；启用后由组长直接创建成员，默认名称按「职位-编号」生成。',
      setupSaved: '协作组已启用',
      setupRequiredShort: '未启用',
      relationshipTopology: '关系拓扑',
      topologyHint: '连线表示汇报关系；任务会沿汇报路径流向执行成员，节点显示最近一次协作状态。拖动角色下方的小方框到另一个角色，可建立附加或临时关系。',
      topologyLegendLead: '组长',
      topologyLegendMember: '组员',
      topologyLegendActive: '协作中',
      topologyLegendReport: '汇报',
      topologyLegendCollab: '协作',
      topologyLegendTemp: '临时',
      topologyLegendFlow: '任务流',
      topologyNoRuns: '暂无协作记录',
      topologyDragRelation: '拖动建立关系',
      roleActions: '角色操作',
      editRole: '修改',
      copyMember: '复制成员',
      roleCopied: '已创建副本「{name}」，保存后加入团队',
      workspaceScoped: '仅对当前工作区生效',
      hostRestartRequired: '当前 Host 仍是旧版本。重启 DSH 后才能使用工作区初始化、关系图谱和临时关系；当前仅显示基础关系。',
      workspaceDisabled: '协作组已在当前工作区停用。请从工作区文件夹菜单重新启用。',
      menuEnable: '启用协作组',
      menuDisable: '停用协作组',
      menuLoading: '协作组…',
      menuNeedRestart: '协作组（需重启 Host）',
      enableConfirmTitle: '启用协作组？',
      enableConfirmText: '将归档当前工作区下的全部会话，并创建新的组长会话进入协作组初始化。此操作会影响正在运行的会话。',
      enableConfirmCancel: '取消',
      enableConfirmAction: '归档并启用',
      enabling: '正在归档并创建组长会话…',
      enableFailed: '启用协作组失败',
      disableFailed: '停用协作组失败',
      menuEnabled: '协作组已启用',
      menuDisabled: '协作组已停用',
      openTeamView: '打开协作组视图',
      openSession: '打开组员会话',
      openSessionTitle: '在独立 AI 会话中查看该组员的执行过程',
      repairSessions: '修复成员会话',
      repairingSessions: '正在修复…',
      designTeam: '设计团队关系',
      designingTeam: '正在设计团队关系…',
      designTeamDone: '团队关系设计完成',
      midprojectReport: '中期汇报',
      midprojectReporting: '正在生成中期汇报…',
      midprojectReportDone: '中期汇报已发送，可在对话中继续提问',
      midprojectReportFailed: '生成中期汇报失败',
      designTeamFailed: '设计团队关系失败',
      repairDone: '成员会话已修复',
      repairFailed: '修复成员会话失败',
      sessionUnavailable: '会话尚未建立',
      collaborationProcess: '协作过程',
      taskTimer: '本次任务',
      taskRunning: '计时中',
      taskFinished: '已完成',
      taskNoTitle: '未填写任务标题',
      teamChat: '协作对话',
      chatWidth: '调整协作对话框宽度',
      collapseChat: '收起协作对话',
      expandChat: '展开协作对话',
      teamChatHint: '组长与成员的实时委派、执行和返回结果。',
      teamChatEmpty: '当前还没有协作对话',
      teamChatLead: '组长',
      teamChatMember: '成员',
      teamChatWaiting: '正在执行，等待成员返回…',
      teamChatUpdated: '更新于 {time}',
      teamChatOpen: '打开会话',
      teamChatUser: '用户',
      teamChatHistory: '最近对话',
      teamChatMessages: '{count} 条消息',
      teamChatLoading: '正在加载协作记录…',
      collaborationHint: '展示本工作区最近的任务委派、组员会话和返回结果。',
      assigned: '组长委派',
      returned: '返回结果',
      processSession: '组员会话',
      activeCollaboration: '正在协作',
      activeCollaborationHint: '组长正在等待「{name}」的结果。',
      noActive: '当前没有进行中的协作',
      triggerAria: '打开协作组组织架构',
      title: '协作组',
      subtitle: '你只向组长下达任务，组长按组织架构把工作交给合适的成员。',
      close: '关闭',
      refresh: '刷新',
      tabOrg: '组织架构',
      tabActivity: '协作过程',
      tabAudit: '安排记录',
      tabUsage: 'Token 与费用',
      usageTitle: 'Token 用量与费用',
      usageHint: '按成员统计历史 Token 用量，价格自动从 models.dev 获取并按实际模型计算。',
      usageAutoPricing: '自动价格',
      usageRulesTitle: '计费规则',
      usageRulesModel: '单价自动从 models.dev 获取（USD / 百万 Token），按 1 USD ≈ {rate} CNY 换算（汇率来源：{source}）。',
      usageRulesFormula: '费用 = (输入 Token − 缓存读取 Token) × 输入单价 + 缓存读取 Token × 缓存单价 + 输出 Token × 输出单价。',
      usageRulesPeak: 'DeepSeek 峰时：UTC 01:00–04:00、06:00–10:00（周一至周五，中国法定节假日除外）。其余时间为谷时，谷时价格是峰时的 50%。',
      usageRulesNote: '缓存写入计入输入；未匹配模型按 0 元计；费用为估算值，以供应商账单为准。',
      usageAutoPricingHint: '价格来自 models.dev；离线时使用内置价格快照。',
      usageTotal: '全团队合计',
      usageInput: '输入',
      usageOutput: '输出',
      usageCacheRead: '缓存读取',
      usageCacheWrite: '缓存写入',
      usageTotalTokens: '总 Token',
      usageCost: '费用',
      usageByModel: '按模型计费',
      usageModel: '模型',
      usageModelInput: '输入',
      usageModelOutput: '输出',
      usageModelCache: '缓存',
      usageModelTotal: '总 Token',
      usageModelEmpty: '暂无模型用量',
      usageTurns: '调用',
      usageMember: '成员',
      usageLead: '组长',
      usageEmpty: '暂无 Token 记录',
      usageLoading: '正在统计 Token…',
      usagePriceTitle: '价格设置',
      usagePriceHint: '单价按每百万 Token 计，保存后用于费用计算。',
      usageInputPrice: '输入单价 / 百万 Token',
      usageOutputPrice: '输出单价 / 百万 Token',
      usageCurrency: '货币',
      usageSavePrice: '保存价格',
      usageSavingPrice: '保存中…',
      usagePriceSaved: '价格已保存',
      usageNotConfigured: '未设置单价，费用显示为 0',
      usageCacheNote: '费用仅按输入/输出 Token 计算；缓存 Token 单独展示。',
      auditTitle: '安排与人事记录',
      auditHint: '所有工作委派、人事调整和关系改动及其原因。',
      auditEmpty: '还没有安排记录',
      auditReason: '原因',
      auditWork: '工作安排',
      auditPersonnel: '人事改动',
      auditRelation: '关系改动',
      auditAssign: '委派任务',
      auditCreateMember: '新建成员',
      auditCreateGroup: '创建模块组',
      auditFire: '开除成员',
      auditPark: '暂停成员',
      auditRestore: '恢复成员',
      auditEffort: '调整思考强度',
      auditSkill: '注入技能',
      auditProjectSummary: '项目总结',
      auditStageSummary: '阶段总结',
      auditProject: '项目经验',
      auditSelectModel: '切换组长模型',
      auditRemoveTemporary: '断开临时关系',
      skillInjectTitle: '技能注入',
      skillInjectHint: '选择环境 skill 或为此角色编写一个专用 skill；注入后进入它的身份与后续任务提示。',
      skillInstalled: '环境 skill',
      skillCustom: '自定义 skill',
      skillSearchPlaceholder: '搜索 skill 名称、描述或适用场景',
      skillSearch: '搜索',
      skillSearching: '搜索中…',
      skillNoResults: '没有匹配的 skill',
      skillSelect: '选择',
      skillSelected: '已选择',
      skillName: '名称',
      skillDescription: '描述',
      skillInstructions: '技能内容',
      skillReason: '注入原因',
      skillReasonPlaceholder: '为什么这个 skill 适合该角色',
      skillInjectAction: '注入技能',
      skillInjecting: '注入中…',
      skillInjected: '技能已注入',
      skillExisting: '已注入技能',
      skillEmpty: '尚未注入技能',
      skillSourceFramework: '环境',
      skillSourceCustom: '自定义',
      skillRequired: '请选择 skill，或填写自定义名称和内容，并填写原因',
      skillUpload: '从本地文件导入',
      skillUploadHint: '支持 Markdown（可选 YAML frontmatter）、纯文本和 JSON；不超过 64KB。',
      skillUploaded: '已读取文件',
      skillFileTooLarge: '文件不能超过 64KB',
      skillFileReadError: '读取 skill 文件失败',
      leadModel: '组长模型',
      leadModelHint: '选择后立即切换组长会话，并保存为下次组长会话使用的模型。',
      leadModelLoading: '正在读取模型目录…',
      leadModelError: '模型目录读取失败',
      leadModelSaved: '组长模型已切换',
      leadModelScope: '可选模型范围',
      leadModelScopeHint: '只允许组长从勾选的 DSH 已配置模型中选择；至少保留一个。',
      leadModelScopeAll: '全选',
      leadModelScopeEmpty: '至少选择一个模型',
      leadModelSaveScope: '保存可选范围',
      leadModelScopeSaving: '保存中…',
      leadModelScopeSaved: '可选模型范围已保存',
      leadReasoningDefault: '默认思考强度',
      auditSetManager: '调整汇报关系',
      auditAddHandoff: '增加交接',
      auditRemoveHandoff: '移除交接',
      auditTempRelation: '临时关系',
      memberCount: '{count} 位成员',
      teamSettings: '团队设置',
      roleTemplates: '角色模板',
      templateHint: '从内置或自定义模板快速创建成员；使用后仍可调整姓名、汇报对象和提示词。',
      templateBuiltin: '内置',
      templateCustom: '自定义',
      useTemplate: '使用',
      blankRole: '空白角色',
      newTemplate: '新建模板',
      templateName: '模板名称',
      templateNamePlaceholder: '例如：数据工程师',
      templateResponsibilities: '模板职责',
      templateAuthority: '模板具体职权',
      templateBoundaries: '模板禁止边界',
      templateInstructions: '模板工作准则',
      templateSave: '保存模板',
      templateSaving: '正在保存…',
      templateCreated: '模板已保存',
      templateDeleted: '模板已删除',
      templateDelete: '删除',
      templateEmpty: '还没有模板。先新建一个，或直接创建空白角色。',
      addMember: '添加成员',
      addRelation: '添加关系',
      autoLayout: '自动布局',
      showExtraRelations: '显示附加关系',
      hideExtraRelations: '隐藏附加关系',
      zoomControls: '拓扑缩放',
      zoomIn: '放大',
      zoomOut: '缩小',
      fitGraph: '适应',
      fullscreen: '全屏',
      exitFullscreen: '退出全屏',
      layoutSaved: '图谱位置已保存',
      relationEdit: '编辑关系',
      relationSelfError: '关系的起点和终点不能是同一个人。',
      relationFrom: '起点',
      relationTo: '终点',
      relationType: '关系类型',
      relationLabel: '关系说明',
      relationLabelPlaceholder: '例如：季度目标协作',
      relationExpires: '到期时间',
      relationExpiresHint: '到期后不再进入组长与组员的协作上下文；关系记录仍保留，可手动删除。',
      relationNoExpiry: '手动移除前有效',
      relationSave: '保存关系',
      relationSaving: '正在保存…',
      relationDelete: '删除关系',
      relationDeleteConfirm: '确定删除这条关系？',
      relationDeleteYes: '确认删除',
      relationDeleteNo: '保留',
      relationSaved: '关系已保存',
      relationDeleted: '关系已删除',
      relationAdditional: '附加关系',
      relationNone: '暂无附加关系',
      relationPrimary: '主汇报',
      relationReports: '附加汇报',
      relationCollaborates: '协作',
      relationTemporary: '临时',
      relationHandoff: '交接',
      relationExpired: '已过期',
      relationManual: '手动移除前有效',
      relationUntil: '至 {time}',
      relationGraphHint: '主汇报线之外可添加多重、交叉或临时关系；点击图谱连线可编辑。',
      relationSelectHint: '选择一条连线，或点击「添加关系」。',
      roleLimit: '最多 {count} 位成员',
      leadCurrent: '当前会话',
      leadHint: '用户唯一直接对话的人',
      teamName: '团队名称',
      leadLabel: '组长称呼',
      leadDesc: '组长说明',
      settingsHint: '组织架构的修改只影响之后发起的委派，正在执行的组员不会被打断。',
      orgHint: '点击成员查看职责，或调整他的汇报对象。',
      noRoles: '还没有组员',
      noResponsibilities: '暂无职责说明',
      noRolesHint: '添加一位组员，组长才能开始分配工作。你也可以先向组长下达一个简单任务。',
      save: '保存更改',
      saving: '正在保存…',
      saved: '已保存',
      cancel: '取消',
      deleteRole: '删除成员',
      confirmDeleteTitle: '确定删除「{name}」？',
      confirmDeleteDesc: '删除后无法恢复；与该成员相关的附加关系也会一并移除。',
      confirmDeleteMove: '其直接下属将改为向「{manager}」汇报。',
      confirmDeleteYes: '确认删除',
      confirmDeleteKeep: '保留成员',
      newMember: '新成员',
      newRole: '新角色',
      selectRole: '选择一个角色',
      selectRoleHint: '查看职责、调整汇报关系，或添加新的角色。',
      roleId: '角色 ID',
      name: '姓名',
      roleTitle: '角色名称',
      roleLevel: '岗位级别',
      thinkingEffort: '思考强度',
      levelCaptain: '队长',
      levelMember: '队员',
      reportsTo: '汇报对象',
      status: '状态',
      enabled: '启用',
      disabled: '停用',
      accent: '头像颜色',
      responsibilities: '职责摘要',
      instructions: '工作准则',
      responsibilitiesHint: '出现在组长的组织名单中，保持简短。',
      instructionsHint: '会完整注入给该组员，写清边界、方法和交付要求。',
      idHint: '创建后保持不变，组长调度时使用。',
      managerHint: '不能把成员汇报给自身或其下属。',
      unsavedBlocked: '请先保存或取消当前修改，再切换成员。',
      activityHint: '组长调用 team_assign 后，委派和结果会实时出现在这里。',
      noActivity: '还没有委派记录',
      noActivityHint: '向组长下达任务后，组长对组员的委派会显示在这里。',
      task: '任务',
      result: '结果',
      diagnostic: '诊断',
      duration: '耗时',
      childSession: '组员会话',
      statusRunning: '执行中',
      statusCompleted: '已完成',
      statusFailed: '失败',
      statusAborted: '已中止',
      statusPending: '等待中',
      loading: '正在加载协作组…',
      loadFailed: '无法加载组织架构',
      retry: '重试',
      saveFailed: '保存失败',
      conflictTitle: '组织架构已更新',
      conflictText: '另一个窗口或会话修改了组织架构。你的修改仍在这里，但需要先载入最新版本才能继续保存。',
      reloadLatest: '载入最新版本，放弃我的修改',
      keepMine: '保留我的修改',
      discardTitle: '有未保存的修改',
      discardText: '关闭后会丢失当前编辑。',
      keepEditing: '继续编辑',
      discardClose: '放弃并关闭',
      warningTitle: '提示',
      durationInstant: '不足 1 秒',
      durationSeconds: '{count} 秒',
      durationMinutes: '{minutes} 分 {seconds} 秒',
      durationHours: '{hours} 小时 {minutes} 分',
      created: '创建于 {time}',
      serviceUnavailable: '协作组服务暂不可用，请刷新页面后重试。',
      saveFirst: '先保存当前修改',
      roleCreated: '成员已添加',
      roleDeleted: '成员已删除',
      roleDisabled: '角色已停用',
      changesSaved: '组织架构已保存',
      idCopied: '角色 ID 已复制',
      copyId: '复制角色 ID',
      apiOffline: '未找到协作组接口。插件可能尚未加载，请刷新页面。',
      closeNotice: '关闭提示',
    };

    const en = {
      trigger: 'Team Org',
      workspaceLabel: 'Workspace',
      workspaceUnknown: 'No workspace',
      setupTitle: 'Establish the initial team',
      setupPreviewShow: 'Show relationship graph',
      setupPreviewHide: 'Hide relationship graph',
      setupIntro: 'This workspace does not have Team Org enabled yet. Confirm the team name, roles, and reporting lines first. After that, the user only needs to brief the lead.',
      setupWorkspace: 'Current workspace',
      setupTeamName: 'Team name',
      setupRoles: 'Initial roles',
      setupRolesHint: 'Default role prompts are preloaded and editable here; they remain editable after setup.',
      setupPrompts: 'Default prompt',
      setupResponsibilities: 'Responsibility summary',
      setupInstructions: 'Role prompt',
      setupEnable: 'Create team and enable',
      setupEnabling: 'Enabling…',
      setupAtLeastOne: 'Enable at least one role',
      setupDefaultNote: 'The initial team contains only the lead. After setup the lead creates members directly; default names use position-number.',
      setupSaved: 'Team Org enabled',
      setupRequiredShort: 'Not enabled',
      relationshipTopology: 'Relationship topology',
      topologyHint: 'Lines show reporting relationships; tasks flow along the reporting path to the member, and nodes show the latest collaboration state. Drag the small handle below a role onto another role to create an additional or temporary relation.',
      topologyLegendLead: 'Lead',
      topologyLegendMember: 'Member',
      topologyLegendActive: 'Collaborating',
      topologyLegendReport: 'Reports',
      topologyLegendCollab: 'Collaborates',
      topologyLegendTemp: 'Temporary',
      exportImage: 'Export image',
      exportImageTitle: 'Team relationship map',
      exportImageSubtitle: 'Reporting backbone + collaboration relations',
      exportImageLegendLead: 'Lead',
      exportImageLegendCaptain: 'Captain',
      exportImageLegendMember: 'Member',
      exportImageLegendReport: 'Reporting',
      exportImageLegendCollab: 'Collaboration',
      exportImageLegendHandoff: 'Handoff',
      exportImageLegendTemp: 'Temporary',
      exportImageLegendExpired: 'Expired',
      exportImageExplainTitle: 'Legend & notes',
      exportResponsibilityTitle: 'Role responsibilities',
      exportTableRole: 'Role',
      exportTableMember: 'Member',
      exportTableDuty: 'Responsibilities',
      exportTableManager: 'Reports to',
      exportImageMemberCount: 'members',
      exportImageBusy: 'Exporting…',
      exportImageExplain1: 'Orange is the lead; solid arrows are fixed reporting lines; dashed lines are collaboration or handoff; dotted lines are temporary relations.',
      exportImageExplain2: 'Arrows point to the manager/receiver. Expired temporary relations remain visible but no longer enter the active context.',
      exportImageExplain3: 'This graph is coordination context, not an access-control policy; managers still assign and accept work by role.',
      exportImageExtraShown: 'Extra relations included',
      exportImageExtraHidden: 'Extra relations hidden',
      exportImageFailed: 'Could not export image',
      topologyLegendFlow: 'Task flow',
      topologyNoRuns: 'No collaboration yet',
      topologyDragRelation: 'Drag to create relation',
      roleActions: 'Role actions',
      editRole: 'Edit',
      copyMember: 'Copy member',
      roleCopied: 'Copy of “{name}” created; save to add it',
      workspaceScoped: 'Applies to this workspace only',
      hostRestartRequired: 'The Host is still an older version. Restart DSH to enable workspace onboarding, the relationship graph, and temporary relations.',
      workspaceDisabled: 'Team Org is disabled in this workspace. Re-enable it from the workspace folder menu.',
      menuEnable: 'Enable Team Org',
      menuDisable: 'Disable Team Org',
      menuLoading: 'Team Org…',
      menuNeedRestart: 'Team Org (Host restart needed)',
      enableConfirmTitle: 'Enable Team Org?',
      enableConfirmText: 'All sessions in this workspace will be archived, then a new lead session will open for setup. Running sessions will be stopped.',
      enableConfirmCancel: 'Cancel',
      enableConfirmAction: 'Archive and enable',
      enabling: 'Archiving and creating the lead session…',
      enableFailed: 'Could not enable Team Org',
      disableFailed: 'Could not disable Team Org',
      menuEnabled: 'Team Org enabled',
      menuDisabled: 'Team Org disabled',
      openTeamView: 'Open Team Org view',
      openSession: 'Open member session',
      openSessionTitle: 'Open this member’s separate AI session',
      repairSessions: 'Repair member sessions',
      repairingSessions: 'Repairing…',
      designTeam: 'Design team relationships',
      designingTeam: 'Designing team relationships…',
      designTeamDone: 'Team relationship design completed',
      midprojectReport: 'Mid-project report',
      midprojectReporting: 'Generating mid-project report…',
      midprojectReportDone: 'Mid-project report sent; continue asking questions in chat',
      midprojectReportFailed: 'Could not generate mid-project report',
      designTeamFailed: 'Could not design team relationships',
      repairDone: 'Member sessions repaired',
      repairFailed: 'Could not repair member sessions',
      sessionUnavailable: 'Session not created yet',
      collaborationProcess: 'Collaboration',
      taskTimer: 'Current task',
      taskRunning: 'Running',
      taskFinished: 'Finished',
      taskNoTitle: 'Untitled task',
      teamChat: 'Team chat',
      chatWidth: 'Resize team chat',
      collapseChat: 'Collapse team chat',
      expandChat: 'Expand team chat',
      teamChatHint: 'Live assignments, execution, and returned results between the lead and members.',
      teamChatEmpty: 'No collaboration conversation yet',
      teamChatLead: 'Lead',
      teamChatMember: 'Member',
      teamChatWaiting: 'Running; waiting for the member…',
      teamChatUpdated: 'Updated {time}',
      teamChatOpen: 'Open session',
      teamChatUser: 'User',
      teamChatHistory: 'Recent conversation',
      teamChatMessages: '{count} messages',
      teamChatLoading: 'Loading collaboration…',
      collaborationHint: 'Recent assignments, member sessions, and returned results in this workspace.',
      assigned: 'Lead assigned',
      returned: 'Result returned',
      processSession: 'Member session',
      activeCollaboration: 'Collaborating',
      activeCollaborationHint: 'The lead is waiting for “{name}”.',
      noActive: 'No active collaboration',
      triggerAria: 'Open team organization',
      title: 'Team Org',
      subtitle: 'You brief the lead. The lead assigns work to the right members through the org chart.',
      close: 'Close',
      refresh: 'Refresh',
      tabOrg: 'Organization',
      tabActivity: 'Collaboration',
      tabAudit: 'Decisions',
      tabUsage: 'Tokens & cost',
      usageTitle: 'Token usage & cost',
      usageHint: 'Historical tokens by member; prices are fetched automatically from models.dev and applied per model.',
      usageAutoPricing: 'Automatic pricing',
      usageRulesTitle: 'Billing rules',
      usageRulesModel: 'Prices are fetched from models.dev (USD per 1M tokens) and converted at 1 USD ≈ {rate} CNY (FX source: {source}).',
      usageRulesFormula: 'Cost = (input tokens − cache-read tokens) × input price + cache-read tokens × cache price + output tokens × output price.',
      usageRulesPeak: 'DeepSeek peak: 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday, excluding Chinese public holidays. All other hours are off-peak at 50% of peak.',
      usageRulesNote: 'Cache writes count as input; unmatched models cost 0; estimates only, provider billing prevails.',
      usageAutoPricingHint: 'Prices come from models.dev; a bundled snapshot is used offline.',
      usageTotal: 'Team total',
      usageInput: 'Input',
      usageOutput: 'Output',
      usageCacheRead: 'Cache read',
      usageCacheWrite: 'Cache write',
      usageTotalTokens: 'Total tokens',
      usageCost: 'Cost',
      usageByModel: 'Cost by model',
      usageModel: 'Model',
      usageModelInput: 'Input',
      usageModelOutput: 'Output',
      usageModelCache: 'Cache',
      usageModelTotal: 'Total',
      usageModelEmpty: 'No model usage yet',
      usageTurns: 'Calls',
      usageMember: 'Member',
      usageLead: 'Lead',
      usageEmpty: 'No token records yet',
      usageLoading: 'Collecting tokens…',
      usagePriceTitle: 'Price settings',
      usagePriceHint: 'Rates are per million tokens and are used for cost calculation.',
      usageInputPrice: 'Input price / 1M tokens',
      usageOutputPrice: 'Output price / 1M tokens',
      usageCurrency: 'Currency',
      usageSavePrice: 'Save prices',
      usageSavingPrice: 'Saving…',
      usagePriceSaved: 'Prices saved',
      usageNotConfigured: 'No rates configured; cost shown as 0',
      usageCacheNote: 'Cost uses input/output tokens; cache tokens are shown separately.',
      auditTitle: 'Work & personnel decisions',
      auditHint: 'Every assignment, personnel change, and relation change, with its reason.',
      auditEmpty: 'No decisions recorded yet',
      auditReason: 'Reason',
      auditWork: 'Work',
      auditPersonnel: 'Personnel',
      auditRelation: 'Relation',
      auditAssign: 'Assign task',
      auditCreateMember: 'Create member',
      auditCreateGroup: 'Create module group',
      auditFire: 'Fire member',
      auditPark: 'Park member',
      auditRestore: 'Restore member',
      auditEffort: 'Set effort',
      auditSkill: 'Inject skill',
      auditProjectSummary: 'Project summary',
      auditStageSummary: 'Stage summary',
      auditProject: 'Project experience',
      auditSelectModel: 'Lead model switch',
      auditRemoveTemporary: 'Disconnect temporary relation',
      skillInjectTitle: 'Skill injection',
      skillInjectHint: 'Select an installed skill or author one for this role; injected skills enter its identity and future task prompts.',
      skillInstalled: 'Installed skill',
      skillCustom: 'Custom skill',
      skillSearchPlaceholder: 'Search skill name, description, or when-to-use',
      skillSearch: 'Search',
      skillSearching: 'Searching…',
      skillNoResults: 'No matching skill',
      skillSelect: 'Select',
      skillSelected: 'Selected',
      skillName: 'Name',
      skillDescription: 'Description',
      skillInstructions: 'Skill content',
      skillReason: 'Reason',
      skillReasonPlaceholder: 'Why this skill fits this role',
      skillInjectAction: 'Inject skill',
      skillInjecting: 'Injecting…',
      skillInjected: 'Skill injected',
      skillExisting: 'Injected skills',
      skillEmpty: 'No skills injected yet',
      skillSourceFramework: 'Installed',
      skillSourceCustom: 'Custom',
      skillRequired: 'Select a skill or provide custom name/content, and a reason',
      skillUpload: 'Import local file',
      skillUploadHint: 'Markdown (optional YAML frontmatter), plain text, or JSON; max 64KB.',
      skillUploaded: 'File loaded',
      skillFileTooLarge: 'File must be 64KB or smaller',
      skillFileReadError: 'Could not read the skill file',
      leadModel: 'Lead model',
      leadModelHint: 'Switches the lead session immediately and is saved for future lead sessions.',
      leadModelLoading: 'Loading model catalog…',
      leadModelError: 'Could not load model catalog',
      leadModelSaved: 'Lead model switched',
      leadModelScope: 'Allowed models',
      leadModelScopeHint: 'The lead may only choose from checked DSH-configured models. Keep at least one.',
      leadModelScopeAll: 'Select all',
      leadModelScopeEmpty: 'Select at least one model',
      leadModelSaveScope: 'Save allowed models',
      leadModelScopeSaving: 'Saving…',
      leadModelScopeSaved: 'Allowed models saved',
      leadReasoningDefault: 'Default reasoning effort',
      auditSetManager: 'Change manager',
      auditAddHandoff: 'Add handoff',
      auditRemoveHandoff: 'Remove handoff',
      auditTempRelation: 'Temporary relation',
      memberCount: '{count} members',
      teamSettings: 'Team settings',
      roleTemplates: 'Role templates',
      templateHint: 'Create a member from a built-in or custom template; the name, manager, and prompt remain editable.',
      templateBuiltin: 'Built-in',
      templateCustom: 'Custom',
      useTemplate: 'Use',
      blankRole: 'Blank role',
      newTemplate: 'New template',
      templateName: 'Template name',
      templateNamePlaceholder: 'e.g. Data engineer',
      templateResponsibilities: 'Template responsibilities',
      templateAuthority: 'Template authority',
      templateBoundaries: 'Template boundaries',
      templateInstructions: 'Template working instructions',
      templateSave: 'Save template',
      templateSaving: 'Saving…',
      templateCreated: 'Template saved',
      templateDeleted: 'Template deleted',
      templateDelete: 'Delete',
      templateEmpty: 'No templates yet. Create one, or add a blank role.',
      addMember: 'Add member',
      addRelation: 'Add relation',
      autoLayout: 'Auto layout',
      showExtraRelations: 'Show extra relations',
      hideExtraRelations: 'Hide extra relations',
      zoomControls: 'Topology zoom',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fitGraph: 'Fit',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      layoutSaved: 'Graph positions saved',
      relationEdit: 'Edit relation',
      relationSelfError: 'A relation cannot start and end at the same member.',
      relationFrom: 'From',
      relationTo: 'To',
      relationType: 'Relation type',
      relationLabel: 'Description',
      relationLabelPlaceholder: 'e.g. quarterly goal collaboration',
      relationExpires: 'Expires',
      relationExpiresHint: 'After expiry the relation leaves the lead/member collaboration context but stays recorded until removed.',
      relationNoExpiry: 'Until manually removed',
      relationSave: 'Save relation',
      relationSaving: 'Saving…',
      relationDelete: 'Delete relation',
      relationDeleteConfirm: 'Delete this relation?',
      relationDeleteYes: 'Delete relation',
      relationDeleteNo: 'Keep',
      relationSaved: 'Relation saved',
      relationDeleted: 'Relation deleted',
      relationAdditional: 'Additional relations',
      relationNone: 'No additional relations',
      relationPrimary: 'Primary reporting',
      relationReports: 'Additional reporting',
      relationCollaborates: 'Collaboration',
      relationTemporary: 'Temporary',
      relationHandoff: 'Handoff',
      relationExpired: 'Expired',
      relationManual: 'Until manually removed',
      relationUntil: 'until {time}',
      relationGraphHint: 'Beyond the primary reporting line, add multiple, cross-level, or temporary links; click a line in the graph to edit it.',
      relationSelectHint: 'Select a line, or choose Add relation.',
      roleLimit: 'At most {count} members',
      leadCurrent: 'Current chat',
      leadHint: 'The only member the user talks to',
      teamName: 'Team name',
      leadLabel: 'Lead label',
      leadDesc: 'Lead description',
      settingsHint: 'Organization changes apply to future delegations; running members are not interrupted.',
      orgHint: 'Select a member to inspect their role or change their manager.',
      noRoles: 'No members yet',
      noResponsibilities: 'No responsibility summary',
      noRolesHint: 'Add a member so the lead can assign work. You can still give the lead a simple task.',
      save: 'Save changes',
      saving: 'Saving…',
      saved: 'Saved',
      cancel: 'Cancel',
      deleteRole: 'Delete member',
      confirmDeleteTitle: 'Delete “{name}”?',
      confirmDeleteDesc: 'This cannot be undone; additional relations involving this member are removed too.',
      confirmDeleteMove: 'Direct reports will move to “{manager}”.',
      confirmDeleteYes: 'Delete member',
      confirmDeleteKeep: 'Keep member',
      newMember: 'New member',
      newRole: 'New role',
      selectRole: 'Select a role',
      selectRoleHint: 'Inspect responsibilities, change reporting lines, or add a new role.',
      roleId: 'Role ID',
      name: 'Name',
      roleTitle: 'Role title',
      roleLevel: 'Position level',
      thinkingEffort: 'Reasoning effort',
      levelCaptain: 'Captain',
      levelMember: 'Member',
      reportsTo: 'Reports to',
      status: 'Status',
      enabled: 'Enabled',
      disabled: 'Disabled',
      accent: 'Avatar color',
      responsibilities: 'Responsibility summary',
      instructions: 'Working instructions',
      responsibilitiesHint: 'Appears in the lead’s roster. Keep it short.',
      instructionsHint: 'Injected into every delegation to this member. State boundaries, method, and expected output.',
      idHint: 'Stable after creation; the lead uses it when delegating.',
      managerHint: 'A member cannot report to themselves or to their own report.',
      unsavedBlocked: 'Save or cancel the current edits before selecting another member.',
      activityHint: 'Delegations and results appear here as the lead calls team_assign.',
      noActivity: 'No delegations yet',
      noActivityHint: 'Give the lead a task, and its assignments to members will show up here.',
      task: 'Task',
      result: 'Result',
      diagnostic: 'Diagnostic',
      duration: 'Duration',
      childSession: 'Member chat',
      statusRunning: 'Running',
      statusCompleted: 'Completed',
      statusFailed: 'Failed',
      statusAborted: 'Stopped',
      statusPending: 'Pending',
      loading: 'Loading team organization…',
      loadFailed: 'Could not load the organization',
      retry: 'Retry',
      saveFailed: 'Could not save',
      conflictTitle: 'Organization changed',
      conflictText: 'Another window or session changed the organization. Your edits are still here; load the latest version before saving again.',
      reloadLatest: 'Load latest and discard my edits',
      keepMine: 'Keep my edits',
      discardTitle: 'Unsaved changes',
      discardText: 'Closing now will lose the current edits.',
      keepEditing: 'Keep editing',
      discardClose: 'Discard and close',
      warningTitle: 'Notice',
      durationInstant: 'under 1s',
      durationSeconds: '{count}s',
      durationMinutes: '{minutes}m {seconds}s',
      durationHours: '{hours}h {minutes}m',
      created: 'Created {time}',
      serviceUnavailable: 'Team Org is unavailable. Refresh the page and try again.',
      saveFirst: 'Save the current changes first',
      roleCreated: 'Member added',
      roleDeleted: 'Member deleted',
      roleDisabled: 'Role disabled',
      changesSaved: 'Organization saved',
      idCopied: 'Role ID copied',
      copyId: 'Copy role ID',
      apiOffline: 'Team Org API was not found. The plugin may not be loaded yet; refresh the page.',
      closeNotice: 'Dismiss notice',
    };

    const css = `
:root{--ao-team-chat-width:clamp(320px,34vw,420px);--ao-team-chat-right:0px}
body.ao-team-chat-open .wSkVaW_body{width:calc(100% - var(--ao-team-chat-width))!important;max-width:calc(100% - var(--ao-team-chat-width))!important;box-sizing:border-box;align-self:flex-start}
.ao_teamChatReopen{position:fixed;z-index:6;top:var(--ao-team-chat-top,76px);right:0;display:flex;align-items:center;gap:6px;padding:10px 8px;border:1px solid var(--dsw-alias-border-l2);border-right:0;border-radius:10px 0 0 10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:-6px 0 18px color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);cursor:pointer;font:inherit;font-size:12px}
.ao_teamChatReopen:hover{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.ao_teamChatReopenArrow{font-size:18px;line-height:1}
.ao_teamChatHeaderActions{display:flex;align-items:center;gap:6px;flex:none}
.ao_teamChatPane{position:fixed;z-index:0;top:var(--ao-team-chat-top,76px);right:var(--ao-team-chat-right,0px);bottom:0;width:var(--ao-team-chat-width);display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1);border-left:.5px solid var(--dsw-alias-border-l2);box-shadow:-8px 0 24px color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}
.ao_teamChatResizer{position:absolute;left:0;top:0;bottom:0;width:7px;cursor:col-resize;z-index:5;touch-action:none;background:transparent}
.ao_teamChatResizer:before{content:'';position:absolute;left:2px;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l2);opacity:.7}
.ao_teamChatResizer:hover:before,.ao_teamChatResizer:focus-visible:before{width:2px;background:var(--dsw-alias-state-business-primary);opacity:1}
.ao_teamChatResizer:focus-visible{outline:none}
.ao_teamChatPane .ao_groupPanel{width:100%;max-width:none;margin:0;padding:16px 12px 24px;height:100%;min-height:0;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;gap:0;flex:1}
.ao_teamChatPane .ao_groupHeader{flex:none;position:relative;z-index:2;padding:4px 2px 10px;background:var(--dsw-alias-bg-layer-1)}
.ao_teamChatPane .ao_groupMsg{max-width:96%}
@media (max-width:980px){:root{--ao-team-chat-width:clamp(250px,34vw,330px)}}
@media (max-width:760px){:root{--ao-team-chat-width:clamp(240px,42vw,300px)}}

.ao_groupScroll{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;-webkit-overflow-scrolling:touch;padding-right:2px}
.ao_teamChatPane .ao_groupScroll{padding-bottom:8px}
.ao_groupPanel{width:min(900px,100%);margin:0 auto;padding:20px 20px 32px;display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary);font-family:inherit}
.ao_groupHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.ao_groupTitle{font-size:18px;line-height:26px;font-weight:600;margin:0}
.ao_groupSub{font-size:12px;line-height:19px;color:var(--dsw-alias-label-tertiary);margin:4px 0 0}
.ao_groupActive{display:inline-flex;align-items:center;gap:7px;align-self:flex-start;border:.5px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-1);border-radius:999px;padding:3px 9px;color:var(--dsw-alias-state-business-primary);font-size:11px;line-height:17px}
.ao_groupError{border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,var(--dsw-alias-border-l2));color:var(--dsw-alias-state-error-primary);border-radius:8px;padding:8px 10px;font-size:11px;line-height:17px}
.ao_groupEmpty{border:.5px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:34px 20px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:19px;display:flex;flex-direction:column;align-items:center;gap:5px}
.ao_groupEmpty p{margin:0;max-width:460px;font-size:11px;line-height:17px}
.ao_groupWorkspace{border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.ao_groupWorkspaceHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;background:var(--dsw-alias-bg-layer-2);border-bottom:.5px solid var(--dsw-alias-border-l1);font-size:12px;line-height:18px}
.ao_groupHeaderMeta{font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.ao_groupHistory{border-top:.5px solid var(--dsw-alias-border-l1);padding:10px 13px;display:flex;flex-direction:column;gap:8px}
.ao_groupHistoryTitle{font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin-bottom:1px}
.ao_groupMsgRow{display:flex;flex-direction:column}
.ao_groupEmptyInline{padding:14px 13px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}
.ao_groupBadge{font-size:10px;line-height:16px;border-radius:999px;padding:0 6px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);color:var(--dsw-alias-state-business-primary)}
.ao_groupTurn{display:flex;flex-direction:column;gap:8px;padding:13px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.ao_groupTurn:last-child{border-bottom:0}
.ao_groupMsg{max-width:86%;border:.5px solid var(--dsw-alias-border-l2);border-radius:11px;padding:9px 11px;background:var(--dsw-alias-bg-layer-2)}
.ao_groupLeadMsg{align-self:flex-start;border-top-left-radius:4px;background:var(--dsw-alias-bg-layer-2)}
.ao_groupMemberMsg{align-self:flex-end;border-top-right-radius:4px;background:var(--dsw-alias-bg-layer-1);min-width:0}
.ao_groupMsgRunning{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,var(--dsw-alias-border-l2))}
.ao_groupMsgHead{display:flex;align-items:center;gap:6px;min-width:0;margin-bottom:5px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px}
.ao_groupMsgHead strong{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ao_groupMsgHead time{margin-left:auto;white-space:nowrap;color:var(--dsw-alias-label-caption)}
.ao_groupAvatar{flex:none;width:19px;height:19px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:9px;font-weight:600}
.ao_groupAvatarLead{color:#D9822B;background:color-mix(in srgb,#D9822B 11%,transparent)}
.ao_groupRole{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px}
.ao_groupText{margin:0;font-size:12px;line-height:19px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere;max-height:none;overflow:visible}
.ao_groupResult{color:var(--dsw-alias-label-secondary);max-height:none}
.ao_md{font-size:12px;line-height:19px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.ao_md p{margin:0 0 6px}
.ao_md p:last-child{margin-bottom:0}
.ao_md h1,.ao_md h2,.ao_md h3,.ao_md h4,.ao_md h5,.ao_md h6{margin:8px 0 4px;line-height:1.35;color:var(--dsw-alias-label-primary)}
.ao_md h1{font-size:17px}.ao_md h2{font-size:15px}.ao_md h3{font-size:13.5px}.ao_md h4,.ao_md h5,.ao_md h6{font-size:12.5px}
.ao_md ul,.ao_md ol{margin:3px 0 7px;padding-left:19px}
.ao_md li{margin:2px 0}
.ao_md blockquote{margin:5px 0;padding:3px 9px;border-left:2px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}
.ao_md pre{margin:6px 0;padding:8px 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);overflow:auto;white-space:pre}
.ao_md code{font-family:var(--ds-font-family-code,monospace);font-size:11px;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 4px}
.ao_md pre code{padding:0;background:transparent;font-size:11px;line-height:1.55}
.ao_md a{color:var(--dsw-alias-state-business-primary);text-decoration:underline;text-underline-offset:2px}
.ao_md hr{border:0;border-top:.5px solid var(--dsw-alias-border-l2);margin:7px 0}
.ao_groupArrow{color:var(--dsw-alias-label-tertiary);margin-right:5px}
.ao_groupActions{display:flex;justify-content:flex-end;gap:6px;margin-top:6px}
@media (max-width:620px){.ao_groupPanel{padding:14px 12px 24px}.ao_groupMsg{max-width:96%}.ao_groupRole{display:none}}
.ao_workspacePill{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ao_workspacePill code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 4px}
.ao_topologyScroll{overflow:auto;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:9px 4px 4px;margin-bottom:14px;scrollbar-gutter:stable;cursor:grab;user-select:none;touch-action:none}
.ao_topologyScrollPanning{cursor:grabbing}
.ao_topologyCanvas{position:relative;margin:0;min-height:272px;touch-action:none}
.ao_edges{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:0;touch-action:none}
.ao_edge{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:1.3}
.ao_edgeExtra{stroke:var(--dsw-alias-label-tertiary);stroke-width:1.25}
.ao_edgeExtraReports{stroke:#6E8BFF;stroke-dasharray:2 3}
.ao_edgeHandoff{stroke:#7C6CFF;stroke-width:1.8;stroke-dasharray:8 4}
.ao_edgeCollab{stroke:#2E9E7B;stroke-dasharray:6 4}
.ao_edgeTemp{stroke:#D9822B;stroke-dasharray:2 5;animation:aoDash 1.1s linear infinite}
.ao_edgeExpired{opacity:.35;animation:none}
.ao_edgeSelected{stroke-width:2.4;stroke:var(--dsw-alias-state-business-primary)}
.ao_edgesHover .ao_edge{opacity:.2}
.ao_edgesHover .ao_edgeHovered{opacity:1;stroke-width:3;filter:drop-shadow(0 0 4px color-mix(in srgb,currentColor 40%,transparent))}
.ao_edgeDimmed{opacity:.2}
.ao_edgeProcess{stroke-width:2}
.ao_edgeRunning{stroke:var(--dsw-alias-state-business-primary);stroke-dasharray:6 5;animation:aoDash 1.05s linear infinite}
.ao_edgeDone{stroke:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary));stroke-width:1.9}
.ao_edgeFailed{stroke:var(--dsw-alias-state-error-primary);stroke-width:2;stroke-dasharray:3 4}
.ao_edgeProcessMuted{opacity:.46;animation:none}
.ao_edgeFlow{fill:var(--dsw-alias-state-business-primary);stroke:none;filter:drop-shadow(0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent))}
.ao_edgeProcessBadge{position:absolute;z-index:2;display:inline-flex;align-items:center;gap:3px;transform:translate(-50%,-50%);border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));padding:1px 5px;font-size:8.5px;line-height:13px;color:var(--dsw-alias-label-secondary);white-space:nowrap;pointer-events:none;box-shadow:0 2px 6px color-mix(in srgb,#000 8%,transparent)}
.ao_edgeProcessBadgeRunning{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,var(--dsw-alias-border-l2));color:var(--dsw-alias-state-business-primary)}
.ao_edgeProcessBadgeDone{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary)) 42%,var(--dsw-alias-border-l2));color:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary))}
.ao_edgeProcessBadgeFailed{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 42%,var(--dsw-alias-border-l2));color:var(--dsw-alias-state-error-primary)}
.ao_edgeHit{fill:none;stroke:transparent;stroke-width:18;pointer-events:stroke;cursor:pointer}
.ao_node{position:absolute;display:flex;flex-direction:column;align-items:flex-start;gap:3px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));padding:7px 8px;min-width:0;height:70px;cursor:pointer;font-family:inherit;color:var(--dsw-alias-label-primary);text-align:left;transition:border-color .12s,box-shadow .12s,background .12s;z-index:1}
.ao_node{touch-action:none;user-select:none}
.ao_node:active{cursor:grabbing}
.ao_nodeDragging{opacity:.86;box-shadow:0 10px 28px color-mix(in srgb,#000 18%,transparent)!important;z-index:4}
.ao_node:hover,.ao_node:focus-visible{border-color:var(--dsw-alias-border-l3);box-shadow:var(--dsw-elevation-panel)}
.ao_nodeLead{background:linear-gradient(145deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,var(--dsw-alias-bg-layer-1)),var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 42%,var(--dsw-alias-border-l2))}
.ao_nodeSelected{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 68%,var(--dsw-alias-border-l2));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 32%,transparent)}
.ao_nodeActive{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 58%,var(--dsw-alias-border-l2));box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.ao_nodeRunRunning{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 64%,var(--dsw-alias-border-l2));box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent)}
.ao_nodeRunCompleted{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary)) 45%,var(--dsw-alias-border-l2))}
.ao_nodeRunFailed{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 52%,var(--dsw-alias-border-l2));box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.ao_nodeConnectTarget{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}
.ao_nodePort{position:absolute;z-index:3;width:12px;height:12px;border-radius:4px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;justify-content:center;padding:0;font:inherit;font-size:9px;line-height:1;cursor:crosshair;transform:translateX(-50%);touch-action:none;user-select:none;transition:border-color .12s,color .12s,box-shadow .12s}
.ao_nodePort:hover,.ao_nodePort:focus-visible,.ao_nodePortDragging{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);outline:none}
.ao_canvasActions{position:absolute;top:8px;left:8px;z-index:6;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ao_canvasActionActive{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,var(--dsw-alias-bg-layer-1))}
.ao_canvasAction{display:inline-flex;align-items:center;gap:5px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-secondary);padding:4px 8px;font:inherit;font-size:11px;line-height:17px;cursor:pointer;box-shadow:0 2px 8px color-mix(in srgb,#000 9%,transparent)}
.ao_canvasAction:hover,.ao_canvasAction:focus-visible{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);outline:none}
.ao_canvasAction:disabled{opacity:.55;cursor:default}
.ao_nodeMenuButton{position:absolute;z-index:4;width:17px;height:17px;border-radius:5px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;justify-content:center;padding:0;font:inherit;font-size:13px;line-height:1;cursor:pointer;box-shadow:0 1px 3px color-mix(in srgb,#000 8%,transparent)}
.ao_nodeMenuButton:hover,.ao_nodeMenuButton:focus-visible{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);outline:none}
.ao_nodeMenu{position:fixed;z-index:180;min-width:154px;padding:4px;border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);font-family:inherit;animation:aoPop .12s ease-out}
.ao_nodeMenuTitle{padding:5px 8px 6px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);border-bottom:.5px solid var(--dsw-alias-border-l1);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:196px}
.ao_nodeMenuItem{width:100%;display:flex;align-items:center;gap:7px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12px;line-height:17px;padding:6px 8px;text-align:left;cursor:pointer}
.ao_nodeMenuItem:hover,.ao_nodeMenuItem:focus-visible{background:var(--dsw-alias-bg-layer-2);outline:none}
.ao_connectLayer{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:2}
.ao_connectPath{fill:none;stroke:var(--dsw-alias-state-business-primary);stroke-width:1.8;stroke-dasharray:4 4;animation:aoDash 1s linear infinite}
.ao_nodeTop{display:flex;align-items:center;gap:6px;min-width:0;width:100%}
.ao_nodeName{font-size:11.5px;line-height:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ao_nodeTitle{font-size:9.5px;line-height:14px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ao_nodeMeta{display:flex;align-items:center;gap:4px;font-size:9px;line-height:13px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ao_nodeLeadTag{color:var(--dsw-alias-state-business-primary);font-size:9px;line-height:13px;font-weight:500}
.ao_topologyLegend{display:flex;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;padding:0 2px 7px}
.ao_topologyProcess{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 2px 7px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.ao_processTitle{font-weight:600;color:var(--dsw-alias-label-secondary);margin-right:2px}
.ao_processChip{display:inline-flex;align-items:center;gap:4px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 6px;background:var(--dsw-alias-bg-layer-1);white-space:nowrap}
.ao_processRunning{color:var(--dsw-alias-state-business-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,var(--dsw-alias-border-l2))}
.ao_processDone{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary))}
.ao_processFailed{color:var(--dsw-alias-state-error-primary)}
.ao_processEmpty{color:var(--dsw-alias-label-caption)}
.ao_legendDot{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:4px;vertical-align:1px}
.ao_legendLine{display:inline-block;width:14px;border-top:2px solid var(--dsw-alias-border-l3);vertical-align:4px;margin-right:4px}
.ao_legendDash{display:inline-block;width:14px;border-top:2px dashed var(--dsw-alias-state-business-primary);vertical-align:4px;margin-right:4px}
.ao_legendFlow{display:inline-block;width:14px;border-top:2px dotted var(--dsw-alias-state-business-primary);vertical-align:4px;margin-right:4px}
.ao_relationList{display:flex;flex-direction:column;gap:4px;margin-top:2px}
.ao_relationChip{width:100%;display:flex;align-items:center;gap:6px;text-align:left;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:6px;padding:4px 7px;font-family:inherit;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.ao_relationChip:hover,.ao_relationChip:focus-visible{border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
.ao_relationChipActive{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 50%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary)}
.ao_relationType{font-size:9px;line-height:14px;border-radius:999px;padding:0 5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);flex:none}
.ao_relationTypeTemp{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 9%,transparent)}
.ao_relationTypeReports{color:var(--dsw-alias-label-secondary)}
.ao_relationTo{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ao_taskBadge{display:flex;align-items:center;gap:7px;flex-wrap:wrap;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);padding:6px 9px;margin:0 0 12px;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary);min-width:0}
.ao_taskBadgeDone{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary)) 36%,var(--dsw-alias-border-l2))}
.ao_taskBadgeLabel{flex:none;color:var(--dsw-alias-label-tertiary);font-size:9px;text-transform:uppercase;letter-spacing:.04em}
.ao_taskBadgeTitle{min-width:0;max-width:min(48vw,360px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:11.5px;font-weight:600}
.ao_taskBadgeTime{flex:none;font-variant-numeric:tabular-nums;color:var(--dsw-alias-state-business-primary);font-weight:600}
.ao_taskBadgeDone .ao_taskBadgeTime{color:var(--dsw-alias-label-secondary)}
.ao_taskBadgeStatus{flex:none;border-radius:999px;padding:0 6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:15px}
.ao_activeStrip{border:.5px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 30%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 6%,transparent);border-radius:9px;padding:8px 10px;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.ao_activeStrip strong{color:var(--dsw-alias-label-primary);font-weight:600}
.ao_activeStrip .ao_button{margin-left:auto}
.ao_setupWrap{overflow:auto;padding:18px 22px 30px;flex:1;min-height:0}
.ao_setupIntro{border:.5px solid var(--dsw-alias-border-l2);background:linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent),var(--dsw-alias-bg-layer-2));border-radius:12px;padding:14px 16px;margin-bottom:16px}
.ao_setupTitle{font-size:16px;line-height:24px;font-weight:600;margin:0}
.ao_setupText{font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary);margin:5px 0 0;max-width:680px}
.ao_setupWorkspace{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:9px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.ao_setupGrid{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start}
.ao_setupList{display:flex;flex-direction:column;gap:8px}
.ao_setupRole{border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:10px 11px;display:flex;flex-direction:column;gap:8px}
.ao_setupRoleHead{display:flex;align-items:flex-start;gap:9px}
.ao_setupRoleText{min-width:0;flex:1}
.ao_setupRoleName{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;line-height:18px;font-weight:600}
.ao_setupRoleTitle{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary)}
.ao_setupRoleGrid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}
.ao_setupRoleGrid .ao_select{min-width:150px}
.ao_setupDetails{border-top:.5px solid var(--dsw-alias-border-l1);padding-top:6px}
.ao_setupDetails summary{cursor:pointer;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:17px;outline:none}
.ao_setupDetails summary:hover,.ao_setupDetails summary:focus-visible{color:var(--dsw-alias-label-primary)}
.ao_setupPrompt{display:flex;flex-direction:column;gap:8px;padding-top:7px}
.ao_setupPreview{border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:8px 12px;margin-bottom:16px}
.ao_setupPreviewToggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;padding:2px 0}
.ao_setupPreviewToggle .ao_setupPreviewTitle{margin:0}
.ao_setupPreviewCanvas{margin-top:8px;max-height:310px;overflow:hidden;display:flex;flex-direction:column}
.ao_setupPreviewCanvas .ao_topologyShell{height:285px;max-height:285px}
.ao_setupPreviewCanvas .ao_topologyScroll{min-height:210px;max-height:230px}
.ao_setupPreviewTitle{font-size:11px;line-height:17px;font-weight:600;margin:0 0 3px}
.ao_setupPreviewText{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);margin:0}
.ao_setupActions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:16px}
.ao_setupActions .ao_buttonPrimary{min-height:32px;padding:6px 14px;font-size:12.5px}
.ao_setupError{color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:17px;margin:8px 0 0}
.ao_timeline{display:flex;flex-direction:column;gap:0;margin:8px 0 0;padding-left:3px}
.ao_timelineItem{position:relative;display:flex;gap:9px;padding:0 0 12px 14px;border-left:1px solid var(--dsw-alias-border-l2);margin-left:3px}
.ao_timelineItem:last-child{border-left-color:transparent;padding-bottom:0}
.ao_timelineDot{position:absolute;left:-4px;top:4px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-caption);box-shadow:0 0 0 3px var(--dsw-alias-bg-layer-2)}
.ao_timelineDotActive{background:var(--dsw-alias-state-business-primary);animation:aoPulse 1.5s ease-in-out infinite}
.ao_timelineDotOk{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary))}
.ao_timelineDotError{background:var(--dsw-alias-state-error-primary)}
.ao_timelineText{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.ao_timelineLabel{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);font-weight:500}
.ao_timelineDetail{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);word-break:break-word}
.ao_timelineActions{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px}
.ao_sessionButton{font-family:inherit;font-size:10.5px;line-height:16px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:5px;padding:2px 7px;cursor:pointer;display:inline-flex;align-items:center;gap:3px}
.ao_sessionButton:hover,.ao_sessionButton:focus-visible{border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
.ao_sessionButton:disabled{opacity:.55;cursor:default}
@keyframes aoDash{to{stroke-dashoffset:-18}}
.ao_wsMenuItem{display:flex;align-items:center;gap:7px;width:100%;box-sizing:border-box;border:0;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font-family:inherit;font-size:13px;line-height:20px;padding:7px 11px;border-radius:6px;cursor:pointer}
.ao_wsMenuItem:hover,.ao_wsMenuItem:focus-visible{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));outline:none}
.ao_wsMenuItem:disabled{opacity:.55;cursor:default}
.ao_wsMenuDivider{height:1px;background:var(--dsw-alias-border-l1);margin:4px 6px}
.ao_wsMenuCheck{width:14px;flex:none;color:var(--dsw-alias-state-business-primary);font-size:12px}
.ao_wsToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:230;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));border:.5px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-panel);border-radius:8px;padding:8px 12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);max-width:calc(100vw - 32px)}
.ao_wsConfirmOverlay{position:fixed;inset:0;z-index:220;background:color-mix(in srgb,#000 38%,transparent);display:flex;align-items:center;justify-content:center;padding:20px;animation:aoFade .14s ease-out}
.ao_wsConfirmPanel{width:min(440px,100%);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-elevation-prominent);padding:18px 20px;color:var(--dsw-alias-label-primary);outline:none;box-sizing:border-box}
.ao_wsConfirmTitle{font-size:16px;line-height:24px;font-weight:600;margin:0}
.ao_wsConfirmText{font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary);margin:7px 0 0}
.ao_wsConfirmError{font-size:11px;line-height:17px;color:var(--dsw-alias-state-error-primary);margin:9px 0 0}
.ao_wsConfirmActions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.ao_trigger{min-height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:6px;align-items:center;gap:5px;padding:3px 7px;font-size:12px;display:inline-flex;font-family:inherit}
.ao_trigger:hover,.ao_trigger:focus-visible{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.ao_triggerLabel{white-space:nowrap}
.ao_triggerCount{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;font-size:11px;line-height:16px}
.ao_liveDot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent);animation:aoPulse 1.8s ease-in-out infinite}
.ao_overlay{position:fixed;inset:0;z-index:120;background:color-mix(in srgb,#000 38%,transparent);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;animation:aoFade .14s ease-out}
.ao_panel{box-sizing:border-box;width:min(1100px,100%);height:min(800px,100%);max-height:calc(100dvh - 40px);display:flex;flex-direction:column;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;box-shadow:var(--dsw-elevation-prominent);overflow:hidden;outline:none;animation:aoPop .16s ease-out;font-family:inherit}
.ao_panel *{box-sizing:border-box}
.ao_header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 22px 14px}
.ao_heading{min-width:0}
.ao_titleRow{display:flex;align-items:center;gap:9px;min-width:0}
.ao_title{font-size:18px;line-height:26px;font-weight:600;margin:0;letter-spacing:-.01em}
.ao_titleIcon{display:inline-flex;color:var(--dsw-alias-state-business-primary)}
.ao_countPill{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap}
.ao_subtitle{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;margin:6px 0 0;max-width:600px}
.ao_headerActions{display:flex;gap:4px;flex:none}
.ao_iconButton{width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.ao_iconButton:hover,.ao_iconButton:focus-visible{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.ao_iconButton:disabled{opacity:.5;cursor:default}
.ao_toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 22px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.ao_tabs{display:flex;gap:2px;background:var(--dsw-alias-bg-layer-2);padding:2px;border-radius:8px}
.ao_tab{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);padding:5px 12px;border-radius:6px;font-size:12px;line-height:18px;cursor:pointer;font-family:inherit}
.ao_tab:hover{color:var(--dsw-alias-label-primary)}
.ao_tabActive{background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 1px 2px color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.ao_toolbarActions{display:flex;align-items:center;gap:6px}
.ao_button{font-family:inherit;font-size:12px;line-height:18px;border-radius:7px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);padding:5px 10px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap}
.ao_button:hover,.ao_button:focus-visible{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1)}
.ao_button:disabled{opacity:.55;cursor:default}
.ao_buttonPrimary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.ao_buttonPrimary:hover,.ao_buttonPrimary:focus-visible{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 88%,#000);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 88%,#000)}
.ao_buttonDanger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,var(--dsw-alias-border-l2))}
.ao_buttonDangerSolid{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:#fff}
.ao_buttonGhost{background:transparent;border-color:transparent}
.ao_buttonGhost:hover,.ao_buttonGhost:focus-visible{background:var(--dsw-alias-bg-layer-2);border-color:transparent}
.ao_body[hidden],.ao_main[hidden]{display:none!important}
.ao_body{position:relative;display:grid;grid-template-columns:minmax(0,1fr);min-height:0;flex:1}
.ao_main{min-width:0;overflow:auto;padding:18px 20px 28px;scrollbar-gutter:stable;display:flex;flex-direction:column}
.ao_topologyShell{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;gap:4px}
.ao_graphToolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:26px}
.ao_zoomControls{display:flex;align-items:center;gap:3px;margin-left:auto}
.ao_zoomButton{min-width:26px;justify-content:center;padding:3px 7px;font-size:13px;line-height:16px}
.ao_zoomValue{min-width:38px;text-align:center;font-size:10px;line-height:17px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.ao_zoomSurface{position:relative;flex:none;margin:0 auto;touch-action:none}
.ao_topologyShellExpanded{position:fixed;inset:12px;z-index:400;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:var(--dsw-elevation-prominent);padding:12px;min-height:0}
.ao_topologyShellExpanded .ao_topologyScroll{min-height:0;flex:1}
.ao_graphToolbar .ao_canvasActions{position:static;top:auto;left:auto;z-index:auto;padding:0}
.ao_topologyScroll{flex:1 1 auto;min-height:272px}
.ao_modelScopeBox{border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:9px 10px;display:flex;flex-direction:column;gap:7px;margin:9px 0}
.ao_modelScopeHead{display:flex;flex-direction:column;gap:2px}
.ao_modelScopeHead strong{font-size:11px;line-height:16px;color:var(--dsw-alias-label-primary)}
.ao_modelScopeHead span{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary)}
.ao_modelScopeList{max-height:170px;overflow:auto;display:flex;flex-direction:column;gap:5px;border-top:.5px solid var(--dsw-alias-border-l1);padding-top:6px}
.ao_modelScopeGroup{display:flex;flex-wrap:wrap;gap:3px 10px;align-items:center}
.ao_modelScopeProvider{width:100%;font-size:9.5px;line-height:14px;color:var(--dsw-alias-label-caption)}
.ao_modelScopeItem{display:inline-flex;align-items:center;gap:4px;font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary);cursor:pointer}
.ao_modelScopeItem input{accent-color:var(--dsw-alias-state-business-primary)}
.ao_modelScopeActions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ao_skillInjector{border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1);padding:10px;display:flex;flex-direction:column;gap:7px;margin:10px 0}
.ao_skillHead{display:flex;flex-direction:column;gap:2px}
.ao_skillHead strong{font-size:12px;line-height:17px;color:var(--dsw-alias-label-primary)}
.ao_skillHead span{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary)}
.ao_skillExistingTitle{font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary)}
.ao_skillChips{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
.ao_skillChip{display:inline-flex;align-items:center;gap:4px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 6px;background:var(--dsw-alias-bg-layer-2);font-size:9.5px;line-height:14px;color:var(--dsw-alias-label-secondary);max-width:100%}
.ao_skillChip strong{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ao_skillChip small{color:var(--dsw-alias-label-tertiary);font-size:9px}
.ao_skillUploadRow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:7px 0;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.ao_skillUploadLabel{display:inline-flex;align-items:center;gap:4px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:16px;cursor:pointer}
.ao_skillUploadLabel:hover{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.ao_skillUploadLabel input{display:none}
.ao_skillUploadIcon{font-size:12px;line-height:1}
.ao_skillFile{font-size:9.5px;line-height:14px;color:var(--dsw-alias-state-business-primary);overflow-wrap:anywhere}
.ao_skillModes{display:flex;gap:3px;border-bottom:.5px solid var(--dsw-alias-border-l1);padding-bottom:3px}
.ao_skillMode{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10.5px;line-height:16px;padding:3px 6px;border-radius:5px;cursor:pointer}
.ao_skillMode:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ao_skillModeActive{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 9%,transparent)}
.ao_skillSearchRow{display:flex;gap:5px;align-items:center}
.ao_skillSearchRow .ao_input{flex:1;min-width:0}
.ao_skillResults{max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:4px;padding:2px 0}
.ao_skillResult{display:flex;flex-direction:column;gap:1px;text-align:left;border:.5px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;padding:6px 8px;cursor:pointer}
.ao_skillResult:hover{border-color:var(--dsw-alias-border-l3)}
.ao_skillResult strong{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-primary)}
.ao_skillResult span{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary)}
.ao_skillResult small{font-size:9px;color:var(--dsw-alias-state-business-primary)}
.ao_skillResultActive{border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,var(--dsw-alias-bg-layer-1))}
.ao_skillSelected{font-size:10px;line-height:15px;color:var(--dsw-alias-state-business-primary);margin:0}
.ao_skillActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ao_skillInjector .ao_textarea{min-height:52px}
.ao_side{display:none;position:fixed;z-index:490;top:50%;left:50%;right:auto;bottom:auto;translate:-50% -50%;width:min(640px,calc(100vw - 32px));max-height:calc(100vh - 24px);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:var(--dsw-elevation-prominent);overflow:auto;padding:22px 22px 30px;scrollbar-gutter:stable}
.ao_side.ao_sideAnchored{top:var(--ao-editor-top,50%);left:var(--ao-editor-left,50%);translate:none;width:var(--ao-editor-width,390px);max-height:calc(100vh - 24px);padding:16px 16px 22px}
.ao_bodyEditor .ao_side{display:block;animation:aoPop .14s ease-out}
.ao_editorBackdrop{position:fixed;inset:0;z-index:480;background:color-mix(in srgb,#000 28%,transparent)}
.ao_usagePage{overflow:auto;padding-bottom:28px}
.ao_usageRules{border:.5px solid var(--dsw-alias-border-l2);background:linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent),var(--dsw-alias-bg-layer-1));border-radius:10px;padding:11px 13px;margin:0 0 12px}
.ao_usageRulesTitle{font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:4px}
.ao_usageRules p{margin:2px 0;font-size:10.5px;line-height:17px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.ao_usageRules .ao_hint{margin-top:4px;font-size:10px}
.ao_usageTotalGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:4px 0 14px}
.ao_usageMetric{border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:9px;padding:10px 12px;display:flex;flex-direction:column;gap:3px}
.ao_usageMetric span{font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.ao_usageMetric strong{font-size:17px;line-height:24px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.ao_usageMetricCost strong{color:var(--dsw-alias-state-business-primary)}
.ao_usagePriceCard{border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:12px 13px;margin-bottom:14px;max-width:760px}
.ao_usagePriceHead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.ao_usagePriceHead strong{font-size:12px}
.ao_usagePriceHead span{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.ao_usagePriceGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ao_usagePriceActions{display:flex;align-items:center;gap:9px;margin-top:9px}
.ao_usageTableWrap{overflow:auto;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;max-width:100%}
.ao_usageTable{width:100%;border-collapse:collapse;min-width:760px;font-size:11px;line-height:17px}
.ao_usageTable th{font-weight:600;text-align:right;white-space:nowrap;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);padding:7px 9px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.ao_usageTable th:first-child{text-align:left}
.ao_usageTable td{text-align:right;padding:7px 9px;border-bottom:.5px solid var(--dsw-alias-border-l1);font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
.ao_usageTable td:first-child{text-align:left;white-space:normal}
.ao_usageTable tr:last-child td{border-bottom:0}
.ao_usageTable small{display:block;color:var(--dsw-alias-label-caption);font-size:9px;line-height:14px}
.ao_usageName{display:block;color:var(--dsw-alias-label-primary);font-weight:600}
@media (max-width:720px){.ao_usageTotalGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.ao_usagePriceGrid{grid-template-columns:1fr}}
.ao_auditPage{overflow:auto;padding-bottom:28px}
.ao_auditList{display:flex;flex-direction:column;gap:9px;max-width:860px}
.ao_auditItem{border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:11px 13px}
.ao_auditHead{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap}
.ao_auditHead strong{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}
.ao_auditHead time{margin-left:auto;color:var(--dsw-alias-label-caption);font-size:10px;line-height:16px;white-space:nowrap}
.ao_auditKind{font-size:10px;line-height:16px;border-radius:999px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}
.ao_auditKindWork{color:var(--dsw-alias-state-business-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,var(--dsw-alias-border-l2))}
.ao_auditKindPersonnel{color:#D9822B;border-color:color-mix(in srgb,#D9822B 35%,var(--dsw-alias-border-l2))}
.ao_auditKindRelation{color:#2E9E7B;border-color:color-mix(in srgb,#2E9E7B 35%,var(--dsw-alias-border-l2))}
.ao_auditRole{font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);border-radius:4px;background:var(--dsw-alias-bg-layer-2);padding:0 4px}
.ao_auditActor{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;margin-top:3px}
.ao_auditReason{margin:6px 0 0;font-size:12px;line-height:19px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere}
.ao_auditReason span{color:var(--dsw-alias-label-tertiary);font-weight:600}
.ao_auditSummary{margin:3px 0 0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;overflow-wrap:anywhere}
.ao_settingsPage{max-width:720px;margin:0 auto}
.ao_settingsHead{display:flex;flex-direction:column;gap:4px;margin-bottom:16px}
.ao_settingsTitle{font-size:15px;line-height:22px;font-weight:600;margin:0}
.ao_settingsHint{font-size:12px;line-height:19px;color:var(--dsw-alias-label-tertiary);margin:0}
.ao_settingsForm{max-width:560px}
.ao_templateOverlay{position:fixed;inset:0;z-index:210;background:color-mix(in srgb,#000 38%,transparent);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;animation:aoFade .14s ease-out}
.ao_templateDialog{width:min(760px,100%);max-height:min(760px,calc(100dvh - 40px));display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;box-shadow:var(--dsw-elevation-prominent);overflow:hidden;outline:none;animation:aoPop .16s ease-out;font-family:inherit}
.ao_templateHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:20px 22px 10px}
.ao_templateTitleRow{display:flex;align-items:center;gap:8px;min-width:0}
.ao_templateTitle{font-size:17px;line-height:24px;font-weight:600;margin:0}
.ao_templateSub{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;margin:5px 0 0;max-width:540px}
.ao_templateBody{min-height:0;overflow:auto;padding:8px 22px 22px}
.ao_templateToolbar{display:flex;align-items:center;gap:8px;justify-content:space-between;margin:4px 0 12px}
.ao_templateCount{color:var(--dsw-alias-label-tertiary);font-size:11px}
.ao_templateGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ao_templateCard{display:flex;flex-direction:column;gap:6px;min-width:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:11px 12px;color:var(--dsw-alias-label-primary)}
.ao_templateCard:hover{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,var(--dsw-alias-border-l2))}
.ao_templateCardTop{display:flex;align-items:center;justify-content:space-between;gap:7px;min-width:0}
.ao_templateName{font-size:13px;line-height:19px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ao_templateBadge{flex:none;border-radius:999px;padding:0 6px;font-size:9px;line-height:15px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}
.ao_templateSnippet{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:51px}
.ao_templateCardActions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:2px}
.ao_templateEmpty{border:.5px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:19px}
.ao_templateForm{display:flex;flex-direction:column;gap:12px;max-width:620px}
.ao_templateFormActions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
@media (max-width:620px){.ao_templateOverlay{padding:8px}.ao_templateDialog{max-height:calc(100dvh - 16px)}.ao_templateHeader{padding:16px 16px 8px}.ao_templateBody{padding:6px 16px 18px}.ao_templateGrid{grid-template-columns:minmax(0,1fr)}}
.ao_sectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 14px}
.ao_sectionTitle{font-size:13px;line-height:20px;font-weight:600;margin:0}
.ao_sectionHint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;margin:4px 0 0;max-width:430px}
.ao_banner{border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:9px;padding:9px 11px;margin:0 0 14px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);display:flex;gap:8px;align-items:flex-start}
.ao_bannerWarn{border-color:color-mix(in srgb,var(--dsw-alias-state-warning-primary,var(--dsw-alias-state-business-primary)) 35%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-secondary)}
.ao_bannerError{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-secondary)}
.ao_bannerIcon{flex:none;margin-top:1px;color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-tertiary))}
.ao_bannerError .ao_bannerIcon{color:var(--dsw-alias-state-error-primary)}
.ao_tree{display:flex;flex-direction:column;gap:0;padding-bottom:8px}
.ao_leadCard{width:100%;display:flex;align-items:flex-start;gap:11px;text-align:left;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:12px;padding:11px 12px;color:var(--dsw-alias-label-primary);cursor:pointer;font-family:inherit;position:relative}
.ao_leadCard:hover,.ao_leadCard:focus-visible{border-color:var(--dsw-alias-border-l3)}
.ao_leadCardSelected{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 58%,var(--dsw-alias-border-l2));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 32%,transparent)}
.ao_avatar{flex:none;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:600;letter-spacing:.02em;border:1px solid transparent}
.ao_avatarLead{border-radius:12px}
.ao_leadInfo{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.ao_leadNameRow{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ao_leadName{font-size:14px;line-height:20px;font-weight:600}
.ao_leadBadge{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);border-radius:999px;padding:0 7px;font-size:10px;line-height:17px;font-weight:500;white-space:nowrap}
.ao_leadDesc{color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:17px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ao_treeChildren{list-style:none;margin:0 0 0 17px;padding:5px 0 0 21px;border-left:1px solid var(--dsw-alias-border-l2)}
.ao_treeItem{position:relative;padding:4px 0 0;list-style:none}
.ao_treeItem:before{content:"";position:absolute;left:-21px;top:26px;width:19px;border-top:1px solid var(--dsw-alias-border-l2)}
.ao_roleCard{width:100%;display:flex;align-items:flex-start;gap:10px;text-align:left;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:9px 10px;color:var(--dsw-alias-label-primary);cursor:pointer;font-family:inherit;transition:border-color .12s,background .12s}
.ao_roleCard:hover,.ao_roleCard:focus-visible{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1)}
.ao_roleCardSelected{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 58%,var(--dsw-alias-border-l2));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 30%,transparent)}
.ao_roleCardDisabled{opacity:.68}
.ao_roleInfo{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.ao_roleNameRow{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap}
.ao_roleName{font-size:12.5px;line-height:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ao_roleTitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;white-space:nowrap}
.ao_roleResp{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ao_roleMeta{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:16px;flex-wrap:wrap}
.ao_roleChevron{flex:none;color:var(--dsw-alias-label-caption);margin-top:8px}
.ao_status{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:0 6px;font-size:10px;line-height:16px;white-space:nowrap;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}
.ao_statusOn{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary));border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary)) 30%,var(--dsw-alias-border-l2))}
.ao_statusRunning{color:var(--dsw-alias-state-business-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent)}
.ao_statusFailed{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,var(--dsw-alias-border-l2))}
.ao_dot{width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}
.ao_dotPulse{animation:aoPulse 1.5s ease-in-out infinite}
.ao_empty{border:.5px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:22px 18px;text-align:center;color:var(--dsw-alias-label-tertiary);margin-left:17px}
.ao_emptyIcon{color:var(--dsw-alias-label-caption);margin-bottom:6px}
.ao_emptyTitle{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-weight:500}
.ao_emptyText{font-size:11px;line-height:17px;margin:4px auto 0;max-width:360px}
.ao_sideHead{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:14px}
.ao_sideTitle{font-size:13px;line-height:19px;font-weight:600;margin:0}
.ao_sideSub{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;margin:3px 0 0}
.ao_form{display:flex;flex-direction:column;gap:13px}
.ao_field{display:flex;flex-direction:column;gap:5px}
.ao_label{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-weight:500;display:flex;align-items:center;justify-content:space-between;gap:8px}
.ao_input,.ao_textarea,.ao_select{width:100%;font-family:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;padding:6px 8px;outline:none;transition:border-color .12s,box-shadow .12s}
.ao_input:hover,.ao_textarea:hover,.ao_select:hover{border-color:var(--dsw-alias-border-l3)}
.ao_input:focus,.ao_textarea:focus,.ao_select:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent)}
.ao_textarea{resize:vertical;min-height:58px}
.ao_hint{color:var(--dsw-alias-label-tertiary);font-size:10.5px;line-height:16px;margin:0}
.ao_row2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.ao_switchRow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:.5px solid var(--dsw-alias-border-l1);border-bottom:.5px solid var(--dsw-alias-border-l1)}
.ao_switchText{display:flex;flex-direction:column;gap:1px}
.ao_switchLabel{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.ao_switchHint{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-tertiary)}
.ao_switch{width:34px;height:19px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);position:relative;cursor:pointer;flex:none;transition:background .15s,border-color .15s;padding:0}
.ao_switchOn{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.ao_switchKnob{width:13px;height:13px;border-radius:50%;background:#fff;position:absolute;left:2px;top:2px;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.ao_switchOn .ao_switchKnob{transform:translateX(15px)}
.ao_swatches{display:flex;gap:6px;flex-wrap:wrap}
.ao_swatch{width:22px;height:22px;border-radius:7px;border:2px solid transparent;cursor:pointer;padding:0;position:relative}
.ao_swatchActive{box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-2),0 0 0 3.5px currentColor}
.ao_swatch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.ao_formActions{display:flex;align-items:center;gap:8px;padding-top:4px;flex-wrap:wrap}
.ao_formActions .ao_buttonPrimary{margin-left:auto}
.ao_saveStatus{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;gap:4px;min-height:18px}
.ao_saveStatusOk{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-state-business-primary))}
.ao_errorText{color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:17px;margin:0}
.ao_deleteBox{border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 5%,transparent);border-radius:9px;padding:10px 11px;display:flex;flex-direction:column;gap:8px;margin-top:2px}
.ao_deleteTitle{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);font-weight:500}
.ao_deleteDesc{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary);margin:0}
.ao_deleteActions{display:flex;gap:7px;justify-content:flex-end}
.ao_idRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ao_idBadge{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:5px;padding:1px 5px;word-break:break-all}
.ao_activityList{display:flex;flex-direction:column;gap:8px}
.ao_runCard{border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;overflow:hidden}
.ao_runCard summary{list-style:none;cursor:pointer;display:flex;align-items:flex-start;gap:9px;padding:10px 12px;outline:none}
.ao_runCard summary::-webkit-details-marker{display:none}
.ao_runCard summary:hover,.ao_runCard summary:focus-visible{background:var(--dsw-alias-bg-layer-1)}
.ao_runSummaryMain{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.ao_runRole{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.ao_runName{font-size:12px;line-height:18px;font-weight:600}
.ao_runTitle{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.ao_runTask{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ao_runMeta{display:flex;align-items:center;gap:7px;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;padding-top:1px;flex-wrap:wrap;justify-content:flex-end}
.ao_runBody{border-top:.5px solid var(--dsw-alias-border-l1);padding:10px 12px 12px;display:flex;flex-direction:column;gap:10px}
.ao_runSection{display:flex;flex-direction:column;gap:3px}
.ao_runSectionLabel{font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.03em}
.ao_runText{font-size:11.5px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;margin:0;max-height:320px;overflow:auto}
.ao_runFoot{display:flex;gap:9px;flex-wrap:wrap;color:var(--dsw-alias-label-caption);font-size:10px;line-height:16px;border-top:.5px dashed var(--dsw-alias-border-l1);padding-top:7px}
.ao_centerState{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;min-height:280px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:26px}
.ao_spinner{width:16px;height:16px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-state-business-primary);animation:aoSpin .8s linear infinite}
.ao_centerTitle{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}
.ao_centerText{font-size:11px;line-height:17px;max-width:380px}
.ao_notice{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));border:.5px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-panel,var(--dsw-elevation-prominent));border-radius:8px;padding:7px 11px;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:7px;max-width:calc(100% - 32px);z-index:5;animation:aoPop .15s ease-out}
.ao_noticeClose{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:0;display:inline-flex}
.ao_discardBar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,var(--dsw-alias-state-business-primary)) 10%,var(--dsw-alias-bg-layer-2));border-bottom:1px solid var(--dsw-alias-border-l1);padding:8px 22px;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary);flex:none}
.ao_discardActions{display:flex;gap:6px;flex:none}
.ao_conflict{border:.5px solid color-mix(in srgb,var(--dsw-alias-state-warning-primary,var(--dsw-alias-state-business-primary)) 36%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,var(--dsw-alias-state-business-primary)) 7%,transparent);border-radius:9px;padding:10px 11px;display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
.ao_conflictTitle{font-size:11.5px;line-height:17px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ao_conflictText{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary);margin:0}
.ao_conflictActions{display:flex;gap:6px;flex-wrap:wrap}
.ao_srOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@keyframes aoFade{from{opacity:0}to{opacity:1}}
@keyframes aoPop{from{opacity:0;transform:translateY(5px) scale(.995)}to{opacity:1;transform:none}}
@keyframes aoSpin{to{transform:rotate(360deg)}}
@keyframes aoPulse{0%,100%{opacity:1}50%{opacity:.45}}
@media (max-width:820px){.ao_setupGrid{grid-template-columns:minmax(0,1fr)}.ao_setupWrap{padding:16px 16px 24px}.ao_body{grid-template-columns:minmax(0,1fr)}.ao_main{padding:16px 16px 24px}.ao_side{padding:16px 14px 24px;width:min(600px,calc(100% - 24px));max-height:calc(100% - 24px)}}
@media (max-width:720px){.ao_setupWrap{padding:14px 14px 24px}.ao_setupRoleGrid{grid-template-columns:1fr}.ao_setupRoleGrid .ao_select{min-width:0}.ao_overlay{padding:8px}.ao_panel{height:calc(100dvh - 16px);max-height:none;border-radius:12px}.ao_header{padding:16px 16px 12px}.ao_toolbar{padding:0 16px 10px;gap:6px}.ao_toolbarActions .ao_button span{display:none}.ao_body{display:flex;flex-direction:column;overflow:auto}.ao_main{overflow:visible;flex:none;padding:14px 14px 10px}.ao_side{position:fixed;top:8px;left:8px;right:8px;bottom:8px;translate:none;width:auto;max-height:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 14px 26px}
.ao_side.ao_sideAnchored{top:var(--ao-editor-top,8px);left:var(--ao-editor-left,8px);right:auto;bottom:auto;width:var(--ao-editor-width,calc(100vw - 24px));max-height:calc(100vh - 16px)}.ao_triggerLabel{display:none}.ao_discardBar{padding:8px 16px;align-items:flex-start;flex-direction:column}.ao_discardActions{width:100%;justify-content:flex-end}.ao_subtitle{font-size:11px}.ao_runMeta{padding-top:0}.ao_headerActions .ao_iconButton{width:28px;height:28px}}
@media (max-width:460px){.ao_countPill{display:none}.ao_title{font-size:16px}.ao_tab{padding:5px 9px}.ao_toolbarActions .ao_buttonPrimary span{display:none}.ao_leadDesc{-webkit-line-clamp:3}.ao_row2{grid-template-columns:1fr}.ao_treeChildren{margin-left:11px;padding-left:16px}.ao_treeItem:before{left:-16px;width:14px}.ao_roleResp{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}
@media (prefers-reduced-motion:reduce){.ao_edgeActive,.ao_edgeRunning,.ao_timelineDotActive{animation:none}.ao_overlay,.ao_panel,.ao_notice,.ao_dotPulse,.ao_liveDot,.ao_spinner{animation:none}.ao_switchKnob{transition:none}}
`;

    const ICONS = {
      org: ['M12 3a2.6 2.6 0 1 0 0 5.2A2.6 2.6 0 0 0 12 3Z', 'M5 15.8a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z', 'M19 15.8a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z', 'M12 8.2v3.4M5 15.8v-2.2h14v2.2'],
      close: ['M6 6l12 12', 'M18 6L6 18'],
      plus: ['M12 5v14', 'M5 12h14'],
      check: ['M5 12l4 4L19 6'],
      refresh: ['M20 11a8 8 0 1 0-2.4 5.7', 'M20 5v6h-6'],
      trash: ['M4 7h16', 'M9 7V5h6v2', 'M7 7l1 13h8l1-13', 'M10 11v5', 'M14 11v5'],
      chevron: ['M6 9l6 6 6-6'],
      settings: ['M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z', 'M4.5 12h1.7M17.8 12h1.7M12 4.5v1.7M12 17.8v1.7', 'M6.7 6.7l1.2 1.2M16.1 16.1l1.2 1.2', 'M17.3 6.7l-1.2 1.2M7.9 16.1l-1.2 1.2'],
      user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21a8 8 0 0 1 16 0'],
      spark: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z'],
      warning: ['M12 4l9 16H3L12 4Z', 'M12 9v5', 'M12 17.2v.1'],
      info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5', 'M12 8v.1'],
    };

    function cx(...values) {
      return values.filter(Boolean).join(' ');
    }

    function trFactory(t) {
      return (key, vars) => {
        try {
          return typeof t === 'function' ? t(key, vars) : key;
        } catch {
          return key;
        }
      };
    }

    function Icon({ name, size = 16, className }) {
      const paths = ICONS[name] ?? ICONS.info;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          className,
        },
        paths.map((d, index) => h('path', { d, key: index })),
      );
    }

    function Avatar({ name, color, size = 36, lead = false }) {
      const initials = String(name ?? '?').trim().slice(0, 2) || '?';
      return h(
        'span',
        {
          className: cx('ao_avatar', lead && 'ao_avatarLead'),
          style: {
            width: size,
            height: size,
            fontSize: lead ? Math.round(size * 0.36) : Math.round(size * 0.35),
            backgroundColor: `${color}1f`,
            color,
            borderColor: `${color}55`,
          },
          'aria-hidden': 'true',
        },
        initials,
      );
    }

    function StatusBadge({ status, t }) {
      const label = {
        running: t('statusRunning'),
        completed: t('statusCompleted'),
        failed: t('statusFailed'),
        aborted: t('statusAborted'),
        pending: t('statusPending'),
        enabled: t('enabled'),
        disabled: t('disabled'),
      }[status] ?? status;
      return h(
        'span',
        {
          className: cx(
            'ao_status',
            status === 'enabled' && 'ao_statusOn',
            status === 'running' && 'ao_statusRunning',
            (status === 'failed' || status === 'aborted') && 'ao_statusFailed',
          ),
        },
        h('span', { className: cx('ao_dot', status === 'running' && 'ao_dotPulse') }),
        label,
      );
    }

    function roleManager(org, role) {
      if (role.reportsTo === 'lead') return org.lead.label;
      return org.roles.find((candidate) => candidate.id === role.reportsTo)?.name ?? org.lead.label;
    }

    function descendantIds(org, roleId) {
      const result = new Set();
      let changed = true;
      while (changed) {
        changed = false;
        for (const role of org.roles) {
          if (role.id === roleId || result.has(role.id)) continue;
          if (role.reportsTo === roleId || result.has(role.reportsTo)) {
            result.add(role.id);
            changed = true;
          }
        }
      }
      return result;
    }

    function managerOptions(org, roleId) {
      const blocked = new Set([roleId, ...descendantIds(org, roleId)]);
      return [
        { id: 'lead', name: org.lead.label, title: '' },
        ...org.roles.filter((role) => !blocked.has(role.id)).map((role) => ({ id: role.id, name: role.name, title: role.title })),
      ];
    }

    function defaultEmployeeName(org, title, excludeId) {
      const prefix = String(title ?? '').trim();
      if (prefix === '') return '';
      const used = new Set(org.roles.filter((role) => role.id !== excludeId).map((role) => role.name));
      let index = 1;
      let candidate = `${prefix}-${String(index).padStart(2, '0')}`;
      while (used.has(candidate)) {
        index += 1;
        candidate = `${prefix}-${String(index).padStart(2, '0')}`;
      }
      return candidate;
    }

    function nextRoleId(org) {
      let index = 1;
      let id = 'custom-role';
      while (org.roles.some((role) => role.id === id)) {
        index += 1;
        id = `custom-role-${index}`;
      }
      return id;
    }

    function makeDraft(org, selectedId) {
      if (selectedId === 'lead') {
        return {
          kind: 'lead',
          teamName: org.teamName,
          label: org.lead.label,
          description: org.lead.description,
        };
      }
      const role = org.roles.find((candidate) => candidate.id === selectedId);
      return role === undefined ? null : { kind: 'role', role: { ...role }, isNew: false };
    }

    function formatDuration(ms, t) {
      const numeric = Number(ms);
      const value = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
      if (value < 1000) return t('durationInstant');
      if (value < 60_000) return t('durationSeconds', { count: Math.max(1, Math.round(value / 1000)) });
      const totalSeconds = Math.floor(value / 1000);
      if (totalSeconds < 3600) {
        return t('durationMinutes', { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 });
      }
      const totalMinutes = Math.floor(totalSeconds / 60);
      return t('durationHours', { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 });
    }

    function formatTime(iso) {
      if (typeof iso !== 'string') return '';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      try {
        const sameYear = date.getFullYear() === new Date().getFullYear();
        return date.toLocaleString(undefined, {
          ...(sameYear ? {} : { year: 'numeric' }),
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        return date.toISOString();
      }
    }

    function readText(event) {
      return event.target.value;
    }

    class ApiError extends Error {
      constructor(message, code, status, payload) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.payload = payload;
      }
    }

    async function apiGet(sessionId, signal, workspaceId) {
      const params = new URLSearchParams();
      if (typeof sessionId === 'string' && sessionId !== '') params.set('sessionId', sessionId);
      if (typeof workspaceId === 'string' && workspaceId !== '') params.set('workspaceId', workspaceId);
      const query = params.size > 0 ? `?${params.toString()}` : '';
      let response;
      try {
        response = await fetch(`${ENDPOINT}${query}`, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'x-agent-org': '1',
          },
          signal,
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      if (payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? 'invalid-response', payload?.code ?? 'invalid-response', response.status, payload);
      }
      return payload;
    }

    async function apiGroup(workspaceId) {
      let response;
      try {
        const query = new URLSearchParams({ group: '1' });
        if (typeof workspaceId === 'string' && workspaceId !== '') query.set('workspaceId', workspaceId);
        response = await fetch(`${ENDPOINT}?${query.toString()}`, {
          credentials: 'same-origin',
          headers: { accept: 'application/json', 'x-agent-org': '1' },
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiSkills(sessionId, workspaceId, query) {
      const params = new URLSearchParams({ skills: '1' });
      if (typeof sessionId === 'string' && sessionId !== '') params.set('sessionId', sessionId);
      if (typeof workspaceId === 'string' && workspaceId !== '') params.set('workspaceId', workspaceId);
      if (typeof query === 'string' && query.trim() !== '') params.set('query', query.trim());
      let response;
      try {
        response = await fetch(`${ENDPOINT}?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { accept: 'application/json', 'x-agent-org': '1' },
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiSkillInject(sessionId, workspaceId, skill) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            action: 'skill-inject',
            ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
            ...(typeof workspaceId === 'string' && workspaceId !== '' ? { workspaceId } : {}),
            ...skill,
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiProvision(workspaceId, leadSessionId, roleId) {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-agent-org': '1',
        },
        body: JSON.stringify({ action: 'provision', workspaceId, leadSessionId, roleId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    async function apiDesignTeam(workspaceId, sessionId) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            action: 'design-team',
            ...(workspaceId ? { workspaceId } : {}),
            ...(sessionId ? { sessionId } : {}),
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiUsage(workspaceId, sessionId) {
      const query = new URLSearchParams();
      if (workspaceId) query.set('workspaceId', workspaceId);
      if (sessionId) query.set('sessionId', sessionId);
      query.set('usage', '1');
      let response;
      try {
        response = await fetch(`${ENDPOINT}?${query.toString()}`, {
          credentials: 'same-origin',
          headers: { accept: 'application/json', 'x-agent-org': '1' },
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiMidprojectReport(workspaceId, sessionId) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            action: 'midproject-report',
            ...(workspaceId ? { workspaceId } : {}),
            ...(sessionId ? { sessionId } : {}),
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiRepair(workspaceId, sessionId) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            action: 'repair',
            ...(typeof workspaceId === 'string' && workspaceId !== '' ? { workspaceId } : {}),
            ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(
          payload?.error ?? `HTTP ${response.status}`,
          payload?.code ?? 'http',
          response.status,
          payload,
        );
      }
      return payload;
    }

    async function apiMarkWorkspaceDeleted(path) {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-agent-org': '1',
        },
        body: JSON.stringify({ action: 'workspace-deleted', path }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    async function apiSave(revision, org, sessionId, workspaceId) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            revision,
            org,
            ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
            ...(typeof workspaceId === 'string' && workspaceId !== '' ? { workspaceId } : {}),
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(
          payload?.error ?? `HTTP ${response.status}`,
          payload?.code ?? 'http',
          response.status,
          payload,
        );
      }
      return payload;
    }

    async function apiLayout(sessionId, workspaceId, revision, patch) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            action: 'layout',
            revision,
            ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
            ...(typeof workspaceId === 'string' && workspaceId !== '' ? { workspaceId } : {}),
            ...patch,
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiModels(sessionId, workspaceId) {
      const params = new URLSearchParams({ models: '1' });
      if (typeof sessionId === 'string' && sessionId !== '') params.set('sessionId', sessionId);
      if (typeof workspaceId === 'string' && workspaceId !== '') params.set('workspaceId', workspaceId);
      let response;
      try {
        response = await fetch(`${ENDPOINT}?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { accept: 'application/json', 'x-agent-org': '1' },
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiLeadModel(sessionId, workspaceId, provider, model, reasoningEffort) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            action: 'lead-model',
            ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
            ...(typeof workspaceId === 'string' && workspaceId !== '' ? { workspaceId } : {}),
            provider,
            model,
            ...(typeof reasoningEffort === 'string' && reasoningEffort !== '' ? { reasoningEffort } : {}),
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    async function apiLeadModelPolicy(sessionId, workspaceId, policy) {
      let response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-agent-org': '1',
          },
          body: JSON.stringify({
            action: 'lead-model-policy',
            ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
            ...(typeof workspaceId === 'string' && workspaceId !== '' ? { workspaceId } : {}),
            policy,
          }),
        });
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : String(error), 'network', 0, null);
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || payload === null || payload.ok !== true) {
        throw new ApiError(payload?.error ?? `HTTP ${response.status}`, payload?.code ?? 'http', response.status, payload);
      }
      return payload;
    }

    function topologyLayout(org, overrides = {}, minWidth = 0) {
      const roles = Array.isArray(org.roles) ? org.roles : [];
      const roleWidth = 174;
      const leadWidth = 208;
      const nodeHeight = 70;
      const children = new Map([['lead', []]]);
      for (const role of roles) children.set(role.id, []);
      for (const role of roles) {
        const parent = children.has(role.reportsTo) && role.reportsTo !== role.id ? role.reportsTo : 'lead';
        children.get(parent).push(role.id);
      }
      let leafCount = 0;
      const countLeaves = (id, seen = new Set()) => {
        if (seen.has(id)) return 0;
        seen.add(id);
        const kids = (children.get(id) ?? []).filter((kid) => !seen.has(kid));
        if (kids.length === 0) {
          leafCount += 1;
          return 1;
        }
        return kids.reduce((sum, kid) => sum + countLeaves(kid, seen), 0);
      };
      countLeaves('lead');
      leafCount = Math.max(1, leafCount);
      const step = (Math.PI * 2) / leafCount;
      const minChord = leafCount > 1 ? roleWidth / (2 * Math.sin(step / 2)) : 0;
      const baseRadius = Math.max(270, minChord + 30);
      const ringGap = 178;
      const placed = new Map();
      let cursor = -Math.PI / 2;
      const place = (id, depth, seen = new Set()) => {
        if (seen.has(id)) return cursor + step / 2;
        seen.add(id);
        const kids = (children.get(id) ?? []).filter((kid) => !seen.has(kid));
        let angle;
        if (kids.length === 0) {
          angle = cursor + step / 2;
          cursor += step;
        } else {
          const angles = kids.map((kid) => place(kid, depth + 1, new Set(seen)));
          angle = (angles[0] + angles[angles.length - 1]) / 2;
        }
        placed.set(id, { angle, depth });
        return angle;
      };
      place('lead', 0);
      const maxDepth = Math.max(0, ...[...placed.values()].map((point) => point.depth));
      let width = Math.max(940, Number.isFinite(minWidth) ? minWidth : 0, baseRadius * 2.5 + 380);
      let height = Math.max(680, baseRadius * 1.8 + 300);
      const centerX = width / 2;
      const centerY = height / 2 + 16;
      const seedOf = (id) => [...String(id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const nodes = [{
        id: 'lead',
        isLead: true,
        name: org.lead.label,
        title: '',
        accent: '#D9822B',
        enabled: true,
        x: centerX,
        y: centerY - nodeHeight / 2,
        width: leadWidth,
      }];
      for (const role of roles) {
        const point = placed.get(role.id);
        if (point === undefined) continue;
        const seed = seedOf(role.id);
        const angle = point.angle + ((seed % 13) - 6) * 0.004;
        const jitter = ((seed % 17) - 8);
        const ring = Math.max(0, point.depth - 1);
        const rx = baseRadius * 1.18 + ring * ringGap * 1.22 + jitter;
        const ry = baseRadius * 0.78 + ring * ringGap * 0.92 + jitter * 0.5;
        nodes.push({
          id: role.id,
          isLead: false,
          name: role.name,
          title: role.title,
          level: role.level === 'captain' ? 'captain' : 'member',
          accent: role.accent,
          enabled: role.enabled,
          reportsTo: role.reportsTo,
          x: centerX + Math.cos(angle) * rx,
          y: centerY + Math.sin(angle) * ry - nodeHeight / 2,
          width: roleWidth,
        });
      }
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const clampNode = (node) => {
        node.x = Math.max(node.width / 2 + 20, Math.min(6000, node.x));
        node.y = Math.max(20, Math.min(6000, node.y));
      };
      for (const node of nodes) {
        const saved = overrides[node.id] ?? org.layout?.[node.id];
        if (saved !== undefined && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          node.x = saved.x;
          node.y = saved.y;
        }
        clampNode(node);
      }
      const centerOf = (node) => ({ x: node.x, y: node.y + nodeHeight / 2 });
      const anchor = (node, toward) => {
        const from = centerOf(node);
        const dx = toward.x - from.x;
        const dy = toward.y - from.y;
        const halfW = node.width / 2 + 4;
        const halfH = nodeHeight / 2 + 4;
        if (dx === 0 && dy === 0) return { x: from.x, y: from.y };
        const scale = Math.min(
          Math.abs(dx) < 0.001 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx),
          Math.abs(dy) < 0.001 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy),
        );
        return { x: from.x + dx * scale, y: from.y + dy * scale };
      };
      let maxX = 0;
      let maxY = 0;
      for (const node of nodes) {
        maxX = Math.max(maxX, node.x + node.width / 2 + 24);
        maxY = Math.max(maxY, node.y + nodeHeight + 24);
      }
      width = Math.max(width, maxX);
      height = Math.max(height, maxY);
      const edges = [];
      for (const role of roles) {
        const from = nodeById.get(role.reportsTo) ?? nodeById.get('lead');
        const to = nodeById.get(role.id);
        if (from === undefined || to === undefined) continue;
        edges.push({
          id: `primary-${role.id}`,
          kind: 'primary',
          from: anchor(from, centerOf(to)),
          to: anchor(to, centerOf(from)),
        });
      }
      const now = Date.now();
      for (const relation of org.relations ?? []) {
        const from = nodeById.get(relation.from);
        const to = nodeById.get(relation.to);
        if (from === undefined || to === undefined) continue;
        const expiry = relation.expiresAt === null ? Number.POSITIVE_INFINITY : Date.parse(relation.expiresAt);
        edges.push({
          id: relation.id,
          kind: 'extra',
          relation,
          expired: relation.type === 'temporary' && Number.isFinite(expiry) && expiry <= now,
          from: anchor(from, centerOf(to)),
          to: anchor(to, centerOf(from)),
        });
      }
      return {
        width,
        height,
        nodes,
        edges,
        roleById: new Map(roles.map((role) => [role.id, role])),
      };
    }

    function topoEdgePath(edge) {
      return `M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}`;
    }

    function extraEdgePath(edge) {
      return `M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}`;
    }

    function edgePath(edge, index) {
      return edge.kind === 'primary' ? topoEdgePath(edge) : extraEdgePath(edge, index);
    }

    function connectPath(from, to) {
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    }

    function exportEscape(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    function exportShort(value, limit) {
      const text = String(value ?? '');
      return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
    }

    function exportFitText(value, maxWidth, fontSize) {
      const text = String(value ?? '');
      if (text === '') return '';
      const charWidth = (char) => {
        const code = char.codePointAt(0) ?? 0;
        if (code >= 0x2E80 && code <= 0x9FFF) return fontSize;
        if (code >= 0xFF00 && code <= 0xFFEF) return fontSize;
        if (char === ' ') return fontSize * 0.32;
        return fontSize * 0.56;
      };
      let width = 0;
      let out = '';
      for (const char of text) {
        const next = width + charWidth(char);
        if (next > maxWidth) break;
        out += char;
        width = next;
      }
      if (out.length === text.length) return text;
      const ellipsisWidth = fontSize * 0.9;
      while (out.length > 0 && width + ellipsisWidth > maxWidth) {
        const last = [...out].pop();
        out = [...out].slice(0, -1).join('');
        width -= charWidth(last);
      }
      return `${out}…`;
    }

    function wrapExportText(text, maxChars) {
      const source = String(text ?? '');
      const lines = [];
      for (let index = 0; index < source.length; index += maxChars) {
        lines.push(source.slice(index, index + maxChars));
      }
      return lines.length === 0 ? [''] : lines;
    }

    function topologyExportSvg({ org, runs, layout, t, showExtraRelations }) {
      const margin = 44;
      const headerHeight = 98;
      const innerPad = 36;
      const nodeHeight = 70;
      const nodes = layout.nodes;
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const node of nodes) {
        minX = Math.min(minX, node.x - node.width / 2);
        maxX = Math.max(maxX, node.x + node.width / 2);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y + nodeHeight);
      }
      if (!Number.isFinite(minX)) {
        minX = 0;
        maxX = 940;
        minY = 0;
        maxY = 220;
      }
      const contentWidth = Math.max(1, maxX - minX) + innerPad * 2;
      const contentHeight = Math.max(1, maxY - minY) + innerPad * 2;
      const width = Math.max(900, Math.ceil(contentWidth + margin * 2));
      const graphLeft = (width - contentWidth) / 2;
      const roles = new Map((org.roles ?? []).map((role) => [role.id, role]));
      const tableX = margin;
      const tableWidth = width - margin * 2;
      const tableRoleWidth = tableWidth * 0.22;
      const tableMemberWidth = tableWidth * 0.19;
      const tableManagerWidth = tableWidth * 0.15;
      const tableDutyWidth = tableWidth - tableRoleWidth - tableMemberWidth - tableManagerWidth;
      const tableDutyChars = Math.max(18, Math.floor((tableDutyWidth - 18) / 10.5));
      const tableRows = [{
        role: t('exportImageLegendLead'),
        member: org.lead.label,
        duty: org.lead.description || '—',
        manager: '—',
        lead: true,
        enabled: true,
      }, ...(org.roles ?? []).map((role) => ({
        role: role.title,
        member: role.name,
        duty: role.responsibilities || role.instructions || '—',
        manager: role.reportsTo === 'lead' ? org.lead.label : (roles.get(role.reportsTo)?.name ?? org.lead.label),
        lead: false,
        enabled: role.enabled !== false,
      }))];
      const tableRowLines = tableRows.map((row) => wrapExportText(row.duty, tableDutyChars));
      const tableRowHeights = tableRowLines.map((lines) => Math.max(32, 12 + lines.length * 16));
      const tableTitleHeight = 34;
      const tableHeaderHeight = 28;
      const tableTop = headerHeight + contentHeight + 30;
      const tableHeight = tableTitleHeight + tableHeaderHeight + tableRowHeights.reduce((sum, value) => sum + value, 0);
      const footerTop = tableTop + tableHeight + 18;
      const legendItems = [
        ['circle', '#D9822B', t('exportImageLegendLead')],
        ['circle', '#7C6CFF', t('exportImageLegendCaptain')],
        ['circle', '#6E8BFF', t('exportImageLegendMember')],
        ['circle', '#4F7CFF', t('topologyLegendActive')],
        ['solid', '#6E8BFF', t('exportImageLegendReport')],
        ['dash', '#2E9E7B', t('exportImageLegendCollab')],
        ['dash', '#7C6CFF', t('exportImageLegendHandoff')],
        ['dot', '#D9822B', t('exportImageLegendTemp')],
        ['dot', '#A6A9B3', t('exportImageLegendExpired')],
      ];
      const legendColumns = 4;
      const legendRows = Math.ceil(legendItems.length / legendColumns);
      const wrapWidth = Math.max(60, Math.floor((width - margin * 2 - 36) / 7));
      const explanation = [
        t('exportImageExplain1'),
        t('exportImageExplain2'),
        t('exportImageExplain3'),
      ].flatMap((line) => wrapExportText(line, wrapWidth));
      const footerHeight = 48 + legendRows * 24 + 12 + explanation.length * 17 + 18;
      const height = Math.ceil(footerTop + footerHeight);
      const edges = showExtraRelations ? layout.edges : layout.edges.filter((edge) => edge.kind === 'primary');
      const runningByRole = new Map();
      for (const run of runs ?? []) {
        if (run.roleId !== undefined && run.status === 'running') runningByRole.set(run.roleId, run);
      }
      const parts = [];
      parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
      parts.push('<defs>');
      parts.push('<marker id="ao-export-arrow-primary" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" fill="#6E8BFF"/></marker>');
      parts.push('<marker id="ao-export-arrow-extra" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" fill="#7C6CFF"/></marker>');
      parts.push('</defs>');
      parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF"/>`);
      parts.push(`<text x="${margin}" y="38" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="22" font-weight="700" fill="#1F2430">${exportEscape(exportShort(org.teamName || t('exportImageTitle'), 40))}</text>`);
      parts.push(`<text x="${margin}" y="63" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="12" fill="#6B7280">${exportEscape(t('exportImageTitle'))} · ${exportEscape(t('exportImageSubtitle'))} · ${(org.roles ?? []).length + 1} ${exportEscape(t('exportImageMemberCount'))} · ${exportEscape(new Date().toLocaleString())}</text>`);
      parts.push(`<text x="${width - margin}" y="38" text-anchor="end" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="11" fill="#6B7280">${exportEscape(showExtraRelations ? t('exportImageExtraShown') : t('exportImageExtraHidden'))}</text>`);
      parts.push(`<g transform="translate(${graphLeft + innerPad - minX}, ${headerHeight + innerPad - minY})">`);
      for (const edge of edges) {
        const relation = edge.relation;
        let stroke = '#6E8BFF';
        let dash = '';
        let marker = 'ao-export-arrow-primary';
        let strokeWidth = 2;
        if (edge.kind === 'extra') {
          marker = 'ao-export-arrow-extra';
          if (relation?.type === 'temporary') {
            stroke = edge.expired ? '#A6A9B3' : '#D9822B';
            dash = '2 5';
            strokeWidth = 1.7;
          } else if (relation?.type === 'handoff') {
            stroke = '#7C6CFF';
            dash = '6 4';
          } else if (relation?.type === 'reports') {
            stroke = '#6E8BFF';
            dash = '5 4';
          } else {
            stroke = '#2E9E7B';
            dash = '6 4';
          }
        }
        parts.push(`<path d="M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${marker})"/>`);
      }
      for (const node of nodes) {
        const role = node.isLead ? null : roles.get(node.id);
        const x = node.x - node.width / 2;
        const y = node.y;
        const accent = node.accent || '#7C6CFF';
        const isLead = node.isLead;
        const clipId = `ao-export-node-${node.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const textWidth = node.width - 36;
        parts.push(`<clipPath id="${clipId}"><rect x="${x + 2}" y="${y + 2}" width="${node.width - 4}" height="${nodeHeight - 4}" rx="10"/></clipPath>`);
        parts.push(`<g opacity="${node.enabled === false ? '0.55' : '1'}">`);
        parts.push(`<rect x="${x}" y="${y}" width="${node.width}" height="${nodeHeight}" rx="12" fill="${isLead ? '#FFF8ED' : '#FFFFFF'}" stroke="${isLead ? '#D9822B' : accent}" stroke-width="${isLead ? 2 : 1.3}"/>`);
        parts.push(`<rect x="${x}" y="${y + 12}" width="4" height="${nodeHeight - 24}" rx="2" fill="${isLead ? '#D9822B' : accent}"/>`);
        parts.push(`<g clip-path="url(#${clipId})">`);
        parts.push(`<text x="${x + 16}" y="${y + 28}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="13" font-weight="600" fill="#1F2430">${exportEscape(exportFitText(node.name, textWidth, 13))}</text>`);
        const subtitle = isLead ? t('exportImageLegendLead') : `${node.title ?? ''}${node.level === 'captain' ? ` · ${t('exportImageLegendCaptain')}` : ''}`;
        parts.push(`<text x="${x + 16}" y="${y + 48}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" fill="#6B7280">${exportEscape(exportFitText(subtitle, textWidth, 10.5))}</text>`);
        const manager = isLead ? '' : (role?.reportsTo === 'lead' ? t('exportImageLegendLead') : roles.get(role?.reportsTo)?.name ?? '');
        if (manager !== '') {
          parts.push(`<text x="${x + 16}" y="${y + 62}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="9.5" fill="#9CA3AF">${exportEscape(exportFitText(`↑ ${manager}`, textWidth, 9.5))}</text>`);
        }
        parts.push('</g>');
        if (runningByRole.has(node.id)) {
          parts.push(`<circle cx="${x + node.width - 15}" cy="${y + 17}" r="4" fill="#4F7CFF"/>`);
        }
        parts.push('</g>');
      }
      parts.push('</g>');
      parts.push(`<rect x="${tableX}" y="${tableTop}" width="${tableWidth}" height="${tableHeight}" rx="10" fill="#FBFCFE" stroke="#D9DEE8"/>`);
      parts.push(`<text x="${tableX + 14}" y="${tableTop + 23}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="13" font-weight="600" fill="#1F2430">${exportEscape(t('exportResponsibilityTitle'))}</text>`);
      const tableHeaderY = tableTop + tableTitleHeight;
      const colRole = tableX;
      const colMember = colRole + tableRoleWidth;
      const colDuty = colMember + tableMemberWidth;
      const colManager = colDuty + tableDutyWidth;
      parts.push(`<rect x="${tableX}" y="${tableHeaderY}" width="${tableWidth}" height="${tableHeaderHeight}" fill="#EEF2F8"/>`);
      parts.push(`<text x="${colRole + 10}" y="${tableHeaderY + 18}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" font-weight="600" fill="#4B5563">${exportEscape(t('exportTableRole'))}</text>`);
      parts.push(`<text x="${colMember + 10}" y="${tableHeaderY + 18}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" font-weight="600" fill="#4B5563">${exportEscape(t('exportTableMember'))}</text>`);
      parts.push(`<text x="${colDuty + 10}" y="${tableHeaderY + 18}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" font-weight="600" fill="#4B5563">${exportEscape(t('exportTableDuty'))}</text>`);
      parts.push(`<text x="${colManager + 10}" y="${tableHeaderY + 18}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" font-weight="600" fill="#4B5563">${exportEscape(t('exportTableManager'))}</text>`);
      let rowTop = tableHeaderY + tableHeaderHeight;
      tableRows.forEach((row, index) => {
        const rowHeight = tableRowHeights[index];
        if (row.lead) {
          parts.push(`<rect x="${tableX}" y="${rowTop}" width="${tableWidth}" height="${rowHeight}" fill="#FFF8ED"/>`);
        } else if (index % 2 === 0) {
          parts.push(`<rect x="${tableX}" y="${rowTop}" width="${tableWidth}" height="${rowHeight}" fill="#F8FAFD"/>`);
        }
        parts.push(`<path d="M ${tableX} ${rowTop} L ${tableX + tableWidth} ${rowTop}" stroke="#E2E5EC" stroke-width="1"/>`);
        parts.push(`<text x="${colRole + 10}" y="${rowTop + 20}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" font-weight="600" fill="#374151">${exportEscape(exportFitText(row.role, tableRoleWidth - 20, 10.5))}</text>`);
        parts.push(`<text x="${colMember + 10}" y="${rowTop + 20}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" fill="#4B5563">${exportEscape(exportFitText(row.member, tableMemberWidth - 20, 10.5))}</text>`);
        parts.push(`<text x="${colManager + 10}" y="${rowTop + 20}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" fill="#6B7280">${exportEscape(exportFitText(row.manager, tableManagerWidth - 20, 10.5))}</text>`);
        tableRowLines[index].forEach((line, lineIndex) => {
          parts.push(`<text x="${colDuty + 10}" y="${rowTop + 19 + lineIndex * 16}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" fill="#4B5563">${exportEscape(exportFitText(line, tableDutyWidth - 20, 10.5))}</text>`);
        });
        rowTop += rowHeight;
      });
      [colMember, colDuty, colManager].forEach((x) => {
        parts.push(`<path d="M ${x} ${tableHeaderY} L ${x} ${tableTop + tableHeight}" stroke="#E2E5EC" stroke-width="1"/>`);
      });
      parts.push(`<rect x="${tableX}" y="${tableTop}" width="${tableWidth}" height="${tableHeight}" rx="10" fill="none" stroke="#D9DEE8"/>`);
      parts.push(`<rect x="${margin}" y="${footerTop}" width="${width - margin * 2}" height="${footerHeight - 12}" rx="10" fill="#F7F8FC" stroke="#E2E5EC"/>`);
      parts.push(`<text x="${margin + 14}" y="${footerTop + 24}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="13" font-weight="600" fill="#1F2430">${exportEscape(t('exportImageExplainTitle'))}</text>`);
      const legendX = margin + 14;
      const legendY = footerTop + 46;
      legendItems.forEach(([kind, color, label], index) => {
        const col = index % legendColumns;
        const row = Math.floor(index / legendColumns);
        const x = legendX + col * Math.max(140, (width - margin * 2 - 28) / legendColumns);
        const y = legendY + row * 24;
        if (kind === 'circle') parts.push(`<circle cx="${x + 5}" cy="${y - 4}" r="4.5" fill="${color}"/>`);
        else if (kind === 'solid') parts.push(`<path d="M ${x} ${y - 4} L ${x + 18} ${y - 4}" stroke="${color}" stroke-width="2"/>`);
        else if (kind === 'dash') parts.push(`<path d="M ${x} ${y - 4} L ${x + 18} ${y - 4}" stroke="${color}" stroke-width="2" stroke-dasharray="5 3"/>`);
        else parts.push(`<path d="M ${x} ${y - 4} L ${x + 18} ${y - 4}" stroke="${color}" stroke-width="2" stroke-dasharray="2 4"/>`);
        parts.push(`<text x="${x + 25}" y="${y}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" fill="#4B5563">${exportEscape(label)}</text>`);
      });
      const explainTop = legendY + legendRows * 24 + 7;
      explanation.forEach((line, index) => {
        parts.push(`<text x="${legendX}" y="${explainTop + index * 17}" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="10.5" fill="#6B7280">${exportEscape(line)}</text>`);
      });
      parts.push('</svg>');
      return { svg: parts.join(''), width, height };
    }

    function downloadTopologyImage(options) {
      const { svg, width, height } = topologyExportSvg(options);
      const scale = 2;
      return new Promise((resolve, reject) => {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const context = canvas.getContext('2d');
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((png) => {
              URL.revokeObjectURL(url);
              if (png === null) {
                reject(new Error('PNG 编码失败'));
                return;
              }
              const anchor = document.createElement('a');
              const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
              anchor.href = URL.createObjectURL(png);
              anchor.download = `team-relations-${timestamp}.png`;
              document.body.append(anchor);
              anchor.click();
              anchor.remove();
              setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
              resolve();
            }, 'image/png');
          } catch (error) {
            URL.revokeObjectURL(url);
            reject(error);
          }
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('SVG 渲染失败'));
        };
        image.src = url;
      });
    }

    function Topology({ org, runs, selectedId, selectedEdgeId, onSelect, onEdgeSelect, onNodeMove, onConnect, onNodeMenu, onAddMember, canAddMember, onAutoLayout, autoLayoutAvailable, interactive, onInteractionChange, t }) {
      const [dragPositions, setDragPositions] = React.useState({});
      const [connect, setConnect] = React.useState(null);
      const [hoveredEdgeId, setHoveredEdgeId] = React.useState(null);
      const [showExtraRelations, setShowExtraRelations] = React.useState(false);
      const [zoom, setZoom] = React.useState(1);
      const [expanded, setExpanded] = React.useState(false);
      const [panning, setPanning] = React.useState(false);
      const [exporting, setExporting] = React.useState(false);
      const centeredRef = React.useRef(false);
      const dragRef = React.useRef(null);
      const connectRef = React.useRef(null);
      const canvasRef = React.useRef(null);
      const scrollRef = React.useRef(null);
      const suppressClickRef = React.useRef(null);
      const suppressEdgeClickRef = React.useRef(false);
      const panRef = React.useRef(null);
      const zoomAnchorRef = React.useRef(null);
      const touchRef = React.useRef(new Map());
      const pinchRef = React.useRef(null);
      const zoomRef = React.useRef(zoom);
      zoomRef.current = zoom;
      const layout = topologyLayout(org, dragPositions, 0);
      const canvasGutter = 1200 * zoom;
      const extraEdgeCount = layout.edges.filter((edge) => edge.kind === 'extra').length;
      const visibleEdges = showExtraRelations ? layout.edges : layout.edges.filter((edge) => edge.kind === 'primary');
      const centerScroll = () => {
        const element = scrollRef.current;
        if (element === null) return;
        element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
        element.scrollTop = Math.max(0, (element.scrollHeight - element.clientHeight) / 2);
      };
      React.useEffect(() => {
        const frame = requestAnimationFrame(() => {
          if (centeredRef.current) return;
          centeredRef.current = true;
          centerScroll();
        });
        return () => cancelAnimationFrame(frame);
      }, [layout.width, layout.height]);
      React.useEffect(() => {
        centeredRef.current = false;
      }, [expanded]);
      React.useEffect(() => {
        if (!expanded) return undefined;
        const onKey = (event) => {
          if (event.key === 'Escape') setExpanded(false);
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
      }, [expanded]);
      const fitZoom = () => {
        const element = scrollRef.current;
        if (element === null) return;
        const next = Math.min(1.8, Math.max(0.35, Math.min((element.clientWidth - 40) / layout.width, (element.clientHeight - 40) / layout.height)));
        setZoom(Math.round(next * 100) / 100);
        requestAnimationFrame(centerScroll);
      };
      React.useEffect(() => {
        const element = scrollRef.current;
        if (element === null) return undefined;
        const onWheel = (event) => {
          if (event.deltaY === 0) return;
          event.preventDefault();
          const rect = element.getBoundingClientRect();
          const px = Math.max(0, Math.min(element.clientWidth, event.clientX - rect.left));
          const py = Math.max(0, Math.min(element.clientHeight, event.clientY - rect.top));
          const current = zoomRef.current;
          const factor = Math.exp(-event.deltaY * 0.0015);
          const next = Math.min(1.8, Math.max(0.35, Math.round(current * factor * 100) / 100));
          if (next === current) return;
          zoomAnchorRef.current = {
            contentX: (element.scrollLeft + px) / current,
            contentY: (element.scrollTop + py) / current,
            px,
            py,
          };
          setZoom(next);
        };
        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
      }, [layout.width, layout.height]);
      React.useEffect(() => {
        const anchor = zoomAnchorRef.current;
        if (anchor === null) return;
        const element = scrollRef.current;
        if (element !== null) {
          element.scrollLeft = Math.max(0, anchor.contentX * zoom - anchor.px);
          element.scrollTop = Math.max(0, anchor.contentY * zoom - anchor.py);
        }
        zoomAnchorRef.current = null;
      }, [zoom]);
      const pinchPoints = () => [...touchRef.current.values()].slice(0, 2);
      const beginPinch = () => {
        const points = pinchPoints();
        if (points.length < 2) return;
        const element = scrollRef.current;
        if (element === null) return;
        const rect = element.getBoundingClientRect();
        const midX = (points[0].clientX + points[1].clientX) / 2;
        const midY = (points[0].clientY + points[1].clientY) / 2;
        const px = midX - rect.left;
        const py = midY - rect.top;
        const current = zoomRef.current;
        pinchRef.current = {
          startDistance: Math.max(1, Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY)),
          startZoom: current,
          contentX: (element.scrollLeft + px) / current,
          contentY: (element.scrollTop + py) / current,
        };
        panRef.current = null;
        setPanning(false);
        onInteractionChange?.(false);
      };
      const movePinch = (event) => {
        const pinch = pinchRef.current;
        const points = pinchPoints();
        const element = scrollRef.current;
        if (pinch === null || points.length < 2 || element === null) return;
        event.preventDefault();
        const distance = Math.max(1, Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY));
        const next = Math.min(1.8, Math.max(0.35, Math.round(pinch.startZoom * (distance / pinch.startDistance) * 100) / 100));
        const rect = element.getBoundingClientRect();
        const px = (points[0].clientX + points[1].clientX) / 2 - rect.left;
        const py = (points[0].clientY + points[1].clientY) / 2 - rect.top;
        if (next !== zoomRef.current) {
          zoomAnchorRef.current = { contentX: pinch.contentX, contentY: pinch.contentY, px, py };
          setZoom(next);
        } else {
          element.scrollLeft = Math.max(0, pinch.contentX * next - px);
          element.scrollTop = Math.max(0, pinch.contentY * next - py);
        }
      };
      const beginPan = (event) => {
        if (event.pointerType === 'touch') {
          touchRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
          if (touchRef.current.size >= 2) {
            beginPinch();
            return;
          }
        }
        if (event.button !== 0) return;
        const target = event.target;
        if (target?.closest?.('.ao_node, .ao_nodePort, .ao_nodeMenuButton, .ao_connectLayer')) return;
        const element = scrollRef.current;
        if (element === null) return;
        panRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: element.scrollLeft,
          startTop: element.scrollTop,
          moved: false,
        };
        element.setPointerCapture?.(event.pointerId);
        onInteractionChange?.(true);
        setPanning(true);
      };
      const movePan = (event) => {
        if (event.pointerType === 'touch') {
          if (touchRef.current.has(event.pointerId)) {
            touchRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
          }
          if (touchRef.current.size >= 2) {
            movePinch(event);
            return;
          }
        }
        const pan = panRef.current;
        const element = scrollRef.current;
        if (pan === null || element === null) return;
        event.preventDefault();
        if (Math.abs(event.clientX - pan.startX) + Math.abs(event.clientY - pan.startY) > 4) {
          pan.moved = true;
        }
        element.scrollLeft = Math.max(0, pan.startLeft - (event.clientX - pan.startX));
        element.scrollTop = Math.max(0, pan.startTop - (event.clientY - pan.startY));
      };
      const endPan = (event) => {
        if (event.pointerType === 'touch') {
          touchRef.current.delete(event.pointerId);
          if (touchRef.current.size < 2) pinchRef.current = null;
        }
        const pan = panRef.current;
        if (pan === null) return;
        const element = scrollRef.current;
        element?.releasePointerCapture?.(pan.pointerId);
        panRef.current = null;
        setPanning(false);
        if (pan.moved) {
          suppressEdgeClickRef.current = true;
          setTimeout(() => { suppressEdgeClickRef.current = false; }, 0);
        }
      };
      const latestByRole = new Map();
      for (const run of runs ?? []) {
        if (run === null || run === undefined || typeof run.roleId !== 'string') continue;
        if (!latestByRole.has(run.roleId)) latestByRole.set(run.roleId, run);
      }
      const roleById = new Map((org.roles ?? []).map((role) => [role.id, role]));
      const edgeById = new Map(layout.edges.map((edge) => [edge.id, edge]));
      const pathForRole = (roleId) => {
        const path = [];
        const seen = new Set();
        let current = roleId;
        while (current !== 'lead' && !seen.has(current)) {
          seen.add(current);
          path.push(`primary-${current}`);
          const role = roleById.get(current);
          const parent = role?.reportsTo;
          current = parent !== undefined && parent !== current && roleById.has(parent) ? parent : 'lead';
        }
        return path.reverse();
      };
      const runStatusLabel = (status) => ({
        running: t('statusRunning'),
        completed: t('statusCompleted'),
        failed: t('statusFailed'),
        aborted: t('statusAborted'),
        pending: t('statusPending'),
      }[status] ?? status);
      const runDuration = (run) => {
        const started = Date.parse(run.startedAt ?? '');
        if (run.status === 'running') {
          return Number.isFinite(started) ? formatDuration(Math.max(0, Date.now() - started), t) : '';
        }
        if (Number.isFinite(run.durationMs)) return formatDuration(run.durationMs, t);
        const finished = Date.parse(run.finishedAt ?? '');
        return Number.isFinite(started) && Number.isFinite(finished)
          ? formatDuration(Math.max(0, finished - started), t)
          : '';
      };
      const processPriority = { running: 3, failed: 2, aborted: 2, completed: 1, pending: 0 };
      const edgeRuns = new Map();
      const badgeRuns = [];
      for (const [roleId, run] of latestByRole) {
        const finalEdge = edgeById.get(`primary-${roleId}`);
        if (finalEdge === undefined) continue;
        for (const edgeId of pathForRole(roleId)) {
          const current = edgeRuns.get(edgeId);
          if (current === undefined || (processPriority[run.status] ?? 0) > (processPriority[current.status] ?? 0)) {
            edgeRuns.set(edgeId, run);
          }
        }
        const finishedAt = Date.parse(run.finishedAt ?? run.startedAt ?? '');
        const age = run.status === 'running' || !Number.isFinite(finishedAt) ? 0 : Date.now() - finishedAt;
        badgeRuns.push({
          roleId,
          run,
          x: (finalEdge.from.x + finalEdge.to.x) / 2,
          y: (finalEdge.from.y + finalEdge.to.y) / 2,
          muted: age > 15 * 60 * 1000,
        });
      }
      const latestRuns = [...latestByRole.values()];
      const runningCount = latestRuns.filter((run) => run.status === 'running').length;
      const completedCount = latestRuns.filter((run) => run.status === 'completed').length;
      const failedCount = latestRuns.filter((run) => run.status === 'failed' || run.status === 'aborted').length;
      const reduceMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const activeRoles = new Set(latestRuns.filter((run) => run.status === 'running').map((run) => run.roleId));
      const now = Date.now();
      const beginDrag = (node, event) => {
        if (!interactive || typeof onNodeMove !== 'function' || dragRef.current !== null) return;
        event.stopPropagation();
        onInteractionChange?.(true);
        const captureElement = event.currentTarget;
        captureElement.setPointerCapture?.(event.pointerId);
        const onMove = (moveEvent) => moveDrag(moveEvent);
        const onEnd = (endEvent) => endDrag(endEvent);
        dragRef.current = {
          id: node.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startNodeX: node.x,
          startNodeY: node.y,
          moved: false,
          pending: null,
          frame: null,
          captureElement,
          onMove,
          onEnd,
        };
        window.addEventListener('pointermove', onMove, { capture: true, passive: false });
        window.addEventListener('pointerup', onEnd, true);
        window.addEventListener('pointercancel', onEnd, true);
      };
      const applyDragPoint = (drag) => {
        if (drag.pending === null) return;
        const point = drag.pending;
        drag.pending = null;
        const dx = (point.clientX - drag.startX) / zoom;
        const dy = (point.clientY - drag.startY) / zoom;
        if (!drag.moved) {
          // Touch taps carry a few pixels of jitter. Do not start moving the
          // node until the finger has clearly left the tap threshold.
          const screenDistance = Math.hypot(point.clientX - drag.startX, point.clientY - drag.startY);
          if (screenDistance < 4) return;
          drag.moved = true;
        }
        const node = layout.nodes.find((candidate) => candidate.id === drag.id);
        if (node === undefined) return;
        const x = Math.max(node.width / 2 + 8, Math.min(4000, drag.startNodeX + dx));
        const y = Math.max(20, Math.min(4000, drag.startNodeY + dy));
        drag.last = { x, y };
        setDragPositions((previous) => ({ ...previous, [drag.id]: { x, y } }));
      };
      const moveDrag = (event) => {
        const drag = dragRef.current;
        if (drag === null || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
        if (event.pointerType === 'touch') event.preventDefault();
        drag.pending = { clientX: event.clientX, clientY: event.clientY };
        if (drag.frame !== null) return;
        drag.frame = requestAnimationFrame(() => {
          drag.frame = null;
          applyDragPoint(drag);
        });
      };
      const endDrag = (event) => {
        const drag = dragRef.current;
        if (drag === null || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
        if (drag.frame !== null) {
          cancelAnimationFrame(drag.frame);
          drag.frame = null;
        }
        applyDragPoint(drag);
        dragRef.current = null;
        onInteractionChange?.(false);
        window.removeEventListener('pointermove', drag.onMove, true);
        window.removeEventListener('pointerup', drag.onEnd, true);
        window.removeEventListener('pointercancel', drag.onEnd, true);
        if (drag.pointerId !== undefined) {
          try { drag.captureElement?.releasePointerCapture?.(drag.pointerId); } catch { /* pointer already released */ }
        }
        if (drag.moved && drag.last !== undefined) {
          suppressClickRef.current = drag.id;
          onNodeMove(drag.id, drag.last);
          setTimeout(() => {
            if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
          }, 0);
        }
        setDragPositions((previous) => {
          const next = { ...previous };
          delete next[drag.id];
          return next;
        });
      };
      const connectPoint = (event) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        return {
          x: rect === undefined ? event.clientX : (event.clientX - rect.left) / zoom,
          y: rect === undefined ? event.clientY : (event.clientY - rect.top) / zoom,
        };
      };
      const connectTarget = (event) => {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const target = element?.closest?.('[data-ao-node-id]');
        return target?.getAttribute('data-ao-node-id') ?? null;
      };
      const beginConnect = (node, event) => {
        if (!interactive || typeof onConnect !== 'function') return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const next = {
          from: node.id,
          start: { x: node.x, y: node.y + 82 },
          point: connectPoint(event),
          target: null,
        };
        connectRef.current = next;
        setConnect(next);
      };
      const moveConnect = (event) => {
        const current = connectRef.current;
        if (current === null) return;
        event.preventDefault();
        const target = connectTarget(event);
        const next = {
          ...current,
          point: connectPoint(event),
          target: target === current.from ? null : target,
        };
        connectRef.current = next;
        setConnect(next);
      };
      const endConnect = (event) => {
        const current = connectRef.current;
        if (current === null) return;
        event.preventDefault();
        event.stopPropagation();
        const target = connectTarget(event);
        connectRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        setConnect(null);
        if (target !== null && target !== current.from) onConnect(current.from, target);
      };
      const cancelConnect = () => {
        connectRef.current = null;
        setConnect(null);
      };
      const exportGraph = async () => {
        if (exporting) return;
        setExporting(true);
        try {
          await downloadTopologyImage({ org, runs, layout, t, showExtraRelations });
        } catch (error) {
          console.warn('[agent-org] could not export relationship image:', error);
          window.alert(t('exportImageFailed'));
        } finally {
          setExporting(false);
        }
      };
      const canvasActions = interactive ? h(
            'div',
            { className: 'ao_canvasActions' },
            typeof onAddMember === 'function' ? h(
              'button',
              {
                type: 'button',
                className: 'ao_canvasAction ao_addMemberFloat',
                onClick: onAddMember,
                disabled: canAddMember === false,
                title: canAddMember === false ? t('roleLimit', { count: 80 }) : t('addMember'),
              },
              '+',
              h('span', null, t('addMember')),
            ) : null,
            typeof onAutoLayout === 'function' ? h(
              'button',
              {
                type: 'button',
                className: 'ao_canvasAction ao_autoLayoutFloat',
                onClick: onAutoLayout,
              },
              h(Icon, { name: 'refresh', size: 13 }),
              h('span', null, t('autoLayout')),
            ) : null,
            extraEdgeCount > 0 ? h(
              'button',
              {
                type: 'button',
                className: cx('ao_canvasAction ao_extraRelationsToggle', showExtraRelations && 'ao_canvasActionActive'),
                onClick: () => setShowExtraRelations((value) => !value),
                title: showExtraRelations ? t('hideExtraRelations') : t('showExtraRelations'),
                'aria-pressed': showExtraRelations,
              },
              h(Icon, { name: 'org', size: 13 }),
              h('span', null, showExtraRelations ? t('hideExtraRelations') : t('showExtraRelations')),
            ) : null,
            h(
              'button',
              {
                type: 'button',
                className: 'ao_canvasAction ao_exportImage',
                onClick: () => void exportGraph(),
                disabled: exporting,
                title: t('exportImage'),
              },
              h('span', { 'aria-hidden': 'true' }, '⇩'),
              h('span', null, exporting ? t('exportImageBusy') : t('exportImage')),
            ),
          ) : null;

      return h(
        'div',
        { className: cx('ao_topologyShell', expanded && 'ao_topologyShellExpanded') },
        h(
          'div',
          { className: 'ao_graphToolbar' },
          canvasActions,
          h(
            'div',
            { className: 'ao_zoomControls', role: 'group', 'aria-label': t('zoomControls') },
            h('button', {
              type: 'button',
              className: 'ao_canvasAction ao_zoomButton',
              onClick: () => setZoom((value) => Math.max(0.35, Math.round((value - 0.1) * 100) / 100)),
              title: t('zoomOut'),
              'aria-label': t('zoomOut'),
            }, '−'),
            h('span', { className: 'ao_zoomValue', 'aria-live': 'polite' }, `${Math.round(zoom * 100)}%`),
            h('button', {
              type: 'button',
              className: 'ao_canvasAction ao_zoomButton',
              onClick: () => setZoom((value) => Math.min(1.8, Math.round((value + 0.1) * 100) / 100)),
              title: t('zoomIn'),
              'aria-label': t('zoomIn'),
            }, '+'),
            h('button', {
              type: 'button',
              className: 'ao_canvasAction',
              onClick: fitZoom,
              title: t('fitGraph'),
              'aria-label': t('fitGraph'),
            }, t('fitGraph')),
            h('button', {
              type: 'button',
              className: cx('ao_canvasAction', expanded && 'ao_canvasActionActive'),
              onClick: () => setExpanded((value) => !value),
              title: expanded ? t('exitFullscreen') : t('fullscreen'),
              'aria-label': expanded ? t('exitFullscreen') : t('fullscreen'),
              'aria-pressed': expanded,
            }, '⛶', h('span', null, expanded ? t('exitFullscreen') : t('fullscreen'))),
          ),
        ),
        h(
          'div',
          { className: 'ao_topologyLegend' },
          h('span', null, h('span', { className: 'ao_legendDot', style: { color: '#D9822B' } }), t('topologyLegendLead')),
          h('span', null, h('span', { className: 'ao_legendDot', style: { color: 'var(--dsw-alias-label-tertiary)' } }), t('topologyLegendMember')),
          h('span', null, h('span', { className: 'ao_legendLine', style: { borderTopColor: '#6E8BFF' } }), t('topologyLegendReport')),
          h('span', null, h('span', { className: 'ao_legendDash', style: { borderTopColor: '#2E9E7B' } }), t('topologyLegendCollab')),
          h('span', null, h('span', { className: 'ao_legendDash', style: { borderTopColor: '#7C6CFF' } }), t('relationHandoff')),
          h('span', null, h('span', { className: 'ao_legendDot', style: { color: 'var(--dsw-alias-state-business-primary)' } }), t('topologyLegendActive')),
          h('span', null, h('span', { className: 'ao_legendFlow' }), t('topologyLegendFlow')),
          h('span', null, h('span', { className: 'ao_legendDash', style: { borderColor: '#D9822B', borderTopStyle: 'dotted' } }), t('topologyLegendTemp')),
        ),
        interactive || latestRuns.length > 0 ? h(
          'div',
          { className: 'ao_topologyProcess' },
          h('span', { className: 'ao_processTitle' }, t('collaborationProcess')),
          latestRuns.length === 0
            ? h('span', { className: 'ao_processEmpty' }, t('topologyNoRuns'))
            : h(React.Fragment, null,
                h('span', { className: 'ao_processChip ao_processRunning' }, h('span', { className: 'ao_dot ao_dotPulse' }), `${runningCount} ${t('statusRunning')}`),
                h('span', { className: 'ao_processChip ao_processDone' }, h('span', { className: 'ao_dot' }), `${completedCount} ${t('statusCompleted')}`),
                failedCount > 0 ? h('span', { className: 'ao_processChip ao_processFailed' }, h('span', { className: 'ao_dot' }), `${failedCount} ${t('statusFailed')}`) : null,
              ),
        ) : null,
        h(
          'div',
          {
            ref: scrollRef,
            className: cx('ao_topologyScroll', panning && 'ao_topologyScrollPanning'),
            role: 'group',
            'aria-label': t('relationshipTopology'),
            onPointerDown: beginPan,
            onPointerMove: movePan,
            onPointerUp: endPan,
            onPointerCancel: endPan,
          },
          h(
            'div',
            { className: 'ao_zoomSurface', style: { width: `${layout.width * zoom + canvasGutter * 2}px`, height: `${layout.height * zoom + canvasGutter * 2}px` } },
            h(
            'div',
            { ref: canvasRef, className: 'ao_topologyCanvas', style: { position: 'absolute', left: `${canvasGutter}px`, top: `${canvasGutter}px`, width: `${layout.width}px`, height: `${layout.height}px`, transform: `scale(${zoom})`, transformOrigin: 'top left' } },
            h(
              'svg',
            { className: cx('ao_edges', hoveredEdgeId !== null && 'ao_edgesHover'), width: layout.width, height: layout.height, 'aria-hidden': 'true' },
            h(
              'defs',
              null,
              h('marker', {
                id: 'ao-arrow',
                viewBox: '0 0 8 8',
                refX: 7,
                refY: 4,
                markerWidth: 6,
                markerHeight: 6,
                orient: 'auto-start-reverse',
              }, h('path', { d: 'M0,0 L8,4 L0,8 Z', style: { fill: 'var(--dsw-alias-label-caption)' } })),
              h('marker', {
                id: 'ao-arrow-extra',
                viewBox: '0 0 8 8',
                refX: 7,
                refY: 4,
                markerWidth: 6,
                markerHeight: 6,
                orient: 'auto-start-reverse',
              }, h('path', { d: 'M0,0 L8,4 L0,8 Z', style: { fill: 'var(--dsw-alias-state-business-primary)' } })),
            ),
            visibleEdges.map((edge, index) => {
              const path = edgePath(edge, index);
              const selected = selectedEdgeId === edge.id;
              const expired = edge.kind === 'extra' && edge.relation.type === 'temporary'
                && (edge.relation.expiresAt === null ? false : Date.parse(edge.relation.expiresAt) <= now);
              const hovered = hoveredEdgeId === edge.id;
              const run = edgeRuns.get(edge.id);
              const processClass = run === undefined
                ? null
                : run.status === 'running'
                  ? 'ao_edgeRunning'
                  : run.status === 'completed'
                    ? 'ao_edgeDone'
                    : 'ao_edgeFailed';
              const processMuted = run !== undefined && run.status !== 'running' && badgeRuns.some((badge) => badge.run === run && badge.muted);
              const classes = edge.kind === 'primary'
                ? cx('ao_edge', processClass, processMuted && 'ao_edgeProcessMuted', hovered && 'ao_edgeHovered', hoveredEdgeId !== null && !hovered && 'ao_edgeDimmed')
                : cx(
                    'ao_edge ao_edgeExtra',
                    edge.relation.type === 'reports' && 'ao_edgeExtraReports',
                    edge.relation.type === 'handoff' && 'ao_edgeHandoff',
                    edge.relation.type === 'collaborates' && 'ao_edgeCollab',
                    edge.relation.type === 'temporary' && 'ao_edgeTemp',
                    expired && 'ao_edgeExpired',
                    selected && 'ao_edgeSelected',
                    processClass,
                    processMuted && 'ao_edgeProcessMuted',
                    hovered && 'ao_edgeHovered',
                    hoveredEdgeId !== null && !hovered && 'ao_edgeDimmed',
                  );
              return h(
                'g',
                { key: edge.id },
                interactive && onEdgeSelect ? h('path', {
                  className: 'ao_edgeHit',
                  d: path,
                  title: edge.kind === 'primary'
                    ? t('relationPrimary')
                    : `${relationTypeLabel(t, edge.relation?.type)}${edge.relation?.label ? ` · ${edge.relation.label}` : ''}`,
                  onPointerEnter: () => setHoveredEdgeId(edge.id),
                  onPointerLeave: () => setHoveredEdgeId(null),
                  onClick: (event) => {
                    event.stopPropagation();
                    if (suppressEdgeClickRef.current) {
                      suppressEdgeClickRef.current = false;
                      return;
                    }
                    onEdgeSelect(edge);
                  },
                }) : null,
                h('path', {
                  className: classes,
                  d: path,
                  markerEnd: edge.kind === 'primary' || edge.relation?.type === 'reports' || edge.relation?.type === 'temporary' || edge.relation?.type === 'handoff'
                    ? (edge.kind === 'primary' ? 'url(#ao-arrow)' : 'url(#ao-arrow-extra)')
                    : undefined,
                }),
                run?.status === 'running' && !reduceMotion ? h(
                  'circle',
                  { r: 2.8, className: 'ao_edgeFlow' },
                  h('animateMotion', { dur: '1.7s', repeatCount: 'indefinite', path }),
                ) : null,
              );
            }),
          ),
          connect === null ? null : h(
            'svg',
            { className: 'ao_connectLayer', width: layout.width, height: layout.height, 'aria-hidden': 'true' },
            h('path', { className: 'ao_connectPath', d: connectPath(connect.start, connect.point) }),
          ),
          badgeRuns.filter(({ run }) => run.status === 'running').map(({ roleId, run, x, y }, badgeIndex) => {
            const duration = runDuration(run);
            const stateClass = 'ao_edgeProcessBadgeRunning';
            return h(
              'span',
              {
                key: `process-${roleId}`,
                className: cx('ao_edgeProcessBadge', stateClass),
                style: { left: `${x}px`, top: `${y + (badgeIndex % 2 === 0 ? -5 : 5)}px` },
                title: run.task || undefined,
                'aria-label': `${run.roleName}: ${runStatusLabel(run.status)}${run.task ? ` · ${run.task}` : ''}`,
              },
              h('span', { className: cx('ao_dot', run.status === 'running' && 'ao_dotPulse') }),
              `${runStatusLabel(run.status)}${duration === '' ? '' : ` · ${duration}`}`,
            );
          }),
          layout.nodes.map((node) => {
            const active = activeRoles.has(node.id);
            const selected = selectedId === node.id;
            const run = latestByRole.get(node.id);
            const runClass = run?.status === 'running'
              ? 'ao_nodeRunRunning'
              : run?.status === 'completed'
                ? 'ao_nodeRunCompleted'
                : run?.status === 'failed' || run?.status === 'aborted'
                  ? 'ao_nodeRunFailed'
                  : null;
            const runDurationText = run === undefined ? '' : runDuration(run);
            return h(
              interactive ? 'button' : 'div',
              {
                key: node.id,
                type: interactive ? 'button' : undefined,
                className: cx(
                  'ao_node',
                  node.isLead && 'ao_nodeLead',
                  selected && 'ao_nodeSelected',
                  active && 'ao_nodeActive',
                  runClass,
                  connect?.target === node.id && connect.from !== node.id && 'ao_nodeConnectTarget',
                  dragRef.current?.id === node.id && 'ao_nodeDragging',
                ),
                'data-ao-node-id': node.id,
                title: run?.task || undefined,
                style: {
                  left: `${node.x - node.width / 2}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                },
                onClick: interactive ? () => {
                  if (suppressClickRef.current === node.id) {
                    suppressClickRef.current = null;
                    return;
                  }
                  onSelect(node.id);
                } : undefined,
                onContextMenu: interactive && typeof onNodeMenu === 'function' ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onNodeMenu(node, event);
                } : undefined,
                onPointerDown: interactive ? (event) => beginDrag(node, event) : undefined,
                'aria-pressed': interactive ? selected : undefined,
                'aria-label': node.isLead
                  ? `${t('topologyLegendLead')}: ${node.name}`
                  : `${node.name} · ${node.title}${node.level === 'captain' ? ` · ${t('levelCaptain')}` : ''}${run === undefined ? '' : ` · ${runStatusLabel(run.status)}`}`,
                tabIndex: interactive ? 0 : -1,
              },
              h(
                'span',
                { className: 'ao_nodeTop' },
                h(Avatar, { name: node.name, color: node.accent, size: node.isLead ? 28 : 24 }),
                h('span', { className: 'ao_nodeName' }, node.name),
              ),
              h('span', { className: 'ao_nodeTitle' }, node.isLead ? t('topologyLegendLead') : `${node.title}${node.level === 'captain' ? ` · ${t('levelCaptain')}` : ''}`),
              h(
                'span',
                { className: 'ao_nodeMeta' },
                run !== undefined
                  ? h(React.Fragment, null,
                      h('span', {
                        className: cx('ao_dot', run.status === 'running' && 'ao_dotPulse'),
                        style: {
                          color: run.status === 'running'
                            ? 'var(--dsw-alias-state-business-primary)'
                            : run.status === 'completed'
                              ? 'var(--dsw-alias-state-success-primary, var(--dsw-alias-state-business-primary))'
                              : 'var(--dsw-alias-state-error-primary)',
                        },
                      }),
                      `${runStatusLabel(run.status)}${runDurationText === '' ? '' : ` · ${runDurationText}`}`,
                    )
                  : active
                    ? h(React.Fragment, null, h('span', { className: 'ao_dot ao_dotPulse', style: { color: 'var(--dsw-alias-state-business-primary)' } }), t('topologyLegendActive'))
                    : node.isLead
                      ? h('span', { className: 'ao_nodeLeadTag' }, t('leadCurrent'))
                      : node.enabled
                        ? h(React.Fragment, null, h('span', { className: 'ao_dot', style: { color: 'var(--dsw-alias-state-success-primary, var(--dsw-alias-state-business-primary))' } }), t('enabled'))
                        : t('disabled'),
              ),
            );
          }),
          interactive && typeof onNodeMenu === 'function' ? layout.nodes.map((node) => h(
            'button',
            {
              key: `menu-${node.id}`,
              type: 'button',
              className: 'ao_nodeMenuButton',
              style: {
                left: `${node.x + node.width / 2 + 3}px`,
                top: `${node.y + 8}px`,
              },
              title: t('editRole'),
              'aria-label': `${t('editRole')}: ${node.name}`,
              onPointerDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(node.id);
              },
            },
            '✎',
          )) : null,
          interactive && typeof onConnect === 'function' ? layout.nodes.map((node) => h(
            'button',
            {
              key: `port-${node.id}`,
              type: 'button',
              className: cx('ao_nodePort', connect?.from === node.id && 'ao_nodePortDragging'),
              style: { left: `${node.x}px`, top: `${node.y + 76}px` },
              title: t('topologyDragRelation'),
              'aria-label': `${t('topologyDragRelation')}: ${node.name}`,
              'data-ao-node-id': node.id,
              onPointerDown: (event) => beginConnect(node, event),
              onPointerMove: moveConnect,
              onPointerUp: endConnect,
              onPointerCancel: cancelConnect,
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
              },
            },
            '+',
          )) : null,
        ),
          ),
      ),
      );
    }

    function LeadModelPanel({ t, idPrefix = 'lead', modelCatalog, modelLoading, modelError, modelSaving, modelPolicySaving, modelChoice, modelPolicy, onModelChange, setModelPolicy, onSavePolicy }) {
      return h(
        React.Fragment,
        null,
        h(
          Field,
          { label: t('leadModel'), hint: t('leadModelHint'), htmlFor: `${idPrefix}-model` },
          h(
            'select',
            {
              id: `${idPrefix}-model`,
              className: 'ao_select',
              value: modelChoice,
              disabled: modelLoading || modelSaving || modelCatalog === null,
              onChange: (event) => void onModelChange(event.target.value),
            },
            modelChoice === '' ? h('option', { value: '' }, modelLoading ? t('leadModelLoading') : t('leadModel')) : null,
            ...(modelCatalog?.groups ?? []).map((group) => {
              const models = (group.models ?? []).filter((model) => modelPolicy.includes(`${group.id}|${model.id}`));
              return models.length === 0 ? null : h(
                'optgroup',
                { label: group.name, key: group.id },
                ...models.map((model) => h('option', { key: `${group.id}|${model.id}`, value: `${group.id}|${model.id}` }, model.name)),
              );
            }),
          ),
          modelError !== null ? h('p', { className: 'ao_errorText', role: 'alert' }, `${t('leadModelError')}: ${modelError}`) : null,
          modelSaving ? h('p', { className: 'ao_hint' }, t('saving')) : null,
        ),
        h(
          'div',
          { className: 'ao_modelScopeBox' },
          h('div', { className: 'ao_modelScopeHead' },
            h('strong', null, t('leadModelScope')),
            h('span', null, t('leadModelScopeHint')),
          ),
          modelCatalog === null ? h('p', { className: 'ao_hint' }, modelLoading ? t('leadModelLoading') : t('leadModelError')) : h(
            'div',
            { className: 'ao_modelScopeList' },
            (modelCatalog.groups ?? []).map((group) => h(
              'div',
              { className: 'ao_modelScopeGroup', key: group.id },
              h('span', { className: 'ao_modelScopeProvider' }, group.name),
              ...(group.models ?? []).map((model) => {
                const key = `${group.id}|${model.id}`;
                return h(
                  'label',
                  { className: 'ao_modelScopeItem', key },
                  h('input', {
                    type: 'checkbox',
                    checked: modelPolicy.includes(key),
                    onChange: (event) => setModelPolicy((previous) => event.target.checked
                      ? [...previous.filter((item) => item !== key), key]
                      : previous.filter((item) => item !== key)),
                  }),
                  h('span', null, model.name),
                );
              }),
            )),
          ),
          h('div', { className: 'ao_modelScopeActions' },
            h('button', {
              type: 'button',
              className: 'ao_button ao_buttonGhost',
              onClick: () => setModelPolicy((modelCatalog?.groups ?? []).flatMap((group) => (group.models ?? []).map((model) => `${group.id}|${model.id}`))),
            }, t('leadModelScopeAll')),
            h('button', {
              type: 'button',
              className: 'ao_button ao_buttonPrimary',
              disabled: modelPolicySaving || modelPolicy.length === 0,
              onClick: () => void onSavePolicy(),
            }, modelPolicySaving ? t('leadModelScopeSaving') : t('leadModelSaveScope')),
            modelPolicy.length === 0 ? h('span', { className: 'ao_hint' }, t('leadModelScopeEmpty')) : null,
          ),
        ),
      );
    }

    function SetupScreen({ setupOrg, workspace, sessionId, workspaceId, onChange, onSave, saving, error, t }) {
      const [previewOpen, setPreviewOpen] = React.useState(false);
      const [modelCatalog, setModelCatalog] = React.useState(null);
      const [modelLoading, setModelLoading] = React.useState(false);
      const [modelError, setModelError] = React.useState(null);
      const roles = setupOrg.roles ?? [];
      const enabledCount = roles.filter((role) => role.enabled).length;
      const update = (patch) => onChange({ ...setupOrg, ...patch });
      React.useEffect(() => {
        let alive = true;
        setModelLoading(true);
        setModelError(null);
        apiModels(sessionId, workspaceId)
          .then((data) => {
            if (!alive) return;
            setModelCatalog(data);
          })
          .catch((failure) => {
            if (alive) setModelError(failure instanceof Error ? failure.message : String(failure));
          })
          .finally(() => {
            if (alive) setModelLoading(false);
          });
        return () => { alive = false; };
      }, [sessionId, workspaceId]);
      React.useEffect(() => {
        if (modelCatalog === null) return;
        const lead = setupOrg.lead ?? {};
        const allKeys = (modelCatalog.groups ?? []).flatMap((group) => (group.models ?? []).map((model) => `${group.id}|${model.id}`));
        const preferred = (modelCatalog.groups ?? [])
          .flatMap((group) => (group.models ?? []).map((model) => ({ provider: group.id, model: model.id, name: model.name })))
          .find((item) => item.model === 'deepseek-v4.1-flash' || /v4\.1.*flash/i.test(item.name) || /dsv41flash/i.test(item.name));
        const current = lead.model ?? preferred ?? modelCatalog.default ?? null;
        const currentKey = current === null || current === undefined ? '' : `${current.provider}|${current.model}`;
        const policy = Array.isArray(lead.modelPolicy) && lead.modelPolicy.length > 0
          ? lead.modelPolicy.map((item) => `${item.provider}|${item.model}`).filter((key) => allKeys.includes(key))
          : allKeys;
        if (lead.model === undefined || lead.model === null || !Array.isArray(lead.modelPolicy)) {
          onChange({
            ...setupOrg,
            lead: {
              ...lead,
              ...(lead.model === undefined || lead.model === null ? { model: currentKey === '' ? null : current } : {}),
              modelPolicy: policy.map((key) => {
                const [provider, model] = key.split('|');
                return { provider, model };
              }),
            },
          });
        }
      }, [modelCatalog]);
      const lead = setupOrg.lead ?? {};
      const leadModelKey = lead.model === null || lead.model === undefined ? '' : `${lead.model.provider}|${lead.model.model}`;
      const modelPolicyKeys = Array.isArray(lead.modelPolicy)
        ? lead.modelPolicy.map((item) => `${item.provider}|${item.model}`)
        : [];
      const selectedModelMeta = (() => {
        if (leadModelKey === '') return null;
        for (const group of modelCatalog?.groups ?? []) {
          for (const model of group.models ?? []) {
            if (`${group.id}|${model.id}` === leadModelKey) return { group, model };
          }
        }
        return null;
      })();
      const updateLeadModel = (key) => {
        const [provider, model] = key.split('|');
        const meta = (modelCatalog?.groups ?? []).flatMap((group) => (group.models ?? []).map((entry) => ({ group, entry }))).find((item) => `${item.group.id}|${item.entry.id}` === key);
        update({
          lead: {
            ...lead,
            model: { provider, model, ...(meta?.entry.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: meta.entry.reasoning.defaultEffort }) },
          },
        });
      };
      const updatePolicy = (nextKeys) => {
        const policy = nextKeys.map((key) => {
          const [provider, model] = key.split('|');
          return { provider, model };
        });
        const nextLead = { ...lead, modelPolicy: policy };
        if (leadModelKey !== '' && !nextKeys.includes(leadModelKey) && nextKeys.length > 0) {
          const [provider, model] = nextKeys[0].split('|');
          const meta = (modelCatalog?.groups ?? []).flatMap((group) => (group.models ?? []).map((entry) => ({ group, entry }))).find((item) => `${item.group.id}|${item.entry.id}` === nextKeys[0]);
          nextLead.model = { provider, model, ...(meta?.entry.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: meta.entry.reasoning.defaultEffort }) };
        }
        update({ lead: nextLead });
      };
      const setupModelReady = modelCatalog === null || (leadModelKey !== '' && modelPolicyKeys.length > 0);
      const updateRole = (id, patch) => update({
        roles: roles.map((role) => (role.id === id ? { ...role, ...patch } : role)),
      });
      return h(
        'div',
        { className: 'ao_setupWrap' },
        h(
          'div',
          { className: 'ao_setupIntro' },
          h('h3', { className: 'ao_setupTitle' }, t('setupTitle')),
          h('p', { className: 'ao_setupText' }, t('setupIntro')),
          h(
            'div',
            { className: 'ao_setupWorkspace' },
            h('strong', null, t('setupWorkspace')),
            h('span', null, workspace?.title ?? t('workspaceUnknown')),
            workspace?.path ? h('code', { className: 'ao_idBadge' }, workspace.path) : null,
            h('span', { className: 'ao_status' }, t('setupRequiredShort')),
          ),
          h(
            'div',
            { className: 'ao_setupActions', style: { marginTop: '10px' } },
            h(
              'button',
              {
                type: 'button',
                className: 'ao_button ao_buttonPrimary',
                disabled: saving || !setupModelReady,
                onClick: onSave,
              },
              saving ? t('setupEnabling') : t('setupEnable'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'ao_setupPreview' },
          h(
            'button',
            {
              type: 'button',
              className: 'ao_setupPreviewToggle',
              onClick: () => setPreviewOpen((value) => !value),
              'aria-expanded': previewOpen,
            },
            h('span', { className: 'ao_setupPreviewTitle' }, t('relationshipTopology')),
            h('span', { className: 'ao_hint' }, previewOpen ? t('setupPreviewHide') : t('setupPreviewShow')),
          ),
          previewOpen ? h(
            'div',
            { className: 'ao_setupPreviewCanvas' },
            h('p', { className: 'ao_setupPreviewText' }, t('topologyHint')),
            h(Topology, {
              org: setupOrg,
              runs: [],
              selectedId: null,
              onSelect: () => {},
              interactive: false,
              t,
            }),
          ) : null,
        ),
        h(
          'div',
          { className: 'ao_setupGrid' },
          h(
            'div',
            null,
            h(
              Field,
              { label: t('setupTeamName'), htmlFor: 'ao-setup-team-name' },
              h('input', {
                id: 'ao-setup-team-name',
                className: 'ao_input',
                value: setupOrg.teamName,
                maxLength: 60,
                onChange: (event) => update({ teamName: readText(event) }),
              }),
            ),
            h(
              'div',
              { className: 'ao_modelScopeBox', style: { marginTop: '14px' } },
              h('div', { className: 'ao_modelScopeHead' },
                h('strong', null, t('leadModel')),
                h('span', null, t('leadModelHint')),
              ),
              modelLoading ? h('p', { className: 'ao_hint' }, t('leadModelLoading')) : null,
              modelError !== null ? h('p', { className: 'ao_errorText', role: 'alert' }, `${t('leadModelError')}: ${modelError}`) : null,
              modelCatalog !== null ? h(
                React.Fragment,
                null,
                h(
                  'select',
                  {
                    className: 'ao_select',
                    value: leadModelKey,
                    disabled: modelLoading,
                    onChange: (event) => updateLeadModel(event.target.value),
                  },
                  h('option', { value: '' }, t('leadModel')),
                  ...(modelCatalog.groups ?? []).map((group) => {
                    const models = (group.models ?? []).filter((entry) => modelPolicyKeys.includes(`${group.id}|${entry.id}`));
                    return models.length === 0 ? null : h(
                      'optgroup',
                      { label: group.name, key: group.id },
                      ...models.map((entry) => h('option', { key: `${group.id}|${entry.id}`, value: `${group.id}|${entry.id}` }, entry.name)),
                    );
                  }),
                ),
                selectedModelMeta?.model?.reasoning?.efforts?.length > 0 ? h(
                  'select',
                  {
                    className: 'ao_select',
                    value: lead.model?.reasoningEffort ?? selectedModelMeta.model.reasoning.defaultEffort ?? '',
                    onChange: (event) => {
                      const value = event.target.value;
                      update({ lead: { ...lead, model: { ...lead.model, ...(value === '' ? { reasoningEffort: undefined } : { reasoningEffort: value }) } } });
                    },
                  },
                  h('option', { value: '' }, t('leadReasoningDefault')),
                  ...selectedModelMeta.model.reasoning.efforts.map((effort) => h('option', { key: effort.id, value: effort.id }, effort.name)),
                ) : null,
                h(
                  'div',
                  { className: 'ao_modelScopeList' },
                  (modelCatalog.groups ?? []).map((group) => h(
                    'div',
                    { className: 'ao_modelScopeGroup', key: group.id },
                    h('span', { className: 'ao_modelScopeProvider' }, group.name),
                    ...(group.models ?? []).map((entry) => {
                      const key = `${group.id}|${entry.id}`;
                      return h(
                        'label',
                        { className: 'ao_modelScopeItem', key },
                        h('input', {
                          type: 'checkbox',
                          checked: modelPolicyKeys.includes(key),
                          onChange: (event) => updatePolicy(event.target.checked
                            ? [...modelPolicyKeys, key]
                            : modelPolicyKeys.filter((item) => item !== key)),
                        }),
                        h('span', null, entry.name),
                      );
                    }),
                  )),
                ),
                h(
                  'div',
                  { className: 'ao_modelScopeActions' },
                  h('button', {
                    type: 'button',
                    className: 'ao_button ao_buttonGhost',
                    onClick: () => updatePolicy((modelCatalog.groups ?? []).flatMap((group) => (group.models ?? []).map((entry) => `${group.id}|${entry.id}`))),
                  }, t('leadModelScopeAll')),
                  modelPolicyKeys.length === 0 ? h('span', { className: 'ao_hint' }, t('leadModelScopeEmpty')) : null,
                ),
              ) : null,
            ),
            h(
              'div',
              { className: 'ao_sectionHead', style: { marginTop: '18px' } },
              h(
                'div',
                null,
                h('h3', { className: 'ao_sectionTitle' }, t('setupRoles')),
                h('p', { className: 'ao_sectionHint' }, t('setupRolesHint')),
              ),
              h('span', { className: 'ao_countPill' }, `${enabledCount} / ${roles.length}`),
            ),
            h(
              'div',
              { className: 'ao_setupList' },
              roles.map((role) => h(
                'article',
                { className: 'ao_setupRole', key: role.id },
                h(
                  'div',
                  { className: 'ao_setupRoleHead' },
                  h(Avatar, { name: role.name, color: role.accent, size: 32 }),
                  h(
                    'div',
                    { className: 'ao_setupRoleText' },
                    h('div', { className: 'ao_setupRoleName' }, role.name),
                    h('div', { className: 'ao_setupRoleTitle' }, role.title),
                  ),
                  h(Switch, {
                    checked: role.enabled,
                    onChange: (value) => updateRole(role.id, { enabled: value }),
                    label: `${role.name} ${t('status')}`,
                  }),
                ),
                h(
                  'div',
                  { className: 'ao_setupRoleGrid' },
                  h(
                    Field,
                    { label: t('reportsTo'), htmlFor: `ao-setup-manager-${role.id}` },
                    h(
                      'select',
                      {
                        id: `ao-setup-manager-${role.id}`,
                        className: 'ao_select',
                        value: role.reportsTo,
                        onChange: (event) => updateRole(role.id, { reportsTo: readText(event) }),
                      },
                      managerOptions(setupOrg, role.id).map((option) =>
                        h('option', { value: option.id, key: option.id }, option.title ? `${option.name} · ${option.title}` : option.name),
                      ),
                    ),
                  ),
                  h('span', { className: 'ao_hint' }, t('managerHint')),
                ),
                h(
                  'details',
                  { className: 'ao_setupDetails' },
                  h('summary', null, t('setupPrompts')),
                  h(
                    'div',
                    { className: 'ao_setupPrompt' },
                    h(
                      Field,
                      { label: t('setupResponsibilities'), htmlFor: `ao-setup-resp-${role.id}` },
                      h('textarea', {
                        id: `ao-setup-resp-${role.id}`,
                        className: 'ao_textarea',
                        rows: 2,
                        maxLength: 400,
                        value: role.responsibilities,
                        onChange: (event) => updateRole(role.id, { responsibilities: readText(event) }),
                      }),
                    ),
                    h(
                      Field,
                      { label: t('setupInstructions'), htmlFor: `ao-setup-instructions-${role.id}` },
                      h('textarea', {
                        id: `ao-setup-instructions-${role.id}`,
                        className: 'ao_textarea',
                        rows: 6,
                        maxLength: 4000,
                        value: role.instructions,
                        onChange: (event) => updateRole(role.id, { instructions: readText(event) }),
                      }),
                    ),
                  ),
                ),
              )),
            ),
            h(
              'div',
              { className: 'ao_setupActions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ao_button ao_buttonPrimary',
                  disabled: saving || !setupModelReady,
                  onClick: onSave,
                },
                saving ? t('setupEnabling') : t('setupEnable'),
              ),
              h('span', { className: 'ao_hint' }, t('setupDefaultNote')),
            ),
            error ? h('p', { className: 'ao_setupError', role: 'alert' }, error) : null,
          ),
        ),
      );
    }

    function RunCard({ run, t, onOpenSession }) {
      const running = run.status === 'running';
      const duration = running
        ? formatDuration(Date.now() - new Date(run.startedAt).getTime(), t)
        : formatDuration(run.durationMs ?? 0, t);
      const dotClass = running
        ? 'ao_timelineDotActive'
        : run.status === 'completed'
          ? 'ao_timelineDotOk'
          : 'ao_timelineDotError';
      return h(
        'details',
        { className: 'ao_runCard', open: running ? true : undefined },
        h(
          'summary',
          null,
          h(StatusBadge, { status: run.status, t }),
          h(
            'span',
            { className: 'ao_runSummaryMain' },
            h(
              'span',
              { className: 'ao_runRole' },
              h('span', { className: 'ao_runName' }, run.roleName),
              h('span', { className: 'ao_runTitle' }, run.roleTitle),
            ),
            h('span', { className: 'ao_runTask' }, run.task),
          ),
          h(
            'span',
            { className: 'ao_runMeta' },
            h('span', null, formatTime(run.startedAt)),
            h('span', null, duration),
          ),
        ),
        h(
          'div',
          { className: 'ao_runBody' },
          h(
            'div',
            { className: 'ao_timeline' },
            h(
              'div',
              { className: 'ao_timelineItem' },
              h('span', { className: 'ao_timelineDot ao_timelineDotOk' }),
              h(
                'span',
                { className: 'ao_timelineText' },
                h('span', { className: 'ao_timelineLabel' }, t('assigned')),
                h('span', { className: 'ao_timelineDetail' }, run.task || '—'),
              ),
            ),
            h(
              'div',
              { className: 'ao_timelineItem' },
              h('span', { className: cx('ao_timelineDot', dotClass) }),
              h(
                'span',
                { className: 'ao_timelineText' },
                h('span', { className: 'ao_timelineLabel' }, t('processSession')),
                h('span', { className: 'ao_timelineDetail' }, `${run.childSessionId || t('sessionUnavailable')}${running ? ` · ${t('statusRunning')}` : ''}`),
                h(
                  'span',
                  { className: 'ao_timelineActions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ao_sessionButton',
                      disabled: !run.childSessionId || typeof onOpenSession !== 'function',
                      title: t('openSessionTitle'),
                      onClick: () => onOpenSession?.(run),
                    },
                    t('openSession'),
                  ),
                ),
              ),
            ),
            !running ? h(
              'div',
              { className: 'ao_timelineItem' },
              h('span', { className: cx('ao_timelineDot', dotClass) }),
              h(
                'span',
                { className: 'ao_timelineText' },
                h('span', { className: 'ao_timelineLabel' }, t('returned')),
                h('span', { className: 'ao_timelineDetail' }, run.summary || run.diagnostic || '—'),
              ),
            ) : null,
          ),
          h(
            'div',
            { className: 'ao_runFoot' },
            h('span', null, `${t('duration')}: ${duration}`),
            h('span', null, `${t('processSession')}: ${run.childSessionId || '—'}`),
          ),
        ),
      );
    }

    function Switch({ checked, onChange, label }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': checked,
          'aria-label': label,
          className: cx('ao_switch', checked && 'ao_switchOn'),
          onClick: () => onChange(!checked),
        },
        h('span', { className: 'ao_switchKnob' }),
      );
    }

    function Field({ label, hint, children, htmlFor }) {
      return h(
        'div',
        { className: 'ao_field' },
        h(
          'label',
          { className: 'ao_label', htmlFor },
          h('span', null, label),
        ),
        children,
        hint ? h('p', { className: 'ao_hint' }, hint) : null,
      );
    }

    function relationTypeLabel(t, type) {
      return {
        reports: t('relationReports'),
        collaborates: t('relationCollaborates'),
        temporary: t('relationTemporary'),
        handoff: t('relationHandoff'),
      }[type] ?? type;
    }

    function relationExpired(relation, now = Date.now()) {
      return relation.type === 'temporary'
        && relation.expiresAt !== null
        && Date.parse(relation.expiresAt) <= now;
    }

    function relationNodeName(org, id) {
      return id === 'lead' ? org.lead.label : (org.roles.find((role) => role.id === id)?.name ?? id);
    }

    function toDatetimeLocal(value) {
      if (typeof value !== 'string') return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (part) => String(part).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function fromDatetimeLocal(value) {
      if (typeof value !== 'string' || value === '') return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    function nextRelationId(org) {
      let index = 1;
      let id = 'relation-1';
      while ((org.relations ?? []).some((relation) => relation.id === id)) {
        index += 1;
        id = `relation-${index}`;
      }
      return id;
    }

    function EdgeEditor({ org, draft, onChange, onSave, onDelete, onCancel, saving, error, t }) {
      const [confirmDelete, setConfirmDelete] = React.useState(false);
      const nodes = [{ id: 'lead', name: org.lead.label, title: '' }, ...org.roles];
      const update = (patch) => onChange({ ...draft, ...patch });
      const setType = (type) => {
        if (type === 'temporary') {
          const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          update({ type, expiresAt: draft.expiresAt ?? defaultExpiry.toISOString() });
        } else {
          update({ type, expiresAt: null });
        }
      };
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'ao_sideHead' },
          h(
            'div',
            null,
            h('h3', { className: 'ao_sideTitle' }, draft.isNew ? t('addRelation') : t('relationEdit')),
            h('p', { className: 'ao_sideSub' }, t('relationGraphHint')),
          ),
        ),
        h(
          'div',
          { className: 'ao_form' },
          h(
            'div',
            { className: 'ao_row2' },
            h(
              Field,
              { label: t('relationFrom'), htmlFor: 'ao-edge-from' },
              h(
                'select',
                {
                  id: 'ao-edge-from',
                  className: 'ao_select',
                  value: draft.from,
                  onChange: (event) => {
                    const from = readText(event);
                    const nextTo = draft.to === from
                      ? (nodes.find((node) => node.id !== from)?.id ?? draft.to)
                      : draft.to;
                    update({ from, to: nextTo });
                  },
                },
                nodes.map((node) => h('option', { value: node.id, key: node.id }, `${node.name}${node.title ? ` · ${node.title}` : ''}`)),
              ),
            ),
            h(
              Field,
              { label: t('relationTo'), htmlFor: 'ao-edge-to' },
              h(
                'select',
                {
                  id: 'ao-edge-to',
                  className: 'ao_select',
                  value: draft.to,
                  onChange: (event) => update({ to: readText(event) }),
                },
                nodes.filter((node) => node.id !== draft.from).map((node) => h('option', { value: node.id, key: node.id }, `${node.name}${node.title ? ` · ${node.title}` : ''}`)),
              ),
            ),
          ),
          h(
            Field,
            { label: t('relationType'), htmlFor: 'ao-edge-type' },
            h(
              'select',
              {
                id: 'ao-edge-type',
                className: 'ao_select',
                value: draft.type,
                onChange: (event) => setType(readText(event)),
              },
              h('option', { value: 'reports' }, t('relationReports')),
              h('option', { value: 'collaborates' }, t('relationCollaborates')),
              h('option', { value: 'temporary' }, t('relationTemporary')),
              h('option', { value: 'handoff' }, t('relationHandoff')),
            ),
          ),
          h(
            Field,
            { label: t('relationLabel'), htmlFor: 'ao-edge-label' },
            h('input', {
              id: 'ao-edge-label',
              className: 'ao_input',
              value: draft.label,
              maxLength: 60,
              placeholder: t('relationLabelPlaceholder'),
              onChange: (event) => update({ label: readText(event) }),
            }),
          ),
          draft.type === 'temporary' ? h(
            Field,
            { label: t('relationExpires'), hint: t('relationExpiresHint'), htmlFor: 'ao-edge-expiry' },
            h('input', {
              id: 'ao-edge-expiry',
              className: 'ao_input',
              type: 'datetime-local',
              value: toDatetimeLocal(draft.expiresAt),
              onChange: (event) => update({ expiresAt: fromDatetimeLocal(readText(event)) }),
            }),
            h(
              'div',
              { className: 'ao_timelineActions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ao_button ao_buttonGhost',
                  onClick: () => update({ expiresAt: null }),
                },
                t('relationNoExpiry'),
              ),
            ),
          ) : null,
          h(
            'div',
            { className: 'ao_formActions' },
            h('button', { type: 'button', className: 'ao_button ao_buttonPrimary', disabled: saving, onClick: onSave }, saving ? t('relationSaving') : t('relationSave')),
            h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: onCancel, disabled: saving }, t('cancel')),
          ),
          error ? h('p', { className: 'ao_errorText', role: 'alert' }, error) : null,
          !draft.isNew && !confirmDelete ? h(
            'button',
            { type: 'button', className: 'ao_button ao_buttonDanger', onClick: () => setConfirmDelete(true) },
            h(Icon, { name: 'trash', size: 14 }),
            h('span', null, t('relationDelete')),
          ) : null,
          !draft.isNew && confirmDelete ? h(
            'div',
            { className: 'ao_deleteBox', role: 'alertdialog' },
            h('span', { className: 'ao_deleteTitle' }, t('relationDeleteConfirm')),
            h(
              'div',
              { className: 'ao_deleteActions' },
              h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: () => setConfirmDelete(false) }, t('relationDeleteNo')),
              h('button', { type: 'button', className: 'ao_button ao_buttonDangerSolid', onClick: onDelete, disabled: saving }, t('relationDeleteYes')),
            ),
          ) : null,
        ),
      );
    }

    function readableGroupText(value, depth = 0) {
      if (value === null || value === undefined) return '';
      if (typeof value !== 'string') {
        if (Array.isArray(value)) return value.map((item) => readableGroupText(item, depth + 1)).filter(Boolean).join('\n');
        if (typeof value === 'object') {
          const keys = ['message', 'reply', 'summary', 'report', 'result', 'answer', 'content', 'text', 'description', 'reason', 'status', 'task'];
          for (const key of keys) {
            if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
              const candidate = readableGroupText(value[key], depth + 1);
              if (candidate !== '') return candidate;
            }
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
          const human = readableGroupText(JSON.parse(text), depth + 1);
          if (human !== '') return human;
        } catch {
          // Keep the plain text.
        }
      }
      return text;
    }

    function GroupChatIcon({ size }) {
      return h(Icon, { name: 'org', size: size ?? 18 });
    }

    function MarkdownMessage({ text, className }) {
      const source = String(text ?? '');
      if (FrameworkMarkdownText !== null) {
        return h(
          'div',
          { className: className ? `ao_mdHost ${className}` : 'ao_mdHost' },
          h(FrameworkMarkdownText, { text: source, variant: 'body' }),
        );
      }
      return h('div', { className: className ? `ao_mdFallback ${className}` : 'ao_mdFallback' }, source);
    }

    function GroupChat({ t, openSession, workspaceId, onCollapse }) {
      const [data, setData] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const scrollRef = React.useRef(null);
      const stickRef = React.useRef(true);
      React.useEffect(() => {
        let alive = true;
        let timer = null;
        let inFlight = false;
        const load = async () => {
          if (inFlight) return;
          inFlight = true;
          try {
            const next = await apiGroup(workspaceId);
            if (!alive) return;
            setData(next);
            setError(null);
            setLoading(false);
          } catch (reason) {
            if (!alive) return;
            setError(reason instanceof Error ? reason.message : String(reason));
            setLoading(false);
          } finally {
            inFlight = false;
          }
        };
        void load();
        timer = setInterval(() => {
          if (document.visibilityState !== 'hidden') void load();
        }, 2000);
        const onVisibility = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
          alive = false;
          if (timer !== null) clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }, [workspaceId]);

      React.useEffect(() => {
        const element = scrollRef.current;
        if (element === null || !stickRef.current) return;
        requestAnimationFrame(() => {
          element.scrollTop = element.scrollHeight;
        });
      }, [data]);
      const groups = Array.isArray(data?.groups) ? data.groups : [];
      const activeCount = groups.reduce((sum, group) => sum + group.runs.filter((run) => run.status === 'running').length, 0);
      const open = (sessionId) => {
        if (typeof openSession !== 'function' || typeof sessionId !== 'string' || sessionId === '') return;
        openSession(sessionId);
      };
      return h(
        'div',
        { className: 'ao_groupPanel' },
        h(
          'div',
          { className: 'ao_groupHeader' },
          h('div', null,
            h('h2', { className: 'ao_groupTitle' }, t('teamChat')),
            h('p', { className: 'ao_groupSub' }, t('teamChatHint')),
          ),
          h(
            'div',
            { className: 'ao_teamChatHeaderActions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ao_button ao_buttonGhost',
                onClick: onCollapse,
                title: t('collapseChat'),
                'aria-label': t('collapseChat'),
              },
              h('span', { className: 'ao_teamChatReopenArrow' }, '›'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ao_button ao_buttonGhost',
                onClick: () => {
                  apiGroup(workspaceId)
                    .then((next) => { setData(next); setError(null); })
                    .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
                },
              },
              h(Icon, { name: 'refresh', size: 14 }),
              h('span', null, t('refresh')),
            ),
          ),
        ),
        h(
          'div',
          {
            className: 'ao_groupScroll',
            ref: scrollRef,
            onScroll: (event) => {
              const element = event.currentTarget;
              stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 36;
            },
          },
        activeCount > 0 ? h(
          'div',
          { className: 'ao_groupActive', role: 'status' },
          h('span', { className: 'ao_liveDot', 'aria-hidden': 'true' }),
          `${activeCount} ${t('statusRunning')}`,
        ) : null,
        error !== null ? h('div', { className: 'ao_groupError', role: 'alert' }, error) : null,
        groups.length === 0 ? h(
          'div',
          { className: 'ao_groupEmpty' },
          h(Icon, { name: loading ? 'refresh' : 'spark', size: 24, className: 'ao_emptyIcon' }),
          h('strong', null, loading ? t('teamChatLoading') : t('teamChatEmpty')),
          loading ? null : h('p', null, t('teamChatHint')),
        ) : groups.map((group) => {
          const runs = [...group.runs].reverse();
          const groupActive = group.runs.filter((run) => run.status === 'running').length;
          return h(
            'section',
            { className: 'ao_groupWorkspace', key: group.workspaceId },
            h(
              'div',
              { className: 'ao_groupWorkspaceHead' },
              h('strong', null, group.workspaceTitle || group.workspaceId),
              h('span', { className: 'ao_groupHeaderMeta' }, groupActive > 0 ? `${groupActive} ${t('statusRunning')}` : '', group.messages?.length ? ` · ${t('teamChatMessages', { count: group.messages.length })}` : ''),
            ),
            runs.map((run) => {
              const running = run.status === 'running';
              const result = running
                ? t('teamChatWaiting')
                : (readableGroupText(run.summary || run.diagnostic) || '—');
              const roleOpen = typeof run.childSessionId === 'string' && run.childSessionId !== '';
              return h(
                'div',
                { className: 'ao_groupTurn', key: run.id },
                h(
                  'div',
                  { className: 'ao_groupMsg ao_groupLeadMsg' },
                  h('div', { className: 'ao_groupMsgHead' },
                    h('span', { className: 'ao_groupAvatar ao_groupAvatarLead' }, (run.delegatorName || t('teamChatLead')).slice(0, 1)),
                    h('strong', null, run.delegatorName || t('teamChatLead')),
                    h('time', null, formatTime(run.startedAt)),
                  ),
                  h('p', { className: 'ao_groupText' }, h('span', { className: 'ao_groupArrow' }, '→'), run.roleName, h('br'), run.task || '—'),
                ),
                h(
                  'div',
                  { className: cx('ao_groupMsg', 'ao_groupMemberMsg', running && 'ao_groupMsgRunning') },
                  h('div', { className: 'ao_groupMsgHead' },
                    h('span', { className: 'ao_groupAvatar' }, (run.roleName || '?').slice(0, 1)),
                    h('strong', null, run.roleName),
                    h('span', { className: 'ao_groupRole' }, run.roleTitle),
                    h(StatusBadge, { status: run.status, t }),
                    h('time', { dateTime: run.finishedAt ?? run.startedAt ?? undefined, title: run.finishedAt ? `${formatTime(run.startedAt)} → ${formatTime(run.finishedAt)}` : undefined },
                      running
                        ? `${formatTime(run.startedAt)} · ${formatDuration(Date.now() - new Date(run.startedAt).getTime(), t)}`
                        : `${formatTime(run.finishedAt ?? run.startedAt)} · ${formatDuration(run.durationMs ?? 0, t)}`,
                    ),
                  ),
                  h(MarkdownMessage, { className: 'ao_groupText ao_groupResult', text: result }),
                  roleOpen || run.parentSessionId ? h(
                    'div',
                    { className: 'ao_groupActions' },
                    run.parentSessionId ? h('button', { type: 'button', className: 'ao_sessionButton', onClick: () => open(run.parentSessionId) }, run.delegatorName || t('teamChatLead')) : null,
                    roleOpen ? h('button', { type: 'button', className: 'ao_sessionButton', onClick: () => open(run.childSessionId) }, t('teamChatOpen')) : null,
                  ) : null,
                ),
              );
            }),
            Array.isArray(group.messages) && group.messages.length > 0 ? h(
              'div',
              { className: 'ao_groupHistory' },
              h('div', { className: 'ao_groupHistoryTitle' }, t('teamChatHistory')),
              group.messages.map((message) => {
                const member = message.kind === 'member';
                const speaker = message.kind === 'user'
                  ? t('teamChatUser')
                  : message.kind === 'assignment'
                    ? (group.leadLabel || t('teamChatLead'))
                    : member ? message.roleName : (group.leadLabel || t('teamChatLead'));
                return h(
                  'div',
                  { className: 'ao_groupMsgRow', key: message.id },
                  h(
                    'div',
                    { className: cx('ao_groupMsg', member ? 'ao_groupMemberMsg' : 'ao_groupLeadMsg') },
                    h('div', { className: 'ao_groupMsgHead' },
                      h('span', { className: cx('ao_groupAvatar', !member && 'ao_groupAvatarLead') }, (speaker || '?').slice(0, 1)),
                      h('strong', null, speaker),
                      message.roleTitle ? h('span', { className: 'ao_groupRole' }, message.roleTitle) : null,
                      h('time', { dateTime: message.at ?? undefined }, formatTime(message.at)),
                    ),
                    h(MarkdownMessage, { className: 'ao_groupText', text: readableGroupText(message.text) || '—' }),
                    message.sessionId ? h('div', { className: 'ao_groupActions' }, h('button', { type: 'button', className: 'ao_sessionButton', onClick: () => open(message.sessionId) }, t('teamChatOpen'))) : null,
                  ),
                );
              }),
            ) : null,
            runs.length === 0 && (!Array.isArray(group.messages) || group.messages.length === 0) ? h(
              'div',
              { className: 'ao_groupEmptyInline' },
              t('teamChatEmpty'),
            ) : null,
          );
        }),
        ),
      );
    }

    function parseSkillFile(text, fileName) {
      const source = String(text ?? '').replace(/\r\n/g, '\n').trim();
      let name = '';
      let description = '';
      let instructions = source;
      let body = source;
      const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
      if (frontmatter !== null) {
        body = frontmatter[2].trim();
        for (const line of frontmatter[1].split('\n')) {
          const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
          if (match === null) continue;
          const key = match[1].toLowerCase();
          const value = match[2].trim().replace(/^['"]|['"]$/g, '');
          if (key === 'name') name = value;
          else if (key === 'description') description = value;
        }
        instructions = body;
      }
      if (source.startsWith('{')) {
        try {
          const parsed = JSON.parse(source);
          name = String(parsed.name ?? parsed.title ?? name);
          description = String(parsed.description ?? description);
          instructions = String(parsed.instructions ?? parsed.content ?? parsed.body ?? instructions);
        } catch {
          // Not JSON; fall through to Markdown/text parsing.
        }
      }
      if (name === '') {
        const heading = body.match(/^#\s+(.+)$/m);
        if (heading !== null) name = heading[1].trim();
      }
      if (name === '') name = String(fileName ?? '').replace(/\.(md|markdown|txt|json)$/i, '');
      return {
        name: name.slice(0, 80),
        description: description.slice(0, 300),
        instructions: instructions.slice(0, 12_000),
      };
    }

    function SkillInjector({ role, t, onSearch, onInject, onInjected }) {
      const [mode, setMode] = React.useState('installed');
      const [query, setQuery] = React.useState('');
      const [results, setResults] = React.useState([]);
      const [selected, setSelected] = React.useState(null);
      const [customName, setCustomName] = React.useState('');
      const [customDescription, setCustomDescription] = React.useState('');
      const [customInstructions, setCustomInstructions] = React.useState('');
      const [reason, setReason] = React.useState('');
      const [loading, setLoading] = React.useState(false);
      const [saving, setSaving] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [notice, setNotice] = React.useState('');
      const [fileError, setFileError] = React.useState(null);
      const [importedFile, setImportedFile] = React.useState('');

      const importFile = async (file) => {
        if (file === undefined || file === null) return;
        setFileError(null);
        setNotice('');
        if (file.size > 64 * 1024) {
          setFileError(t('skillFileTooLarge'));
          return;
        }
        try {
          const text = await file.text();
          const parsed = parseSkillFile(text, file.name);
          if (parsed.name === '' || parsed.instructions.trim() === '') {
            setFileError(t('skillFileReadError'));
            return;
          }
          setMode('custom');
          setCustomName(parsed.name);
          setCustomDescription(parsed.description);
          setCustomInstructions(parsed.instructions);
          setImportedFile(file.name);
          setNotice(t('skillUploaded'));
        } catch {
          setFileError(t('skillFileReadError'));
        }
      };

      const search = async (nextQuery) => {
        setLoading(true);
        setError(null);
        try {
          const data = await onSearch(nextQuery ?? query);
          setResults(Array.isArray(data.skills) ? data.skills : []);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setLoading(false);
        }
      };
      React.useEffect(() => {
        if (mode === 'installed') void search('');
      }, [mode]);
      const canSubmit = role.enabled !== false && saving === false && reason.trim().length >= 2
        && (mode === 'installed' ? selected !== null : customName.trim() !== '' && customInstructions.trim() !== '');
      const submit = async () => {
        if (!canSubmit) {
          setError(t('skillRequired'));
          return;
        }
        setSaving(true);
        setError(null);
        setNotice('');
        try {
          const payload = {
            roleId: role.id,
            reason: reason.trim(),
            ...(mode === 'installed'
              ? { skill: selected.name }
              : { name: customName.trim(), description: customDescription.trim(), instructions: customInstructions.trim() }),
          };
          const data = await onInject(payload);
          onInjected(data);
          setNotice(t('skillInjected'));
          setReason('');
          setSelected(null);
          setCustomName('');
          setCustomDescription('');
          setCustomInstructions('');
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setSaving(false);
        }
      };
      const existing = Array.isArray(role.skills) ? role.skills : [];
      return h(
        'div',
        {
          className: 'ao_skillInjector',
          onKeyDown: (event) => {
            if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
          },
        },
        h(
          'div',
          { className: 'ao_skillHead' },
          h('strong', null, t('skillInjectTitle')),
          h('span', null, t('skillInjectHint')),
        ),
        existing.length > 0 ? h(
          'div',
          { className: 'ao_skillExisting' },
          h('span', { className: 'ao_skillExistingTitle' }, `${t('skillExisting')} (${existing.length})`),
          h('div', { className: 'ao_skillChips' }, existing.map((skill) => h(
            'span',
            { className: 'ao_skillChip', key: skill.name, title: skill.instructions },
            h('strong', null, skill.name),
            h('small', null, skill.source === 'framework' ? t('skillSourceFramework') : t('skillSourceCustom')),
          ))),
        ) : h('p', { className: 'ao_hint' }, t('skillEmpty')),
        h(
          'div',
          { className: 'ao_skillModes', role: 'tablist' },
          h('button', { type: 'button', role: 'tab', 'aria-selected': mode === 'installed', className: cx('ao_skillMode', mode === 'installed' && 'ao_skillModeActive'), onClick: () => { setMode('installed'); setError(null); } }, t('skillInstalled')),
          h('button', { type: 'button', role: 'tab', 'aria-selected': mode === 'custom', className: cx('ao_skillMode', mode === 'custom' && 'ao_skillModeActive'), onClick: () => { setMode('custom'); setError(null); } }, t('skillCustom')),
        ),
        h(
          'div',
          { className: 'ao_skillUploadRow' },
          h('label', { className: 'ao_skillUploadLabel' },
            h('input', {
              type: 'file',
              accept: '.md,.markdown,.txt,.json',
              onChange: (event) => {
                void importFile(event.target.files?.[0]);
                event.target.value = '';
              },
            }),
            h('span', { className: 'ao_skillUploadIcon', 'aria-hidden': 'true' }, '⇧'),
            h('span', null, t('skillUpload')),
          ),
          h('span', { className: 'ao_hint' }, t('skillUploadHint')),
          importedFile !== '' ? h('small', { className: 'ao_skillFile' }, `${t('skillUploaded')}：${importedFile}`) : null,
        ),
        fileError !== null ? h('p', { className: 'ao_errorText', role: 'alert' }, fileError) : null,
        mode === 'installed' ? h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'ao_skillSearchRow' },
            h('input', {
              className: 'ao_input',
              value: query,
              placeholder: t('skillSearchPlaceholder'),
              onChange: (event) => setQuery(event.target.value),
            }),
            h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: () => void search(query), disabled: loading }, loading ? t('skillSearching') : t('skillSearch')),
          ),
          loading ? h('p', { className: 'ao_hint' }, t('skillSearching')) : results.length === 0 ? h('p', { className: 'ao_hint' }, t('skillNoResults')) : h(
            'div',
            { className: 'ao_skillResults', role: 'listbox' },
            results.map((skill) => h(
              'button',
              {
                type: 'button',
                role: 'option',
                'aria-selected': selected?.name === skill.name,
                key: skill.name,
                className: cx('ao_skillResult', selected?.name === skill.name && 'ao_skillResultActive'),
                onClick: () => setSelected(skill),
              },
              h('strong', null, skill.name),
              h('span', null, skill.description),
              selected?.name === skill.name ? h('small', null, t('skillSelected')) : null,
            )),
          ),
          selected !== null ? h('p', { className: 'ao_skillSelected' }, `${t('skillSelected')}: ${selected.name}`) : null,
        ) : h(
          React.Fragment,
          null,
          h('input', { className: 'ao_input', value: customName, maxLength: 80, placeholder: t('skillName'), onChange: (event) => setCustomName(event.target.value) }),
          h('input', { className: 'ao_input', value: customDescription, maxLength: 300, placeholder: t('skillDescription'), onChange: (event) => setCustomDescription(event.target.value) }),
          h('textarea', { className: 'ao_textarea', rows: 4, value: customInstructions, maxLength: 12000, placeholder: t('skillInstructions'), onChange: (event) => setCustomInstructions(event.target.value) }),
        ),
        h('textarea', { className: 'ao_textarea', rows: 2, value: reason, maxLength: 300, placeholder: t('skillReasonPlaceholder'), onChange: (event) => setReason(event.target.value) }),
        error !== null ? h('p', { className: 'ao_errorText', role: 'alert' }, error) : null,
        notice !== '' ? h('p', { className: 'ao_saveStatus ao_saveStatusOk', role: 'status' }, notice) : null,
        h(
          'div',
          { className: 'ao_skillActions' },
          h('button', { type: 'button', className: 'ao_button ao_buttonPrimary', onClick: () => void submit(), disabled: !canSubmit || role.enabled === false }, saving ? t('skillInjecting') : t('skillInjectAction')),
          role.enabled === false ? h('span', { className: 'ao_hint' }, t('roleDisabled')) : null,
        ),
      );
    }

    function TemplateDialog({ org, saving, error, onPick, onBlank, onCreate, onClose, t }) {
      const [mode, setMode] = React.useState('list');
      const [draft, setDraft] = React.useState({ title: '', level: 'member', responsibilities: '', authority: '', boundaries: '', instructions: '', accent: '#7C6CFF' });
      const templates = Array.isArray(org?.templates) ? org.templates : [];
      const colors = ['#7C6CFF', '#2E9E7B', '#D9822B', '#3B82F6', '#D9578A', '#8A6A4B'];
      const reset = () => setDraft({ title: '', level: 'member', responsibilities: '', authority: '', boundaries: '', instructions: '', accent: '#7C6CFF' });
      const save = async () => {
        const title = draft.title.trim();
        if (title.length < 1 || title.length > 24 || saving) return;
        try {
          await onCreate({
            title,
            level: draft.level,
            responsibilities: draft.responsibilities.trim(),
            authority: draft.authority.trim(),
            boundaries: draft.boundaries.trim(),
            instructions: draft.instructions.trim(),
            accent: draft.accent,
          });
          setMode('list');
          reset();
        } catch {
          // Parent keeps the error in the shared error slot.
        }
      };
      const header = h(
        'div',
        { className: 'ao_templateHeader' },
        h(
          'div',
          { className: 'ao_templateTitleRow' },
          h(Icon, { name: 'org', size: 19, className: 'ao_titleIcon' }),
          h('div', null,
            h('h3', { className: 'ao_templateTitle' }, mode === 'create' ? t('newTemplate') : t('roleTemplates')),
            h('p', { className: 'ao_templateSub' }, t('templateHint')),
          ),
        ),
        h('button', {
          type: 'button',
          className: 'ao_iconButton',
          onClick: onClose,
          title: t('close'),
          'aria-label': t('close'),
        }, h(Icon, { name: 'close', size: 16 })),
      );
      const list = h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'ao_templateToolbar' },
          h('span', { className: 'ao_templateCount' }, `${templates.length} ${t('roleTemplates')}`),
          h(
            'span',
            { className: 'ao_discardActions' },
            h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: onBlank }, t('blankRole')),
            h('button', { type: 'button', className: 'ao_button ao_buttonPrimary', onClick: () => { setMode('create'); reset(); } }, t('newTemplate')),
          ),
        ),
        templates.length === 0 ? h('div', { className: 'ao_templateEmpty' }, t('templateEmpty')) : h(
          'div',
          { className: 'ao_templateGrid' },
          templates.map((template) => h(
            'div',
            { key: template.id, className: 'ao_templateCard' },
            h(
              'div',
              { className: 'ao_templateCardTop' },
              h('span', { className: 'ao_templateName' }, template.title),
              h('span', { className: 'ao_templateBadge' }, `${template.builtin ? t('templateBuiltin') : t('templateCustom')} · ${template.level === 'captain' ? t('levelCaptain') : t('levelMember')}`),
            ),
            h('p', { className: 'ao_templateSnippet' }, template.responsibilities || template.instructions || '—'),
            h(
              'div',
              { className: 'ao_templateCardActions' },
              h('button', {
                type: 'button',
                className: 'ao_button ao_buttonPrimary',
                onClick: () => onPick(template),
              }, t('useTemplate')),
            ),
          )),
        ),
      );
      const create = h(
        'div',
        { className: 'ao_templateForm' },
        h(
          Field,
          { label: t('templateName'), htmlFor: 'ao-template-title' },
          h('input', {
            id: 'ao-template-title',
            className: 'ao_input',
            value: draft.title,
            maxLength: 24,
            autoFocus: true,
            placeholder: t('templateNamePlaceholder'),
            onChange: (event) => setDraft((previous) => ({ ...previous, title: readText(event) })),
          }),
        ),
        h(
          Field,
          { label: t('roleLevel'), htmlFor: 'ao-template-level' },
          h(
            'select',
            {
              id: 'ao-template-level',
              className: 'ao_select',
              value: draft.level,
              onChange: (event) => setDraft((previous) => ({ ...previous, level: readText(event) })),
            },
            h('option', { value: 'member' }, t('levelMember')),
            h('option', { value: 'captain' }, t('levelCaptain')),
          ),
        ),
        h(
          Field,
          { label: t('templateResponsibilities'), htmlFor: 'ao-template-responsibilities' },
          h('textarea', {
            id: 'ao-template-responsibilities',
            className: 'ao_textarea',
            rows: 3,
            maxLength: 400,
            value: draft.responsibilities,
            onChange: (event) => setDraft((previous) => ({ ...previous, responsibilities: readText(event) })),
          }),
        ),
        h(
          Field,
          { label: t('templateAuthority'), htmlFor: 'ao-template-authority' },
          h('input', {
            id: 'ao-template-authority',
            className: 'ao_input',
            maxLength: 300,
            value: draft.authority,
            onChange: (event) => setDraft((previous) => ({ ...previous, authority: readText(event) })),
          }),
        ),
        h(
          Field,
          { label: t('templateBoundaries'), htmlFor: 'ao-template-boundaries' },
          h('input', {
            id: 'ao-template-boundaries',
            className: 'ao_input',
            maxLength: 300,
            value: draft.boundaries,
            onChange: (event) => setDraft((previous) => ({ ...previous, boundaries: readText(event) })),
          }),
        ),
        h(
          Field,
          { label: t('templateInstructions'), htmlFor: 'ao-template-instructions' },
          h('textarea', {
            id: 'ao-template-instructions',
            className: 'ao_textarea',
            rows: 8,
            maxLength: 4000,
            value: draft.instructions,
            onChange: (event) => setDraft((previous) => ({ ...previous, instructions: readText(event) })),
          }),
        ),
        h(
          Field,
          { label: t('accent') },
          h(
            'div',
            { className: 'ao_swatches', role: 'group', 'aria-label': t('accent') },
            colors.map((color) => h('button', {
              type: 'button',
              key: color,
              className: cx('ao_swatch', draft.accent === color && 'ao_swatchActive'),
              style: { backgroundColor: color, color },
              'aria-label': color,
              'aria-pressed': draft.accent === color,
              onClick: () => setDraft((previous) => ({ ...previous, accent: color })),
            })),
          ),
        ),
        h(
          'div',
          { className: 'ao_templateFormActions' },
          h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: () => setMode('list'), disabled: saving }, t('cancel')),
          h('button', { type: 'button', className: 'ao_button ao_buttonPrimary', onClick: save, disabled: saving || draft.title.trim() === '' }, saving ? t('templateSaving') : t('templateSave')),
        ),
      );
      return h(
        'div',
        {
          className: 'ao_templateOverlay',
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget && !saving) onClose();
          },
        },
        h(
          'div',
          { className: 'ao_templateDialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('roleTemplates') },
          header,
          h(
            'div',
            { className: 'ao_templateBody' },
            mode === 'create' ? create : list,
            error ? h('p', { className: 'ao_errorText', role: 'alert' }, error) : null,
          ),
        ),
      );
    }

    function TaskTimerBadge({ task, t }) {
      const [now, setNow] = React.useState(Date.now());
      React.useEffect(() => {
        if (task === null || task === undefined || task.finishedAt !== null) return undefined;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
      }, [task?.id, task?.finishedAt]);
      if (task === null || task === undefined) return null;
      const started = Date.parse(task.startedAt ?? '');
      const finished = task.finishedAt === null ? NaN : Date.parse(task.finishedAt);
      const duration = Number.isFinite(task.durationMs) && task.durationMs > 0
        ? task.durationMs
        : (Number.isFinite(started) ? Math.max(0, (Number.isFinite(finished) ? finished : now) - started) : 0);
      return h(
        'div',
        { className: cx('ao_taskBadge', task.finishedAt !== null && 'ao_taskBadgeDone'), 'data-ao-task-timer': task.id },
        h('span', { className: 'ao_taskBadgeLabel' }, t('taskTimer')),
        h('strong', { className: 'ao_taskBadgeTitle', title: task.title || t('taskNoTitle') }, task.title || t('taskNoTitle')),
        h('span', { className: 'ao_taskBadgeTime' }, formatDuration(duration, t)),
        h('span', { className: 'ao_taskBadgeStatus' }, task.finishedAt === null ? t('taskRunning') : t('taskFinished')),
      );
    }

    const TEAM_CHAT_WIDTH_KEY = 'dsh-agent-org.team-chat-width';
    const TEAM_CHAT_COLLAPSED_KEY = 'dsh-agent-org.team-chat-collapsed';
    const DEFAULT_CHAT_WIDTH = 420;
    const clampChatWidth = (value) => Math.max(280, Math.min(760, Number(value) || DEFAULT_CHAT_WIDTH, Math.max(300, window.innerWidth - 260)));
    const readChatCollapsed = () => {
      try { return window.localStorage.getItem(TEAM_CHAT_COLLAPSED_KEY) === '1'; } catch { return false; }
    };
    const readChatWidth = () => {
      try {
        return clampChatWidth(window.localStorage.getItem(TEAM_CHAT_WIDTH_KEY));
      } catch {
        return DEFAULT_CHAT_WIDTH;
      }
    };

    const autoPinnedWorkingSessions = new Map();
    let autoPinSyncBusy = false;

    function OrgAction({ t, sessionId, openMemberSession, switchLeadModel, pinSession, unpinSession, pinnedSessionIds }) {
      const tr = trFactory(t);
      const [open, setOpen] = React.useState(false);
      const [tab, setTab] = React.useState('org');
      const [state, setState] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [loadError, setLoadError] = React.useState(null);
      const [selectedId, setSelectedId] = React.useState('lead');
      const [draft, setDraft] = React.useState(null);
      const [dirty, setDirty] = React.useState(false);
      const [saveStatus, setSaveStatus] = React.useState('idle');
      const [saveError, setSaveError] = React.useState(null);
      const [notice, setNotice] = React.useState(null);
      const [repairing, setRepairing] = React.useState(false);
      const [designingTeam, setDesigningTeam] = React.useState(false);
      const [reportingMidproject, setReportingMidproject] = React.useState(false);
      const [teamDock, setTeamDock] = React.useState(null);
      const [usageData, setUsageData] = React.useState(null);
      const [usageLoading, setUsageLoading] = React.useState(false);
      const [usageError, setUsageError] = React.useState(null);
      const [confirmDelete, setConfirmDelete] = React.useState(false);
      const [discardOpen, setDiscardOpen] = React.useState(false);
      const [conflict, setConflict] = React.useState(null);
      const [setupOrg, setSetupOrg] = React.useState(null);
      const [setupDirty, setSetupDirty] = React.useState(false);
      const [setupSaving, setSetupSaving] = React.useState(false);
      const [setupError, setSetupError] = React.useState(null);
      const [edgeDraft, setEdgeDraft] = React.useState(null);
      const [nodeMenu, setNodeMenu] = React.useState(null);
      const [roleDialogOpen, setRoleDialogOpen] = React.useState(false);
      const [editorAnchor, setEditorAnchor] = React.useState(null);
      const [templateOpen, setTemplateOpen] = React.useState(false);
      const [templateSaving, setTemplateSaving] = React.useState(false);
      const [templateError, setTemplateError] = React.useState(null);
      const [modelCatalog, setModelCatalog] = React.useState(null);
      const [modelLoading, setModelLoading] = React.useState(false);
      const [modelSaving, setModelSaving] = React.useState(false);
      const [modelError, setModelError] = React.useState(null);
      const [modelChoice, setModelChoice] = React.useState('');
      const [modelPolicy, setModelPolicy] = React.useState([]);
      const [modelPolicySaving, setModelPolicySaving] = React.useState(false);
      const [edgeDirty, setEdgeDirty] = React.useState(false);
      const [edgeSaving, setEdgeSaving] = React.useState(false);
      const [edgeError, setEdgeError] = React.useState(null);
      const triggerRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const previousFocusRef = React.useRef(null);
      const dirtyRef = React.useRef(false);
      const closeRef = React.useRef(() => {});
      const refreshingRef = React.useRef(false);
      const noticeTimerRef = React.useRef(null);
      const tabOrgRef = React.useRef(null);
      const tabActivityRef = React.useRef(null);
      const tabAuditRef = React.useRef(null);
      const tabUsageRef = React.useRef(null);
      const tabSettingsRef = React.useRef(null);
      const deleteKeepRef = React.useRef(null);
      const deleteButtonRef = React.useRef(null);
      const interactionRef = React.useRef(false);
      const layoutSavingRef = React.useRef(false);
      const [chatWidth, setChatWidth] = React.useState(readChatWidth);
      const [chatCollapsed, setChatCollapsed] = React.useState(readChatCollapsed);
      const chatResizeRef = React.useRef(null);

      dirtyRef.current = dirty || setupDirty || edgeDirty;

      React.useEffect(() => {
        try { window.localStorage.setItem(TEAM_CHAT_COLLAPSED_KEY, chatCollapsed ? '1' : '0'); } catch { /* private mode */ }
      }, [chatCollapsed]);

      React.useEffect(() => {
        const width = clampChatWidth(chatWidth);
        document.documentElement.style.setProperty('--ao-team-chat-width', `${width}px`);
        try { window.localStorage.setItem(TEAM_CHAT_WIDTH_KEY, String(width)); } catch { /* private mode */ }
      }, [chatWidth]);

      React.useEffect(() => {
        const onResize = () => setChatWidth((current) => clampChatWidth(current));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, []);

      const beginChatResize = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = clampChatWidth(chatWidth);
        const onMove = (moveEvent) => {
          const next = clampChatWidth(startWidth - (moveEvent.clientX - startX));
          chatResizeRef.current = { width: next };
          document.documentElement.style.setProperty('--ao-team-chat-width', `${next}px`);
        };
        const onEnd = () => {
          window.removeEventListener('pointermove', onMove, true);
          window.removeEventListener('pointerup', onEnd, true);
          window.removeEventListener('pointercancel', onEnd, true);
          const width = chatResizeRef.current?.width ?? startWidth;
          chatResizeRef.current = null;
          setChatWidth(width);
        };
        window.addEventListener('pointermove', onMove, { capture: true, passive: false });
        window.addEventListener('pointerup', onEnd, true);
        window.addEventListener('pointercancel', onEnd, true);
      };

      React.useEffect(() => {
        let alive = true;
        const syncWorkingSessions = async () => {
          if (autoPinSyncBusy || !alive) return;
          if (typeof pinSession !== 'function' || typeof unpinSession !== 'function') return;
          autoPinSyncBusy = true;
          try {
            const data = await apiGet(sessionId);
            if (!alive || data?.configured !== true || data?.enabled !== true) return;
            const active = new Set((Array.isArray(data.runs) ? data.runs : [])
              .filter((run) => run?.status === 'running' && typeof run.childSessionId === 'string' && run.childSessionId !== '')
              .map((run) => run.childSessionId));
            const pinned = new Set(typeof pinnedSessionIds === 'function' ? pinnedSessionIds() : []);
            for (const childSessionId of active) {
              if (pinned.has(childSessionId) || autoPinnedWorkingSessions.has(childSessionId)) continue;
              autoPinnedWorkingSessions.set(childSessionId, false);
              try {
                await pinSession(childSessionId);
              } catch (error) {
                autoPinnedWorkingSessions.delete(childSessionId);
                console.warn('[agent-org] could not pin working member session:', error);
              }
            }
            for (const [childSessionId, wasPinned] of [...autoPinnedWorkingSessions.entries()]) {
              if (active.has(childSessionId)) continue;
              autoPinnedWorkingSessions.delete(childSessionId);
              if (!wasPinned) {
                try {
                  await unpinSession(childSessionId);
                } catch (error) {
                  console.warn('[agent-org] could not unpin finished member session:', error);
                }
              }
            }
          } catch {
            // A transient API/network failure should not affect the organization UI.
          } finally {
            autoPinSyncBusy = false;
          }
        };
        void syncWorkingSessions();
        const timer = setInterval(() => { void syncWorkingSessions(); }, 8000);
        return () => {
          alive = false;
          clearInterval(timer);
        };
      }, [sessionId]);

      React.useEffect(() => {
        if (nodeMenu === null) return undefined;
        const onPointerDown = (event) => {
          if (event.target?.closest?.('[data-agent-org-node-menu]') === null) setNodeMenu(null);
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setNodeMenu(null);
        };
        document.addEventListener('mousedown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('mousedown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [nodeMenu]);

      const showNotice = React.useCallback((message) => {
        setNotice(message);
        if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = setTimeout(() => {
          noticeTimerRef.current = null;
          setNotice(null);
        }, 2600);
      }, []);

      const applyIncoming = React.useCallback((data) => {
        setState((previous) => {
          if (previous !== null && data.revision < previous.revision) return previous;
          if (previous === null || !dirtyRef.current) return data;
          return { ...previous, runs: data.runs, warning: data.warning, serverTime: data.serverTime };
        });
      }, []);

      React.useEffect(() => {
        let alive = true;
        apiGet(sessionId)
          .then((data) => {
            if (!alive) return;
            const isLead = data.org?.lead?.sessionId === sessionId;
            const enabled = data.configured === true && data.enabled === true;
            setTeamDock({
              isLead,
              enabled,
              workspaceId: data.workspace?.id ?? '',
              teamName: data.org?.teamName ?? '',
            });
          })
          .catch(() => {
            if (alive) setTeamDock(null);
          });
        return () => {
          alive = false;
        };
      }, [sessionId]);

      React.useEffect(() => {
        const open = teamDock?.isLead === true && teamDock?.enabled === true && !chatCollapsed;
        document.body.classList.toggle('ao-team-chat-open', open);
        document.documentElement.style.removeProperty('--ao-team-chat-top');
        if (!open) {
          return () => {
            document.body.classList.remove('ao-team-chat-open');
          };
        }
        let frame = null;
        let observer = null;
        const measure = () => {
          const header = document.querySelector('.wSkVaW_header');
          if (header !== null) {
            const top = Math.ceil(header.getBoundingClientRect().bottom);
            document.documentElement.style.setProperty('--ao-team-chat-top', `${top}px`);
          }
          const rightbar = document.querySelector('.pI_x6G_rightbarCol');
          const rightWidth = rightbar === null ? 0 : Math.max(0, Math.ceil(rightbar.getBoundingClientRect().width));
          document.documentElement.style.setProperty('--ao-team-chat-right', `${rightWidth}px`);
        };
        const connect = () => {
          const header = document.querySelector('.wSkVaW_header');
          if (header === null) {
            frame = requestAnimationFrame(connect);
            return;
          }
          measure();
          if (typeof ResizeObserver === 'function') {
            observer = new ResizeObserver(measure);
            observer.observe(header);
            const rightbar = document.querySelector('.pI_x6G_rightbarCol');
            if (rightbar !== null) {
              observer.observe(rightbar);
            }
          }
        };
        connect();
        window.addEventListener('resize', measure);
        return () => {
          if (frame !== null) cancelAnimationFrame(frame);
          if (observer !== null) observer.disconnect();
          window.removeEventListener('resize', measure);
          document.documentElement.style.removeProperty('--ao-team-chat-top');
          document.documentElement.style.removeProperty('--ao-team-chat-right');
          document.body.classList.remove('ao-team-chat-open');
        };
      }, [sessionId, teamDock?.isLead, teamDock?.enabled, chatCollapsed]);

      React.useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        setModelLoading(true);
        setModelError(null);
        apiModels(sessionId, state?.workspace?.id)
          .then((data) => {
            if (!alive) return;
            setModelCatalog(data);
            const selected = data.selected ?? data.default;
            setModelChoice(selected === null || selected === undefined ? '' : `${selected.provider}|${selected.model}`);
            const allKeys = (data.groups ?? []).flatMap((group) => (group.models ?? []).map((model) => `${group.id}|${model.id}`));
            const allowed = Array.isArray(data.policy) ? data.policy.map((item) => `${item.provider}|${item.model}`).filter((key) => allKeys.includes(key)) : allKeys;
            setModelPolicy(allowed);
          })
          .catch((error) => {
            if (alive) setModelError(error instanceof Error ? error.message : String(error));
          })
          .finally(() => {
            if (alive) setModelLoading(false);
          });
        return () => { alive = false; };
      }, [open, sessionId, state?.workspace?.id]);

      const saveLeadModel = async (choice) => {
        if (modelSaving || typeof choice !== 'string' || choice === '') return;
        const [provider, model] = choice.split('|');
        if (!provider || !model) return;
        setModelSaving(true);
        setModelError(null);
        try {
          const data = await apiLeadModel(sessionId, state?.workspace?.id, provider, model);
          setState(data);
          setModelChoice(choice);
          if (typeof switchLeadModel === 'function') {
            try {
              await switchLeadModel({ sessionId, provider, model });
            } catch (syncError) {
              console.warn('[agent-org] lead model saved but client model state was not refreshed:', syncError);
            }
          }
          showNotice(tr('leadModelSaved'));
        } catch (error) {
          setModelError(error instanceof Error ? error.message : String(error));
        } finally {
          setModelSaving(false);
        }
      };

      const saveModelPolicy = async () => {
        if (modelPolicySaving || modelPolicy.length === 0) return;
        setModelPolicySaving(true);
        setModelError(null);
        try {
          const policy = modelPolicy.map((key) => {
            const [provider, model] = key.split('|');
            return { provider, model };
          });
          const data = await apiLeadModelPolicy(sessionId, state?.workspace?.id, policy);
          setState(data);
          showNotice(tr('leadModelScopeSaved'));
        } catch (error) {
          setModelError(error instanceof Error ? error.message : String(error));
        } finally {
          setModelPolicySaving(false);
        }
      };

      const loadUsage = React.useCallback(async () => {
        if (state === null) return;
        setUsageLoading(true);
        try {
          const data = await apiUsage(state.workspace?.id, sessionId);
          setUsageData(data.usage ?? null);
          setUsageError(null);
        } catch (error) {
          setUsageError(error instanceof Error ? error.message : String(error));
        } finally {
          setUsageLoading(false);
        }
      }, [state?.workspace?.id, sessionId]);

      React.useEffect(() => {
        if (!open || tab !== 'usage') return undefined;
        let alive = true;
        const load = () => { if (alive) void loadUsage(); };
        load();
        const timer = setInterval(load, 5000);
        return () => {
          alive = false;
          clearInterval(timer);
        };
      }, [open, tab, loadUsage]);


      const searchRoleSkills = (query) => apiSkills(sessionId, state?.workspace?.id, query);
      const injectRoleSkill = (payload) => apiSkillInject(sessionId, state?.workspace?.id, payload);
      const handleSkillInjected = (data) => {
        setState(data);
        const updated = data?.org?.roles?.find((role) => role.id === selectedId);
        if (updated !== undefined) {
          setDraft((previous) => (previous !== null && previous.kind === 'role'
            ? { ...previous, role: { ...previous.role, skills: updated.skills ?? [] } }
            : previous));
        }
        showNotice(tr('skillInjected'));
      };

      // Explicit, user-triggered repair. Never runs automatically; GET state is
      // read-only, so this is the only panel path that detaches/rebuilds member
      // sessions.
      const repairMemberSessions = async () => {
        if (repairing) return;
        setRepairing(true);
        try {
          const data = await apiRepair(state?.workspace?.id, sessionId);
          setState(data);
          showNotice(tr('repairDone'));
        } catch (error) {
          showNotice(`${tr('repairFailed')}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          setRepairing(false);
        }
      };

      const designTeamRelations = async () => {
        if (designingTeam || state === null) return;
        setDesigningTeam(true);
        try {
          const data = await apiDesignTeam(state.workspace?.id, sessionId);
          setState(data);
          showNotice(tr('designTeamDone'));
        } catch (error) {
          showNotice(`${tr('designTeamFailed')}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          setDesigningTeam(false);
        }
      };
      const requestMidprojectReport = async () => {
        if (reportingMidproject || state === null) return;
        setReportingMidproject(true);
        try {
          const data = await apiMidprojectReport(state.workspace?.id, sessionId);
          setState(data);
          showNotice(tr('midprojectReportDone'));
        } catch (error) {
          showNotice(`${tr('midprojectReportFailed')}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          setReportingMidproject(false);
        }
      };

      React.useEffect(() => () => {
        if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current);
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;
        previousFocusRef.current = document.activeElement;
        const timer = requestAnimationFrame(() => panelRef.current?.focus());
        return () => {
          cancelAnimationFrame(timer);
          const previous = previousFocusRef.current;
          if (previous !== null && typeof previous.focus === 'function') previous.focus();
        };
      }, [open]);

      React.useEffect(() => {
        if (!open) return undefined;
        let alive = true;
        const controller = new AbortController();
        const load = async (first) => {
          if (!alive || refreshingRef.current) return;
          if (!first && (interactionRef.current || layoutSavingRef.current || dirtyRef.current)) return;
          refreshingRef.current = true;
          if (first) setLoading(true);
          try {
            const data = await apiGet(sessionId, controller.signal);
            if (!alive || interactionRef.current || layoutSavingRef.current) return;
            applyIncoming(data);
            setLoadError(null);
          } catch (error) {
            if (!alive || controller.signal.aborted) return;
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setLoadError(error instanceof Error ? error.message : String(error));
          } finally {
            refreshingRef.current = false;
            if (first && alive) setLoading(false);
          }
        };
        void load(true);
        const interval = setInterval(() => {
          if (document.visibilityState !== 'hidden') void load(false);
        }, 1500);
        const onVisibility = () => { if (document.visibilityState === 'visible') void load(false); };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
          alive = false;
          controller.abort();
          clearInterval(interval);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }, [open, sessionId, applyIncoming]);

      React.useEffect(() => {
        if (!open || state === null || dirty || state.configured === false) return;
        setDraft(makeDraft(state.org, selectedId));
        if (selectedId !== 'lead' && !state.org.roles.some((role) => role.id === selectedId)) {
          setSelectedId('lead');
        }
      }, [open, state, selectedId, dirty]);

      React.useEffect(() => {
        if (!open || state === null) return;
        if (state.configured === false) {
          if (setupOrg === null) {
            setSetupOrg(JSON.parse(JSON.stringify(state.org)));
            setSetupDirty(false);
            setSetupError(null);
          }
          return;
        }
        if (setupOrg !== null) {
          setSetupOrg(null);
          setSetupDirty(false);
          setSetupError(null);
        }
      }, [open, state, setupOrg]);

      const selectTab = (next) => {
        if (next === 'settings') {
          setRoleDialogOpen(false);
          setEdgeDraft(null);
          setSelectedId('lead');
          setDraft(state === null ? null : makeDraft(state.org, 'lead'));
        }
        setTab(next);
        requestAnimationFrame(() => {
          const target = next === 'org' ? tabOrgRef.current : next === 'activity' ? tabActivityRef.current : next === 'audit' ? tabAuditRef.current : next === 'usage' ? tabUsageRef.current : tabSettingsRef.current;
          target?.focus();
        });
      };

      const switchTab = (next) => {
        if (roleDialogOpen || edgeDraft !== null || conflict !== null) {
          if (dirtyRef.current) {
            showNotice(tr('unsavedBlocked'));
            return;
          }
          setRoleDialogOpen(false);
          setEdgeDraft(null);
          setConflict(null);
        }
        setTab(next);
      };

      const onTabKeyDown = (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const order = ['org', 'activity', 'audit', 'usage', 'settings'];
        const current = Math.max(0, order.indexOf(tab));
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        selectTab(order[(current + direction + order.length) % order.length]);
      };

      const requestClose = React.useCallback(() => {
        if (dirtyRef.current) setDiscardOpen(true);
        else {
          setRoleDialogOpen(false);
          setTemplateOpen(false);
          setEdgeDraft(null);
          setNodeMenu(null);
          setOpen(false);
        }
      }, []);
      closeRef.current = requestClose;

      React.useEffect(() => {
        if (confirmDelete) deleteKeepRef.current?.focus();
      }, [confirmDelete]);

      React.useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            if (discardOpen) setDiscardOpen(false);
            else if (roleDialogOpen || edgeDraft !== null) closeEditor();
            else closeRef.current();
            return;
          }
          if (event.key !== 'Tab' || panelRef.current === null) return;
          const focusable = [...panelRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )].filter((node) => node !== panelRef.current && (node.offsetWidth > 0 || node.offsetHeight > 0));
          if (focusable.length === 0) {
            event.preventDefault();
            panelRef.current.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (!panelRef.current.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      }, [open, discardOpen, roleDialogOpen, edgeDraft]);

      const selectMember = (id) => {
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        setSelectedId(id);
        setEdgeDraft(null);
        setEdgeDirty(false);
        setEdgeError(null);
        setConfirmDelete(false);
        setSaveError(null);
        setConflict(null);
        setSaveStatus('idle');
        setDraft(state === null ? null : makeDraft(state.org, id));
        if (id === 'lead') {
          setTab('org');
          setRoleDialogOpen(true);
        } else {
          if (tab === 'settings') setTab('org');
          setRoleDialogOpen(true);
        }
      };

      const openTemplatePicker = () => {
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        if (state === null) return;
        if (state.org.roles.length >= 24) {
          showNotice(tr('roleLimit', { count: 24 }));
          return;
        }
        setTemplateError(null);
        setTemplateOpen(true);
      };

      const addMemberFromTemplate = (template) => {
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        if (state === null || template === undefined || template === null) return;
        if (state.org.roles.length >= 24) {
          showNotice(tr('roleLimit', { count: 24 }));
          return;
        }
        const id = nextRoleId(state.org);
        const role = {
          id,
          name: defaultEmployeeName(state.org, template.title, id) || template.title,
          title: template.title,
          level: template.level === 'captain' ? 'captain' : 'member',
          effort: 'low',
          authority: template.authority || '',
          boundaries: template.boundaries || '',
          reportsTo: 'lead',
          enabled: true,
          accent: template.accent || '#7C6CFF',
          responsibilities: template.responsibilities || '',
          instructions: template.instructions || '',
        };
        setTemplateOpen(false);
        setTemplateError(null);
        setTab('org');
        setSelectedId(id);
        setDraft({ kind: 'role', role, isNew: true, autoName: false });
        setRoleDialogOpen(true);
        setDirty(true);
        setSaveStatus('idle');
        setSaveError(null);
        setConflict(null);
        setConfirmDelete(false);
      };

      const createTemplate = async (fields) => {
        if (state === null || templateSaving) return;
        const templates = Array.isArray(state.org.templates) ? state.org.templates : [];
        if (templates.length >= 24) {
          setTemplateError(tr('roleLimit', { count: 24 }));
          throw new Error('template limit');
        }
        const title = String(fields.title ?? '').trim();
        if (title.length < 1 || title.length > 24) {
          setTemplateError(tr('templateName'));
          throw new Error('template title');
        }
        const template = {
          id: `template-${Date.now().toString(36)}`,
          title,
          level: fields.level === 'captain' ? 'captain' : 'member',
          accent: fields.accent || '#7C6CFF',
          responsibilities: String(fields.responsibilities ?? '').trim(),
          authority: String(fields.authority ?? '').trim(),
          boundaries: String(fields.boundaries ?? '').trim(),
          instructions: String(fields.instructions ?? '').trim(),
          builtin: false,
        };
        setTemplateSaving(true);
        setTemplateError(null);
        try {
          const data = await apiSave(state.revision, {
            ...state.org,
            templates: [...templates, template],
          }, sessionId);
          setState(data);
          showNotice(tr('templateCreated'));
          return template;
        } catch (error) {
          setTemplateError(error instanceof Error ? error.message : String(error));
          throw error;
        } finally {
          setTemplateSaving(false);
        }
      };

      const addMember = () => {
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        setTemplateOpen(false);
        setEdgeDraft(null);
        setEdgeDirty(false);
        setEdgeError(null);
        if (state === null) return;
        if (state.org.roles.length >= 24) {
          showNotice(tr('roleLimit', { count: 24 }));
          return;
        }
        const id = nextRoleId(state.org);
        const role = {
          id,
          name: '',
          title: '',
          level: 'member',
          effort: 'low',
          authority: '',
          boundaries: '',
          reportsTo: 'lead',
          enabled: true,
          accent: ['#7C6CFF', '#2E9E7B', '#D9822B', '#3B82F6', '#D9578A', '#8A6A4B'][state.org.roles.length % 6],
          responsibilities: '',
          instructions: '',
        };
        setTab('org');
        setSelectedId(id);
        setDraft({ kind: 'role', role, isNew: true, autoName: true });
        setRoleDialogOpen(true);
        setDirty(true);
        setSaveStatus('idle');
        setSaveError(null);
        setConflict(null);
        setConfirmDelete(false);
      };

      const copyMember = (role) => {
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        if (state === null || role === undefined || role === null) return;
        if (state.org.roles.length >= 24) {
          showNotice(tr('roleLimit', { count: 24 }));
          return;
        }
        const id = nextRoleId(state.org);
        const used = new Set(state.org.roles.map((candidate) => candidate.name));
        const baseName = defaultEmployeeName(state.org, role.title, id)
          || `${role.name} 副本`.slice(0, 24)
          || '新成员';
        let name = baseName;
        let suffix = 2;
        while (used.has(name)) {
          name = `${baseName} ${suffix}`.slice(0, 24);
          suffix += 1;
        }
        const { sessionId: ignored, ...rest } = role;
        const copied = {
          ...rest,
          id,
          name,
          reportsTo: role.reportsTo,
          enabled: role.enabled !== false,
          accent: role.accent,
          responsibilities: role.responsibilities ?? '',
          instructions: role.instructions ?? '',
        };
        setTab('org');
        setSelectedId(id);
        setDraft({ kind: 'role', role: copied, isNew: true, autoName: false });
        setRoleDialogOpen(true);
        setDirty(true);
        setSaveStatus('idle');
        setSaveError(null);
        setConflict(null);
        setConfirmDelete(false);
        setNodeMenu(null);
        showNotice(tr('roleCopied', { name }));
      };

      const updateLead = (patch) => {
        setDraft((previous) => (previous === null ? previous : { ...previous, ...patch }));
        setDirty(true);
        setSaveStatus('idle');
        setSaveError(null);
      };

      const updateRole = (patch) => {
        setDraft((previous) => (
          previous === null || previous.kind !== 'role'
            ? previous
            : { ...previous, role: { ...previous.role, ...patch } }
        ));
        setDirty(true);
        setSaveStatus('idle');
        setSaveError(null);
      };

      const cancelEdits = () => {
        if (state === null) return;
        const target = draft !== null && draft.isNew && selectedId !== 'lead' ? 'lead' : selectedId;
        setSelectedId(target);
        setDraft(makeDraft(state.org, target));
        setRoleDialogOpen(false);
        setDirty(false);
        setSaveStatus('idle');
        setSaveError(null);
        setConfirmDelete(false);
        setConflict(null);
      };

      const save = async (event) => {
        if (event !== undefined) event.preventDefault();
        if (state === null || state.configured === false || draft === null || saveStatus === 'saving') return;
        let nextOrg;
        if (draft.kind === 'lead') {
          nextOrg = {
            ...state.org,
            teamName: draft.teamName.trim(),
            lead: {
              ...state.org.lead,
              label: draft.label.trim(),
              description: draft.description.trim(),
            },
          };
        } else {
          const role = {
            ...draft.role,
            name: draft.role.name.trim(),
            title: draft.role.title.trim(),
            responsibilities: draft.role.responsibilities.trim(),
            instructions: draft.role.instructions.trim(),
          };
          const exists = state.org.roles.some((candidate) => candidate.id === role.id);
          const roles = exists
            ? state.org.roles.map((candidate) => (candidate.id === role.id ? role : candidate))
            : [...state.org.roles, role];
          nextOrg = { ...state.org, roles };
        }

        setSaveStatus('saving');
        setSaveError(null);
        setConflict(null);
        try {
          let data = await apiSave(state.revision, nextOrg, sessionId);
          if (data.enabled && data.org.roles.some((role) => role.enabled && !role.sessionId)) {
            const workspaceId = data.workspace?.id ?? state.workspace?.id;
            const leadSessionId = data.org.lead?.sessionId ?? sessionId;
            if (typeof workspaceId === 'string' && typeof leadSessionId === 'string') {
              try {
                data = await apiProvision(workspaceId, leadSessionId, draft.kind === 'role' ? draft.role.id : undefined);
              } catch (error) {
                console.warn('[agent-org] could not provision new member sessions:', error);
              }
            }
          }
          setState(data);
          setDirty(false);
          const target = draft.kind === 'lead' ? 'lead' : draft.role.id;
          setSelectedId(target);
          setDraft(makeDraft(data.org, target));
          if (draft.kind === 'role') setRoleDialogOpen(false);
          setSaveStatus('saved');
          showNotice(draft.isNew ? tr('roleCreated') : tr('changesSaved'));
        } catch (error) {
          setSaveStatus('error');
          if (error instanceof ApiError && error.code === 'revision-conflict') {
            setConflict(error.payload ?? null);
            setSaveError(tr('conflictText'));
          } else if (error instanceof ApiError && error.code === 'network') {
            setSaveError(tr('serviceUnavailable'));
          } else {
            setSaveError(error instanceof Error ? error.message : String(error));
          }
        }
      };

      const deleteRole = async () => {
        if (state === null || draft === null || draft.kind !== 'role' || draft.isNew) return;
        const role = draft.role;
        const roles = state.org.roles
          .filter((candidate) => candidate.id !== role.id)
          .map((candidate) => (
            candidate.reportsTo === role.id ? { ...candidate, reportsTo: role.reportsTo } : candidate
          ));
        const relations = (state.org.relations ?? []).filter((relation) => (
          relation.from !== role.id && relation.to !== role.id
        ));
        const helpRequests = (state.org.helpRequests ?? []).filter((request) => (
          request.from !== role.id && request.to !== role.id
        ));
        const failureReports = (state.org.failureReports ?? []).filter((report) => (
          report.from !== role.id && report.roleId !== role.id
        ));
        const layout = { ...(state.org.layout ?? {}) };
        delete layout[role.id];
        setSaveStatus('saving');
        setSaveError(null);
        try {
          const data = await apiSave(state.revision, {
            ...state.org,
            roles,
            relations,
            helpRequests,
            failureReports,
            layout,
          }, sessionId);
          setState(data);
          setDirty(false);
          setSelectedId('lead');
          setDraft(makeDraft(data.org, 'lead'));
          setRoleDialogOpen(false);
          setTab('settings');
          setSaveStatus('idle');
          setConfirmDelete(false);
          showNotice(tr('roleDeleted'));
          if (typeof role.sessionId === 'string' && role.sessionId !== '') {
            void archiveMemberSession(role.sessionId).catch((error) => {
              console.warn('[agent-org] could not archive deleted member session:', error);
            });
          }
        } catch (error) {
          setSaveStatus('error');
          if (error instanceof ApiError && error.code === 'revision-conflict') {
            setConflict(error.payload ?? null);
            setSaveError(tr('conflictText'));
          } else if (error instanceof ApiError && error.code === 'network') {
            setSaveError(tr('serviceUnavailable'));
          } else {
            setSaveError(error instanceof Error ? error.message : String(error));
          }
        }
      };

      const loadLatestAfterConflict = () => {
        if (conflict === null || typeof conflict.org !== 'object') return;
        const data = {
          ...conflict,
          ok: true,
          revision: conflict.revision,
          org: conflict.org,
          runs: state?.runs ?? [],
          warning: null,
        };
        setState(data);
        setDirty(false);
        setSaveStatus('idle');
        setSaveError(null);
        setConflict(null);
        setConfirmDelete(false);
        const target = selectedId === 'lead' ? 'lead' : selectedId;
        setSelectedId(target);
        setDraft(makeDraft(data.org, target));
      };

      const selectEdge = (edge) => {
        if (edge?.kind === 'primary') {
          // Primary reporting lines are not stored relation objects. Open the
          // child role editor so its fixed "reports to" manager can be changed.
          const roleId = typeof edge.id === 'string' && edge.id.startsWith('primary-')
            ? edge.id.slice('primary-'.length)
            : null;
          if (roleId !== null && roleId !== '') selectMember(roleId);
          return;
        }
        if (edge?.relation === undefined) return;
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        setSelectedId(edge.relation.from);
        setEdgeDraft({ ...edge.relation, isNew: false });
        setRoleDialogOpen(false);
        setEdgeDirty(false);
        setEdgeError(null);
        setConfirmDelete(false);
      };

      const openNodeMenu = (node, event) => {
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        const x = Math.max(8, Math.min(event.clientX ?? 0, window.innerWidth - 184));
        const y = Math.max(8, Math.min(event.clientY ?? 0, window.innerHeight - 116));
        setNodeMenu({ nodeId: node.id, x, y });
      };

      const beginRelation = (from, to) => {
        if (from === to) return;
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        if (state === null || state.org === null || state.org === undefined) return;
        const nodeIds = new Set(['lead', ...(state.org.roles ?? []).map((role) => role.id)]);
        if (!nodeIds.has(from) || !nodeIds.has(to)) return;
        setSelectedId(from);
        setEdgeDraft({
          isNew: true,
          id: nextRelationId(state.org),
          from,
          to,
          type: 'collaborates',
          label: '',
          expiresAt: null,
        });
        setRoleDialogOpen(false);
        setEdgeDirty(false);
        setEdgeError(null);
        setConfirmDelete(false);
      };

      const updateEdge = (next) => {
        setEdgeDraft(next);
        setEdgeDirty(true);
        setEdgeError(null);
      };

      const cancelEdge = () => {
        setEdgeDraft(null);
        setEdgeDirty(false);
        setEdgeError(null);
      };

      const closeEditor = () => {
        // X means dismiss the floating editor. Unsaved edits are discarded so
        // the close control always works; Save remains the explicit commit.
        if (roleDialogOpen) cancelEdits();
        if (edgeDraft !== null) cancelEdge();
        setRoleDialogOpen(false);
        setConflict(null);
      };

      const saveEdge = async () => {
        if (state === null || edgeDraft === null || edgeSaving) return;
        if (edgeDraft.from === edgeDraft.to) {
          setEdgeError(tr('relationSelfError'));
          return;
        }
        const relation = {
          id: edgeDraft.id,
          from: edgeDraft.from,
          to: edgeDraft.to,
          type: edgeDraft.type,
          label: String(edgeDraft.label ?? '').trim(),
          expiresAt: edgeDraft.type === 'temporary' ? (edgeDraft.expiresAt ?? null) : null,
        };
        const current = state.org.relations ?? [];
        const relations = current.some((item) => item.id === relation.id)
          ? current.map((item) => (item.id === relation.id ? relation : item))
          : [...current, relation];
        setEdgeSaving(true);
        setEdgeError(null);
        try {
          const data = await apiSave(state.revision, { ...state.org, relations }, sessionId);
          setState(data);
          setSelectedId(relation.from);
          setEdgeDraft(null);
          setEdgeDirty(false);
          setSaveStatus('saved');
          showNotice(tr('relationSaved'));
        } catch (error) {
          if (error instanceof ApiError && error.code === 'network') setEdgeError(tr('serviceUnavailable'));
          else setEdgeError(error instanceof Error ? error.message : String(error));
        } finally {
          setEdgeSaving(false);
        }
      };

      const deleteEdge = async () => {
        if (state === null || edgeDraft === null || edgeDraft.isNew || edgeSaving) return;
        setEdgeSaving(true);
        setEdgeError(null);
        try {
          const relations = (state.org.relations ?? []).filter((relation) => relation.id !== edgeDraft.id);
          const data = await apiSave(state.revision, { ...state.org, relations }, sessionId);
          setState(data);
          setEdgeDraft(null);
          setEdgeDirty(false);
          setSaveStatus('saved');
          showNotice(tr('relationDeleted'));
        } catch (error) {
          if (error instanceof ApiError && error.code === 'network') setEdgeError(tr('serviceUnavailable'));
          else setEdgeError(error instanceof Error ? error.message : String(error));
        } finally {
          setEdgeSaving(false);
        }
      };

      const moveNode = async (nodeId, position) => {
        if (state === null || legacyHost) return;
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        const previous = state;
        layoutSavingRef.current = true;
        const layout = { ...(previous.org.layout ?? {}), [nodeId]: { x: position.x, y: position.y } };
        setState((current) => (current === null ? current : { ...current, org: { ...current.org, layout } }));
        try {
          const data = await apiLayout(sessionId, previous.workspace?.id, previous.revision, { nodeId, position });
          setState(data);
          setSaveStatus('saved');
        } catch (error) {
          setState((current) => (current === null ? current : { ...current, org: { ...current.org, layout: previous.org.layout ?? {} } }));
          showNotice(error instanceof Error ? error.message : String(error));
        } finally {
          layoutSavingRef.current = false;
        }
      };

      const resetLayout = async () => {
        if (state === null || legacyHost) return;
        if (dirtyRef.current) {
          showNotice(tr('unsavedBlocked'));
          return;
        }
        const previous = state;
        layoutSavingRef.current = true;
        setState((current) => (current === null ? current : { ...current, org: { ...current.org, layout: {} } }));
        try {
          const data = await apiLayout(sessionId, previous.workspace?.id, previous.revision, { clear: true });
          setState(data);
          setSaveStatus('saved');
          showNotice(tr('layoutSaved'));
        } catch (error) {
          setState((current) => (current === null ? current : { ...current, org: { ...current.org, layout: previous.org.layout ?? {} } }));
          showNotice(error instanceof Error ? error.message : String(error));
        } finally {
          layoutSavingRef.current = false;
        }
      };

      const openRunSession = (run) => {
        if (!run?.childSessionId || typeof openMemberSession !== 'function') return;
        try {
          openMemberSession(run.parentSessionId, run.childSessionId);
        } catch (error) {
          showNotice(error instanceof Error ? error.message : String(error));
        }
      };

      const saveSetup = async () => {
        if (state === null || state.configured !== false || setupOrg === null || setupSaving) return;
        setSetupSaving(true);
        setSetupError(null);
        try {
          const data = await apiSave(0, { ...setupOrg, enabled: true }, sessionId);
          setState(data);
          setSetupOrg(null);
          setSetupDirty(false);
          setDirty(false);
          setSelectedId('lead');
          setDraft(makeDraft(data.org, 'lead'));
          setSaveStatus('saved');
          setTab('org');
          showNotice(tr('setupSaved'));
        } catch (error) {
          if (error instanceof ApiError && error.code === 'network') {
            setSetupError(tr('serviceUnavailable'));
          } else {
            setSetupError(error instanceof Error ? error.message : String(error));
          }
        } finally {
          setSetupSaving(false);
        }
      };

      const activeRunList = state?.runs?.filter((run) => run.status === 'running') ?? [];
      const activeRuns = activeRunList.length;
      const warning = state?.warning ?? null;
      const roleCount = state?.org?.roles?.length ?? 0;
      const isSetup = state !== null && state.configured === false;
      const workspace = state?.workspace ?? null;
      const legacyHost = state !== null && (state.configured === undefined || state.workspace === undefined);
      const currentDraft = draft;
      const selectedRole = currentDraft?.kind === 'role' ? currentDraft.role : null;
      const latestRoleRun = selectedRole === null
        ? null
        : state?.runs?.find((run) => run.roleId === selectedRole.id) ?? null;
      React.useEffect(() => {
        const anchorId = selectedId === 'lead' ? 'lead' : selectedRole?.id;
        if (!roleDialogOpen || anchorId === undefined || anchorId === null) {
          setEditorAnchor(null);
          return undefined;
        }
        let frame = null;
        let timer = null;
        const update = () => {
          const node = panelRef.current?.querySelector(`[data-ao-node-id="${anchorId}"]`);
          if (node === null || node === undefined) return;
          const rect = node.getBoundingClientRect();
          const width = Math.min(390, Math.max(160, window.innerWidth - 24));
          let left = rect.right + 12;
          let top = rect.top;
          if (left + width > window.innerWidth - 12) {
            const leftCandidate = rect.left - width - 12;
            if (leftCandidate >= 12) {
              left = leftCandidate;
            } else {
              left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
              top = rect.bottom + 10;
            }
          }
          left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
          const estimatedHeight = Math.min(430, Math.max(180, window.innerHeight - 24));
          top = Math.max(12, Math.min(top, window.innerHeight - estimatedHeight - 12));
          setEditorAnchor({ left, top, width });
        };
        const schedule = () => {
          if (frame !== null) return;
          frame = requestAnimationFrame(() => {
            frame = null;
            update();
          });
        };
        schedule();
        timer = setInterval(update, 300);
        window.addEventListener('resize', schedule);
        const scroller = panelRef.current?.querySelector('.ao_topologyScroll');
        scroller?.addEventListener('scroll', schedule, { passive: true });
        return () => {
          if (frame !== null) cancelAnimationFrame(frame);
          if (timer !== null) clearInterval(timer);
          window.removeEventListener('resize', schedule);
          scroller?.removeEventListener('scroll', schedule);
        };
      }, [roleDialogOpen, selectedId, selectedRole?.id]);
      React.useLayoutEffect(() => {
        if (!roleDialogOpen) return;
        const side = panelRef.current?.querySelector('.ao_sideAnchored');
        if (side === null || side === undefined) return;
        const rect = side.getBoundingClientRect();
        const maxRight = window.innerWidth - 12;
        const maxBottom = window.innerHeight - 12;
        const left = Math.max(12, Math.min(rect.left, maxRight - rect.width));
        const top = Math.max(12, Math.min(rect.top, maxBottom - rect.height));
        setEditorAnchor((previous) => {
          if (previous === null) return previous;
          if (Math.abs(previous.left - left) < 1 && Math.abs(previous.top - top) < 1) return previous;
          return { ...previous, left, top };
        });
      }, [editorAnchor, roleDialogOpen, selectedId]);
      const relatedRelations = selectedRole === null
        ? []
        : (state?.org?.relations ?? []).filter((relation) => (
            relation.from === selectedRole.id || relation.to === selectedRole.id
          ));
      const isNew = currentDraft?.kind === 'role' && currentDraft.isNew === true;
      const managerAfterDelete = selectedRole === null ? '' : (selectedRole.reportsTo === 'lead' ? state?.org?.lead?.label ?? '' : state?.org?.roles?.find((candidate) => candidate.id === selectedRole.reportsTo)?.name ?? '');
      const menuRole = nodeMenu === null
        ? null
        : nodeMenu.nodeId === 'lead'
          ? { id: 'lead', name: state?.org?.lead?.label ?? tr('topologyLegendLead'), isLead: true }
          : state?.org?.roles?.find((role) => role.id === nodeMenu.nodeId) ?? null;

      const trigger = h(
        'button',
        {
          type: 'button',
          ref: triggerRef,
          className: 'ao_trigger',
          'data-agent-org-trigger': '',
          'aria-label': tr('triggerAria'),
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          onClick: () => {
            if (open) requestClose();
            else {
              setOpen(true);
              setTab('org');
              setSelectedId('lead');
              setDraft(null);
              setDirty(false);
              setSaveError(null);
              setSaveStatus('idle');
              setDiscardOpen(false);
              setConflict(null);
              setConfirmDelete(false);
              setSetupOrg(null);
              setSetupDirty(false);
              setSetupError(null);
              setEdgeDraft(null);
              setEdgeDirty(false);
              setEdgeError(null);
            }
          },
        },
        h(Icon, { name: 'org', size: 14 }),
        h('span', { className: 'ao_triggerLabel' }, tr('trigger')),
        state !== null
          ? h(
              React.Fragment,
              null,
              h(
                'span',
                { className: 'ao_triggerCount' },
                state.configured === false ? tr('setupRequiredShort') : roleCount,
              ),
              activeRuns > 0 ? h('span', { className: 'ao_liveDot', 'aria-hidden': 'true' }) : null,
            )
          : null,
      );

      const teamChatNode = teamDock?.isLead === true && teamDock?.enabled === true ? ReactDOM.createPortal(
        chatCollapsed
          ? h(
            'button',
            {
              type: 'button',
              className: 'ao_teamChatReopen',
              onClick: () => setChatCollapsed(false),
              title: tr('expandChat'),
              'aria-label': tr('expandChat'),
            },
            h('span', { className: 'ao_teamChatReopenArrow' }, '‹'),
            h('span', null, tr('teamChat')),
          )
          : h(
          'aside',
          {
            className: 'ao_teamChatPane',
            'data-agent-org-team-chat': '',
            'aria-label': tr('teamChat'),
          },
          h('div', {
            className: 'ao_teamChatResizer',
            role: 'separator',
            'aria-label': tr('chatWidth'),
            'aria-orientation': 'vertical',
            'aria-valuemin': 280,
            'aria-valuemax': 760,
            'aria-valuenow': chatWidth,
            tabIndex: 0,
            title: tr('chatWidth'),
            onPointerDown: beginChatResize,
            onDoubleClick: () => setChatWidth(DEFAULT_CHAT_WIDTH),
            onKeyDown: (event) => {
              if (event.key === 'ArrowLeft') { event.preventDefault(); setChatWidth((current) => clampChatWidth(current + 20)); }
              else if (event.key === 'ArrowRight') { event.preventDefault(); setChatWidth((current) => clampChatWidth(current - 20)); }
            },
          }),
          h(GroupChat, {
            t: tr,
            workspaceId: teamDock.workspaceId,
            openSession: openMemberSession,
            onCollapse: () => setChatCollapsed(true),
          }),
        ),
        document.body,
      ) : null;

      if (!open) return h(React.Fragment, null, trigger, teamChatNode);

      const tabs = h(
        'div',
        { className: 'ao_tabs', role: 'tablist', 'aria-label': tr('title'), onKeyDown: onTabKeyDown },
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': tab === 'org',
            'aria-controls': 'ao-panel-org',
            id: 'ao-tab-org',
            ref: tabOrgRef,
            tabIndex: tab === 'org' ? 0 : -1,
            className: cx('ao_tab', tab === 'org' && 'ao_tabActive'),
            onClick: () => switchTab('org'),
          },
          tr('tabOrg'),
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': tab === 'activity',
            'aria-controls': 'ao-panel-activity',
            id: 'ao-tab-activity',
            ref: tabActivityRef,
            tabIndex: tab === 'activity' ? 0 : -1,
            className: cx('ao_tab', tab === 'activity' && 'ao_tabActive'),
            onClick: () => switchTab('activity'),
          },
          tr('tabActivity'),
          state?.runs?.length ? h('span', { className: 'ao_triggerCount' }, ` ${state.runs.length}`) : null,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': tab === 'audit',
            'aria-controls': 'ao-panel-audit',
            id: 'ao-tab-audit',
            ref: tabAuditRef,
            tabIndex: tab === 'audit' ? 0 : -1,
            className: cx('ao_tab', tab === 'audit' && 'ao_tabActive'),
            onClick: () => switchTab('audit'),
          },
          tr('tabAudit'),
          state?.org?.audit?.length ? h('span', { className: 'ao_triggerCount' }, ` ${state.org.audit.length}`) : null,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': tab === 'usage',
            'aria-controls': 'ao-panel-usage',
            id: 'ao-tab-usage',
            ref: tabUsageRef,
            tabIndex: tab === 'usage' ? 0 : -1,
            className: cx('ao_tab', tab === 'usage' && 'ao_tabActive'),
            onClick: () => switchTab('usage'),
          },
          tr('tabUsage'),
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': tab === 'settings',
            'aria-controls': 'ao-panel-settings',
            id: 'ao-tab-settings',
            ref: tabSettingsRef,
            tabIndex: tab === 'settings' ? 0 : -1,
            className: cx('ao_tab', tab === 'settings' && 'ao_tabActive'),
            onClick: () => {
              if (dirtyRef.current) {
                showNotice(tr('unsavedBlocked'));
                return;
              }
              setRoleDialogOpen(false);
              setEdgeDraft(null);
              setSelectedId('lead');
              setDraft(state === null ? null : makeDraft(state.org, 'lead'));
              setTab('settings');
            },
          },
          tr('teamSettings'),
        ),
      );

      let content = null;
      if (loading && state === null) {
        content = h(
          'div',
          { className: 'ao_centerState', role: 'status' },
          h('span', { className: 'ao_spinner' }),
          h('span', null, tr('loading')),
        );
      } else if (loadError !== null && state === null) {
        content = h(
          'div',
          { className: 'ao_centerState', role: 'alert' },
          h(Icon, { name: 'warning', size: 20 }),
          h('span', { className: 'ao_centerTitle' }, tr('loadFailed')),
          h('span', { className: 'ao_centerText' }, loadError),
          h(
            'button',
            {
              type: 'button',
              className: 'ao_button',
              onClick: () => {
                setLoadError(null);
                setLoading(true);
                apiGet(sessionId)
                  .then((data) => applyIncoming(data))
                  .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)))
                  .finally(() => setLoading(false));
              },
            },
            h(Icon, { name: 'refresh', size: 14 }),
            h('span', null, tr('retry')),
          ),
        );
      } else if (state !== null && state.configured === false) {
        content = setupOrg === null
          ? h(
              'div',
              { className: 'ao_centerState', role: 'status' },
              h('span', { className: 'ao_spinner' }),
              h('span', null, tr('loading')),
            )
          : h(SetupScreen, {
              setupOrg,
              workspace,
              sessionId,
              workspaceId: state?.workspace?.id,
              onChange: (next) => {
                setSetupOrg(next);
                setSetupDirty(true);
                setSetupError(null);
              },
              onSave: saveSetup,
              saving: setupSaving,
              error: setupError,
              t: tr,
            });
      } else if (state !== null) {
        const org = state.org;
        const editorOpen = roleDialogOpen || edgeDraft !== null || conflict !== null;
        const orgPanel = h(
          'div',
          { className: cx('ao_body', editorOpen && 'ao_bodyEditor'), id: 'ao-panel-org', role: 'tabpanel', 'aria-labelledby': 'ao-tab-org', hidden: tab !== 'org' },
          editorOpen ? h('div', { className: 'ao_editorBackdrop', onClick: closeEditor, 'aria-hidden': 'true' }) : null,
          h(
            'section',
            { className: 'ao_main', 'aria-label': tr('tabOrg') },
            warning ? h(
              'div',
              { className: 'ao_banner ao_bannerWarn', role: 'status' },
              h(Icon, { name: 'warning', size: 15, className: 'ao_bannerIcon' }),
              h('span', null, warning),
            ) : null,
            loadError ? h(
              'div',
              { className: 'ao_banner ao_bannerError', role: 'alert' },
              h(Icon, { name: 'warning', size: 15, className: 'ao_bannerIcon' }),
              h('span', null, loadError),
            ) : null,
            legacyHost ? h(
              'div',
              { className: 'ao_banner ao_bannerWarn', role: 'status' },
              h(Icon, { name: 'warning', size: 15, className: 'ao_bannerIcon' }),
              h('span', null, tr('hostRestartRequired')),
            ) : null,
            state.enabled === false ? h(
              'div',
              { className: 'ao_banner ao_bannerWarn', role: 'alert' },
              h(Icon, { name: 'warning', size: 15, className: 'ao_bannerIcon' }),
              h('span', null, tr('workspaceDisabled')),
            ) : null,
            h(
              'div',
              { className: 'ao_sectionHead' },
              h(
                'div',
                null,
                h('h3', { className: 'ao_sectionTitle' }, org.teamName),
                h('p', { className: 'ao_sectionHint' }, tr('topologyHint')),
              ),
            ),
            state.org.activeTask ? h(TaskTimerBadge, { task: state.org.activeTask, t: tr }) : null,
            activeRunList.length > 0 ? h(
              'div',
              { className: 'ao_activeStrip', role: 'status' },
              h('span', { className: 'ao_liveDot', 'aria-hidden': 'true' }),
              h(
                'span',
                null,
                h('strong', null, `${tr('activeCollaboration')} · `),
                tr('activeCollaborationHint', { name: activeRunList[0].roleName }),
                activeRunList.length > 1 ? ` (+${activeRunList.length - 1})` : '',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ao_sessionButton',
                  onClick: () => openRunSession(activeRunList[0]),
                },
                tr('openSession'),
              ),
            ) : null,
            h(Topology, {
              org,
              runs: state.runs,
              selectedId,
              selectedEdgeId: edgeDraft?.id ?? null,
              onSelect: selectMember,
              onEdgeSelect: selectEdge,
              onNodeMove: legacyHost ? undefined : moveNode,
              onInteractionChange: (active) => { interactionRef.current = active; },
              onConnect: beginRelation,
              onNodeMenu: openNodeMenu,
              onAddMember: openTemplatePicker,
              canAddMember: org.roles.length < 80,
              onAutoLayout: resetLayout,
              autoLayoutAvailable: true,
              interactive: true,
              t: tr,
            }),
            org.roles.length === 0 ? h(
              'div',
              { className: 'ao_empty', style: { marginLeft: 0 } },
              h(Icon, { name: 'user', size: 20, className: 'ao_emptyIcon' }),
              h('div', { className: 'ao_emptyTitle' }, tr('noRoles')),
              h('p', { className: 'ao_emptyText' }, tr('noRolesHint')),
            ) : null,
          ),
          h(
            'aside',
            {
              className: cx('ao_side', roleDialogOpen && (selectedRole !== null || selectedId === 'lead') && 'ao_sideAnchored'),
              'aria-label': tr('teamSettings'),
              style: editorAnchor === null ? undefined : {
                '--ao-editor-left': `${editorAnchor.left}px`,
                '--ao-editor-top': `${editorAnchor.top}px`,
                '--ao-editor-width': `${editorAnchor.width}px`,
              },
            },
            edgeDraft !== null ? h(EdgeEditor, {
              key: edgeDraft.id,
              org,
              draft: edgeDraft,
              onChange: updateEdge,
              onSave: saveEdge,
              onDelete: deleteEdge,
              onCancel: cancelEdge,
              saving: edgeSaving,
              error: edgeError,
              t: tr,
            }) : null,
            edgeDraft === null && conflict !== null ? h(
              'div',
              { className: 'ao_conflict', role: 'alert' },
              h('span', { className: 'ao_conflictTitle' }, tr('conflictTitle')),
              h('p', { className: 'ao_conflictText' }, tr('conflictText')),
              h(
                'div',
                { className: 'ao_conflictActions' },
                h('button', { type: 'button', className: 'ao_button', onClick: loadLatestAfterConflict }, tr('reloadLatest')),
                h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: () => setConflict(null) }, tr('keepMine')),
              ),
            ) : null,
            edgeDraft === null && currentDraft === null ? h(
              'div',
              { className: 'ao_empty', style: { marginLeft: 0 } },
              h('div', { className: 'ao_emptyTitle' }, tr('selectRole')),
              h('p', { className: 'ao_emptyText' }, tr('selectRoleHint')),
            ) : edgeDraft === null && currentDraft.kind === 'lead' ? h(
              'div',
              null,
              h(
                'div',
                { className: 'ao_sideHead' },
                h(
                  'div',
                  null,
                  h('h3', { className: 'ao_sideTitle' }, tr('teamSettings')),
                  h('p', { className: 'ao_sideSub' }, tr('leadHint')),
                ),
              ),
              h(
                'form',
                { className: 'ao_form', onSubmit: save },
                h(
                  Field,
                  { label: tr('teamName'), htmlFor: 'ao-team-name' },
                  h('input', {
                    id: 'ao-team-name',
                    className: 'ao_input',
                    value: currentDraft.teamName,
                    maxLength: 60,
                    required: true,
                    onChange: (event) => updateLead({ teamName: readText(event) }),
                  }),
                ),
                h(
                  Field,
                  { label: tr('leadLabel'), htmlFor: 'ao-lead-label' },
                  h('input', {
                    id: 'ao-lead-label',
                    className: 'ao_input',
                    value: currentDraft.label,
                    maxLength: 20,
                    required: true,
                    onChange: (event) => updateLead({ label: readText(event) }),
                  }),
                ),
                h(
                  Field,
                  { label: tr('leadDesc'), hint: tr('settingsHint'), htmlFor: 'ao-lead-desc' },
                  h('textarea', {
                    id: 'ao-lead-desc',
                    className: 'ao_textarea',
                    rows: 4,
                    maxLength: 280,
                    value: currentDraft.description,
                    onChange: (event) => updateLead({ description: readText(event) }),
                  }),
                ),
                h(LeadModelPanel, {
                  t: tr,
                  idPrefix: 'lead',
                  modelCatalog,
                  modelLoading,
                  modelError,
                  modelSaving,
                  modelPolicySaving,
                  modelChoice,
                  modelPolicy,
                  onModelChange: saveLeadModel,
                  setModelPolicy,
                  onSavePolicy: saveModelPolicy,
                }),
                h(
                  'div',
                  { className: 'ao_formActions' },
                  h('button', { type: 'submit', className: 'ao_button ao_buttonPrimary', disabled: !dirty || saveStatus === 'saving' }, saveStatus === 'saving' ? tr('saving') : tr('save')),
                  h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: cancelEdits, disabled: !dirty }, tr('cancel')),
                  h('span', { className: cx('ao_saveStatus', saveStatus === 'saved' && 'ao_saveStatusOk'), role: 'status' }, saveStatus === 'saved' ? tr('saved') : null),
                ),
                saveError ? h('p', { className: 'ao_errorText', role: 'alert' }, saveError) : null,
              ),
            ) : edgeDraft === null ? h(
              'div',
              null,
              h(
                'div',
                { className: 'ao_sideHead' },
                h(
                  'div',
                  null,
                  h('h3', { className: 'ao_sideTitle' }, currentDraft.isNew ? tr('newMember') : selectedRole.name || tr('newMember')),
                  h(
                    'p',
                    { className: 'ao_sideSub' },
                    currentDraft.isNew ? tr('newRole') : `${currentDraft.role.title} · ${currentDraft.role.level === 'captain' ? tr('levelCaptain') : tr('levelMember')} · ${roleManager(org, currentDraft.role)}`,
                  ),
                ),
                !currentDraft.isNew ? h(Avatar, { name: currentDraft.role.name, color: currentDraft.role.accent, size: 34 }) : null,
              ),
              latestRoleRun !== null ? h(
                'div',
                { className: 'ao_banner', style: { marginBottom: '12px' } },
                h('span', null, `${tr('processSession')}: ${latestRoleRun.childSessionId || tr('sessionUnavailable')}`),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ao_sessionButton',
                    disabled: !latestRoleRun.childSessionId,
                    onClick: () => openRunSession(latestRoleRun),
                  },
                  tr('openSession'),
                ),
              ) : null,
              h(
                'form',
                { className: 'ao_form', onSubmit: save },
                h(
                  'div',
                  { className: 'ao_row2' },
                  h(
                    Field,
                    { label: tr('name'), htmlFor: 'ao-role-name' },
                    h('input', {
                      id: 'ao-role-name',
                      className: 'ao_input',
                      value: currentDraft.role.name,
                      maxLength: 24,
                      required: true,
                      autoFocus: currentDraft.isNew,
                      onChange: (event) => {
                        updateRole({ name: readText(event) });
                        setDraft((previous) => (previous === null ? previous : { ...previous, autoName: false }));
                      },
                    }),
                  ),
                  h(
                    Field,
                    { label: tr('roleTitle'), htmlFor: 'ao-role-title' },
                    h('input', {
                      id: 'ao-role-title',
                      className: 'ao_input',
                      value: currentDraft.role.title,
                      maxLength: 24,
                      required: true,
                      onChange: (event) => {
                        const title = readText(event);
                        if (currentDraft.autoName) {
                          updateRole({ title, name: defaultEmployeeName(org, title, currentDraft.role.id) });
                        } else {
                          updateRole({ title });
                        }
                      },
                    }),
                  ),
                ),
                h(
                  Field,
                  { label: tr('thinkingEffort'), htmlFor: 'ao-role-effort' },
                  h(
                    'select',
                    {
                      id: 'ao-role-effort',
                      className: 'ao_select',
                      value: typeof currentDraft.role.effort === 'string' && currentDraft.role.effort !== '' ? currentDraft.role.effort : 'low',
                      onChange: (event) => updateRole({ effort: readText(event) }),
                    },
                    ...['minimal', 'off', 'low', 'medium', 'high', 'xhigh', 'max'].map((effort) => h('option', { key: effort, value: effort }, effort)),
                    typeof currentDraft.role.effort === 'string' && currentDraft.role.effort !== '' && !['minimal', 'off', 'low', 'medium', 'high', 'xhigh', 'max'].includes(currentDraft.role.effort)
                      ? h('option', { value: currentDraft.role.effort }, currentDraft.role.effort)
                      : null,
                  ),
                ),
                h(
                  Field,
                  { label: tr('roleLevel'), htmlFor: 'ao-role-level' },
                  h(
                    'select',
                    {
                      id: 'ao-role-level',
                      className: 'ao_select',
                      value: currentDraft.role.level === 'captain' ? 'captain' : 'member',
                      onChange: (event) => updateRole({ level: readText(event) }),
                    },
                    h('option', { value: 'member' }, tr('levelMember')),
                    h('option', { value: 'captain' }, tr('levelCaptain')),
                  ),
                ),
                h(
                  Field,
                  { label: tr('reportsTo'), hint: tr('managerHint'), htmlFor: 'ao-role-manager' },
                  h(
                    'select',
                    {
                      id: 'ao-role-manager',
                      className: 'ao_select',
                      value: currentDraft.role.reportsTo,
                      onChange: (event) => updateRole({ reportsTo: readText(event) }),
                    },
                    managerOptions(org, currentDraft.role.id).map((option) =>
                      h('option', { value: option.id, key: option.id }, option.title ? `${option.name} · ${option.title}` : option.name),
                    ),
                  ),
                ),
                !legacyHost ? h(
                  Field,
                  { label: tr('relationAdditional'), hint: tr('relationGraphHint') },
                  h(
                    'div',
                    { className: 'ao_relationList' },
                    relatedRelations.length === 0
                      ? h('span', { className: 'ao_hint' }, tr('relationNone'))
                      : relatedRelations.map((relation) => {
                          const expired = relationExpired(relation);
                          const otherId = relation.from === currentDraft.role.id ? relation.to : relation.from;
                          return h(
                            'button',
                            {
                              type: 'button',
                              key: relation.id,
                              className: 'ao_relationChip',
                              onClick: () => selectEdge({ kind: 'extra', relation }),
                            },
                            h('span', { className: `ao_relationType ${relation.type === 'temporary' ? 'ao_relationTypeTemp' : 'ao_relationTypeReports'}` }, relationTypeLabel(tr, relation.type)),
                            h('span', { className: 'ao_relationTo' }, `${relationNodeName(org, otherId)}${relation.label ? ` · ${relation.label}` : ''}${expired ? ` · ${tr('relationExpired')}` : ''}`),
                          );
                        }),
                  ),
                ) : null,
                h(
                  'div',
                  { className: 'ao_switchRow' },
                  h(
                    'span',
                    { className: 'ao_switchText' },
                    h('span', { className: 'ao_switchLabel' }, tr('status')),
                    h('span', { className: 'ao_switchHint' }, currentDraft.role.enabled ? tr('enabled') : tr('disabled')),
                  ),
                  h(Switch, {
                    checked: currentDraft.role.enabled,
                    onChange: (value) => updateRole({ enabled: value }),
                    label: tr('status'),
                  }),
                ),
                h(
                  Field,
                  { label: tr('accent') },
                  h(
                    'div',
                    { className: 'ao_swatches', role: 'group', 'aria-label': tr('accent') },
                    ['#7C6CFF', '#2E9E7B', '#D9822B', '#3B82F6', '#D9578A', '#8A6A4B'].map((color) =>
                      h('button', {
                        type: 'button',
                        key: color,
                        className: cx('ao_swatch', currentDraft.role.accent === color && 'ao_swatchActive'),
                        style: { backgroundColor: color, color },
                        'aria-label': color,
                        'aria-pressed': currentDraft.role.accent === color,
                        onClick: () => updateRole({ accent: color }),
                      }),
                    ),
                  ),
                ),
                h(
                  Field,
                  { label: tr('responsibilities'), hint: tr('responsibilitiesHint'), htmlFor: 'ao-role-resp' },
                  h('textarea', {
                    id: 'ao-role-resp',
                    className: 'ao_textarea',
                    rows: 3,
                    maxLength: 400,
                    value: currentDraft.role.responsibilities,
                    onChange: (event) => updateRole({ responsibilities: readText(event) }),
                  }),
                ),
                h(
                  Field,
                  { label: tr('roleAuthority'), hint: tr('authorityHint'), htmlFor: 'ao-role-authority' },
                  h('textarea', {
                    id: 'ao-role-authority',
                    className: 'ao_textarea',
                    rows: 3,
                    maxLength: 300,
                    value: currentDraft.role.authority ?? '',
                    onChange: (event) => updateRole({ authority: readText(event) }),
                  }),
                ),
                h(
                  Field,
                  { label: tr('roleBoundaries'), hint: tr('boundariesHint'), htmlFor: 'ao-role-boundaries' },
                  h('textarea', {
                    id: 'ao-role-boundaries',
                    className: 'ao_textarea',
                    rows: 3,
                    maxLength: 300,
                    value: currentDraft.role.boundaries ?? '',
                    onChange: (event) => updateRole({ boundaries: readText(event) }),
                  }),
                ),
                h(
                  Field,
                  { label: tr('instructions'), hint: tr('instructionsHint'), htmlFor: 'ao-role-instructions' },
                  h('textarea', {
                    id: 'ao-role-instructions',
                    className: 'ao_textarea',
                    rows: 9,
                    maxLength: 4000,
                    value: currentDraft.role.instructions,
                    onChange: (event) => updateRole({ instructions: readText(event) }),
                  }),
                ),
                !currentDraft.isNew ? h(SkillInjector, {
                  role: currentDraft.role,
                  t: tr,
                  onSearch: searchRoleSkills,
                  onInject: injectRoleSkill,
                  onInjected: handleSkillInjected,
                }) : null,
                !currentDraft.isNew ? h(
                  Field,
                  { label: tr('roleId'), hint: tr('idHint') },
                  h(
                    'span',
                    { className: 'ao_idRow' },
                    h('code', { className: 'ao_idBadge' }, currentDraft.role.id),
                    typeof navigator !== 'undefined' && navigator.clipboard ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'ao_button ao_buttonGhost',
                        onClick: () => {
                          navigator.clipboard.writeText(currentDraft.role.id).then(() => showNotice(tr('idCopied'))).catch(() => {});
                        },
                        title: tr('copyId'),
                      },
                      tr('copyId'),
                    ) : null,
                  ),
                ) : null,
                h(
                  'div',
                  { className: 'ao_formActions' },
                  h('button', { type: 'submit', className: 'ao_button ao_buttonPrimary', disabled: !dirty || saveStatus === 'saving' }, saveStatus === 'saving' ? tr('saving') : tr('save')),
                  h('button', { type: 'button', className: 'ao_button ao_buttonGhost', onClick: cancelEdits, disabled: !dirty }, tr('cancel')),
                  h('span', { className: cx('ao_saveStatus', saveStatus === 'saved' && 'ao_saveStatusOk'), role: 'status' }, saveStatus === 'saved' ? tr('saved') : null),
                ),
                saveError ? h('p', { className: 'ao_errorText', role: 'alert' }, saveError) : null,
                !currentDraft.isNew && confirmDelete ? h(
                  'div',
                  { className: 'ao_deleteBox', role: 'alertdialog', 'aria-describedby': 'ao-delete-desc', 'aria-label': tr('confirmDeleteTitle', { name: currentDraft.role.name }) },
                  h('span', { className: 'ao_deleteTitle' }, tr('confirmDeleteTitle', { name: currentDraft.role.name })),
                  h('p', { className: 'ao_deleteDesc', id: 'ao-delete-desc' }, tr('confirmDeleteDesc')),
                  descendantIds(org, currentDraft.role.id).size > 0
                    ? h('p', { className: 'ao_deleteDesc' }, tr('confirmDeleteMove', { manager: managerAfterDelete }))
                    : null,
                  h(
                    'div',
                    { className: 'ao_deleteActions' },
                    h('button', {
                      type: 'button',
                      ref: deleteKeepRef,
                      className: 'ao_button ao_buttonGhost',
                      onClick: () => {
                        setConfirmDelete(false);
                        requestAnimationFrame(() => deleteButtonRef.current?.focus());
                      },
                    }, tr('confirmDeleteKeep')),
                    h('button', { type: 'button', className: 'ao_button ao_buttonDangerSolid', onClick: () => void deleteRole() }, tr('confirmDeleteYes')),
                  ),
                ) : !currentDraft.isNew ? h(
                  'button',
                  {
                    type: 'button',
                    ref: deleteButtonRef,
                    className: 'ao_button ao_buttonDanger',
                    onClick: () => setConfirmDelete(true),
                  },
                  h(Icon, { name: 'trash', size: 14 }),
                  h('span', null, tr('deleteRole')),
                ) : null,
              ),
            ) : null,
          ),
        );

        const activityPanel = h(
          'section',
          {
            className: 'ao_main',
            id: 'ao-panel-activity',
            role: 'tabpanel',
            'aria-labelledby': 'ao-tab-activity',
            hidden: tab !== 'activity',
            style: { gridColumn: '1 / -1', flex: 1, minHeight: 0 },
            'aria-label': tr('tabActivity'),
          },
          h(
            'div',
            { className: 'ao_sectionHead' },
            h(
              'div',
              null,
              h('h3', { className: 'ao_sectionTitle' }, tr('collaborationProcess')),
              h('p', { className: 'ao_sectionHint' }, tr('collaborationHint')),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ao_button',
                onClick: () => {
                  apiGet(sessionId)
                    .then((data) => applyIncoming(data))
                    .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));
                },
              },
              h(Icon, { name: 'refresh', size: 14 }),
              h('span', null, tr('refresh')),
            ),
          ),
          state.runs.length === 0
            ? h(
                'div',
                { className: 'ao_empty', style: { marginLeft: 0 } },
                h(Icon, { name: 'spark', size: 22, className: 'ao_emptyIcon' }),
                h('div', { className: 'ao_emptyTitle' }, tr('noActivity')),
                h('p', { className: 'ao_emptyText' }, tr('noActivityHint')),
              )
            : h(
                'div',
                { className: 'ao_activityList' },
                state.runs.map((run) => h(RunCard, { key: run.id, run, t: tr, onOpenSession: openRunSession })),
              ),
        );

        const auditEntries = Array.isArray(state?.org?.audit) ? state.org.audit : [];
        const auditActionLabel = (action) => ({
          assign: tr('auditAssign'),
          create_member: tr('auditCreateMember'),
          create_module_group: tr('auditCreateGroup'),
          fire_member: tr('auditFire'),
          park_member: tr('auditPark'),
          restore_member: tr('auditRestore'),
          set_effort: tr('auditEffort'),
          inject_skill: tr('auditSkill'),
          summarize_project: tr('auditProjectSummary'),
          summarize_stage: tr('auditStageSummary'),
          select_model: tr('auditSelectModel'),
          remove_temporary: tr('auditRemoveTemporary'),
          set_manager: tr('auditSetManager'),
          add_handoff: tr('auditAddHandoff'),
          remove_handoff: tr('auditRemoveHandoff'),
          create_temporary: tr('auditTempRelation'),
        }[action] ?? action);
        const auditKindLabel = (kind) => kind === 'work'
          ? tr('auditWork')
          : kind === 'relation'
            ? tr('auditRelation')
            : kind === 'project'
              ? tr('auditProject')
              : tr('auditPersonnel');
        const formatTokens = (value) => Number(value || 0).toLocaleString();
        const usageCurrency = usageData?.pricing?.currency || 'USD';
        const currencySymbol = usageCurrency === 'CNY' ? '¥' : usageCurrency === 'USD' ? '$' : `${usageCurrency} `;
        const formatCost = (value) => `${currencySymbol}${Number(value || 0).toFixed(4)}`;
        const usageEntries = Array.isArray(usageData?.entries) ? usageData.entries : [];
        const usageModels = Array.isArray(usageData?.models) ? usageData.models : [];
        const usageTotal = usageData?.total ?? { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
        const usagePanel = h(
          'section',
          {
            className: 'ao_main ao_usagePage',
            id: 'ao-panel-usage',
            role: 'tabpanel',
            'aria-labelledby': 'ao-tab-usage',
            hidden: tab !== 'usage',
            style: { gridColumn: '1 / -1', flex: 1, minHeight: 0 },
            'aria-label': tr('tabUsage'),
          },
          h(
            'div',
            { className: 'ao_usageRules' },
            h('div', { className: 'ao_usageRulesTitle' }, tr('usageRulesTitle')),
            h('p', null, tr('usageRulesModel', {
              rate: (usageData?.pricing?.usdToCny ?? 7.2).toFixed(4),
              source: usageData?.pricing?.exchangeSource ?? 'exchangerate-api',
            })),
            h('p', null, tr('usageRulesFormula')),
            h('p', null, tr('usageRulesPeak')),
            h('p', { className: 'ao_hint' }, tr('usageRulesNote')),
          ),
          h(
            'div',
            { className: 'ao_sectionHead' },
            h('div', null,
              h('h3', { className: 'ao_sectionTitle' }, tr('usageTitle')),
              h('p', { className: 'ao_sectionHint' }, tr('usageHint')),
            ),
            h(
              'button',
              { type: 'button', className: 'ao_button ao_buttonGhost', onClick: loadUsage, disabled: usageLoading },
              h(Icon, { name: 'refresh', size: 14 }),
              h('span', null, usageLoading ? tr('usageLoading') : tr('refresh')),
            ),
          ),
          usageError !== null ? h('div', { className: 'ao_banner ao_bannerError', role: 'alert' }, usageError) : null,
          h(
            'div',
            { className: 'ao_usageTotalGrid' },
            h('div', { className: 'ao_usageMetric' }, h('span', null, tr('usageInput')), h('strong', null, formatTokens(usageTotal.input))),
            h('div', { className: 'ao_usageMetric' }, h('span', null, tr('usageOutput')), h('strong', null, formatTokens(usageTotal.output))),
            h('div', { className: 'ao_usageMetric' }, h('span', null, tr('usageTotalTokens')), h('strong', null, formatTokens(usageTotal.total))),
            h('div', { className: 'ao_usageMetric ao_usageMetricCost' }, h('span', null, tr('usageCost')), h('strong', null, formatCost(usageTotal.cost))),
          ),
          h('p', { className: 'ao_hint ao_usagePricingHint' },
            `${tr('usageAutoPricing')} · ${usageData?.pricing?.source ?? 'models.dev'} · ${usageCurrency}`,
          ),
          h('p', { className: 'ao_hint' }, tr('usageAutoPricingHint')),
          usageEntries.length === 0 ? h(
            'div',
            { className: 'ao_empty', style: { marginLeft: 0 } },
            h(Icon, { name: 'info', size: 20, className: 'ao_emptyIcon' }),
            h('div', { className: 'ao_emptyTitle' }, usageLoading ? tr('usageLoading') : tr('usageEmpty')),
          ) : h(
            'div',
            { className: 'ao_usageTableWrap' },
            h('table', { className: 'ao_usageTable' },
              h('thead', null, h('tr', null,
                h('th', null, tr('usageMember')),
                h('th', null, tr('usageInput')),
                h('th', null, tr('usageOutput')),
                h('th', null, tr('usageCacheRead')),
                h('th', null, tr('usageCacheWrite')),
                h('th', null, tr('usageTotalTokens')),
                h('th', null, tr('usageTurns')),
                h('th', null, tr('usageCost')),
              )),
              h('tbody', null, usageEntries.map((entry) => h('tr', { key: `${entry.roleId}-${entry.sessionId}` },
                h('td', null, h('span', { className: 'ao_usageName' }, entry.id === 'lead' ? tr('usageLead') : entry.name), h('small', null, entry.title), entry.models?.length ? h('small', null, entry.models.map((item) => `${item.provider}/${item.model}${item.period === 'peak' ? ' · 峰' : item.period === 'off-peak' ? ' · 谷' : ''}`).join(', ')) : null),
                h('td', null, formatTokens(entry.input)),
                h('td', null, formatTokens(entry.output)),
                h('td', null, formatTokens(entry.cacheRead)),
                h('td', null, formatTokens(entry.cacheWrite)),
                h('td', null, h('strong', null, formatTokens(entry.total))),
                h('td', null, formatTokens(entry.turns)),
                h('td', null, formatCost(entry.cost)),
              ))),
            ),
            h('div', { className: 'ao_sectionHead', style: { marginTop: '16px' } },
              h('div', null,
                h('h4', { className: 'ao_sectionTitle' }, tr('usageByModel')),
              ),
            ),
            usageModels.length === 0 ? h('p', { className: 'ao_hint' }, tr('usageModelEmpty')) : h(
              'div',
              { className: 'ao_usageTableWrap' },
              h('table', { className: 'ao_usageTable' },
                h('thead', null, h('tr', null,
                  h('th', null, tr('usageModel')),
                  h('th', null, tr('usageModelInput')),
                  h('th', null, tr('usageModelOutput')),
                  h('th', null, tr('usageModelCache')),
                  h('th', null, tr('usageModelTotal')),
                  h('th', null, tr('usageCost')),
                )),
                h('tbody', null, usageModels.map((model) => h('tr', { key: `${model.provider}/${model.model}` },
                  h('td', null, h('span', { className: 'ao_usageName' }, `${model.provider}/${model.model}`)),
                  h('td', null, formatTokens(model.input)),
                  h('td', null, formatTokens(model.output)),
                  h('td', null, formatTokens(model.cacheRead + model.cacheWrite)),
                  h('td', null, h('strong', null, formatTokens(model.total))),
                  h('td', null, formatCost(model.cost)),
                ))),
              ),
            ),
          ),
        );

        const auditPanel = h(
          'section',
          {
            className: 'ao_main ao_auditPage',
            id: 'ao-panel-audit',
            role: 'tabpanel',
            'aria-labelledby': 'ao-tab-audit',
            hidden: tab !== 'audit',
            style: { gridColumn: '1 / -1', flex: 1, minHeight: 0 },
            'aria-label': tr('tabAudit'),
          },
          h(
            'div',
            { className: 'ao_sectionHead' },
            h('div', null,
              h('h3', { className: 'ao_sectionTitle' }, tr('auditTitle')),
              h('p', { className: 'ao_sectionHint' }, tr('auditHint')),
            ),
          ),
          auditEntries.length === 0 ? h(
            'div',
            { className: 'ao_empty', style: { marginLeft: 0 } },
            h(Icon, { name: 'info', size: 20, className: 'ao_emptyIcon' }),
            h('div', { className: 'ao_emptyTitle' }, tr('auditEmpty')),
          ) : h(
            'div',
            { className: 'ao_auditList' },
            auditEntries.map((entry) => h(
              'article',
              { key: entry.id, className: 'ao_auditItem' },
              h(
                'div',
                { className: 'ao_auditHead' },
                h('span', { className: cx('ao_auditKind', `ao_auditKind${entry.kind[0].toUpperCase()}${entry.kind.slice(1)}`) }, auditKindLabel(entry.kind)),
                h('strong', null, auditActionLabel(entry.action)),
                entry.roleName ? h('span', { className: 'ao_auditRole' }, entry.roleName) : null,
                h('time', null, formatTime(entry.at)),
              ),
              h('div', { className: 'ao_auditActor' }, entry.actor || '—'),
              h('p', { className: 'ao_auditReason' }, h('span', null, `${tr('auditReason')}: `), entry.reason),
              entry.summary ? h('p', { className: 'ao_auditSummary' }, entry.summary) : null,
            )),
          ),
        );

        const settingsPanel = currentDraft?.kind === 'lead' ? h(
          'div',
          { className: 'ao_body ao_bodySettings', id: 'ao-panel-settings', role: 'tabpanel', 'aria-labelledby': 'ao-tab-settings', hidden: tab !== 'settings' },
          h(
            'section',
            { className: 'ao_main', 'aria-label': tr('teamSettings') },
            h(
              'div',
              { className: 'ao_settingsPage' },
              h(
                'div',
                { className: 'ao_settingsHead' },
                h('h3', { className: 'ao_settingsTitle' }, tr('teamSettings')),
                h('p', { className: 'ao_settingsHint' }, tr('leadHint')),
              ),
              h(
                'form',
                { className: 'ao_form ao_settingsForm', onSubmit: save },
                h(
                  Field,
                  { label: tr('teamName'), htmlFor: 'ao-settings-team-name' },
                  h('input', {
                    id: 'ao-settings-team-name',
                    className: 'ao_input',
                    value: currentDraft.teamName,
                    maxLength: 60,
                    required: true,
                    onChange: (event) => updateLead({ teamName: readText(event) }),
                  }),
                ),
                h(
                  Field,
                  { label: tr('leadLabel'), htmlFor: 'ao-settings-lead-label' },
                  h('input', {
                    id: 'ao-settings-lead-label',
                    className: 'ao_input',
                    value: currentDraft.label,
                    maxLength: 20,
                    required: true,
                    onChange: (event) => updateLead({ label: readText(event) }),
                  }),
                ),
                h(
                  Field,
                  { label: tr('leadDesc'), hint: tr('settingsHint'), htmlFor: 'ao-settings-lead-desc' },
                  h('textarea', {
                    id: 'ao-settings-lead-desc',
                    className: 'ao_textarea',
                    rows: 5,
                    maxLength: 280,
                    value: currentDraft.description,
                    onChange: (event) => updateLead({ description: readText(event) }),
                  }),
                ),
                h(LeadModelPanel, {
                  t: tr,
                  idPrefix: 'lead-settings',
                  modelCatalog,
                  modelLoading,
                  modelError,
                  modelSaving,
                  modelPolicySaving,
                  modelChoice,
                  modelPolicy,
                  onModelChange: saveLeadModel,
                  setModelPolicy,
                  onSavePolicy: saveModelPolicy,
                }),
                h(
                  'div',
                  { className: 'ao_formActions' },
                  h('button', { type: 'submit', className: 'ao_button ao_buttonPrimary', disabled: !dirty || saveStatus === 'saving' }, saveStatus === 'saving' ? tr('saving') : tr('save')),
                  
                  h('span', { className: cx('ao_saveStatus', saveStatus === 'saved' && 'ao_saveStatusOk'), role: 'status' }, saveStatus === 'saved' ? tr('saved') : null),
                ),
                saveError ? h('p', { className: 'ao_errorText', role: 'alert' }, saveError) : null,
              ),
            ),
          ),
        ) : null;

        content = h(
          React.Fragment,
          null,
          orgPanel,
          activityPanel,
          auditPanel,
          usagePanel,
          settingsPanel,
        );
      }

      return h(
        React.Fragment,
        null,
        trigger,
        teamChatNode,
        ReactDOM.createPortal(
          h(
            'div',
            {
              className: 'ao_overlay',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget) requestClose();
              },
            },
            h(
              'div',
              {
                className: 'ao_panel',
                'data-agent-org-panel': '',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'ao-dialog-title',
                tabIndex: -1,
                ref: panelRef,
                style: { position: 'relative' },
              },
              h(
                'div',
                { className: 'ao_header' },
                h(
                  'div',
                  { className: 'ao_heading' },
                  h(
                    'div',
                    { className: 'ao_titleRow' },
                    h(Icon, { name: 'org', size: 19, className: 'ao_titleIcon' }),
                    h('h2', { className: 'ao_title', id: 'ao-dialog-title' }, tr('title')),
                    state !== null && state.configured !== false ? h('span', { className: 'ao_countPill' }, tr('memberCount', { count: roleCount })) : null,
                    state !== null && state.configured === false ? h('span', { className: 'ao_countPill' }, tr('setupRequiredShort')) : null,
                    workspace !== null ? h(
                      'span',
                      { className: 'ao_workspacePill', title: workspace.path },
                      `${tr('workspaceLabel')}: ${workspace.title}`,
                    ) : null,
                  ),
                  h('p', { className: 'ao_subtitle' }, isSetup ? tr('setupIntro') : tr('subtitle')),
                ),
                h(
                  'div',
                  { className: 'ao_headerActions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ao_iconButton',
                      onClick: () => {
                        apiGet(sessionId)
                          .then((data) => applyIncoming(data))
                          .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));
                      },
                      title: tr('refresh'),
                      'aria-label': tr('refresh'),
                    },
                    h(Icon, { name: 'refresh', size: 16 }),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ao_iconButton',
                      onClick: requestClose,
                      title: tr('close'),
                      'aria-label': tr('close'),
                    },
                    h(Icon, { name: 'close', size: 17 }),
                  ),
                ),
              ),
              !isSetup ? h(
                'div',
                { className: 'ao_toolbar' },
                tabs,
                h(
                  'div',
                  { className: 'ao_toolbarActions' },
                  state?.configured === true && state?.enabled === true ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'ao_button',
                      onClick: designTeamRelations,
                      disabled: designingTeam,
                      title: tr('designTeam'),
                    },
                    h(Icon, { name: 'org', size: 14 }),
                    h('span', null, designingTeam ? tr('designingTeam') : tr('designTeam')),
                  ) : null,
                  state?.configured === true && state?.enabled === true ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'ao_button',
                      onClick: requestMidprojectReport,
                      disabled: reportingMidproject,
                      title: tr('midprojectReport'),
                    },
                    h(Icon, { name: 'spark', size: 14 }),
                    h('span', null, reportingMidproject ? tr('midprojectReporting') : tr('midprojectReport')),
                  ) : null,
                  state?.configured === true && state?.enabled === true ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'ao_button',
                      onClick: repairMemberSessions,
                      disabled: repairing,
                      title: tr('repairSessions'),
                    },
                    h(Icon, { name: 'refresh', size: 14 }),
                    h('span', null, repairing ? tr('repairingSessions') : tr('repairSessions')),
                  ) : null,
                ),
              ) : h(
                'div',
                { className: 'ao_toolbar' },
                h('span', { className: 'ao_workspacePill' }, tr('workspaceScoped')),
              ),
              discardOpen ? h(
                'div',
                { className: 'ao_discardBar', role: 'alert' },
                h('span', null, `${tr('discardTitle')} ${tr('discardText')}`),
                h(
                  'span',
                  { className: 'ao_discardActions' },
                  h('button', { type: 'button', className: 'ao_button', onClick: () => setDiscardOpen(false) }, tr('keepEditing')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ao_button ao_buttonDanger',
                      onClick: () => {
                        setDiscardOpen(false);
                        setDirty(false);
                        setSetupDirty(false);
                        setSetupOrg(null);
                        setEdgeDraft(null);
                        setEdgeDirty(false);
                        setTemplateOpen(false);
                        setOpen(false);
                      },
                    },
                    tr('discardClose'),
                  ),
                ),
              ) : null,
              content,
              notice !== null ? h(
                'div',
                { className: 'ao_notice', role: 'status', 'aria-live': 'polite' },
                h(Icon, { name: 'check', size: 14 }),
                h('span', null, notice),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ao_noticeClose',
                    onClick: () => setNotice(null),
                    'aria-label': tr('closeNotice'),
                  },
                  h(Icon, { name: 'close', size: 12 }),
                ),
              ) : null,
            ),
          ),
          document.body,
        ),
        templateOpen && state?.org ? ReactDOM.createPortal(
          h(TemplateDialog, {
            org: state.org,
            saving: templateSaving,
            error: templateError,
            onPick: addMemberFromTemplate,
            onBlank: addMember,
            onCreate: createTemplate,
            onClose: () => setTemplateOpen(false),
            t: tr,
          }),
          document.body,
        ) : null,
        nodeMenu !== null && menuRole !== null ? ReactDOM.createPortal(
          h(
            'div',
            {
              className: 'ao_nodeMenu',
              'data-agent-org-node-menu': '',
              role: 'menu',
              style: { left: `${nodeMenu.x}px`, top: `${nodeMenu.y}px` },
              onContextMenu: (event) => event.preventDefault(),
            },
            h('div', { className: 'ao_nodeMenuTitle' }, menuRole.name),
            h(
              'button',
              {
                type: 'button',
                className: 'ao_nodeMenuItem',
                role: 'menuitem',
                onClick: () => {
                  const target = nodeMenu.nodeId;
                  setNodeMenu(null);
                  selectMember(target);
                },
              },
              tr('editRole'),
            ),
            !menuRole.isLead && !legacyHost ? h(
              'button',
              {
                type: 'button',
                className: 'ao_nodeMenuItem',
                role: 'menuitem',
                onClick: () => copyMember(menuRole),
              },
              tr('copyMember'),
            ) : null,
          ),
          document.body,
        ) : null,
      );
    }

    function WorkspaceOnboarding({ t, openLeadSession }) {
      const [request, setRequest] = React.useState(null);
      const [data, setData] = React.useState(null);
      const [setupOrg, setSetupOrg] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const [saving, setSaving] = React.useState(false);
      const [error, setError] = React.useState(null);
      const panelRef = React.useRef(null);
      const requestRef = React.useRef(null);
      const openLeadRef = React.useRef(openLeadSession);
      requestRef.current = request;
      openLeadRef.current = openLeadSession;

      const close = React.useCallback(() => {
        pendingOnboarding = null;
        setRequest(null);
        setData(null);
        setSetupOrg(null);
        setError(null);
        setSaving(false);
      }, []);

      React.useEffect(() => {
        const listener = (detail) => {
          setRequest(detail);
          setData(null);
          setSetupOrg(null);
          setError(null);
          setLoading(true);
          requestAnimationFrame(() => panelRef.current?.focus());
        };
        onboardingListeners.add(listener);
        if (pendingOnboarding !== null) listener(pendingOnboarding);
        return () => {
          onboardingListeners.delete(listener);
        };
      }, []);

      React.useEffect(() => {
        if (request === null) return undefined;
        let alive = true;
        setLoading(true);
        setError(null);
        apiGet(undefined, undefined, request.workspaceId)
          .then((payload) => {
            if (!alive) return;
            if (payload.configured) {
              close();
              if (request.leadSessionId) openLeadRef.current(request.leadSessionId);
              return;
            }
            setData(payload);
            setSetupOrg(JSON.parse(JSON.stringify(payload.org)));
          })
          .catch((reason) => {
            if (alive) setError(reason instanceof Error ? reason.message : String(reason));
          })
          .finally(() => {
            if (alive) setLoading(false);
          });
        return () => {
          alive = false;
        };
      }, [request, close]);

      React.useEffect(() => {
        if (request === null) return undefined;
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || saving) return;
          event.preventDefault();
          close();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      }, [request, saving, close]);

      if (request === null) return null;

      const save = async () => {
        if (data === null || setupOrg === null || saving) return;
        setSaving(true);
        setError(null);
        try {
          await apiSave(data.revision, { ...setupOrg, enabled: true }, request.leadSessionId, request.workspaceId);
          const leadSessionId = request.leadSessionId;
          close();
          if (leadSessionId) openLeadRef.current(leadSessionId);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setSaving(false);
        }
      };

      return h(
        'div',
        { className: 'ao_overlay', role: 'presentation' },
        h(
          'div',
          {
            className: 'ao_panel',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'ao-onboarding-title',
            tabIndex: -1,
            ref: panelRef,
            style: { position: 'relative' },
          },
          h(
            'div',
            { className: 'ao_header' },
            h(
              'div',
              { className: 'ao_heading' },
              h(
                'div',
                { className: 'ao_titleRow' },
                h(Icon, { name: 'org', size: 19, className: 'ao_titleIcon' }),
                h('h2', { className: 'ao_title', id: 'ao-onboarding-title' }, t('setupTitle')),
              ),
              h('p', { className: 'ao_subtitle' }, request.workspaceTitle || request.workspaceId),
            ),
            h(
              'div',
              { className: 'ao_headerActions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ao_iconButton',
                  onClick: close,
                  disabled: saving,
                  title: t('close'),
                  'aria-label': t('close'),
                },
                h(Icon, { name: 'close', size: 17 }),
              ),
            ),
          ),
          loading && setupOrg === null ? h(
            'div',
            { className: 'ao_centerState', role: 'status' },
            h('span', { className: 'ao_spinner' }),
            h('span', null, t('loading')),
          ) : error !== null && setupOrg === null ? h(
            'div',
            { className: 'ao_centerState', role: 'alert' },
            h(Icon, { name: 'warning', size: 20 }),
            h('span', { className: 'ao_centerText' }, error),
            h('button', { type: 'button', className: 'ao_button', onClick: close }, t('close')),
          ) : setupOrg !== null ? h(SetupScreen, {
            setupOrg,
            workspace: data?.workspace ?? { id: request.workspaceId, title: request.workspaceTitle, path: '' },
            sessionId: request.leadSessionId,
            workspaceId: request.workspaceId ?? data?.workspace?.id,
            onChange: (next) => {
              setSetupOrg(next);
              setError(null);
            },
            onSave: save,
            saving,
            error,
            t,
          }) : null,
        ),
      );
    }

    function installWorkspaceMenu(ctx, apiGet, apiSave, t) {
      let disposed = false;
      let scheduled = false;
      let scanningTeams = false;
      let activeDialog = null;
      const teamStates = new Map();
      const observer = new MutationObserver(schedule);
      function schedule() {
        if (scheduled || disposed) return;
        scheduled = true;
        setTimeout(() => {
          scheduled = false;
          if (!disposed) {
            scan();
            void scanTeamShortcuts();
          }
        }, 0);
      }
      function teamStateFor(workspaceId) {
        const cached = teamStates.get(workspaceId);
        if (cached !== undefined) {
          if (cached.promise !== null) return cached.promise;
          if (Date.now() - cached.at < 30_000) return Promise.resolve(cached.data);
          teamStates.delete(workspaceId);
        }
        const entry = { data: undefined, at: 0, promise: null };
        entry.promise = apiGet(undefined, undefined, workspaceId)
          .then((data) => {
            entry.data = data;
            entry.at = Date.now();
            entry.promise = null;
            schedule();
            return data;
          })
          .catch(() => {
            entry.data = null;
            entry.at = Date.now();
            entry.promise = null;
            return null;
          });
        teamStates.set(workspaceId, entry);
        return entry.promise;
      }
      function teamIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.15');
        svg.setAttribute('aria-hidden', 'true');
        for (const [tag, attrs] of [
          ['circle', { cx: '8', cy: '3.2', r: '1.7' }],
          ['circle', { cx: '3.2', cy: '12.4', r: '1.7' }],
          ['circle', { cx: '12.8', cy: '12.4', r: '1.7' }],
          ['path', { d: 'M8 4.9v2.7M8 7.6H3.2v3.1M8 7.6h4.8v3.1' }],
        ]) {
          const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
          for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
          svg.append(element);
        }
        return svg;
      }
      async function scanTeamShortcuts() {
        if (scanningTeams || disposed) return;
        scanningTeams = true;
        try {
          const rows = [...document.querySelectorAll('[data-row-key^="workspace:"]')];
          for (const row of rows) {
            if (disposed) return;
            const workspaceId = row.getAttribute('data-row-key')?.slice('workspace:'.length) ?? '';
            if (workspaceId === '') continue;
            const buttons = [...row.querySelectorAll('button')];
            const newButton = buttons.find((candidate) => {
              const label = candidate.getAttribute('aria-label') ?? '';
              return /(^|\s)new session/i.test(label) || label.includes('新建会话');
            });
            if (newButton === undefined) {
              row.querySelector('[data-agent-org-team-button]')?.remove();
              continue;
            }
            const data = await teamStateFor(workspaceId);
            if (disposed) return;
            const leadSessionId = data?.org?.lead?.sessionId;
            const enabled = data?.configured === true && data?.enabled !== false && typeof leadSessionId === 'string' && leadSessionId !== '';
            let button = row.querySelector('[data-agent-org-team-button]');
            if (!enabled) {
              button?.remove();
              continue;
            }
            if (button !== null && button.nextElementSibling === newButton) continue;
            button?.remove();
            if (newButton.parentNode === null || !newButton.isConnected) continue;
            button = document.createElement('button');
            button.type = 'button';
            button.className = newButton.className;
            button.setAttribute('data-agent-org-team-button', '');
            button.setAttribute('aria-label', t('openTeamView'));
            button.setAttribute('title', t('openTeamView'));
            button.append(teamIcon());
            button.addEventListener('pointerdown', (event) => event.stopPropagation());
            button.addEventListener('mousedown', (event) => event.stopPropagation());
            button.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              const targetSessionId = leadSessionId;
              try {
                ctx.uiWorkspace.openSession(targetSessionId);
              } catch {
                return;
              }
              const startedAt = Date.now();
              const openPanel = () => {
                if (document.querySelector('[data-agent-org-panel]') !== null) return;
                const trigger = document.querySelector('button[data-agent-org-trigger]');
                if (trigger !== null) {
                  trigger.click();
                  return;
                }
                if (Date.now() - startedAt < 2_500) setTimeout(openPanel, 60);
              };
              setTimeout(openPanel, 80);
            });
            newButton.parentNode?.insertBefore(button, newButton);
          }
        } finally {
          scanningTeams = false;
        }
      }
      function visible(element) {
        return element !== null && (element.offsetWidth > 0 || element.offsetHeight > 0);
      }
      function closeMenu() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      function dialog(workspaceId, data, title) {
        if (activeDialog !== null) activeDialog.remove();
        const overlay = document.createElement('div');
        overlay.className = 'ao_wsConfirmOverlay';
        overlay.setAttribute('data-agent-org-dialog', '');
        const panel = document.createElement('div');
        panel.className = 'ao_wsConfirmPanel';
        panel.setAttribute('role', 'alertdialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'ao-ws-enable-title');
        panel.setAttribute('tabindex', '-1');
        const heading = document.createElement('h3');
        heading.className = 'ao_wsConfirmTitle';
        heading.id = 'ao-ws-enable-title';
        heading.textContent = t('enableConfirmTitle');
        const copy = document.createElement('p');
        copy.className = 'ao_wsConfirmText';
        copy.textContent = `${title ? `${title} · ` : ''}${t('enableConfirmText')}`;
        const error = document.createElement('p');
        error.className = 'ao_wsConfirmError';
        error.setAttribute('role', 'alert');
        const actions = document.createElement('div');
        actions.className = 'ao_wsConfirmActions';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'ao_button ao_buttonGhost';
        cancel.textContent = t('enableConfirmCancel');
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'ao_button ao_buttonPrimary';
        confirm.textContent = t('enableConfirmAction');
        actions.append(cancel, confirm);
        panel.append(heading, copy, error, actions);
        overlay.append(panel);
        document.body.append(overlay);
        activeDialog = overlay;
        const close = () => {
          if (activeDialog === overlay) activeDialog = null;
          overlay.remove();
          document.removeEventListener('keydown', onKey, true);
        };
        const onKey = (event) => {
          if (event.key === 'Escape' && !confirm.disabled) {
            event.preventDefault();
            close();
          }
          if (event.key === 'Tab') {
            const focusables = [cancel, confirm].filter((button) => !button.disabled);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        };
        cancel.addEventListener('click', () => {
          if (!confirm.disabled) close();
        });
        overlay.addEventListener('mousedown', (event) => {
          if (event.target === overlay && !confirm.disabled) close();
        });
        document.addEventListener('keydown', onKey, true);
        confirm.addEventListener('click', async () => {
          confirm.disabled = true;
          cancel.disabled = true;
          confirm.textContent = t('enabling');
          error.textContent = '';
          try {
            const snapshot = ctx.workspaces.list.getSnapshot();
            const workspace = snapshot.items.find((item) => item.workspaceId === workspaceId);
            const ids = workspace?.sessionIds ?? [];
            for (const sessionId of ids) {
              await ctx.uiWorkspace.archiveSession(sessionId, { stopActivity: true });
            }
            const newSessionId = await ctx.uiWorkspace.connectWorkspace(workspaceId);
            if (data.configured) {
              await apiSave(data.revision, {
                ...data.org,
                enabled: true,
                lead: { ...data.org.lead, sessionId: newSessionId },
              }, newSessionId, workspaceId);
            }
            if (!data.configured) {
              requestOnboarding({
                workspaceId,
                workspaceTitle: title,
                leadSessionId: newSessionId,
              });
            }
            ctx.uiWorkspace.openSession(newSessionId);
            teamStates.delete(workspaceId);
            schedule();
            close();
          } catch (reason) {
            error.textContent = `${t('enableFailed')}: ${reason instanceof Error ? reason.message : String(reason)}`;
            confirm.disabled = false;
            cancel.disabled = false;
            confirm.textContent = t('enableConfirmAction');
          }
        });
        requestAnimationFrame(() => cancel.focus());
      }
      async function scan() {
        const rows = [...document.querySelectorAll('[data-row-key^="workspace:"]')];
        const row = rows.find((candidate) => [...candidate.classList].some((name) => name.includes('menuOpen')));
        if (row === undefined) return;
        const menus = [...document.querySelectorAll('[role="menu"]')].filter(visible);
        const menu = menus[menus.length - 1];
        if (menu === undefined) return;
        if (menu.querySelector('[data-agent-org-menu]') !== null) return;
        const workspaceId = row.getAttribute('data-row-key')?.slice('workspace:'.length) ?? '';
        if (workspaceId === '') return;
        const divider = document.createElement('div');
        divider.className = 'ao_wsMenuDivider';
        divider.setAttribute('data-agent-org-menu', '');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ao_wsMenuItem';
        button.setAttribute('role', 'menuitemcheckbox');
        button.setAttribute('aria-checked', 'false');
        button.setAttribute('data-agent-org-menu', '');
        button.disabled = true;
        const check = document.createElement('span');
        check.className = 'ao_wsMenuCheck';
        const label = document.createElement('span');
        label.textContent = t('menuLoading');
        button.append(check, label);
        menu.append(divider, button);
        let data;
        try {
          data = await apiGet(undefined, undefined, workspaceId);
        } catch {
          label.textContent = t('menuNeedRestart');
          return;
        }
        if (disposed || !button.isConnected) return;
        const enabled = data.configured === true && data.enabled !== false;
        button.disabled = enabled;
        button.setAttribute('aria-checked', enabled ? 'true' : 'false');
        check.textContent = enabled ? '✓' : '';
        label.textContent = enabled ? t('menuEnabled') : t('menuEnable');
        if (!enabled) {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (button.disabled) return;
            button.disabled = true;
            closeMenu();
            dialog(workspaceId, data, row.textContent?.trim() ?? '');
          });
        }
      }
      observer.observe(document.body, { childList: true, subtree: true });
      scan();
      void scanTeamShortcuts();
      return () => {
        disposed = true;
        observer.disconnect();
        activeDialog?.remove();
        for (const node of document.querySelectorAll('[data-agent-org-menu]')) node.remove();
        for (const node of document.querySelectorAll('[data-agent-org-team-button]')) node.remove();
      };
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace', 'workspaces', 'modelDirectories'],
      apply(ctx) {
        archiveMemberSession = (sessionId) => ctx.uiWorkspace.archiveSession(sessionId, { stopActivity: true });

        const openMemberSession = (parentSessionId, childSessionId) => {
          if (typeof childSessionId !== 'string' || childSessionId === '') {
            throw new Error('member session is unavailable');
          }
          try {
            ctx.uiWorkspace.openSession(childSessionId);
          } catch (error) {
            if (typeof parentSessionId !== 'string' || parentSessionId === '') throw error;
            ctx.uiWorkspace.openSession({
              parentSessionId,
              childSessionId,
              mode: 'continuable',
            });
          }
        };


        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register(
            {
              name: 'conversation.session.header.actions',
              id: 'agent-org',
              order: -21,
              locale: NS,
              inject: () => ({
                openMemberSession,
                switchLeadModel: async (selection) => ctx.modelDirectories.directoryFor(selection.sessionId).select({
                  provider: selection.provider,
                  model: selection.model,
                  ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
                }),
                pinSession: (id) => ctx.uiWorkspace.pinSession(id),
                unpinSession: (id) => ctx.uiWorkspace.unpinSession(id),
                pinnedSessionIds: () => ctx.workspaces?.list?.getSnapshot?.()?.pinnedSessionIds ?? [],
              }),
            },
            OrgAction,
          ),
        );

        ctx.effect(() => {
          const tagId = '@local/dsh-agent-org/styles';
          if (document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
            const tag = document.createElement('style');
            tag.dataset.plugin = '@local/dsh-agent-org';
            tag.dataset.pluginCss = tagId;
            tag.textContent = css;
            document.head.appendChild(tag);
          }
          return () => {
            const tag = document.querySelector(`style[data-plugin-css="${tagId}"]`);
            if (tag !== null) tag.remove();
          };
        }, 'agent-org:styles');

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agent-org:dictionaries');

        ctx.effect(() => {
          const source = ctx.workspaces?.list;
          if (source === undefined || typeof source.subscribe !== 'function') return undefined;
          const snapshotItems = () => {
            const snapshot = source.getSnapshot();
            return Array.isArray(snapshot?.items) ? snapshot.items : [];
          };
          const itemsToMap = () => new Map(snapshotItems().map((item) => [item.workspaceId, item.path]));
          let known = itemsToMap();
          const timers = new Map();
          const unsubscribe = source.subscribe(() => {
            const next = itemsToMap();
            for (const [id, path] of known) {
              if (next.has(id) || timers.has(id)) continue;
              const timer = setTimeout(() => {
                timers.delete(id);
                const current = snapshotItems();
                if (current.some((item) => item.workspaceId === id || item.path === path)) return;
                void apiMarkWorkspaceDeleted(path).catch((error) => {
                  console.warn('[agent-org] could not disable deleted workspace:', error);
                });
              }, 900);
              timers.set(id, timer);
            }
            for (const [id, timer] of timers) {
              if (next.has(id)) {
                clearTimeout(timer);
                timers.delete(id);
              }
            }
            known = next;
          });
          return () => {
            unsubscribe();
            for (const timer of timers.values()) clearTimeout(timer);
          };
        }, 'agent-org:workspace-deleted-watch');

        ctx.effect(() => {
          const t = ctx.locale.bind(NS);
          return installWorkspaceMenu(ctx, apiGet, apiSave, t);
        }, 'agent-org:workspace-menu');

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'agent-org:onboarding',
              order: -5,
              locale: NS,
              inject: () => ({
                openLeadSession: (sessionId) => {
                  if (typeof sessionId === 'string' && sessionId !== '') {
                    ctx.uiWorkspace.openSession(sessionId);
                  }
                },
              }),
            },
            WorkspaceOnboarding,
          ),
        );

      },
    };
  },
});
