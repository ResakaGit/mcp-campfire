/**
 * Domain types for mcp-campfire.
 * No MCP, ToolResult, or infrastructure dependencies.
 */

/** Planning session where agents post messages. */
export type Fogata = {
  id: string;
  createdAt?: string;
};

/** A message from an agent in a fire. */
export type Mensaje = {
  id?: string;
  fireId: string;
  text: string;
  author?: string;
  createdAt?: string;
};
