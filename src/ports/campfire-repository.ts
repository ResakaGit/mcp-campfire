/**
 * Port for fire and message persistence.
 * Adapters (in-memory, Redis) implement this contract.
 */
import type { Fogata, Mensaje } from "../domain/index.js";

export interface CampfireRepository {
  getOrCreateFire(id: string): Promise<Fogata>;
  getFire(id: string): Promise<Fogata | null>;
  postMessage(
    fireId: string,
    payload: { text: string; author?: string }
  ): Promise<Mensaje>;
  listMessages(fireId: string): Promise<Mensaje[]>;
}
