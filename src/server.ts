import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { InMemoryCampfireRepository } from "./adapters/index.js";
import { CampfireApp } from "./app/campfire-app.js";
import { DuelApp } from "./app/duel-app.js";
import { errorToToolResult } from "./errors.js";
import {
  echoInputSchema,
  echoTool,
  getOrCreateFireInputSchema,
  getOrCreateFireTool,
  listMessagesInputSchema,
  listMessagesTool,
  pingInputSchema,
  pingTool,
  postMessageInputSchema,
  postMessageTool,
} from "./tools.js";
import {
  abandonDuelInputSchema,
  abandonDuelTool,
  deliverVerdictInputSchema,
  deliverVerdictTool,
  holdTheLineInputSchema,
  holdTheLineTool,
  speakToPartyInputSchema,
  speakToPartyTool,
  strikeArgumentInputSchema,
  strikeArgumentTool,
  takeOathOfJudgementInputSchema,
  takeOathOfJudgementTool,
  throwGauntletInputSchema,
  throwGauntletTool,
  updateBattlePlanInputSchema,
  updateBattlePlanTool,
} from "./tools-duel.js";

function wrapToolHandler<TArgs, TResult>(
  handler: (args: TArgs) => TResult | Promise<TResult>
) {
  return async (args: TArgs): Promise<TResult> => {
    try {
      return await handler(args);
    } catch (error) {
      return errorToToolResult(error) as TResult;
    }
  };
}

/**
 * Registers mcp-campfire tools on an existing McpServer.
 * If `app` is provided, campfire tools are also registered.
 * If `duelApp` (and app, setBattlePlan) are provided, duel tools and speak_to_party/update_battle_plan (with lock) are registered.
 */
