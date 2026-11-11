# Agent Org — workspace-scoped multi-agent collaboration for DSH

Agent Org makes the current conversation the **lead** of a team that belongs to
the current **DSH workspace**. The user briefs only the lead. The lead assigns
self-contained work to role members through `team_assign`; every member runs in
a separate AI session under the same workspace.

The organization is **not enabled automatically**. Use the **workspace folder
menu** → **Enable Team Org** (启用协作组). Enabling:

1. asks for confirmation;
2. archives every session in that workspace (stopping running work);
3. creates a fresh lead session in the same workspace;
4. opens that lead session and automatically shows the initial team setup.

Enabling also opens an app-level onboarding overlay, independent of the
session header. This is what makes “jump to initialization” work even when the
new lead session is still blank. After setup, the overlay closes and the lead
session is entered. An already-enabled workspace shows a checked, disabled menu
item; its enable action cannot run again.

Deleting a workspace retires its durable organization. The organization file is
moved aside as a `.deleted-*` backup, so re-adding the same path starts
unconfigured and runs initial team setup again. The previous organization and
named employee sessions are not silently reused.

The primary reporting line is a tree; the wider relationship view is a graph
and may contain additional, cross-level, cyclic, and temporary links.

## First use in a new workspace

1. Create or open a workspace in DSH and start its conversation.
2. Open **协作组 / Team Org** in the conversation header.
3. The setup screen shows the current workspace path and the default team:
   only the lead by default; add roles during setup if needed.
4. Confirm the team name, each role's manager, enabled/disabled state, and the
   preloaded role prompts. Default prompts can be edited here and later.
5. Click **建立团队并启用 / Create team and enable**.

Until this step is complete:

- the lead receives a “not enabled” policy and cannot delegate;
- `team_assign` rejects calls with a setup instruction;
- no workspace organization file exists.

Each workspace owns its own organization, roles, prompts, sessions, and
collaboration activity. Opening the same plugin in another workspace starts
with its own onboarding flow.

## What the user sees

- **Relationship image export** — the Organization graph has an
  **导出图片 / Export image** action. It renders the complete current graph to a
  PNG with a title, date, role count, color/line legend, active-run marker, and
  explanatory notes about reporting vs collaboration/handoff/temporary links.
  Extra relations follow the current Show extra relations toggle. The image is
  self-contained and uses system fonts. A role-responsibility table under the
  graph lists each position, member, duties, and manager; node labels are
  measured and clipped to avoid crossing the **fixed** node borders.
- **Relationship topology** — a node-link graph with a primary reporting
  backbone plus any number of additional graph relations. Additional links may
  be cross-level, cyclic, multiple, and temporary. Nodes can be **dragged**;
  positions are persisted and **Auto layout**, floating next to **Add member**, resets them. The graph also shows
  the collaboration process: the latest run status and duration on each member
  node, a task-flow badge on the reporting edge into that member, and an
  animated flow along the full lead-to-member reporting path while a run is
  active. Completed and failed runs leave green/red status on the same path;
  the summary strip counts running, completed, and failed members. Running
  members are highlighted, and the active collaboration strip names the role
  and links to its session. Each graph node has a small **+** port below it;
  dragging that port onto another node opens a prefilled relation editor so
  cross-level, additional, or temporary relations can be created without
  leaving the graph. Each node also has a small **⋯** action button beside it;
  clicking it or right-clicking the node opens a role menu with **Edit** and,
  for every role except the lead, **Copy member**. Copy creates a prefilled new
  member draft (same title, reporting line, and prompt) without cloning the
  old session.
- **Graph relations** — drag from the small port under a node to another node to create a relation, or click an existing graph line to edit it.
  Relation types are additional reporting, collaboration, temporary, and directed handoff (for workflow order). A
  temporary relation can expire at a chosen time or remain until removed;
  expired relations disappear from prompt context but stay visible/removable
  in the graph.
- **Role templates** — preset templates for product design, software
  engineering, QA, code review/optimization, GitHub submission, code security,
  and compliance. The floating **Add member** button opens a template picker;
  choosing a template opens the normal role editor prefilled with its title,
  responsibilities, instructions, and accent. Custom templates can be created
  from the same dialog and are stored in the organization document. Lead
  staffing policy requires a dedicated review/optimization role for every
  coding role, one GitHub submission owner, and one code security reviewer.
  Roles also carry a `captain`/`member` level, so the same position can have a
  captain owning interfaces, file boundaries, integration, and acceptance while
  member-level engineers implement independent sections in parallel.
  Complex or user-facing projects must include a dedicated product designer;
  an engineer cannot double as the designer.
