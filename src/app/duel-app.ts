/**
 * Use cases for the Duel state machine.
 * Validates state, turn, and roles; delegates persistence to ports.
 */
import type { Duel } from "../domain/index.js";
import type {
  BattlePlanRepository,
  CampfireRepository,
  DuelStore,
} from "../ports/index.js";
import { ToolError } from "../errors.js";

const BLOCK_MESSAGE =
  "Silence. A duel has been declared. Waiting for an impartial Judge to take the oath.";

export interface DuelPorts {
  campfire: CampfireRepository;
  battlePlan: BattlePlanRepository;
  duelStore: DuelStore;
}

export class DuelApp {
  constructor(private readonly ports: DuelPorts) {}

  async isWriteLocked(fireId: string): Promise<boolean> {
    const duel = await this.ports.duelStore.getDuel(fireId);
    return duel !== null;
  }

  async getBlockMessage(): Promise<string> {
    return BLOCK_MESSAGE;
  }

  async throwGauntlet(
    fireId: string,
    invokerName: string,
    targetName: string,
    thesisOfAttack: string
  ): Promise<Duel> {
    await this.ports.campfire.getOrCreateFire(fireId);
    const existing = await this.ports.duelStore.getDuel(fireId);
    if (existing) {
      throw new ToolError(
        "A duel is already in progress. Resolve it (verdict or abandon_duel) before starting another."
      );
    }
    if (invokerName === targetName) {
      throw new ToolError(
        "Challenger and Defender must be distinct identities."
      );
    }
    const duel: Duel = {
      fireId,
      challengerName: invokerName,
      defenderName: targetName,
      judgeName: null,
      thesisOfAttack,
      currentTurn: "challenger",
      createdAt: new Date().toISOString(),
    };
    await this.ports.duelStore.saveDuel(fireId, duel);
    return duel;
  }

  async takeOathOfJudgement(
    fireId: string,
    characterName: string
  ): Promise<Duel> {
    const duel = await this.ports.duelStore.getDuel(fireId);
    if (!duel) {
      throw new ToolError(`No pending duel on fire '${fireId}'.`);
    }
    if (duel.judgeName !== null) {
      throw new ToolError("The tribunal is already complete. The duel is active.");
    }
    if (
      characterName === duel.challengerName ||
      characterName === duel.defenderName
    ) {
      throw new ToolError(
        `character_name '${characterName}' is already registered as ${characterName === duel.challengerName ? "Challenger" : "Defender"}. The Judge must be a third agent with a different name.`
      );
    }
    const updated: Duel = {
      ...duel,
      judgeName: characterName,
      currentTurn: "challenger",
    };
    await this.ports.duelStore.saveDuel(fireId, updated);
    return updated;
  }

  async strikeArgument(
    fireId: string,
    characterName: string,
    technicalEvidence: string
  ): Promise<Duel> {
    const duel = await this.ports.duelStore.getDuel(fireId);
    if (!duel || duel.judgeName === null) {
      throw new ToolError(
        "Duel is not active. Waiting for the Judge to take the oath."
      );
    }
    if (duel.currentTurn !== "challenger") {
      throw new ToolError(
        `Not your turn. Expected Challenger (${duel.challengerName}). Your role does not match the current turn.`
      );
    }
    if (characterName !== duel.challengerName) {
      throw new ToolError(
        `Only the Challenger (${duel.challengerName}) may use strike_argument this turn. You invoked as '${characterName}'.`
      );
    }
    const updated: Duel = { ...duel, currentTurn: "defender" };
    await this.ports.duelStore.saveDuel(fireId, updated);
    return updated;
  }

  async holdTheLine(
    fireId: string,
    characterName: string,
    defenseRationale: string,
    surrender: boolean
  ): Promise<Duel> {
    const duel = await this.ports.duelStore.getDuel(fireId);
    if (!duel || duel.judgeName === null) {
      throw new ToolError("Duel is not active.");
    }
    if (duel.currentTurn !== "defender") {
      throw new ToolError(
        `Not your turn. Expected Defender (${duel.defenderName}).`
      );
    }
    if (characterName !== duel.defenderName) {
      throw new ToolError(
        `Only the Defender (${duel.defenderName}) may use hold_the_line this turn. You invoked as '${characterName}'.`
      );
    }
    const updated: Duel = { ...duel, currentTurn: "judge" };
    await this.ports.duelStore.saveDuel(fireId, updated);
    return updated;
  }

  async deliverVerdict(
    fireId: string,
    characterName: string,
    winner: "challenger" | "defender",
    rulingRationale: string,
    requiredPlanMutation: string
  ): Promise<{ duel: Duel; planMutated: boolean }> {
    const duel = await this.ports.duelStore.getDuel(fireId);
    if (!duel || duel.judgeName === null) {
      throw new ToolError("Duel is not active.");
    }
    if (duel.currentTurn !== "judge") {
      throw new ToolError(
        `Not your turn. Expected Judge (${duel.judgeName}).`
      );
    }
    if (characterName !== duel.judgeName) {
      throw new ToolError(
        `Only the Judge (${duel.judgeName}) may use deliver_verdict. You invoked as '${characterName}'.`
      );
    }
    await this.ports.battlePlan.setBattlePlan(fireId, requiredPlanMutation);
    await this.ports.duelStore.clearDuel(fireId);
    return { duel, planMutated: true };
  }

  async abandonDuel(fireId: string): Promise<void> {
    const duel = await this.ports.duelStore.getDuel(fireId);
    if (!duel) {
      throw new ToolError(`No duel on fire '${fireId}' to abandon.`);
    }
    await this.ports.duelStore.clearDuel(fireId);
  }
}
