/**
 * Error system for MCP tools (mcp-campfire).
 *
 * Per spec 2025-11-25: tool execution failures must be returned inside the result
 * with `isError: true`, not as JSON-RPC protocol errors, so the LLM can read the message and self-correct.
 *
 * - Business/validation errors → result with isError: true (toolErrorResult).
 * - Protocol errors (tool not found, malformed request) → JSON-RPC error.
 */

/** Successful tool result: content without isError (or isError: false). */
export type ToolSuccessResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: false;
};

/** Error tool result: content + isError: true. */
export type ToolErrorResult = {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
};

/** Tool result: success or business error (same shape for the client). */
export type ToolResult = ToolSuccessResult | ToolErrorResult;

/**
 * Builds an error tool result for the client.
 * Use for business validation or recoverable failures; not for protocol failures.
 */
export function toolErrorResult(message: string): ToolErrorResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Error thrown from a tool to indicate business failure.
 * The handler in server.ts converts it to toolErrorResult(message) so the protocol is not broken.
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
    Object.setPrototypeOf(this, ToolError.prototype);
  }
}

/** Returns whether a value is a ToolError. */
export function isToolError(value: unknown): value is ToolError {
  return value instanceof ToolError;
}

/**
 * Converts a caught error into a tool result with isError: true.
 * ToolError uses its message; others are stringified safely.
 */
export function errorToToolResult(error: unknown): ToolErrorResult {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  return toolErrorResult(message);
}
