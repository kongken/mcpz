export interface Env {
  /** Multica API origin, for example https://api.multica.ai. */
  MULTICA_API_URL?: string;
  /** Self-hosted Multica server override; takes precedence over MULTICA_API_URL. */
  MULTICA_SERVER_URL?: string;
}
