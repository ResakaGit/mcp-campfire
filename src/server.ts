import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { InMemoryCampfireRepository } from "./adapters/index.js";
import { CampfireApp } from "./app/campfire-app.js";
import { DuelApp } from "./app/duel-app.js";
import { errorToToolResult } from "./errors.js";
import {
  echoInputSchema,
  echoTool,
  type EchoInput,
  getOrCreateFireInputSchema,
  getOrCreateFireTool,
  type GetOrCreateFireInput,
  listMessagesInputSchema,
  listMessagesTool,
  type ListMessagesInput,
  pingInputSchema,
  pingTool,
  type PingInput,
  postMessageInputSchema,
  postMessageTool,
  type PostMessageInput,
} from "./tools.js";
import {
  abandonDuelInputSchema,
  abandonDuelTool,
  type AbandonDuelInput,
  deliverVerdictInputSchema,
  deliverVerdictTool,
  type DeliverVerdictInput,
  holdTheLineInputSchema,
  holdTheLineTool,
  type HoldTheLineInput,
  speakToPartyInputSchema,
  speakToPartyTool,
  type SpeakToPartyInput,
  strikeArgumentInputSchema,
  strikeArgumentTool,
  type StrikeArgumentInput,
  takeOathOfJudgementInputSchema,
  takeOathOfJudgementTool,
  type TakeOathOfJudgementInput,
  throwGauntletInputSchema,
  throwGauntletTool,
  type ThrowGauntletInput,
  updateBattlePlanInputSchema,
  updateBattlePlanTool,
  type UpdateBattlePlanInput,
} from "./tools-duel.js";

const DESCRIPTION_DOC = "TOOL_DESCRIPTION_CONVENTION.md";

function requireToolDescription(
  name: string,
  config: { description?: string; inputSchema: unknown }
): void {
  if (typeof config.description !== "string" || !config.description.trim()) {
    throw new Error(`Tool ${name}: description is required (${DESCRIPTION_DOC}).`);
  }
}

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
  function reg<T>(name: string, config: { description: string; inputSchema: unknown }, handler: (args: T) => unknown): void {
    requireToolDescription(name, config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.registerTool(name, config as Parameters<McpServer["registerTool"]>[1], handler as any);
  }
  reg<PingInput>(
    "campfire_ping",
    {
      description: "Health check for mcp-campfire server. Returns pong and timestamp. No args.",
      inputSchema: pingInputSchema,
    },
    wrapToolHandler(() => pingTool())
  );

  reg<EchoInput>(
    "campfire_echo",
    {
      description: "Returns the message sent. Args: message (required). Use to test connectivity.",
      inputSchema: echoInputSchema,
    },
    wrapToolHandler((args) => echoTool(args))
  );

  if (app) {
  reg<GetOrCreateFireInput>(
    "campfire_get_or_create_fire",
    {
      description:
        "Gets or creates a fire (planning session) by id. Args: fireId (required). Returns the fire as JSON. Use to start or join an agent debate session.",
      inputSchema: getOrCreateFireInputSchema,
    },
      wrapToolHandler((args) => getOrCreateFireTool(app, args))
    );

    reg<PostMessageInput>(
      "campfire_post_message",
      {
        description:
          "Posts a message to an existing fire. Args: fireId, text (required), author (optional). Returns the created message as JSON. Blocked during duel; use campfire_speak_to_party then (also blocked until duel ends).",
        inputSchema: postMessageInputSchema,
      },
      wrapToolHandler((args) => postMessageTool(app, args))
    );

    reg<ListMessagesInput>(
      "campfire_list_messages",
      {
        description:
          "Lists messages in a fire. Args: fireId (required). Returns an array of messages as JSON. Use so an agent can read debate history.",
        inputSchema: listMessagesInputSchema,
      },
      wrapToolHandler((args) => listMessagesTool(app, args))
    );
  }

  if (duelApp && app && setBattlePlan) {
    reg<ThrowGauntletInput>(
      "campfire_throw_gauntlet",
      {
        description:
          "Declares a duel: Challenger challenges Defender with a thesis. Args: fireId, challenger_name, target_name, thesis_of_attack (required). State → PENDING; blocks general write tools.",
        inputSchema: throwGauntletInputSchema,
      },
      wrapToolHandler((args) => throwGauntletTool(duelApp, args))
    );
    reg<TakeOathOfJudgementInput>(
      "campfire_take_oath_of_judgement",
      {
        description:
          "A third agent (Judge) takes the oath. Args: fireId, character_name (required; must differ from Challenger and Defender). Activates duel and gives turn to Challenger.",
        inputSchema: takeOathOfJudgementInputSchema,
      },
      wrapToolHandler((args) => takeOathOfJudgementTool(duelApp, args))
    );
    reg<StrikeArgumentInput>(
      "campfire_strike_argument",
      {
        description:
          "Challenger only, on their turn. Presents the technical attack. Args: fireId, character_name, technical_evidence (required). Yields turn to Defender.",
        inputSchema: strikeArgumentInputSchema,
      },
      wrapToolHandler((args) => strikeArgumentTool(duelApp, args))
    );
    reg<HoldTheLineInput>(
      "campfire_hold_the_line",
      {
        description:
          "Defender only, on their turn. Argues in defense or surrenders (surrender: true). Args: fireId, character_name, defense_rationale, surrender (required). Yields turn to Judge.",
        inputSchema: holdTheLineInputSchema,
      },
      wrapToolHandler((args) => holdTheLineTool(duelApp, args))
    );
    reg<DeliverVerdictInput>(
      "campfire_deliver_verdict",
      {
        description:
          "Judge only, on their turn. Args: fireId, character_name, winner ('challenger'|'defender'), ruling_rationale, required_plan_mutation (required). Applies mutation to BattlePlan and sets state to DEBATING.",
        inputSchema: deliverVerdictInputSchema,
      },
      wrapToolHandler((args) => deliverVerdictTool(duelApp, args))
    );
    reg<AbandonDuelInput>(
      "campfire_abandon_duel",
      {
        description:
          "Abandons the duel on the fire. Args: fireId (required). State → DEBATING without changing BattlePlan. Use to exit deadlock if Judge never appears.",
        inputSchema: abandonDuelInputSchema,
      },
      wrapToolHandler((args) => abandonDuelTool(duelApp, args))
    );
    reg<SpeakToPartyInput>(
      "campfire_speak_to_party",
      {
        description:
          "Posts a message to the fire. Args: fireId, text (required), author (optional). Blocked during duel (PENDING/ACTIVE); returns fixed message in that case.",
        inputSchema: speakToPartyInputSchema,
      },
      wrapToolHandler((args) => speakToPartyTool(app, duelApp, args))
    );
    reg<UpdateBattlePlanInput>(
      "campfire_update_battle_plan",
      {
        description:
          "Updates the fire's BattlePlan. Args: fireId, content (required). Blocked during duel (PENDING/ACTIVE); returns fixed message in that case.",
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
