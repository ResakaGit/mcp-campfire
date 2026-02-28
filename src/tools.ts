import { z } from "zod";
import { toolErrorResult, type ToolResult } from "./errors.js";
import type { CampfireApp } from "./app/campfire-app.js";

// --- ping (health check) ---

export const pingInputSchema = z.object({}).strict();

export type PingInput = z.infer<typeof pingInputSchema>;

export function pingTool(): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: `pong @ ${new Date().toISOString()} (mcp-campfire)`,
      },
    ],
  };
}

// --- echo (example with parameter) ---

export const echoInputSchema = z
  .object({
    message: z.string().describe("Message to return"),
  })
  .strict();

export type EchoInput = z.infer<typeof echoInputSchema>;

export function echoTool({ message }: EchoInput): ToolResult {
  if (!message.trim()) {
    return toolErrorResult("message cannot be empty.");
  }
  return {
    content: [{ type: "text", text: message }],
  };
}

// --- fire: get_or_create_fire ---

export const getOrCreateFireInputSchema = z
  .object({
    fireId: z.string().describe("Unique fire id (planning session)"),
  })
  .strict();

export type GetOrCreateFireInput = z.infer<typeof getOrCreateFireInputSchema>;

export async function getOrCreateFireTool(
  app: CampfireApp,
  args: GetOrCreateFireInput
): Promise<ToolResult> {
  const fire = await app.getOrCreateFire(args.fireId);
  return {
    content: [{ type: "text", text: JSON.stringify(fire, null, 2) }],
  };
}

// --- fire: post_message ---

export const postMessageInputSchema = z
  .object({
    fireId: z.string().describe("Fire id to post to"),
    text: z.string().describe("Message content"),
    author: z.string().optional().describe("Agent/author id (optional)"),
  })
  .strict();

export type PostMessageInput = z.infer<typeof postMessageInputSchema>;

export async function postMessageTool(
  app: CampfireApp,
  args: PostMessageInput
): Promise<ToolResult> {
  const msg = await app.postMessage(args.fireId, args.text, args.author);
  return {
    content: [{ type: "text", text: JSON.stringify(msg, null, 2) }],
  };
}

// --- fire: list_messages ---

export const listMessagesInputSchema = z
  .object({
    fireId: z.string().describe("Fire id to list messages from"),
  })
  .strict();

export type ListMessagesInput = z.infer<typeof listMessagesInputSchema>;

export async function listMessagesTool(
  app: CampfireApp,
  args: ListMessagesInput
): Promise<ToolResult> {
  const messages = await app.listMessages(args.fireId);
  return {
    content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
  };
}
