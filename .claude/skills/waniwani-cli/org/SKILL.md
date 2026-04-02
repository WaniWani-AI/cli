---
name: org
description: Organization management - list, view, and switch between WaniWani organizations. Use when the user needs to manage or switch their organization context.
allowed-tools: Bash(waniwani:*)
---

# Organization Management

## Commands

### List Organizations
`waniwani org list` - List all organizations the user belongs to. Shows organization name, slug, and role.

### Current Organization
`waniwani org current` - Show the current active organization. Displays name and details of the org currently being used.

### Switch Organization
`waniwani org switch <name>` - Switch to a different organization.
- `<name>` - Name or slug of the organization to switch to
- All subsequent commands will operate in the context of the selected org

## Examples

```bash
# See which organizations you belong to
waniwani org list

# Check current org
waniwani org current

# Switch to a different org
waniwani org switch my-company
```

## Notes

- Organization context affects which MCPs you see and can manage
- Switching orgs does not affect authentication (login remains valid)
- All commands support `--json` global flag for machine-readable output
