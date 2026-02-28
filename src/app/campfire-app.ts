/**
 * Use cases: orchestration and business validation.
 * Delegates persistence to the port; business errors as ToolError (converted to ToolResult in MCP layer).
 */
import type { Fogata, Mensaje } from "../domain/index.js";
import type { CampfireRepository } from "../ports/index.js";
import { ToolError } from "../errors.js";

export class CampfireApp {
  constructor(private readonly repository: CampfireRepository) {}

  async getOrCreateFire(id: string): Promise<Fogata> {
    return this.repository.getOrCreateFire(id);
  }

  async postMessage(
    fireId: string,
    text: string,
    author?: string
  ): Promise<Mensaje> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new ToolError("message cannot be empty.");
    }
    const fire = await this.repository.getFire(fireId);
    if (!fire) {
      throw new ToolError(`Fire with id '${fireId}' does not exist.`);
    }
    return this.repository.postMessage(fireId, { text: trimmed, author });
  }

  async listMessages(fireId: string): Promise<Mensaje[]> {
    const fire = await this.repository.getFire(fireId);
    if (!fire) {
      throw new ToolError(`Fire with id '${fireId}' does not exist.`);
    }
    return this.repository.listMessages(fireId);
  }
}
