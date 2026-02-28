/**
 * Domain types for the Duel state machine.
 * No MCP, ToolResult, or infrastructure dependencies.
 */

/** Duel session state for a fire. */
export type DuelState = "DEBATING" | "HONORABLE_DUEL_PENDING" | "DUEL_ACTIVE";

/** Role in the duel. */
export type DuelRole = "challenger" | "defender" | "judge";

/** Duel instance for a fire (one per fireId). */
export type Duel = {
  fireId: string;
  challengerName: string;
  defenderName: string;
  judgeName: string | null;
  thesisOfAttack: string;
  currentTurn: DuelRole;
  createdAt?: string;
};

/** BattlePlan: document per fire (text content). */
export type BattlePlanContent = string;
