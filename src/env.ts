export interface Env {
  /** Multica API origin, for example https://api.multica.ai. */
  MULTICA_API_URL?: string;
  /** Self-hosted Multica server override; takes precedence over MULTICA_API_URL. */
  MULTICA_SERVER_URL?: string;
  /** Workspace-scoped Multica access token stored with wrangler secret. */
  MULTICA_API_TOKEN?: string;
  /** Default workspace used for list/create requests. */
  MULTICA_WORKSPACE_ID?: string;
  /** Optional token protecting the public MCP endpoint. */
  MCP_ACCESS_TOKEN?: string;
}
