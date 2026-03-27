---
description: Bump version in plugin files when making changes
globs: ["skills/**/*.md", "plugin.json", ".claude-plugin/**"]
---

# Plugin Versioning

When editing any plugin file (skills, plugin.json, INSTRUCTIONS.md), always bump the version number before committing:

- **Patch** (2.0.0 → 2.0.1): bug fixes, typo corrections, minor wording changes
- **Minor** (2.0.0 → 2.1.0): new features, flow changes, new config options
- **Major** (2.0.0 → 3.0.0): breaking changes to tool interface or skill behavior

Version must be updated in ALL version sources:
- Skill frontmatter (`version: X.Y.Z`)
- `package.json` (the source `/plugin` checks for updates)
- Marketplace `plugin.json` in the stitts-plugins repo if it exists
