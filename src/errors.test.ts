import { describe, it, expect } from "vitest";
import {
  toolErrorResult,
  ToolError,
  isToolError,
  errorToToolResult,
} from "./errors.js";

describe("errors (capa errores)", () => {
  describe("toolErrorResult", () => {
    it("devuelve shape MCP con isError true y un bloque text", () => {
      const result = toolErrorResult("Algo falló");
      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: "text", text: "Algo falló" });
    });
  });

  describe("ToolError", () => {
    it("es instancia de Error y tiene name ToolError", () => {
      const err = new ToolError("mensaje");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ToolError);
      expect(err.name).toBe("ToolError");
      expect(err.message).toBe("mensaje");
    });
  });

  describe("isToolError", () => {
    it("retorna true para ToolError", () => {
      expect(isToolError(new ToolError("x"))).toBe(true);
    });
    it("retorna false para Error genérico u otros valores", () => {
      expect(isToolError(new Error("x"))).toBe(false);
      expect(isToolError("string")).toBe(false);
      expect(isToolError(null)).toBe(false);
    });
  });

  describe("errorToToolResult", () => {
    it("usa message para Error", () => {
      const result = errorToToolResult(new Error("fallo de red"));
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("fallo de red");
    });
    it("stringifica valores no Error", () => {
      const result = errorToToolResult(42);
      expect(result.content[0].text).toBe("42");
    });
    it("maneja null/undefined", () => {
      expect(errorToToolResult(null).content[0].text).toBe("Unknown error");
      expect(errorToToolResult(undefined).content[0].text).toBe("Unknown error");
    });
  });
});
