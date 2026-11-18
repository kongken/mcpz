import type { Env } from "./env";

const DEFAULT_API_URL = "https://api.multica.ai";
const REQUEST_TIMEOUT_MS = 20_000;

export class MulticaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MulticaApiError";
  }
}

export type JsonObject = Record<string, unknown>;

export class MulticaClient {
  constructor(
    private readonly env: Env,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request<T = unknown>(
    path: string,
    init: RequestInit = {},
    query: Record<string, unknown> = {},
  ): Promise<T> {
    const url = new URL(path, this.env.MULTICA_SERVER_URL || this.env.MULTICA_API_URL || DEFAULT_API_URL);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }

    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body !== undefined) headers.set("content-type", "application/json");
    if (this.env.MULTICA_API_TOKEN) headers.set("authorization", `Bearer ${this.env.MULTICA_API_TOKEN}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetcher(url, { ...init, headers, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        let detail = text.slice(0, 500);
        try {
          const body = JSON.parse(text) as JsonObject;
          detail = typeof body.error === "string" ? body.error : detail;
        } catch {
          // Keep the bounded response text for non-JSON errors.
        }
        throw new MulticaApiError(`Multica API request failed (${response.status}): ${detail}`, response.status);
      }
      if (!text) return {} as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new MulticaApiError("Multica API returned invalid JSON", response.status);
      }
    } catch (error) {
      if (error instanceof MulticaApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new MulticaApiError("Multica API request timed out");
      }
      throw new MulticaApiError(`Multica API request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private workspaceQuery(extra: Record<string, unknown> = {}) {
    return { ...extra, workspace_id: this.env.MULTICA_WORKSPACE_ID };
  }

  listAgents(includeArchived = false) {
    return this.request("/api/agents", {}, this.workspaceQuery({ include_archived: includeArchived || undefined }));
  }

  getAgent(agentId: string) {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}`);
  }

  createAgent(input: JsonObject) {
    return this.request("/api/agents", json("POST", { ...input, workspace_id: this.env.MULTICA_WORKSPACE_ID }));
  }

  updateAgent(agentId: string, input: JsonObject) {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}`, json("PUT", input));
  }

  archiveAgent(agentId: string) {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/archive`, { method: "POST" });
  }

  restoreAgent(agentId: string) {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/restore`, { method: "POST" });
  }

  listIssues(input: JsonObject) {
    return this.request("/api/issues", {}, this.workspaceQuery(input));
  }

  getIssue(issueId: string) {
    return this.request(`/api/issues/${encodeURIComponent(issueId)}`);
  }

  createIssue(input: JsonObject) {
    return this.request("/api/issues", json("POST", { ...input, workspace_id: this.env.MULTICA_WORKSPACE_ID }));
  }

  updateIssue(issueId: string, input: JsonObject) {
    return this.request(`/api/issues/${encodeURIComponent(issueId)}`, json("PUT", input));
  }

  listComments(issueId: string, input: JsonObject = {}) {
    const { roots_only, ...rest } = input;
    return this.request(`/api/issues/${encodeURIComponent(issueId)}/comments`, {}, roots_only ? { roots_only: true, ...rest } : { fold: true, ...rest });
  }

  addComment(issueId: string, input: JsonObject) {
    return this.request(`/api/issues/${encodeURIComponent(issueId)}/comments`, json("POST", input));
  }

  searchIssues(input: JsonObject) {
    const { query, ...rest } = input;
    return this.request("/api/issues/search", {}, { q: query, ...rest });
  }

  issueSubresource(issueId: string, suffix: string, init: RequestInit = {}, query: JsonObject = {}) {
    return this.request(`/api/issues/${encodeURIComponent(issueId)}/${suffix}`, init, query);
  }

  agentSubresource(agentId: string, suffix: string, init: RequestInit = {}, query: JsonObject = {}) {
    return this.request(`/api/agents/${encodeURIComponent(agentId)}/${suffix}`, init, query);
  }
}

function json(method: string, body: JsonObject): RequestInit {
  return { method, body: JSON.stringify(body) };
}
