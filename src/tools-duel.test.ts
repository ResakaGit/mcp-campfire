/**
 * E2E tests for the Duel state machine.
 * Criteria: TASK_LIST_BUILDERS_DUELO §3 (Erudito E2E validation).
 */
import { describe, it, expect } from "vitest";
import { InMemoryCampfireRepository } from "./adapters/index.js";
import { CampfireApp } from "./app/campfire-app.js";
import { DuelApp } from "./app/duel-app.js";
import {
  throwGauntletTool,
  takeOathOfJudgementTool,
  strikeArgumentTool,
  holdTheLineTool,
  deliverVerdictTool,
  abandonDuelTool,
  speakToPartyTool,
  updateBattlePlanTool,
} from "./tools-duel.js";

const FIRE_ID = "e2e-fire-1";

function makeDeps() {
  const repo = new InMemoryCampfireRepository();
  const campfireApp = new CampfireApp(repo);
  const duelApp = new DuelApp({
    campfire: repo,
    battlePlan: repo,
    duelStore: repo,
  });
  const setBattlePlan = (fireId: string, content: string) =>
    repo.setBattlePlan(fireId, content);
  return { repo, campfireApp, duelApp, setBattlePlan };
}

const BLOCK_MESSAGE =
  "Silence. A duel has been declared. Waiting for an impartial Judge to take the oath.";

