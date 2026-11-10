# Editable team content

These JSON files are the editable natural-language catalog for the plugin.
They are loaded at Host startup. Edit them directly, or let the lead call
`team_save_knowledge` to append a new role template / organization pattern.

## Categories

- `role-templates.json` — position templates used by the organization editor:
  `title`, `responsibilities`, `instructions`, `level`, `accent`.
- `org-patterns.json` — reusable organization shapes:
  `name`, `fit`, `shape`, `avoid`.
- `role-playbooks.json` — per-role authority, boundaries, and mandatory workflow,
  keyed by role kind (`coding`, `coding-captain`, `docs`, `video-edit`, ...).

`prompts.json` — all system/role prompt templates grouped by `lead`, `lead.video`, `midproject`, `teamDesign`, `bootstrap`, `task`, `identity`, `skills`, plus `text` fallback/rule strings. Preserve the `{{token}}` placeholders when editing; their meanings are documented in the `_placeholders` objects in `prompts.json` and `formats.json`.
- `formats.json` — relation descriptions, roster rows, and skill entry formats.
- `defaults.json` — default team name, lead label, and lead description.
- `team-help.json` — the tool guide and prompt-rule notes returned by `team_help`.

UI labels are already in `../locale/zh.json` and `../locale/en.json`.

## Editing rules

- Keep valid UTF-8 JSON arrays/objects.
- `role-templates.json` and `org-patterns.json` must stay JSON arrays.
- `role-playbooks.json` must stay an object keyed by role kind.
- Do not put secrets, credentials, personal data, or project-specific absolute
  paths in these reusable files.
- Restart the Host after editing manually; the lead tool writes the running
  profile copy atomically.
