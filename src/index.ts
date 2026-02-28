/**
 * Punto de entrada del servidor MCP mcp-campfire.
 * Separa el arranque (I/O) de la lógica pura de las tools.
 */
import { startServer } from "./server.js";

startServer().catch((error) => {
  // stderr es seguro para logs; stdout queda reservado al protocolo MCP.
  console.error(error);
  process.exit(1);
});
