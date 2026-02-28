import { describe, it, expect } from "vitest";
import { CampfireApp } from "./app/campfire-app.js";
import { InMemoryCampfireRepository } from "./adapters/index.js";
import {
  pingTool,
  echoTool,
  getOrCreateFireTool,
  postMessageTool,
  listMessagesTool,
} from "./tools.js";

describe("tools (capa handlers → ToolResult)", () => {
  const repo = new InMemoryCampfireRepository();
  const app = new CampfireApp(repo);

  describe("pingTool", () => {
    it("devuelve content con texto que incluye pong y mcp-campfire", () => {
      const result = pingTool();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toMatch(/pong/);
      expect(result.content[0].text).toMatch(/mcp-campfire/);
      expect(result.isError).toBeFalsy();
    });
  });

  describe("echoTool", () => {
    it("devuelve el mensaje en content cuando no está vacío", () => {
      const result = echoTool({ message: "hola" });
      expect(result.content[0].text).toBe("hola");
      expect(result.isError).toBeFalsy();
    });
    it("devuelve isError true cuando message está vacío", () => {
      const result = echoTool({ message: "   " });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("empty");
    });
  });

  describe("getOrCreateFireTool", () => {
    it("devuelve JSON de Fogata con id y createdAt", async () => {
      const result = await getOrCreateFireTool(app, { fireId: "tool-fire-1" });
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text) as { id: string; createdAt?: string };
      expect(parsed.id).toBe("tool-fire-1");
      expect(parsed.createdAt).toBeDefined();
    });
  });

  describe("postMessageTool", () => {
    it("devuelve JSON de Mensaje creado cuando fogata existe y text no vacío", async () => {
      await app.getOrCreateFire("tool-fire-2");
      const result = await postMessageTool(app, {
        fireId: "tool-fire-2",
        text: "mensaje de test",
        author: "test-agent",
      });
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text) as {
        fireId: string;
        text: string;
        author?: string;
      };
      expect(parsed.fireId).toBe("tool-fire-2");
      expect(parsed.text).toBe("mensaje de test");
      expect(parsed.author).toBe("test-agent");
    });
    it("lanza ToolError (capturable por wrapToolHandler) cuando text vacío", async () => {
      await app.getOrCreateFire("tool-fire-empty");
      await expect(
        postMessageTool(app, { fireId: "tool-fire-empty", text: "" })
      ).rejects.toThrow();
    });
  });

  describe("listMessagesTool", () => {
    it("devuelve JSON array de mensajes para fogata existente", async () => {
      await app.getOrCreateFire("tool-fire-3");
      await app.postMessage("tool-fire-3", "uno");
      await app.postMessage("tool-fire-3", "dos");
      const result = await listMessagesTool(app, { fireId: "tool-fire-3" });
      expect(result.isError).toBeFalsy();
      const list = JSON.parse(result.content[0].text) as Array<{ text: string }>;
      expect(list).toHaveLength(2);
      expect(list.map((m) => m.text)).toEqual(expect.arrayContaining(["uno", "dos"]));
    });
    it("lanza ToolError cuando fogata no existe", async () => {
      await expect(
        listMessagesTool(app, { fireId: "tool-no-existe" })
      ).rejects.toThrow();
    });
  });
});
