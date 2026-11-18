import { describe, expect, it } from "vitest";
import { MulticaClient } from "../src/multica";

describe("MulticaClient", () => {
  it("uses the workspace query and bearer token for list requests", async () => {
    let seen: Request | undefined;
    const client = new MulticaClient(
      {
        MULTICA_API_URL: "https://multica.example",
        MULTICA_API_TOKEN: "secret",
        MULTICA_WORKSPACE_ID: "workspace-1",
      },
      async (input, init) => {
        seen = new Request(input, init);
        return Response.json([{ id: "agent-1" }]);
      },
    );

    await expect(client.listAgents()).resolves.toEqual([{ id: "agent-1" }]);
    expect(seen?.url).toBe("https://multica.example/api/agents?workspace_id=workspace-1");
    expect(seen?.headers.get("authorization")).toBe("Bearer secret");
  });

  it("sends issue creation as JSON without invoking a local process", async () => {
    let seen: Request | undefined;
    const client = new MulticaClient(
      { MULTICA_API_URL: "https://multica.example", MULTICA_WORKSPACE_ID: "workspace-1" },
      async (input, init) => {
        seen = new Request(input, init);
        return Response.json({ id: "issue-1" });
      },
    );

    await client.createIssue({ title: "Ship MCP", description: "Use fetch" });
    expect(seen?.method).toBe("POST");
    expect(await seen?.json()).toEqual({ title: "Ship MCP", description: "Use fetch", workspace_id: "workspace-1" });
  });

  it("bounds upstream error details", async () => {
    const client = new MulticaClient(
      { MULTICA_API_URL: "https://multica.example" },
      async () => new Response(JSON.stringify({ error: "upstream failed" }), { status: 502 }),
    );

    await expect(client.getAgent("agent-1")).rejects.toMatchObject({
      status: 502,
      message: "Multica API request failed (502): upstream failed",
    });
  });
});
