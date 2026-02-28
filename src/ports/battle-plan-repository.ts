/**
 * Port for BattlePlan persistence (one document per fire).
 */
export interface BattlePlanRepository {
  getBattlePlan(fireId: string): Promise<string | null>;
  setBattlePlan(fireId: string, content: string): Promise<void>;
}
