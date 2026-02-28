# mcp-campfire

MCP server for collaborative planning among agents: campfires, messages, shared BattlePlan, and a ceremonial Duel protocol with executable resolution.

---

When multiple agents debate in Cursor, consensus can loop forever. **mcp-campfire** provides a clear bounded context: campfire sessions where discussion happens, and a Duel with a state machine (Challenger vs Defender, Judge decides) that cuts infinite debates and produces an applicable ruling on the plan. Not an oracle or magic: it's a contract. What follows is the reality of the product, with no hidden limits.

---

## What it is and who it's for

**mcp-campfire** is an MCP server (spec 2025-11-25) that exposes:

- **Campfires (fires):** planning sessions identified by `fireId`.
- **Messages:** post and list messages per campfire.
- **BattlePlan:** shared content per campfire; updatable when no duel is active.
- **Duel:** ceremonial protocol where a Challenger challenges a Defender; a third agent (Judge) takes an oath, hears arguments, and delivers a verdict with mandatory mutation to the BattlePlan.

**Audience:** devs orchestrating multiple agents in Cursor who want executable resolution instead of open-ended debate. Compatible with Cursor 2026 and MCP clients using spec 2025-11-25.

---

## Quick start

```bash
cd mcp-campfire
npm install
npm run build
npm start
```

The server uses **stdio** transport: it reads JSON-RPC from stdin and writes to stdout. Cursor starts it when connecting the MCP.

**Cursor registration:** in `.cursor/mcp.json` (workspace root):

```json
"mcp-campfire": {
  "command": "node",
  "args": ["mcp-campfire/dist/index.js"]
}
```

Requirements: workspace root must contain `mcp-campfire`, `npm run build` must have been run, and **restart Cursor** after changing `mcp.json`.

- **Development:** `npm run dev` (tsx watch).
- **Tests:** `npm test` (Vitest).

**Cursor skills:** This repo includes `.cursor/skills/mcp-campfire/SKILL.md` so that when you clone it, Cursor can use the skill for registration, config (including Redis), and tool routing. No extra setup needed.

**Mission use cases:** For reference on orchestration-style MCPs (Quest/Campaign, WorldEvent loop, DDD + Hexagonal), see [docs/MISSION_RPG_QUEST_ORCHESTRATOR.md](docs/MISSION_RPG_QUEST_ORCHESTRATOR.md). That document describes a separate "RPG Quest Orchestrator" core domain and state machine; it is included here as a reusable mission blueprint.

---

## Using mcp-campfire from another project

To use this MCP in a different workspace (e.g. another repo or a project that does not contain mcp-campfire):

1. **Get mcp-campfire**  
   Clone [ResakaGit/mcp-campfire](https://github.com/ResakaGit/mcp-campfire) into your machine or copy the `mcp-campfire` folder into (or next to) your project.

2. **Build**  
   From the `mcp-campfire` directory run: `npm install && npm run build`.

3. **Register in the other project**  
   In that project’s workspace root, create or edit `.cursor/mcp.json`. Add an entry under `mcpServers`:
   ```json
   "mcp-campfire": {
     "command": "node",
     "args": ["/absolute/path/to/mcp-campfire/dist/index.js"]
   }
   ```
   Use the path where `mcp-campfire/dist/index.js` actually lives (absolute path, or path relative to the other project’s root).

4. **Restart Cursor** so it picks up the MCP.

After that, tools are available under server key `mcp-campfire` in that workspace.

---

## Tools table

| Tool | Key parameters | Purpose |
|------|----------------|---------|
| `campfire_ping` | — | Health check; returns pong and timestamp. |
| `campfire_echo` | `message` | Connectivity test; returns the message. |
| `campfire_get_or_create_fire` | `fireId` | Get or create a campfire (session). |
| `campfire_post_message` | `fireId`, `text`, `author`? | Post message to campfire (when no duel). |
| `campfire_list_messages` | `fireId` | List messages in the campfire. |
| `campfire_throw_gauntlet` | `fireId`, `challenger_name`, `target_name`, `thesis_of_attack` | Declare duel; state PENDING; blocks general write. |
| `campfire_take_oath_of_judgement` | `fireId`, `character_name` | Judge (third agent) takes oath; activates duel. |
| `campfire_strike_argument` | `fireId`, `character_name`, `technical_evidence` | Challenger: technical attack. |
| `campfire_hold_the_line` | `fireId`, `character_name`, `defense_rationale`, `surrender` | Defender: defense or surrender. |
| `campfire_deliver_verdict` | `fireId`, `character_name`, `winner`, `ruling_rationale`, `required_plan_mutation` | Judge: ruling and mutation to BattlePlan. |
| `campfire_abandon_duel` | `fireId` | Abandon duel; returns to DEBATING without mutating plan. |
| `campfire_speak_to_party` | `fireId`, `text`, `author`? | Post to campfire; blocked during duel (PENDING/ACTIVE). |
| `campfire_update_battle_plan` | `fireId`, `content` | Update BattlePlan; blocked during duel. |

`winner` in `campfire_deliver_verdict` is `"challenger"` or `"defender"`.

---

## Duel flow

- **throw_gauntlet:** Challenger declares duel against Defender with a thesis of attack. State → PENDING. `campfire_speak_to_party` and `campfire_update_battle_plan` are blocked.
- **take_oath_of_judgement:** A third agent (Judge), distinct from Challenger and Defender, takes the oath. State → ACTIVE. Turn goes to Challenger.
- **strike_argument:** Challenger presents technical evidence. Turn goes to Defender.
- **hold_the_line:** Defender argues or surrenders (`surrender: true`). Turn goes to Judge.
- **deliver_verdict:** Judge chooses winner and applies `required_plan_mutation` to the BattlePlan. State → DEBATING. Write is unblocked.
- **One duel per campfire.** No duel queue; the next duel requires declaring again.
- **Deadlock exit:** if the Judge never appears or the flow is cut, use `campfire_abandon_duel` or rely on external timeout; there is no automatic recovery.

---

## Limitations and trade-offs

- **In-memory persistence (Phase 1).** All state (campfires, messages, duel state, BattlePlan) is lost on server restart. The architecture allows external persistence in the future; no dates are promised.
- **Honor system for identities.** `character_name`, `challenger_name`, `target_name`, and `author` are not authenticated by tokens. If the same name attempts two roles (e.g. Challenger and Judge), the server rejects with an actionable message. Convention between agents, not cryptographic security.
- **One active duel per campfire.** No queue or duel history in this version.
- **Deadlock:** if the Judge never takes the oath or the flow is left mid-way, the only explicit exit is `campfire_abandon_duel`; there is no server-side timeout or auto-abandon.

---

## Error system

Per spec 2025-11-25, tool execution failures are returned **inside the result** with `isError: true`, not as a JSON-RPC error, so the LLM can read the message and self-correct.

- **Business/validation errors** → result with `isError: true` and actionable message in `content[].text`.
- **Protocol errors** (tool not found, malformed request) → JSON-RPC error.

Implementation: `src/errors.ts` (`toolErrorResult`, `ToolError`, `errorToToolResult`). The wrapper in `server.ts` converts exceptions to `ToolResult` with `isError: true`.

---

## Spec and dependencies

- **MCP:** [modelcontextprotocol.io/specification/2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- **Transport:** stdio (JSON-RPC over stdin/stdout).
- **SDK:** `@modelcontextprotocol/sdk`; Zod for tool `inputSchema`.

If the server is later integrated into the repo's orchestrator, tools will be invoked under the unified server key (e.g. `mcp-orchestrator`).
