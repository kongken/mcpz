import { describe, expect, it } from "vitest";
import worker, { credentialsFromRequest, MCP_PATH } from "../src/index";

const env = {
  MULTICA_API_URL: "https://multica.example",
};

describe("Worker routes", () => {
  it("namespaces the Multica MCP endpoint for additional MCPs", async () => {
    expect(MCP_PATH).toBe("/mcp/multica");

    const oldPath = await worker.fetch(new Request("https://mcpz.example/mcp", { method: "GET" }), env);
    expect(oldPath.status).toBe(404);

    const missingHeaders = await worker.fetch(new Request(`https://mcpz.example${MCP_PATH}`, { method: "GET" }), env);
    expect(missingHeaders.status).toBe(401);

    const multicaPath = await worker.fetch(new Request(`https://mcpz.example${MCP_PATH}`, {
      method: "GET",
      headers: {
        authorization: "Bearer request-token",
        "x-multica-workspace-id": "workspace-1",
      },
    }), env);
    expect(multicaPath.status).not.toBe(404);
  });

  it("extracts the upstream credentials from request headers", async () => {
    const credentials = credentialsFromRequest(new Request("https://mcpz.example/mcp/multica", {
      headers: {
        authorization: "bearer request-token",
        "x-multica-workspace-id": "workspace-1",
      },
    }));
    expect(credentials).toEqual({ token: "request-token", workspaceId: "workspace-1" });
  });
});