describe("Duel E2E", () => {
  describe("Full flow: throw_gauntlet → take_oath → strike → hold_the_line → deliver_verdict", () => {
    it("ends in DEBATING with BattlePlan updated and no active duel", async () => {
      const { repo, campfireApp, duelApp, setBattlePlan } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await setBattlePlan(FIRE_ID, "Initial plan.");

      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "Challenger",
        target_name: "Defender",
        thesis_of_attack: "Coupling violation.",
      });

      await takeOathOfJudgementTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Judge",
      });

      await strikeArgumentTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Challenger",
        technical_evidence: "The proposal couples UI layer with domain.",
      });

      await holdTheLineTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Defender",
        defense_rationale: "Trade-off accepted for latency.",
        surrender: false,
      });

      const verdictResult = await deliverVerdictTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Judge",
        winner: "challenger",
        ruling_rationale: "The attack is valid.",
        required_plan_mutation: "Plan mutated by the Judge.",
      });

      expect(verdictResult.isError).toBeFalsy();
      expect(verdictResult.content[0].text).toContain("DEBATING");
      expect(verdictResult.content[0].text).toContain("planMutated");

      const plan = await repo.getBattlePlan(FIRE_ID);
      expect(plan).toBe("Plan mutated by the Judge.");

      const duel = await repo.getDuel(FIRE_ID);
      expect(duel).toBeNull();
    });
  });

  describe("Blocks in PENDING and ACTIVE", () => {
    it("speak_to_party returns fixed message when duel is PENDING", async () => {
      const { repo, campfireApp, duelApp } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "A",
        target_name: "B",
        thesis_of_attack: "Thesis.",
      });

      const result = await speakToPartyTool(campfireApp, duelApp, {
        fireId: FIRE_ID,
        text: "Hello",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(BLOCK_MESSAGE);
    });

    it("update_battle_plan returns fixed message when duel is ACTIVE", async () => {
      const { repo, campfireApp, duelApp, setBattlePlan } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "A",
        target_name: "B",
        thesis_of_attack: "Thesis.",
      });
      await takeOathOfJudgementTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Judge",
      });

      const result = await updateBattlePlanTool(duelApp, setBattlePlan, {
        fireId: FIRE_ID,
        content: "Try to write.",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(BLOCK_MESSAGE);
    });
  });

  describe("Turns: reject when not the current turn", () => {
    it("strike_argument on Defender turn throws with turn message", async () => {
      const { repo, duelApp } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "Challenger",
        target_name: "Defender",
        thesis_of_attack: "Thesis.",
      });
      await takeOathOfJudgementTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Judge",
      });
      await strikeArgumentTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Challenger",
        technical_evidence: "Evidence.",
      });

      await expect(
        strikeArgumentTool(duelApp, {
          fireId: FIRE_ID,
          character_name: "Defender",
          technical_evidence: "Not my turn.",
        })
      ).rejects.toThrow(/Not your turn|Challenger/);
    });

    it("hold_the_line on Challenger turn throws with turn message", async () => {
      const { repo, duelApp } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "Challenger",
        target_name: "Defender",
        thesis_of_attack: "Thesis.",
      });
      await takeOathOfJudgementTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "Judge",
      });

      await expect(
        holdTheLineTool(duelApp, {
          fireId: FIRE_ID,
          character_name: "Challenger",
          defense_rationale: "Not my turn.",
          surrender: false,
        })
      ).rejects.toThrow(/Not your turn|Defender/);
    });
  });

  describe("Three identities: Judge must differ from Challenger and Defender", () => {
    it("take_oath with character_name same as Challenger throws with actionable message", async () => {
      const { repo, duelApp } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "Alice",
        target_name: "Bob",
        thesis_of_attack: "Thesis.",
      });

      await expect(
        takeOathOfJudgementTool(duelApp, {
          fireId: FIRE_ID,
          character_name: "Alice",
        })
      ).rejects.toThrow(/Alice|Challenger|third agent/i);
    });

    it("take_oath with character_name same as Defender throws", async () => {
      const { repo, duelApp } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "Alice",
        target_name: "Bob",
        thesis_of_attack: "Thesis.",
      });

      await expect(
        takeOathOfJudgementTool(duelApp, {
          fireId: FIRE_ID,
          character_name: "Bob",
        })
      ).rejects.toThrow(/Bob|Defender|third agent/i);
    });
  });

  describe("abandon_duel", () => {
    it("in PENDING leads to DEBATING without mutating BattlePlan; speak_to_party and update_battle_plan work after", async () => {
      const { repo, campfireApp, duelApp, setBattlePlan } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await setBattlePlan(FIRE_ID, "Original plan.");
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "A",
        target_name: "B",
        thesis_of_attack: "Thesis.",
      });

      await abandonDuelTool(duelApp, { fireId: FIRE_ID });

      expect(await repo.getDuel(FIRE_ID)).toBeNull();
      expect(await repo.getBattlePlan(FIRE_ID)).toBe("Original plan.");

      const speakResult = await speakToPartyTool(campfireApp, duelApp, {
        fireId: FIRE_ID,
        text: "After abandon.",
      });
      expect(speakResult.isError).toBeFalsy();

      const updateResult = await updateBattlePlanTool(duelApp, setBattlePlan, {
        fireId: FIRE_ID,
        content: "Plan after abandon.",
      });
      expect(updateResult.isError).toBeFalsy();
      expect(await repo.getBattlePlan(FIRE_ID)).toBe("Plan after abandon.");
    });
  });

  describe("Verdict applied to BattlePlan", () => {
    it("deliver_verdict with winner defender applies required_plan_mutation to BattlePlan", async () => {
      const { repo, duelApp, setBattlePlan } = makeDeps();
      await repo.getOrCreateFire(FIRE_ID);
      await setBattlePlan(FIRE_ID, "Initial.");
      await throwGauntletTool(duelApp, {
        fireId: FIRE_ID,
        challenger_name: "R",
        target_name: "D",
        thesis_of_attack: "T.",
      });
      await takeOathOfJudgementTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "J",
      });
      await strikeArgumentTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "R",
        technical_evidence: "E.",
      });
      await holdTheLineTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "D",
        defense_rationale: "No.",
        surrender: false,
      });

      const result = await deliverVerdictTool(duelApp, {
        fireId: FIRE_ID,
        character_name: "J",
        winner: "defender",
        ruling_rationale: "Ruling in favor of Defender.",
        required_plan_mutation: "Mutation by Judge.",
      });
      expect(result.isError).toBeFalsy();
      expect(await repo.getBattlePlan(FIRE_ID)).toBe("Mutation by Judge.");
    });
  });
});
