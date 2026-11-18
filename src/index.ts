import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { Env } from "./env";
import { MulticaClient } from "./multica";
import { registerTools } from "./tools";

const MCP_PATH = "/mcp";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    if (url.pathname === "/healthz" && request.method === "GET") return cors(Response.json({ ok: true }));
    if (url.pathname !== MCP_PATH) return cors(Response.json({ error: "not found" }, { status: 404 }));

    const auth = authorize(request, env);
    if (auth) return cors(auth);

    // This handler is intentionally created per request: the MVP is stateless,
    // so no Durable Object or process-local session is needed on Workers.
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "multica-mcp", version: "0.1.0" });
      registerTools(server, new MulticaClient(env));
      return server;
    }, { legacy: "stateless" });
    return cors(await handler.fetch(request));
  },
};

function authorize(request: Request, env: Env): Response | undefined {
  if (!env.MCP_ACCESS_TOKEN) return undefined;
  const supplied = request.headers.get("authorization");
  if (supplied !== `Bearer ${env.MCP_ACCESS_TOKEN}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="mcp"' },
    });
  }
  return undefined;
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "authorization, content-type, mcp-session-id, mcp-protocol-version, last-event-id");
  headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  headers.set("access-control-expose-headers", "mcp-session-id, mcp-protocol-version, last-event-id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
