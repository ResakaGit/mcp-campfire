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
      description: "Devuelve el mensaje recibido (útil para probar conectividad).",
      inputSchema: echoInputSchema,
    },
    wrapToolHandler((args) => echoTool(args))
  );

  if (app) {
  server.registerTool(
    "campfire_get_or_create_fire",
    {
      description:
        "Gets or creates a fire (planning session) by id. Returns the fire as JSON.",
      inputSchema: getOrCreateFireInputSchema,
    },
      wrapToolHandler((args) => getOrCreateFireTool(app, args))
    );

    server.registerTool(
      "campfire_post_message",
      {
        description:
          "Posts a message to an existing fire. Requires fireId and text; author optional. Returns the created message as JSON.",
        inputSchema: postMessageInputSchema,
      },
      wrapToolHandler((args) => postMessageTool(app, args))
    );

    server.registerTool(
      "campfire_list_messages",
      {
        description:
          "Lists messages of a fire by fireId. Returns array of messages as JSON.",
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
          "Declares a duel: Challenger (challenger_name) challenges Defender (target_name) with a thesis. Sets state to PENDING and locks general write tools.",
        inputSchema: throwGauntletInputSchema,
      },
      wrapToolHandler((args) => throwGauntletTool(duelApp, args))
    );
    server.registerTool(
      "campfire_take_oath_of_judgement",
      {
        description:
          "Third agent (Judge) takes the oath. character_name must differ from Challenger and Defender. Activates the duel and gives turn to Challenger.",
        inputSchema: takeOathOfJudgementInputSchema,
      },
      wrapToolHandler((args) => takeOathOfJudgementTool(duelApp, args))
    );
    server.registerTool(
      "campfire_strike_argument",
      {
        description:
          "Challenger only, on their turn. Presents the technical attack. Yields turn to Defender.",
        inputSchema: strikeArgumentInputSchema,
      },
      wrapToolHandler((args) => strikeArgumentTool(duelApp, args))
    );
    server.registerTool(
      "campfire_hold_the_line",
      {
        description:
          "Defender only, on their turn. Argues in defense or surrenders (surrender: true). Yields turn to Judge.",
        inputSchema: holdTheLineInputSchema,
      },
      wrapToolHandler((args) => holdTheLineTool(duelApp, args))
    );
    server.registerTool(
      "campfire_deliver_verdict",
      {
        description:
          "Judge only, on their turn. winner: 'challenger' or 'defender'. Applies required_plan_mutation to BattlePlan and reverts state to DEBATING.",
        inputSchema: deliverVerdictInputSchema,
      },
      wrapToolHandler((args) => deliverVerdictTool(duelApp, args))
    );
    server.registerTool(
      "campfire_abandon_duel",
      {
        description:
          "Abandons the duel on the fire. Reverts state to DEBATING without mutating BattlePlan. Deadlock exit if Judge never appears.",
        inputSchema: abandonDuelInputSchema,
      },
      wrapToolHandler((args) => abandonDuelTool(duelApp, args))
    );
    server.registerTool(
      "campfire_speak_to_party",
      {
        description:
          "Posts a message to the fire. Blocked during duel (PENDING/ACTIVE); returns fixed message.",
        inputSchema: speakToPartyInputSchema,
      },
      wrapToolHandler((args) => speakToPartyTool(app, duelApp, args))
    );
    server.registerTool(
      "campfire_update_battle_plan",
      {
        description:
          "Updates the fire's BattlePlan. Blocked during duel (PENDING/ACTIVE); returns fixed message.",
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
