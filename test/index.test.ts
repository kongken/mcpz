import { describe, expect, it } from "vitest";
import worker, { MCP_PATH } from "../src/index";

const env = {
  MULTICA_API_URL: "https://multica.example",
};

describe("Worker routes", () => {
  it("namespaces the Multica MCP endpoint for additional MCPs", async () => {
    expect(MCP_PATH).toBe("/mcp/multica");

    const oldPath = await worker.fetch(new Request("https://mcpz.example/mcp", { method: "GET" }), env);
    expect(oldPath.status).toBe(404);

    const multicaPath = await worker.fetch(new Request(`https://mcpz.example${MCP_PATH}`, { method: "GET" }), env);
    expect(multicaPath.status).not.toBe(404);
  });
});
