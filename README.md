# mcp-campfire

Servidor MCP para planificación colaborativa entre agentes: fogatas, mensajes, BattlePlan compartido y protocolo ceremonial de Duelo con resolución ejecutable.

---

Cuando varios agentes debaten en Cursor, el consenso puede quedar en loop. **mcp-campfire** aporta un bounded context claro: sesiones de fogata donde se discute, y un Duelo con máquina de estados (Retador vs Defensor, Juez decide) que corta debates infinitos y produce un fallo aplicable al plan. No es oráculo ni magia: es contrato. Lo que sigue es la realidad del producto, sin ocultar límites.

---

## Qué es y para quién

**mcp-campfire** es un servidor MCP (spec 2025-11-25) que expone:

- **Fogatas (fires):** sesiones de planificación identificadas por `fireId`.
- **Mensajes:** publicar y listar mensajes por fogata.
- **BattlePlan:** contenido compartido por fogata; actualizable cuando no hay duelo activo.
- **Duelo:** protocolo ceremonial en el que un Retador desafía a un Defensor; un tercer agente (Juez) toma juramento, escucha argumentos y entrega veredicto con mutación obligatoria al BattlePlan.

**Audiencia:** devs que orquestan múltiples agentes en Cursor y quieren resolución ejecutable en lugar de debates abiertos. Compatible con Cursor 2026 y clientes MCP que usen spec 2025-11-25.

---

## Quick start

```bash
cd mcp-campfire
npm install
npm run build
npm start
```

El servidor usa transporte **stdio**: lee JSON-RPC por stdin y escribe por stdout. Cursor lo arranca al conectar el MCP.

**Registro en Cursor:** en `.cursor/mcp.json` (raíz del workspace):

```json
"mcp-campfire": {
  "command": "node",
  "args": ["mcp-campfire/dist/index.js"]
}
```

Requisitos: workspace con raíz en el repo que contiene `mcp-campfire`, `npm run build` ejecutado, **reiniciar Cursor** tras cambiar `mcp.json`.

- **Desarrollo:** `npm run dev` (tsx en watch).
- **Tests:** `npm test` (Vitest).

---

## Tabla de tools

| Tool | Parámetros clave | Propósito |
|------|------------------|-----------|
| `campfire_ping` | — | Health check; devuelve pong y timestamp. |
| `campfire_echo` | `message` | Prueba de conectividad; devuelve el mensaje. |
| `campfire_get_or_create_fire` | `fireId` | Obtiene o crea una fogata (sesión). |
| `campfire_post_message` | `fireId`, `text`, `author`? | Publica mensaje en fogata (sin duelo). |
| `campfire_list_messages` | `fireId` | Lista mensajes de la fogata. |
| `campfire_throw_gauntlet` | `fireId`, `challenger_name`, `target_name`, `thesis_of_attack` | Declara duelo; estado PENDING; bloquea escritura general. |
| `campfire_take_oath_of_judgement` | `fireId`, `character_name` | Juez (tercer agente) toma juramento; activa duelo. |
| `campfire_strike_argument` | `fireId`, `character_name`, `technical_evidence` | Retador: ataque técnico. |
| `campfire_hold_the_line` | `fireId`, `character_name`, `defense_rationale`, `surrender` | Defensor: defensa o rendición. |
| `campfire_deliver_verdict` | `fireId`, `character_name`, `winner`, `ruling_rationale`, `required_plan_mutation` | Juez: fallo y mutación al BattlePlan. |
| `campfire_abandon_duel` | `fireId` | Abandona duelo; vuelve a DEBATING sin mutar plan. |
| `campfire_speak_to_party` | `fireId`, `text`, `author`? | Publicar en fogata; bloqueada durante duelo (PENDING/ACTIVE). |
| `campfire_update_battle_plan` | `fireId`, `content` | Actualizar BattlePlan; bloqueada durante duelo. |

`winner` en `campfire_deliver_verdict` es `"challenger"` o `"defender"`.

---

## Flujo del Duelo

- **throw_gauntlet:** Retador declara duelo contra Defensor con una tesis de ataque. Estado → PENDING. Se bloquean `campfire_speak_to_party` y `campfire_update_battle_plan`.
- **take_oath_of_judgement:** Un tercer agente (Juez) distinto de Retador y Defensor toma juramento. Estado → ACTIVE. Turno al Retador.
- **strike_argument:** Retador presenta evidencia técnica. Turno al Defensor.
- **hold_the_line:** Defensor argumenta o se rinde (`surrender: true`). Turno al Juez.
- **deliver_verdict:** Juez elige ganador y aplica `required_plan_mutation` al BattlePlan. Estado → DEBATING. Desbloqueo de escritura.
- **Un duelo por fogata.** No hay cola de duelos; el siguiente duelo requiere declarar de nuevo.
- **Salida de deadlock:** si el Juez nunca aparece o el flujo se corta, usar `campfire_abandon_duel` o depender de timeout externo; no hay recuperación automática.

---

## Limitaciones y trade-offs

- **Persistencia en memoria (Fase 1).** Todo el estado (fogatas, mensajes, duelos, BattlePlan) se pierde al reiniciar el servidor. La arquitectura permite persistencia externa en el futuro; no se prometen fechas.
- **Honor system en identidades.** `character_name`, `challenger_name`, `target_name` y `author` no están autenticados por tokens. Si un mismo nombre intenta dos roles (p. ej. Retador y Juez), el servidor rechaza con mensaje accionable. Convención entre agentes, no seguridad criptográfica.
- **Un duelo activo por fogata.** No hay cola ni historial de duelos en esta versión.
- **Deadlock:** si el Juez no toma juramento o el flujo queda a medias, la única salida explícita es `campfire_abandon_duel`; no hay timeout ni auto-abandono en el servidor.

---

## Sistema de errores

Según spec 2025-11-25, los fallos de ejecución de una tool se devuelven **dentro del resultado** con `isError: true`, no como error JSON-RPC, para que el LLM pueda leer el mensaje y corregirse.

- **Errores de negocio/validación** → resultado con `isError: true` y mensaje accionable en `content[].text`.
- **Errores de protocolo** (tool no encontrada, request mal formado) → error JSON-RPC.

Implementación: `src/errors.ts` (`toolErrorResult`, `ToolError`, `errorToToolResult`). El wrapper en `server.ts` convierte excepciones en `ToolResult` con `isError: true`.

---

## Spec y dependencias

- **MCP:** [modelcontextprotocol.io/specification/2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- **Transporte:** stdio (JSON-RPC por stdin/stdout).
- **SDK:** `@modelcontextprotocol/sdk`; Zod para `inputSchema` de las tools.

Si más adelante el servidor se integra al orchestrator del repo, las tools se invocarán bajo el key del servidor unificado (p. ej. `mcp-orchestrator`).
