import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { Env } from "./env";
import { MulticaClient, type MulticaCredentials } from "./multica";
import { registerTools } from "./tools";

// Keep each MCP under its own path so this Worker can host additional MCP
// servers later without competing for the generic `/mcp` endpoint.
export const MCP_PATH = "/mcp/multica";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    if (url.pathname === "/healthz" && request.method === "GET") return cors(Response.json({ ok: true }));
    if (url.pathname !== MCP_PATH) return cors(Response.json({ error: "not found" }, { status: 404 }));

    const credentials = credentialsFromRequest(request);
    if (!credentials) return cors(unauthorized());

    // This handler is intentionally created per request: the MVP is stateless,
    // so no Durable Object or process-local session is needed on Workers.
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "multica-mcp", version: "0.1.0" });
      registerTools(server, new MulticaClient(env, credentials));
      return server;
    }, { legacy: "stateless" });
    return cors(await handler.fetch(request));
  },
};

export function credentialsFromRequest(request: Request): MulticaCredentials | undefined {
  const authorization = request.headers.get("authorization")?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  const workspaceId = request.headers.get("x-multica-workspace-id")?.trim();
  if (!token || !workspaceId) return undefined;
  return { token, workspaceId };
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "authorization and x-multica-workspace-id headers are required" }), {
    status: 401,
    headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="multica-mcp"' },
  });
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "authorization, content-type, x-multica-workspace-id, mcp-session-id, mcp-protocol-version, last-event-id");
  headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  headers.set("access-control-expose-headers", "mcp-session-id, mcp-protocol-version, last-event-id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
