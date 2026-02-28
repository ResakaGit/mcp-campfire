/**
 * In-memory persistence adapter (Phase 1).
 * Implements CampfireRepository, BattlePlanRepository, and DuelStore.
 */
import type { Duel, Fogata, Mensaje } from "../domain/index.js";
import type {
  BattlePlanRepository,
  CampfireRepository,
  DuelStore,
} from "../ports/index.js";

interface FireState {
  fire: Fogata;
  messages: Mensaje[];
  battlePlan?: string;
  duel?: Duel | null;
}

export class InMemoryCampfireRepository
  implements CampfireRepository, BattlePlanRepository, DuelStore
{
  private readonly store = new Map<string, FireState>();

  private ensureFireState(id: string): FireState {
    let state = this.store.get(id);
    if (!state) {
      const fire: Fogata = { id, createdAt: new Date().toISOString() };
      state = { fire, messages: [] };
      this.store.set(id, state);
    }
    return state;
  }

  async getOrCreateFire(id: string): Promise<Fogata> {
    return this.ensureFireState(id).fire;
  }

  async getFire(id: string): Promise<Fogata | null> {
    const state = this.store.get(id);
    return state ? state.fire : null;
  }

  async postMessage(
    fireId: string,
    payload: { text: string; author?: string }
  ): Promise<Mensaje> {
    const state = this.store.get(fireId);
    if (!state) {
      throw new Error(`Fire with id '${fireId}' does not exist.`);
    }
    const msg: Mensaje = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      fireId,
      text: payload.text,
      author: payload.author,
      createdAt: new Date().toISOString(),
    };
    state.messages.push(msg);
    return msg;
  }

  async listMessages(fireId: string): Promise<Mensaje[]> {
    const state = this.store.get(fireId);
    if (!state) return [];
    return [...state.messages].sort(
      (a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
    );
  }

  // --- BattlePlanRepository ---

  async getBattlePlan(fireId: string): Promise<string | null> {
    const state = this.store.get(fireId);
    return state?.battlePlan ?? null;
  }

  async setBattlePlan(fireId: string, content: string): Promise<void> {
    const state = this.ensureFireState(fireId);
    state.battlePlan = content;
  }

  // --- DuelStore ---

  async getDuel(fireId: string): Promise<Duel | null> {
    const state = this.store.get(fireId);
    return state?.duel ?? null;
  }

  async saveDuel(fireId: string, duel: Duel): Promise<void> {
    const state = this.ensureFireState(fireId);
    state.duel = duel;
  }

  async clearDuel(fireId: string): Promise<void> {
    const state = this.store.get(fireId);
    if (state) state.duel = null;
  }
}
