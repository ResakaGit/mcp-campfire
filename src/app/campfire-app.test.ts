import { describe, it, expect } from "vitest";
import { CampfireApp } from "./campfire-app.js";
import { InMemoryCampfireRepository } from "../adapters/index.js";
import { ToolError } from "../errors.js";

describe("CampfireApp (capa aplicación / lógica de negocio)", () => {
  const repo = new InMemoryCampfireRepository();
  const app = new CampfireApp(repo);

  it("getOrCreateFire delega al repo y retorna Fogata", async () => {
    const fire = await app.getOrCreateFire("app-fire-1");
    expect(fire.id).toBe("app-fire-1");
    expect(fire.createdAt).toBeDefined();
  });

  it("postMessage con text no vacío en fogata existente retorna Mensaje", async () => {
    await app.getOrCreateFire("app-fire-2");
    const msg = await app.postMessage("app-fire-2", "hola mundo", "agent-x");
    expect(msg.text).toBe("hola mundo");
    expect(msg.author).toBe("agent-x");
    expect(msg.fireId).toBe("app-fire-2");
  });

  it("postMessage con text vacío o solo espacios lanza ToolError con mensaje accionable", async () => {
    await app.getOrCreateFire("app-fire-empty");
    await expect(app.postMessage("app-fire-empty", "")).rejects.toThrow(ToolError);
    await expect(app.postMessage("app-fire-empty", "   ")).rejects.toThrow(
      ToolError
    );
    try {
      await app.postMessage("app-fire-empty", "  ");
    } catch (e) {
      expect(e).toBeInstanceOf(ToolError);
      expect((e as ToolError).message).toBe("message cannot be empty.");
    }
  });

  it("postMessage en fogata inexistente lanza ToolError con mensaje accionable", async () => {
    await expect(
      app.postMessage("fogata-que-no-existe", "texto")
    ).rejects.toThrow(ToolError);
    try {
      await app.postMessage("fogata-que-no-existe", "texto");
    } catch (e) {
      expect((e as ToolError).message).toContain("does not exist");
      expect((e as ToolError).message).toContain("fogata-que-no-existe");
    }
  });

  it("listMessages en fogata existente retorna array de Mensaje", async () => {
    await app.getOrCreateFire("app-fire-list");
    await app.postMessage("app-fire-list", "a");
    await app.postMessage("app-fire-list", "b");
    const list = await app.listMessages("app-fire-list");
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.text)).toEqual(["a", "b"]);
  });

  it("listMessages en fogata inexistente lanza ToolError con mensaje accionable", async () => {
    await expect(app.listMessages("otra-inexistente")).rejects.toThrow(
      ToolError
    );
    try {
      await app.listMessages("otra-inexistente");
    } catch (e) {
      expect((e as ToolError).message).toContain("does not exist");
    }
  });

  it("no mantiene estado mutable expuesto: depende del repo inyectado", () => {
    const repo2 = new InMemoryCampfireRepository();
    const app2 = new CampfireApp(repo2);
    expect(app).not.toBe(app2);
    expect((app as unknown as { repository: unknown }).repository).toBe(repo);
  });
});