- **Role editor** — add, edit, enable/disable, delete, and re-parent members;
  edit name, title, responsibilities, and full role prompt text.
- **Organization patterns and web research** — the lead has five built-in
  patterns (module stream, platform + stream, functional matrix, project,
  lean) and is instructed to research established patterns with web search
  when the domain or scale is unfamiliar or the current structure bottlenecks.
  Research is adapted to project facts, not copied; source links are included
  when the lead explains the choice. References used for the pattern set:
  [Team Topologies overview](https://leadermenu.com/lead-teams/team-topologies-overview/),
  [Spotify squad/chapter/guild model](https://talent500.com/blog/spotify-agile-model-squads-tribes-chapters-guilds/),
  [engineering team structures](https://dev.to/projiq/engineering-team-structures-squads-tribes-and-guilds-explained-1gci).
- **Mandatory effort downgrade** — before every assignment the lead must
  classify complexity and call `team_set_effort`. Low-complexity work (single
  file, formatting, simple queries, docs, repetitive changes) must use `low`;
  normal implementation/testing uses `low`; only cross-module, high-risk, or
  very uncertain work uses `high`/`max`. A default `max` must never be carried
  into a simple task, and each new task is re-evaluated.
- **Design ownership** — the lead writes only the management plan
  (scope, team, sequence, acceptance, risks). The concrete implementation plan
  must come from a designer: 系统设计师 owns module boundaries, interfaces,
  data flow, file structure, dependencies, sequencing, and technical tradeoffs;
  产品设计师 owns user journeys, screens, interaction, and visual specs. The
  lead cannot substitute for either. Design work may happen before user
  approval; implementation may not start until the user approves the combined
  plan.
- **Lead read-only file access** — the lead may use `read`/`glob`/`grep`
  to inspect workspace code, docs, config, and evidence when planning or
  reviewing. It must not write, modify, run commands/tests, create sessions,
  or produce deliverables; all changes remain delegated.
- **Direct-report-only delegation** — the lead may assign only roles whose
  `reportsTo` is `lead`; captains may assign only their direct reports. Deeper
  work must be routed through the direct manager. The host rejects cross-level
  assignments instead of relying only on the prompt.
- **DeepSeek peak/off-peak billing** — for DeepSeek models the tab applies
  the official Beijing-time/UTC rules: peak 01:00–04:00 and 06:00–10:00 UTC,
  Monday–Friday, excluding Chinese public holidays; all other hours are
  off-peak at 50% of peak. Different usage events are bucketed by their actual
  timestamp and model, then converted to CNY. Rates: Flash cache hit
  $0.003/$0.006, cache miss $0.15/$0.30, output $0.60/$1.20 (off-peak/peak);
  Pro $0.022/$0.044, $0.66/$1.32, $1.98/$3.96. Source:
  [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing).
- **Automatic CNY billing rules** — model prices come from models.dev (USD
  per 1M tokens), converted to CNY using exchangerate-api (fallback 7.2). The
  Token tab shows the formula at the top: `(input − cache-read) × input price +
  cache-read × cache price + output × output price`. Cache writes count as
  input; unmatched models cost 0; estimates are informational and provider
  billing prevails.
- **Token and cost tab** — a separate Team Org tab reads per-session token
  usage from DSH session logs, shows input/output/cache/total tokens and call
  counts for the lead and every member, and estimates cost per model from automatically fetched `models.dev` pricing
  (cached for six hours), with a bundled DeepSeek price snapshot as an offline
  fallback. The tab refreshes while open.
- **Skill selection and injection** — the lead and same-position captains can
  call `team_skill_search` to inspect the live DSH skill catalog, then
  `team_skill_inject` to attach an installed skill to a direct report or author
  a custom skill with `name` + `instructions`. Injected skills persist on the
  member, appear in the employee identity and every subsequent task prompt, and
  are audited with a reason. `team_skill_search` accepts `role` to confirm the
  target member and returns all eligible direct reports, so search and
  injection cannot drift to a different member. Only direct managers can inject; the lead cannot
  skip a captain to touch that captain's reports. The lead prompt recommends
  letting the direct captain choose skills for its own team.
- **Local skill file import** — the role skill panel has an import control
  accepting Markdown (optional YAML frontmatter), plain text, and JSON up to
  64KB. It derives name/description/body into the custom-skill fields; the user
  reviews, supplies a reason, and injects through the same audited API.
- **User skill injection** — open a member in the Organization panel and use
  the **技能注入 / Skill injection** section to search installed DSH skills or
  write a custom one. A reason is required; the skill is saved on the role and
  appears in the member identity and every subsequent task prompt. User
  injection is audited as actor 用户 and shares the same 8-skill role cap as
  lead/captain injection.
- **Global project experience** — after a project delivery, or at a meaningful
  stage boundary, the lead calls `team_project_summary` with a short title,
  outcome, and reusable practice. Entries are stored globally outside any
  workspace (`~/.dsh/agent-org/experience.json`, override with
  `DSH_AGENT_ORG_EXPERIENCE_FILE`) and the newest entries are injected into
  every future lead prompt. Stage summaries use `kind: "stage"`. The store is
  capped and prompt injection is bounded; secrets and personal data are
  prohibited by the tool policy.
- **Lightweight graph layout writes** — dragging a node no longer posts the
  whole organization. The client sends `action: "layout"` with the revision,
  node id, and x/y only; the Host merges it into the current organization.
  Reset layout uses the same small request with `clear: true`. This keeps drag
  saves well below the request-body limit even when roles carry long prompts,
  skills, and audit history.
- **Direct-report lookup** — every member receives `team_my_reports`, a
  read-only query returning only the current lead/captain/member's direct
  reports with id, name, title, level, enabled state, and effort. Prompts tell
  managers to confirm direct reports before delegating instead of guessing.
- **Failure recovery diagnosis** — `team_failure_diagnosis` groups recent
  failed/aborted runs by member and returns the latest diagnostic. The lead may
  rebuild only the single member with repeated infrastructure/model failures;
  when multiple members fail together it must treat the provider/model as the
  global fault instead of firing everyone.
- **Touch drag stability** — node dragging uses one requestAnimationFrame
  update per frame, a 4px touch tap/jitter threshold, `preventDefault` on touch
  moves, pointer-capture release, and `lostpointercapture` cleanup. The SVG edge
  hit layer is explicitly below nodes so transparent edge strokes cannot form a
  dead zone while dragging.
- **Tool and prompt guide** — `team_help` is a read-only guide for the lead
  (and a filtered subset for captains). It lists current Team Org tools, their
  arguments and when to use them, plus recent prompt-rule changes and the
  current plugin version. Use it after upgrades or whenever a tool is unclear.
- **Video production roles** — built-in templates for 视频编导, 剪辑师, 特效师, 动画师, 调色师, 音效/配乐师, 字幕/包装设计师, and 视频质检师.
  They include role-specific authority, boundaries, and a delivery pipeline from
  script/storyboard and supplied/authorized footage through edit,
  VFX/animation, color, sound, subtitles, and technical QC. The team does not
  provide photography/camera work. A `video-production` organization pattern is also available.
- **Decision audit tab** — every work assignment, personnel change, and
  relationship change requires an explicit `reason`. Reasons are persisted in
  `org.audit` and shown in a new **Decisions / 安排记录** Team Org tab with
  timestamp, actor, action, affected role, reason, and a short summary. This
  applies to lead and captain assignments, member creation, module groups,
  firing, parking/restoring, effort changes, and relation changes.
- **Editable natural-language content** — role templates, organization
  patterns, and per-role authority/boundary/workflow playbooks live in
  `content/*.json`; prompt templates live in `content/prompts.json`. Role creation requires concrete `authority` and `boundaries`; `team_set_scope` updates existing roles. UI copy
  lives in `locale/*.json`. The lead can persist a learned role or org pattern
  with `team_save_knowledge`.
- **Open-source-first research** — before presenting a plan, the lead must search
  for existing open-source implementations/libraries/templates and include a
  reuse assessment: candidates, links, licenses, maintenance, integration cost,
  and adopt/partial/self-build reasoning. Installing or importing code still
  waits for plan approval.
- **Plan approval gate** — before a non-trivial project starts, the lead must
  present a compact plan (scope, non-goals, module/team structure, sequence,
  acceptance, risks, user decisions) and wait for explicit approval. No member
  creation, module group creation, session provisioning, or implementation is
  allowed before approval. Revisions require a new plan; only an explicit
  "no plan needed" waives the gate.
- **Mid-project reporting** — the Team Org toolbar has a **Mid-project report**
  action. It prompts the lead to gather current facts, have the report writer
  produce a progress report, and then enter follow-up Q&A. The lead keeps
  answering until the user explicitly says there are no more questions, ends,
  or says 无; it never treats mid-project Q&A as project completion.
- **Firing by the lead** — the lead calls `team_fire_member` with an explicit
  reason and `confirm: true`. The lead cannot fire itself, and a member with
  enabled direct reports must be transferred first. Firing removes the role and
  archives the member session out of the workspace (DSH exposes archive, not a
  physical log erase), and removes relations/layout entries for that role.
- **Dynamic staffing** — teams start with the minimum core and add roles when
  discovery reveals real modules or parallel work. Module groups can begin with
  a captain plus a specialized engineer, then add testing, review, docs, and
  report roles before delivery. The lead can transfer reporting lines with
  `set_manager` and park/restore members with `team_set_member_active` while
  preserving their sessions. No idle pre-created sessions, but no merging of
  required quality gates either.
- **Anchored role editor** — editing a member or the lead opens a context-menu-style
  popover next to that node instead of a centered side panel. The graph stays
  visible behind a dim backdrop, clicking blank space discards unsaved edits,
  and the popover is raised above the fullscreen graph layer (z-index 490).
- **Graph topology** — the organization view is a grouped radial graph, not a
  depth-row tree: the lead is centered, reporting branches occupy adjacent
  angular sectors, and members are placed along radial rings so primary
  reporting lines do not cross. Edges are straight lines between node
  boundaries; the view auto-centers on open, and drag/auto-layout remain
  available. Extra relations are hidden by default and can be shown with the
  **Show extra relations** toolbar toggle to keep the default view clean.
  Touch: drag one finger on empty canvas to pan; pinch with two fingers to zoom
  and move the zoom midpoint; the gesture stays within the 35%–180% range.
  Drag empty canvas space to pan; use the mouse wheel to zoom around the
  pointer position. Node dragging, relation hits, and connect ports are excluded
  from canvas panning. The graph toolbar has zoom out/in, a percentage readout, fit-to-view, and an
  in-app fullscreen overlay (Esc exits). Pointer drag and relation creation
  compensate for the current zoom.

- **Software module groups** — the lead can create a complete module group in one
  call (`team_create_module_group`): a software captain, a specialized software
  engineer, a software tester, a code-review optimizer, and a documentation
  specialist, each with an independent session. The four specialists report to
  the captain, who can delegate within the group. The role cap is 80, so large
  products can use one group per functional module instead of merging roles.
- **Hierarchical delegation** — the lead can hand a whole slice to a
  same-position captain; captains receive a scoped `team_assign` tool and may
  delegate only to their own direct reports. The tool re-checks the live
  hierarchy on every call, so teammates, managers, and unrelated roles cannot
  be scheduled. Nested results roll back up through the captain.
- **Fast collaboration history** — message history is read only for the lead
  and roles that have runs in the current workspace, with a per-session read
  timeout and a 5s (active) / 20s (idle) cache. Runs themselves still refresh
  every 1.5s. Completed entries show their real finish time; missing event times
  are omitted rather than replaced with the current time.
- **Faster collaboration refresh** — the open Team Org panel refreshes
  organization/runs every 1.5s, the Team chat pane every 2s, and the Host-side
  collaboration cache is 1.5s. Polling pauses while the page is hidden and
  refreshes immediately when it becomes visible again. Canvas dragging/saving
  still pauses state application.
- **Larger audit history** — the organization audit/decision log now retains
  1,000 entries instead of 200; the Decisions tab renders the full retained
  history.
- **Resizable and collapsible team chat** — the Team chat pane next to the
  lead conversation has a draggable left edge and a collapse button. Collapsed
  state and width are saved in localStorage; width is clamped for the viewport,
  resettable by double-click, and adjustable with arrow keys.
- **Captain failure escalation** — a captain reports a persistently failing
  direct report with `team_report_failure`; only the lead can list/approve/reject
  with `team_review_failure`. Approval requires a fresh live model choice and
  atomically creates the replacement, transfers children and skills, archives
  the old session, and removes the failing role.
- **Task timer** — the lead starts each new task with `team_task_start`
  and a one-sentence title, then finishes it with `team_task_finish`. The Team
  Org panel shows a live badge with that title and total elapsed time; finished
  tasks show the final duration. Clarifications within the same task do not
  restart the timer.
- **Stored model is restored before every prompt** — when the session's
  current model differs from `lead.model` / `role.model`, the Host selects the
  stored model immediately before accepting the prompt. Successful manual model
  selections are written back to the organization, so a user's one-off choice
  (for example Qwen) is not overwritten by the default; the restore only fixes a
  real fallback to the deployment default.
- **Default model preference** — prompts prefer
  `opencode-go/deepseek-v4.1-flash` (dsv41flash) unless the user explicitly asks
  for another model or it is unavailable/insufficient. Initial setup also picks
  that model when present. `team_select_model` validates the live provider,
  model, effort, and allowlist before switching, so stale model names fail
  before a call rather than silently falling back.
- **Role sessions stay in their workspace** — new member sessions are attached
  to the current workspace immediately, before the identity/bootstrap turn.
  Blank or interrupted role sessions are no longer detached into Ungrouped;
  explicit member-session repair re-attaches them.
- **Milestone submission and privacy gates** — after each key progress point
  (module complete, feature freeze, demo-ready build, external share, release
  candidate), the team runs code review, relevant tests, privacy/security review,
  and a GitHub commit. These are not deferred to the final delivery. The final
  delivery still gets a complete final review and commit gate.
- **Documentation ownership** — the documentation role writes only
  human-facing docs (README usage, user guides, delivery/release notes) and does
  so last, after implementation, tests, review, security, and feature freeze.
  AI-facing comments, interface contracts, and handoff notes are maintained by
  the role that needs them and do not wait for the documentation role.
- **Live effort levels** — `team_set_effort` no longer hard-codes
  off/low/high/max. It reads the target model's live reasoning-effort list and
  accepts model-specific levels such as minimal, medium, and xhigh. If a
  provider exposes no effort metadata, the requested id is still accepted and
  the adapter decides support.
- **Captain effort control** — `team_set_effort` is available to captains as
  well as the lead. It only accepts a direct report, persists off/low/high/max,
  applies it immediately when the member session is live, and audits the change.
- **Member model assignment and live effort metadata** — `team_select_model`
  accepts `role` so the lead or a captain can assign a model and reasoning
  effort to a direct report. It lists live model names, descriptions, and the
  full effort tier names/default. The assignment is persisted on the role, applied
  to an existing member session, and reapplied on later provisioning.
- **Per-model billing** — the Token tab now aggregates input/output/cache/total
  and CNY cost by provider/model across the whole team, in addition to the
  per-member table, so different models assigned to different members reconcile.
- **Proactive lead model choice** — the lead gets `team_select_model`: calling
  it without arguments lists models allowed by `lead.modelPolicy`; calling it
  with provider/model/reasoningEffort switches the lead session and persists
  the selection. The tool also returns each allowed model's capability
  description and reasoning efforts. The lead prompt requires comparing
  reasoning/coding/context/tool-support/speed/cost/provider stability and
  choosing by task fitness without waiting for the user; every switch is audited
  with its reason.
- **Lead model allowlist** — in the lead settings, every model from the live
  DSH catalog is listed with a checkbox. The checked subset is persisted as
  `lead.modelPolicy`; the lead model dropdown only offers those entries, and
  the Host rejects any lead model switch outside the policy — including the
  normal conversation-header selector. At least one model must remain checked.
- **Setup-time model configuration** — the initial team setup now loads the
  live DSH model catalog and lets the user choose the lead's model, select a
  reasoning effort when the model supports it, and check the models the lead
  may choose later. These values are saved with the initial organization and
  applied to the lead immediately after setup.
- **Lead model selection** — the lead settings section lists the live DSH
  model catalog by provider. Choosing a model switches the current lead session
  immediately and persists `lead.model` in the organization; the model is
  re-applied when the lead agent is installed in later Host runs. The normal
  conversation-header model selector remains available.
- **Lead-only right pane** — Team chat is independent of the Sidebar plugin.
  It renders its own fixed pane only for the configured lead Session, and the
  conversation column is reduced by the same width so content is never covered.
  The pane has no close control. When there are no in-memory runs, it shows
  recent lead/member session messages; member JSON/tool payloads are reduced to
  the natural-language message/summary for readability.
- **No new sessions after enable** — the Host Session Controller rejects new
  Session creation in any configured, enabled Team Org workspace. Internal
  role/lead provisioning bypasses this guard; user-created sessions through the
  UI or API are blocked after setup.
- **Team chat history** — when there are no in-memory assignments (for
  example right after a restart), the panel falls back to recent lead/member
  session messages, so it still shows actual collaboration instead of an empty
  workspace. Runs are shown when present; session history is shown when no runs
  exist.
- **Team chat panel** — the sidebar exposes a **Team chat** panel that groups
  recent lead/member assignments by workspace into a chat-like timeline. Each
  turn shows the lead's task, the member's running/completed/failed state, the
  returned result, and buttons to open the parent or member session. It polls a
  read-only Host feed and does not create or modify sessions.
- **Collaboration process** — a workspace-level timeline of the lead's
  assignment, the member session, and the returned result. Completed cards can
  be expanded to read the full result.
- **Workspace shortcut** — in a Team Org-enabled workspace, a Team Org icon
  appears next to the workspace row's **New session** button. It opens the
  lead session and the Team Org view without going through the workspace menu.
- **Graph workspace** — the topology fills the main modal area. **Add member**
  floats in the canvas's top-left corner, while **Team settings** is a tab
  beside Organization and Collaboration. Left-clicking a role opens its edit
  dialog over the graph; edge editing uses the same modal treatment.
- **Simulated-user testing** — software testers must run automated tests
  **and** simulate real user journeys: first entry, core flows, navigation,
  recovery, permissions, mobile/touch, and exploratory use. They report
  reproducible friction evidence and may block release.
- **Independent software testing** — the default 软件测试师 (software tester)
  owns formal functional, regression, boundary, error, permission, acceptance,
  and release verification. Engineers may self-check with unit tests but cannot
  substitute for independent testing or claim release readiness. Testers do not
  modify business code, and their facts feed the single report writer.
- **Single report owner** — the default template library includes 报告师
  (Report writer). Formal progress, delivery, acceptance, release, and retro
  reports are written only by this role. Other members return structured facts
  and never write report prose; the lead only verifies and gives a short reply
  or forwards the report. Report writers may not modify code, docs, or config.
- **Documentation specialist** — the default template library includes 文档师
  (Documentation specialist), owning README, API/usage/architecture docs, and
  necessary code comments. The standard code workflow is implementation →
  docs/comments → review → security → GitHub submission. The role may change
  documentation and comments only, not behavior or interfaces.
- **Explicit authority and boundaries** — every role can carry a custom
  `authority` (what it may decide/own) and `boundaries` (what it must not do,
  when to escalate). Blank fields derive a standard matrix from the role type
  (designer, coding captain/member, reviewer, GitHub owner, security, QA).
  The lead roster and every member prompt include these boundaries.
- **Member reasoning effort** — each role stores an optional reasoning effort
  (`off`/`low`/`high`/`max`). The lead can change it with the
  `team_set_effort` tool; the setting persists in the organization and is applied
  to the member's next requests. The role editor exposes the same field.
- **Relation permissions** — every member can call the `team_relation` tool's
  `create_temporary` action. Only the lead can call `set_manager` to change a
  member's fixed reporting line and `add_handoff` to set a directed workflow handoff. The user's graph editor remains the
  administrative surface. Member sessions are also created without inheriting
  the lead's agent preset, so the lead persona is never sent to a member.
- **Member sessions** — each employee has exactly one named, persistent root AI
  session under the workspace. The session title is the employee name, and the
  employee identity is injected before any task. It is attached to the workspace
  and visible in the workspace session list, not hidden as a subagent child.
  A session is attached only after its identity/bootstrap turn completes.
- **Stable conversation** — creating, provisioning, or repairing a member never
  calls the Workspace navigation API. The session the user is viewing stays
  selected; only an explicit member "open session" click or enable onboarding
  navigates.
- **Lead-first navigation** — enabling or completing setup opens the lead
  session. The lead session id is stored in the organization. A blank lead
  session receives a short initialization turn so it is a normal visible
  workspace session rather than being hidden by the blank-session rule.
- **New Session stays normal** — the plugin does not intercept or disable the
  workspace New Session action or shortcut. There is no `startSession` patch,
  no workspace-row button override, and no global session guard. Use the
  workspace action exactly as DSH provides it.
- **Explicit repair** — an enabled team shows a **修复成员会话 / Repair member
  sessions** button in the panel toolbar. It is the only panel path that
  detaches, rebuilds, or initializes an existing member or lead session, and it
  never runs automatically. Reading state never repairs anything.

## Default team

A new workspace starts with only the lead. The lead creates members directly
through `team_create_member` or `team_create_module_group`.

New members are named `position-number` by default (for example
`产品设计师-01`, `软件工程师-01`). The name remains editable. Existing
organizations that still contain the legacy HR role are migrated on load: the HR
role and HR template are removed, and its direct reports move to the lead.

## Cancellation semantics

Delegated member turns share the lead tool call's cancellation. If the user
aborts the lead turn while `team_assign` is waiting, the member turn is canceled
with the `parent` cause and the member Session is retained. Re-delegating resumes
the same session. This is not an approval timeout.

## Role duties

- **Lead** only accepts the user's task, decomposes it, assigns self-contained
  work, verifies and integrates results. The lead **prompt** requires it to
  delegate instead of doing the work itself. Role boundaries are prompt-level:
  no tool allow-list is installed, so the lead keeps the user's global tools.
- **Lead** also creates missing members and module groups directly. The scoped
  `team_create_member`, `team_create_module_group`, and `team_fire_member` tools
  are installed on the lead agent. The lead writes each member's identity
  prompt, responsibility boundary, manager, and initializes their session.
- **Other members** only complete the work assigned by the lead. They cannot
  create members or modify the organization.

When the lead needs a new profession, it creates the member directly with the
position, responsibilities, identity prompt, and manager, then assigns work.

## Employee sessions and role injection

Employee sessions are **created through the user-side Session Controller create
contract**, not through the Agent-level
`ctx.sessionController.agents.createSession` API. Concretely the Host calls
`ctx.sessionController.create({ cwd, sessionId, agentPreset })`; that method is
the handler behind the Workspace New Session control's `session.create` Remote
(`SessionController.create` → `SessionCommandController.create`). The session
therefore inherits the live preset, model, and Session Controller bookkeeping
instead of being assembled by hand.

The session is created against its workspace directory while still detached from
the workspace entity. The Host titles it with the employee's name (for example
`系统设计师-01`), injects the role card through a first bootstrap message, and attaches
it to the workspace with `attachSession` **only after that bootstrap turn
completes**. `team_assign` follows the same rule: a still-blank member session
stays unattached while it runs and is attached only after a completed turn.

That ordering is what keeps the user's active conversation stable:

- no `openSession` or `startSession` is called while creating a member, so the
  selected conversation is never replaced;
- a blank, not-yet-initialized member session is not visible as a workspace
  "New Session" candidate, so the Workspace UI cannot reuse it and move the
  user's draft into an employee session;
- explicit repair (panel button → POST `action: "repair"`) detaches a blank
  existing member session instead of reattaching it. No GET request repairs
  sessions.

Only a replaced **legacy subagent** session is archived. A normal root member
session is never auto-archived, because archiving the selected session would
clear the user's current conversation.

`team_assign` reuses the stored employee session through the continuation API
instead of creating a fresh child for every task. The employee keeps its role and
prior task history. If the stored session is still blank (for example an earlier
bootstrap was aborted before it delivered the role card), the Host re-injects the
identity prompt before running the task. If a stored session is no longer usable
(for example after workspace archive/re-enable), the Host creates a replacement
through the same user-side create path and stores the replacement id. Deleting a
member archives its session. Adding a role while the team is enabled provisions its session
immediately. If creation fails, the member stays registered without a session id,
`team_create_member` reports a clear error instead of claiming success, and the
next `team_assign` provisions the missing session automatically.

## Temporary help approvals

A member may submit `team_request_help` with a target role, task, and reason.
The request is stored as pending and is not delegated. Only the lead can call
`team_review_help` to list, approve, or reject it. Approval creates a temporary
relation, delegates the help task, and removes the relation when that delegation
finishes (including failure or abort). Rejection records the decision without
creating a relation. Approval does not change reporting lines or bypass review,
testing, security, or user approval.

## Delegation contract

The Host installs `team_assign`, `team_create_member`, `team_create_module_group`,
and `team_fire_member` on root/lead agents:

- `team_assign({ role, task })` — resolves an enabled role by id, name, or title;
  sends a follow-up task to that employee's persistent role session; waits for
  the turn to complete; returns a structured summary.
- A workspace can be enabled from its folder menu. The enabled state is
  durable in the workspace organization; an enabled workspace's menu action is
  disabled. When disabled through the API, the lead policy and `team_assign`
  reject delegation.
- Internal agent-to-agent traffic uses a compact JSON protocol: members return `{"status","summary","files","verify","risks"}`, the lead sends short `goal/scope/files/accept/deps` task fields, and tool results use `AGENT/STATUS/MS` headers. User-facing answers remain natural language. The per-assignment result cap is 6,000 characters.

After setup or re-enable, the Host sends the lead a **team-relationship design task** instead of a greeting. The lead inspects existing members and levels, uses `team_relation`/`set_manager`/`add_handoff` to design fixed reporting and workflow handoffs, and lists missing roles without creating sessions. An existing team can trigger the same job from the **Design team relationships** toolbar button.

The lead prompt requires a short internal parallel plan and proactively splits work that looks single-person-sized when it has independent, separately testable sections. A webpage can be split across engineers, with one same-position captain owning interfaces, file boundaries, integration, and acceptance. Independent, non-shared-file tasks are delegated in the same turn; dependent work waits or uses a handoff relation. Implementation may run in parallel, but review, security, and GitHub submission remain serialized.

The lead/role prompts include active graph relations. Expired temporary
  relations are excluded. Relations are coordination context, not a hard
  access-control policy.

The employee receives its role injection when the session is created, then the
task prompt on each assignment. The employee keeps prior task history in the same
session. Members other than the lead cannot create teammates through this plugin. The lead
policy is regenerated from the live workspace organization on every prompt
assembly, so edits apply to the next delegation.

## Persistence and API

Organizations are stored per workspace under:

```text
$DSH_HOME/agent-org/workspaces/<sha256-of-workspace-path>.json
```

`DSH_AGENT_ORG_DIR` overrides the directory; `DSH_AGENT_ORG_FILE` is a
single-file test override. Writes use an exclusive `.lock` file, re-read the
current revision from disk, and publish via a random temp file plus atomic
rename. Malformed existing files are backed up as
`<file>.corrupt-<timestamp>-<id>` before a deliberate replacement.

The Web client uses one endpoint:

- `GET /dsh-agent-org/state?sessionId=...` or `?workspaceId=...` — a **pure
  read**: workspace, configuration/enabled state, organization (or setup
  defaults), revision, activity, warnings. It never detaches, repairs, creates,
  or initializes sessions.
- `POST /dsh-agent-org/state` — one of:
  - a setup/update at an expected revision, with either a `sessionId` or
    `workspaceId`. The initial setup uses revision `0`; later saves use the
    returned revision. Initial setup also provisions enabled member sessions
    and initializes the lead session.
  - `{ "action": "provision", "workspaceId": ..., "leadSessionId": ..., "roleId": ... }`
    — explicit member-session provisioning after a role is added.
  - `{ "action": "repair", "workspaceId": ..., "sessionId": ... }` — explicit
    repair: refresh the store, then detach/rebuild missing enabled member
    sessions and initialize a blank lead session when the team is configured
    and enabled. The panel calls this only from the **修复成员会话** button.
  - `{ "action": "workspace-deleted", "path": ... }` — retire the organization
    of a deleted workspace.

All POST variants require `Content-Type: application/json` and `X-Agent-Org: 1`.
Both methods reject explicit `Sec-Fetch-Site: cross-site` and compare `Origin`
with the received `Host` when present. This is defense in depth, **not
authentication**: the DSH Web launch-token listener and any configured auth
gateway remain the access boundary. Use loopback or an authenticated gateway.

`team_assign` is concurrency-safe, so independent delegations issued in one lead
turn may run concurrently, subject to `maxActiveSubagents`.

## Installation

Install the directory as a profile dependency and select the bundle, or use the
Plugin Manager's **Install bundle**. There is no build step and no bundled
runtime dependency. A full DSH Host restart is required when replacing an
already running Host plugin; a page refresh only reloads the browser bundle.

### Compatibility

- `engines.dsh`: `>=0.2.1-rc.5 <0.3.0` (tested against `0.2.1-rc.5`).
- `engines.node`: `>=22.0.0` (the Host must support ESM JSON import attributes,
  `Promise.withResolvers`, and Web `fetch`).
- Host peer: `@deepseek-ai/cordis >=4.0.5 <5.0.0` (optional peer; supplied by DSH).
- Web client dependencies (`react`, `react-dom`, and the injected
  `@deepseek-ai/dsh-client-*` modules) are supplied by the DSH Web host, not
  bundled here.
- Host APIs used: `systemPrompt`, `tools`, `subagents`, `agents`, `sessions`,
  `workspaceRegistry`, `sessionTitle`, `sessionQuery`, `sessionController`,
  `skills`, `webServer`, plus the profile/client services declared by
  `dsh.client.inject`.

The plugin uses capability checks and fallbacks for optional Host methods
(`sessions.flush`, `agents.list`, model catalog/selection paths). DSH `0.3.x`
changes the minor compatibility line and must be revalidated before widening
`engines.dsh`; the plugin does not claim untested API compatibility.

## Limits

- Role boundaries are prompt-level, not a hard capability sandbox. Every role
  keeps the user's global tools and permission roots; only the scoped
  `team_assign` / `team_create_member` tools are added.
- Activity is in memory (last 40 runs per process) and filtered by workspace;
  the organization itself is durable. A restart clears the activity list.
- The primary reporting line remains a tree for initial onboarding and stable
  layout. Additional reporting links in the graph may create cycles or multiple
  managers, but they are advisory context rather than a separate permission
  hierarchy.
- The workspace folder menu entry is implemented as a client-side menu
  enhancement because this DSH release has no workspace-menu slot. DSH upgrades
  that change the folder menu markup may require updating the enhancement.
- Employee sessions are persistent root sessions, not subagent children. The
  plugin resumes the same session for each assignment; it does not create a new
  child for every task. A blank, not-yet-initialized member session stays
  unattached until a turn completes, so it is not offered to the Workspace UI's
  New Session flow.
- Member creation depends on the Host Session Controller create path and the live
  workspace record. If the Host cannot resolve the preset or attach the session,
  `team_create_member` reports an explicit error and leaves the member registered
  for a later automatic provisioning attempt.
- All members share the workspace directory. The plugin does not isolate
  worktrees or lock files.