export function registerCampfireTools(
  server: McpServer,
  app?: CampfireApp,
  duelApp?: DuelApp,
  setBattlePlan?: (fireId: string, content: string) => Promise<void>
): void {
  server.registerTool(
    "campfire_ping",
    {
      description: "Health check del servidor mcp-campfire. Devuelve pong y timestamp.",
      inputSchema: pingInputSchema,
    },
    wrapToolHandler(() => pingTool())
  );

  server.registerTool(
    "campfire_echo",
    {
      description: "Devuelve el mensaje recibido. Parámetro: message (requerido). Útil para probar conectividad.",
      inputSchema: echoInputSchema,
    },
    wrapToolHandler((args) => echoTool(args))
  );

  if (app) {
  server.registerTool(
    "campfire_get_or_create_fire",
    {
      description:
        "Obtiene o crea una fogata (sesión de planificación) por id. Parámetro: fireId. Devuelve la fogata en JSON. Usar para iniciar o unirse a una sesión de debate entre agentes.",
      inputSchema: getOrCreateFireInputSchema,
    },
      wrapToolHandler((args) => getOrCreateFireTool(app, args))
    );

    server.registerTool(
      "campfire_post_message",
      {
        description:
          "Publica un mensaje en una fogata existente. Parámetros: fireId, text, author (opcional). Devuelve el mensaje creado en JSON. Bloqueado durante duelo (usar campfire_speak_to_party está bloqueado entonces).",
        inputSchema: postMessageInputSchema,
      },
      wrapToolHandler((args) => postMessageTool(app, args))
    );

    server.registerTool(
      "campfire_list_messages",
      {
        description:
          "Lista los mensajes de una fogata. Parámetro: fireId. Devuelve un array de mensajes en JSON. Útil para que un agente lea el historial del debate.",
        inputSchema: listMessagesInputSchema,
      },
      wrapToolHandler((args) => listMessagesTool(app, args))
    );
  }

  if (duelApp && app && setBattlePlan) {
    server.registerTool(
      "campfire_throw_gauntlet",
      {
        description:
          "Declara un duelo: el Challenger (challenger_name) reta al Defender (target_name) con una tesis. Parámetros: fireId, challenger_name, target_name, thesis_of_attack. Estado → PENDING; bloquea escritura general.",
        inputSchema: throwGauntletInputSchema,
      },
      wrapToolHandler((args) => throwGauntletTool(duelApp, args))
    );
    server.registerTool(
      "campfire_take_oath_of_judgement",
      {
        description:
          "Un tercer agente (Juez) presta juramento. Parámetros: fireId, character_name (distinto de Challenger y Defender). Activa el duelo y cede el turno al Challenger.",
        inputSchema: takeOathOfJudgementInputSchema,
      },
      wrapToolHandler((args) => takeOathOfJudgementTool(duelApp, args))
    );
    server.registerTool(
      "campfire_strike_argument",
      {
        description:
          "Solo el Challenger, en su turno. Presenta el ataque técnico. Parámetros: fireId, character_name, technical_evidence. Cede el turno al Defender.",
        inputSchema: strikeArgumentInputSchema,
      },
      wrapToolHandler((args) => strikeArgumentTool(duelApp, args))
    );
    server.registerTool(
      "campfire_hold_the_line",
      {
        description:
          "Solo el Defender, en su turno. Argumenta en defensa o se rinde (surrender: true). Parámetros: fireId, character_name, defense_rationale, surrender. Cede el turno al Juez.",
        inputSchema: holdTheLineInputSchema,
      },
      wrapToolHandler((args) => holdTheLineTool(duelApp, args))
    );
    server.registerTool(
      "campfire_deliver_verdict",
      {
        description:
          "Solo el Juez, en su turno. Parámetros: fireId, character_name, winner ('challenger'|'defender'), ruling_rationale, required_plan_mutation. Aplica la mutación al BattlePlan y vuelve el estado a DEBATING.",
        inputSchema: deliverVerdictInputSchema,
      },
      wrapToolHandler((args) => deliverVerdictTool(duelApp, args))
    );
    server.registerTool(
      "campfire_abandon_duel",
      {
        description:
          "Abandona el duelo en la fogata. Parámetro: fireId. Vuelve el estado a DEBATING sin modificar el BattlePlan. Salida de deadlock si el Juez no aparece.",
        inputSchema: abandonDuelInputSchema,
      },
      wrapToolHandler((args) => abandonDuelTool(duelApp, args))
    );
    server.registerTool(
      "campfire_speak_to_party",
      {
        description:
          "Publica un mensaje en la fogata. Parámetros: fireId, text, author (opcional). Bloqueado durante duelo (PENDING/ACTIVE); devuelve mensaje fijo en ese caso.",
        inputSchema: speakToPartyInputSchema,
      },
      wrapToolHandler((args) => speakToPartyTool(app, duelApp, args))
    );
    server.registerTool(
      "campfire_update_battle_plan",
      {
        description:
          "Actualiza el BattlePlan de la fogata. Parámetros: fireId, content. Bloqueado durante duelo (PENDING/ACTIVE); devuelve mensaje fijo en ese caso.",
        inputSchema: updateBattlePlanInputSchema,
      },
      wrapToolHandler((args) =>
        updateBattlePlanTool(duelApp, setBattlePlan, args)
      )
    );
  }
}

/** Module descriptor for the orchestrator to import and register. */
export const campfireMcpModule = {
  name: "mcp-campfire",
  version: "1.0.0",
  register: registerCampfireTools,
};

export async function startServer(): Promise<void> {
  const server = new McpServer(
    { name: campfireMcpModule.name, version: campfireMcpModule.version },
    { capabilities: { tools: { listChanged: false } } }
  );

  const repository = new InMemoryCampfireRepository();
  const app = new CampfireApp(repository);
  const duelPorts = {
    campfire: repository,
    battlePlan: repository,
    duelStore: repository,
  };
  const duelApp = new DuelApp(duelPorts);
  const setBattlePlan = (fireId: string, content: string) =>
    repository.setBattlePlan(fireId, content);

  registerCampfireTools(server, app, duelApp, setBattlePlan);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
