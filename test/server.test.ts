import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNodeServer } from "../src/server";

const server = createNodeServer({ MULTICA_API_URL: "https://multica.example" });

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function baseUrl(): string {
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("Node/Docker entrypoint", () => {
  it("serves the container health check", async () => {
    const response = await fetch(`${baseUrl()}/healthz`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects MCP requests without credential headers", async () => {
    const response = await fetch(`${baseUrl()}/mcp/multica`, { method: "GET" });
    expect(response.status).toBe(401);
  });

  it("forwards credential headers through to the MCP handler", async () => {
    const response = await fetch(`${baseUrl()}/mcp/multica`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer request-token",
        "x-multica-workspace-id": "workspace-1",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "vitest", version: "0" } },
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("multica-mcp");
  });

  it("keeps the namespaced path and rejects unknown routes", async () => {
    const response = await fetch(`${baseUrl()}/mcp`);
    expect(response.status).toBe(404);
  });
});
