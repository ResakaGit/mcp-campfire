import { z } from "zod";
import { toolErrorResult, type ToolResult } from "./errors.js";
import type { CampfireApp } from "./app/campfire-app.js";
import type { DuelApp } from "./app/duel-app.js";

const BLOCK_MESSAGE =
  "Silence. A duel has been declared. Waiting for an impartial Judge to take the oath.";

/** throw_gauntlet: declare duel, set state to PENDING */
export const throwGauntletInputSchema = z
  .object({
    fireId: z.string().describe("Fire id where the duel is declared"),
    challenger_name: z.string().describe("Challenger name (who invokes the duel)"),
    target_name: z.string().describe("Defender name (author of the challenged idea)"),
    thesis_of_attack: z.string().describe("Thesis of the attack: which principle the proposal violates"),
  })
  .strict();

export type ThrowGauntletInput = z.infer<typeof throwGauntletInputSchema>;

export async function throwGauntletTool(
  duelApp: DuelApp,
  args: ThrowGauntletInput
): Promise<ToolResult> {
  const duel = await duelApp.throwGauntlet(
    args.fireId,
    args.challenger_name,
    args.target_name,
    args.thesis_of_attack
  );
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ duel, message: "Duel declared. Waiting for the Judge to take the oath." }, null, 2),
      },
    ],
  };
}

/** take_oath_of_judgement: Judge (third agent) subscribes; activates duel */
export const takeOathOfJudgementInputSchema = z
  .object({
    fireId: z.string().describe("Fire id of the duel"),
    character_name: z.string().describe("Name of the agent taking the Judge role"),
  })
  .strict();

export type TakeOathOfJudgementInput = z.infer<typeof takeOathOfJudgementInputSchema>;

export async function takeOathOfJudgementTool(
  duelApp: DuelApp,
  args: TakeOathOfJudgementInput
): Promise<ToolResult> {
  await duelApp.takeOathOfJudgement(args.fireId, args.character_name);
  return {
    content: [
      { type: "text", text: "The tribunal is complete. Let the duel begin." },
    ],
  };
}

/** strike_argument: Challenger presents technical attack */
export const strikeArgumentInputSchema = z
  .object({
    fireId: z.string().describe("Fire id of the duel"),
    character_name: z.string().describe("Challenger name"),
    technical_evidence: z.string().describe("Technical evidence of the attack"),
  })
  .strict();

export async function strikeArgumentTool(
  duelApp: DuelApp,
  args: z.infer<typeof strikeArgumentInputSchema>
): Promise<ToolResult> {
  const duel = await duelApp.strikeArgument(
    args.fireId,
    args.character_name,
    args.technical_evidence
  );
  return { content: [{ type: "text", text: JSON.stringify(duel, null, 2) }] };
}

/** hold_the_line: Defender argues or surrenders */
export const holdTheLineInputSchema = z
  .object({
    fireId: z.string().describe("Fire id of the duel"),
    character_name: z.string().describe("Defender name"),
    defense_rationale: z.string().describe("Defense argument"),
    surrender: z.boolean().describe("True if the Defender surrenders to the evidence"),
  })
  .strict();

export async function holdTheLineTool(
  duelApp: DuelApp,
  args: z.infer<typeof holdTheLineInputSchema>
): Promise<ToolResult> {
  const duel = await duelApp.holdTheLine(
    args.fireId,
    args.character_name,
    args.defense_rationale,
    args.surrender
  );
  return { content: [{ type: "text", text: JSON.stringify(duel, null, 2) }] };
}

/** deliver_verdict: Judge rules and applies mutation to BattlePlan */
export const deliverVerdictInputSchema = z
  .object({
    fireId: z.string().describe("Fire id of the duel"),
    character_name: z.string().describe("Judge name"),
    winner: z.enum(["challenger", "defender"]).describe("Duel winner"),
    ruling_rationale: z.string().describe("Rationale for the ruling"),
    required_plan_mutation: z.string().describe("Mutation to apply to the master BattlePlan"),
  })
  .strict();

export async function deliverVerdictTool(
  duelApp: DuelApp,
  args: z.infer<typeof deliverVerdictInputSchema>
): Promise<ToolResult> {
  const result = await duelApp.deliverVerdict(
    args.fireId,
    args.character_name,
    args.winner,
    args.ruling_rationale,
    args.required_plan_mutation
  );
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "Verdict delivered. State reverted to DEBATING.",
            winner: args.winner,
            planMutated: result.planMutated,
          },
          null,
          2
        ),
      },
    ],
  };
}

/** abandon_duel: exit duel without verdict; state to DEBATING */
export const abandonDuelInputSchema = z
  .object({
    fireId: z.string().describe("Fire id of the duel to abandon"),
  })
  .strict();

export async function abandonDuelTool(
  duelApp: DuelApp,
  args: z.infer<typeof abandonDuelInputSchema>
): Promise<ToolResult> {
  await duelApp.abandonDuel(args.fireId);
  return {
    content: [
      {
        type: "text",
        text: "Duel abandoned. State reverted to DEBATING. No BattlePlan mutation.",
      },
    ],
  };
}

/** speak_to_party: post to fire; blocked when duel is PENDING/ACTIVE */
export const speakToPartyInputSchema = z
  .object({
    fireId: z.string().describe("Fire id"),
    text: z.string().describe("Message to post"),
    author: z.string().optional().describe("Message author"),
  })
  .strict();

export async function speakToPartyTool(
  campfireApp: CampfireApp,
  duelApp: DuelApp,
  args: z.infer<typeof speakToPartyInputSchema>
): Promise<ToolResult> {
  const locked = await duelApp.isWriteLocked(args.fireId);
  if (locked) {
    return toolErrorResult(BLOCK_MESSAGE);
  }
  const msg = await campfireApp.postMessage(
    args.fireId,
    args.text,
    args.author
  );
  return { content: [{ type: "text", text: JSON.stringify(msg, null, 2) }] };
}

/** update_battle_plan: set BattlePlan content; blocked when duel is PENDING/ACTIVE */
export const updateBattlePlanInputSchema = z
  .object({
    fireId: z.string().describe("Fire id"),
    content: z.string().describe("New BattlePlan content"),
  })
  .strict();

export async function updateBattlePlanTool(
  duelApp: DuelApp,
  battlePlanSet: (fireId: string, content: string) => Promise<void>,
  args: z.infer<typeof updateBattlePlanInputSchema>
): Promise<ToolResult> {
  const locked = await duelApp.isWriteLocked(args.fireId);
  if (locked) {
    return toolErrorResult(BLOCK_MESSAGE);
  }
  await battlePlanSet(args.fireId, args.content);
  return {
    content: [
      { type: "text", text: "BattlePlan updated successfully." },
    ],
  };
}
