---
name: mcp-campfire
description: Use and configure mcp-campfire MCP server (Cursor registration, env/Redis, tool routing). Use when registering the MCP, connecting Redis, or invoking campfire/duel tools from this or another project.
---

# mcp-campfire — Registration, config, tools

Use this skill when the agent must **register**, **configure**, or **invoke** mcp-campfire. Respond with registration snippet, config steps, or `server: "mcp-campfire"` + `toolName` as appropriate.

---

## When to use

- Register mcp-campfire in Cursor (this repo or another project).
- Configure storage: in-memory (default) vs Redis.
- Invoke campfire or duel tools; route to correct tool name and minimal params.

Full tool parameters and flow: [README.md](../../README.md) in this repo. For mission/orchestration use cases (Quest, Campaign, WorldEvent loop): [docs/MISSION_RPG_QUEST_ORCHESTRATOR.md](../../docs/MISSION_RPG_QUEST_ORCHESTRATOR.md).

---

## Cursor registration

In `.cursor/mcp.json` (workspace root), under `mcpServers`:

```json
"mcp-campfire": {
  "command": "node",
  "args": ["mcp-campfire/dist/index.js"]
}
```

Path in `args` must resolve to the built entry (relative to workspace root or absolute). Restart Cursor after changes.

---

## Config

- **Default:** in-memory; no env required. State lost on restart.
- **Redis (when implemented):** set `CAMPFIRE_STORAGE=redis` and `REDIS_URL=redis://...`. Server then uses Redis adapter instead of in-memory.

---

## Tools at a glance

| Intención | Tool |
|-----------|------|
| Health / echo | `campfire_ping`, `campfire_echo` |
| Fire + messages | `campfire_get_or_create_fire`, `campfire_post_message`, `campfire_list_messages` |
| Duel: declare → oath → strike → hold → verdict | `campfire_throw_gauntlet`, `campfire_take_oath_of_judgement`, `campfire_strike_argument`, `campfire_hold_the_line`, `campfire_deliver_verdict` |
| Duel: abandon / write (blocked during duel) | `campfire_abandon_duel`, `campfire_speak_to_party`, `campfire_update_battle_plan` |

Invoke with `call_mcp_tool(server: "mcp-campfire", toolName, arguments)`. See [README.md](../../README.md) for minimal parameters.

---

## Use in another project

1. Clone or copy this repo (mcp-campfire) into the other project or use from a path.
2. In mcp-campfire: `npm install && npm run build`.
3. In the other project, create or edit `.cursor/mcp.json`: add the `mcp-campfire` entry with `args` pointing to `mcp-campfire/dist/index.js` (relative to the other project's root or absolute).
4. Restart Cursor.
