import { describe, it, expect } from "vitest";
import type { Fogata, Mensaje } from "./types.js";

describe("domain types (capa dominio)", () => {
  describe("Fogata", () => {
    it("acepta id y createdAt opcional", () => {
      const f: Fogata = { id: "fire-1" };
      expect(f.id).toBe("fire-1");
      expect(f.createdAt).toBeUndefined();

      const f2: Fogata = { id: "fire-2", createdAt: "2025-01-01T00:00:00Z" };
      expect(f2.createdAt).toBeDefined();
    });
  });

  describe("Mensaje", () => {
    it("acepta fireId, text y opcionales id, author, createdAt", () => {
      const m: Mensaje = { fireId: "f1", text: "hola" };
      expect(m.fireId).toBe("f1");
      expect(m.text).toBe("hola");
      expect(m.id).toBeUndefined();

      const m2: Mensaje = {
        id: "msg-1",
        fireId: "f1",
        text: "hi",
        author: "agent-1",
        createdAt: "2025-01-01T00:00:00Z",
      };
      expect(m2.author).toBe("agent-1");
    });
  });
});
