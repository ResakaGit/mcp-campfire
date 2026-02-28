/**
 * Port for Duel state persistence (one duel per fire).
 */
import type { Duel } from "../domain/index.js";

export interface DuelStore {
  getDuel(fireId: string): Promise<Duel | null>;
  saveDuel(fireId: string, duel: Duel): Promise<void>;
  clearDuel(fireId: string): Promise<void>;
}
