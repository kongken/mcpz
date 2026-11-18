import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MulticaClient, type JsonObject } from "./multica";

const id = z.string().min(1);
const optionalString = z.string().optional();

export function registerTools(server: McpServer, client: MulticaClient): void {
  register(server, "list_multica_agents", "List Multica agents in the configured workspace.", z.object({ include_archived: z.boolean().optional() }), (args) => client.listAgents(args.include_archived));
  register(server, "get_multica_agent", "Read a Multica agent by UUID.", z.object({ agent_id: id }), (args) => client.getAgent(args.agent_id));
  register(server, "create_multica_agent", "Create a Multica agent on a runtime.", z.object({ name: id, runtime_id: id, description: optionalString, instructions: optionalString, model: optionalString, max_concurrent_tasks: z.number().int().positive().max(50).optional() }), (args) => client.createAgent(compact(args)));
  register(server, "update_multica_agent", "Update only the provided fields of a Multica agent.", z.object({ agent_id: id, name: optionalString, description: optionalString, instructions: optionalString, model: optionalString, status: optionalString, runtime_id: optionalString, max_concurrent_tasks: z.number().int().positive().max(50).optional() }), (args) => client.updateAgent(args.agent_id, compact(args, "agent_id")));
  register(server, "archive_multica_agent", "Archive a Multica agent.", z.object({ agent_id: id }), (args) => client.archiveAgent(args.agent_id));
  register(server, "restore_multica_agent", "Restore an archived Multica agent.", z.object({ agent_id: id }), (args) => client.restoreAgent(args.agent_id));

  register(server, "get_multica_work_status", "Read a Multica issue and its current work status.", z.object({ issue_id: id }), (args) => client.getIssue(args.issue_id));
  register(server, "list_multica_issues", "List Multica issues with workspace filters.", z.object({ assignee_id: optionalString, project: optionalString, status: optionalString, limit: z.number().int().min(1).max(100).optional(), offset: z.number().int().min(0).optional() }), (args) => client.listIssues(compact(args)));
  register(server, "create_multica_issue", "Create a Multica issue.", z.object({ title: id, description: optionalString, assignee_id: optionalString, project_id: optionalString, status: optionalString, priority: optionalString, parent_id: optionalString }), (args) => client.createIssue(compact(args)));
  register(server, "update_multica_issue", "Update only the provided fields of a Multica issue.", z.object({ issue_id: id, title: optionalString, description: optionalString, assignee_id: optionalString, project_id: optionalString, status: optionalString, priority: optionalString, parent_id: optionalString }), (args) => client.updateIssue(args.issue_id, compact(args, "issue_id")));
  register(server, "add_multica_issue_comment", "Add a Markdown comment to a Multica issue.", z.object({ issue_id: id, content: id, parent_id: optionalString }), (args) => client.addComment(args.issue_id, compact(args, "issue_id")));
  register(server, "list_multica_issue_comments", "List comments on a Multica issue.", z.object({ issue_id: id, roots_only: z.boolean().optional(), recent: z.number().int().positive().optional() }), (args) => client.listComments(args.issue_id, compact(args, "issue_id")));
  register(server, "search_multica_issues", "Search Multica issues by title, description, or comments.", z.object({ query: id, limit: z.number().int().positive().max(100).optional(), include_closed: z.boolean().optional() }), (args) => client.searchIssues(compact(args)));

  register(server, "assign_multica_issue", "Assign or unassign a Multica issue.", z.object({ issue_id: id, to_id: optionalString, unassign: z.boolean().optional() }), async (args) => {
    if (!args.to_id && !args.unassign) throw new Error("to_id or unassign is required");
    return client.updateIssue(args.issue_id, { assignee_id: args.unassign ? null : args.to_id });
  });
  register(server, "set_multica_issue_status", "Change a Multica issue status.", z.object({ issue_id: id, status: id, duplicate_of: optionalString }), (args) => client.updateIssue(args.issue_id, compact(args, "issue_id")));
  register(server, "list_multica_issue_children", "List child issues of a Multica issue.", z.object({ issue_id: id }), (args) => client.issueSubresource(args.issue_id, "children"));
  register(server, "list_multica_issue_runs", "List execution runs for a Multica issue.", z.object({ issue_id: id, active: z.boolean().optional(), siblings: z.boolean().optional() }), (args) => client.issueSubresource(args.issue_id, "task-runs", {}, compact(args, "issue_id")));
  register(server, "list_multica_issue_run_messages", "List messages for a Multica run.", z.object({ run_id: id, issue: optionalString, since: z.number().int().min(0).optional() }), (args) => client.request(`/api/runs/${encodeURIComponent(args.run_id)}/messages`, {}, compact(args, "run_id")));
  register(server, "get_multica_issue_timeline", "Read a Multica issue timeline.", z.object({ issue_id: id, activity_only: z.boolean().optional(), actions: z.array(z.string()).optional(), since: optionalString }), (args) => client.issueSubresource(args.issue_id, "timeline", {}, compact(args, "issue_id")));
  register(server, "get_multica_issue_usage", "Read aggregated usage for a Multica issue.", z.object({ issue_id: id }), (args) => client.issueSubresource(args.issue_id, "usage"));
  register(server, "get_multica_issue_wakeups", "Read wakeups for a Multica issue.", z.object({ action: z.enum(["list", "get", "runs", "events"]), issue_id: optionalString, wakeup_id: optionalString }), async (args) => {
    if (args.action === "events") return client.request("/api/issues/wakeups/events");
    if (!args.issue_id) throw new Error("issue_id is required for this action");
    const suffix = args.action === "list" ? "wakeups" : `wakeups/${encodeURIComponent(args.wakeup_id || "")}/${args.action}`;
    return client.issueSubresource(args.issue_id, suffix);
  });
  register(server, "rerun_multica_issue", "Re-enqueue the current agent assignment for an issue.", z.object({ issue_id: id }), (args) => client.issueSubresource(args.issue_id, "rerun", { method: "POST" }));

  register(server, "list_multica_agent_tasks", "List runs for a Multica agent.", z.object({ agent_id: id, limit: z.number().int().positive().max(200).optional(), before: optionalString }), (args) => client.agentSubresource(args.agent_id, "tasks", {}, compact(args, "agent_id")));
  register(server, "get_multica_agent_env", "Read a Multica agent custom environment.", z.object({ agent_id: id }), (args) => client.agentSubresource(args.agent_id, "env"));
  register(server, "set_multica_agent_env", "Replace a Multica agent custom environment.", z.object({ agent_id: id, env: id }), (args) => {
    let env: unknown;
    try { env = JSON.parse(args.env); } catch { throw new Error("env must be a JSON object"); }
    if (!env || typeof env !== "object" || Array.isArray(env)) throw new Error("env must be a JSON object");
    return client.agentSubresource(args.agent_id, "env", { method: "PUT", body: JSON.stringify({ custom_env: env }) });
  });
  register(server, "manage_multica_agent_mcp", "List or change MCP servers assigned to an agent.", z.object({ agent_id: id, action: z.enum(["list", "add", "remove", "enable", "disable"]), server_id: optionalString }), async (args) => {
    if (args.action === "list") return client.agentSubresource(args.agent_id, "mcp-servers");
    if (!args.server_id) throw new Error("server_id is required for this action");
    return client.agentSubresource(args.agent_id, `mcp-servers/${encodeURIComponent(args.server_id)}/${args.action}`, { method: "POST" });
  });
  register(server, "manage_multica_agent_skills", "List or change skills assigned to an agent.", z.object({ agent_id: id, action: z.enum(["list", "add", "set"]), skill_ids: z.array(id).optional() }), async (args) => {
    if (args.action === "list") return client.agentSubresource(args.agent_id, "skills");
    if (!args.skill_ids?.length) throw new Error("skill_ids is required for this action");
    return client.agentSubresource(args.agent_id, "skills", { method: "PUT", body: JSON.stringify({ action: args.action, skill_ids: args.skill_ids }) });
  });

  register(server, "manage_multica_issue_labels", "List, attach, or remove issue labels.", z.object({ issue_id: id, action: z.enum(["list", "add", "remove"]), label_id: optionalString }), async (args) => {
    if (args.action !== "list" && !args.label_id) throw new Error("label_id is required for this action");
    const suffix = args.action === "list" ? "labels" : `labels/${encodeURIComponent(args.label_id || "")}`;
    return client.issueSubresource(args.issue_id, suffix, args.action === "list" ? {} : { method: args.action === "add" ? "POST" : "DELETE" });
  });
  register(server, "manage_multica_issue_metadata", "List, get, set, or delete issue metadata.", z.object({ issue_id: id, action: z.enum(["list", "get", "set", "delete"]), key: optionalString, value: optionalString, value_type: optionalString }), (args) => client.issueSubresource(args.issue_id, "metadata", {}, compact(args, "issue_id")));
  register(server, "manage_multica_issue_property", "List, set, or unset issue properties.", z.object({ issue_id: id, action: z.enum(["list", "set", "unset"]), name: optionalString, value: optionalString }), (args) => client.issueSubresource(args.issue_id, "properties", {}, compact(args, "issue_id")));
  register(server, "manage_multica_issue_subscribers", "List, add, or remove issue subscribers.", z.object({ issue_id: id, action: z.enum(["list", "add", "remove"]), user: optionalString, user_id: optionalString }), (args) => client.issueSubresource(args.issue_id, "subscribers", {}, compact(args, "issue_id")));
  register(server, "list_multica_issue_pull_requests", "List pull requests linked to an issue.", z.object({ issue_id: id }), (args) => client.issueSubresource(args.issue_id, "pull-requests"));
  register(server, "reorder_multica_issue", "Reorder an issue within its status column.", z.object({ issue_id: id, before: optionalString, after: optionalString, top: z.boolean().optional(), bottom: z.boolean().optional() }), (args) => client.issueSubresource(args.issue_id, "reorder", { method: "POST", body: JSON.stringify(compact(args, "issue_id")) }));
  register(server, "manage_multica_issue_comment", "Update, resolve, unresolve, or delete a comment.", z.object({ comment_id: id, action: z.enum(["update", "resolve", "unresolve", "delete"]), content: optionalString, expected_revision: z.number().int().positive().optional() }), (args) => {
    if (args.action === "resolve" || args.action === "unresolve") return client.request(`/api/comments/${encodeURIComponent(args.comment_id)}/${args.action}`, { method: "POST" });
    if (args.action === "delete") return client.request(`/api/comments/${encodeURIComponent(args.comment_id)}/keep-replies`, { method: "DELETE" });
    if (!args.content || !args.expected_revision) throw new Error("content and expected_revision are required for update");
    return client.request(`/api/comments/${encodeURIComponent(args.comment_id)}`, { method: "PUT", body: JSON.stringify({ content: args.content, expected_revision: args.expected_revision }) });
  });
  register(server, "cancel_multica_issue_task", "Cancel an in-progress or queued run.", z.object({ run_id: id, issue: optionalString }), (args) => client.request(`/api/runs/${encodeURIComponent(args.run_id)}/cancel`, { method: "POST" }, compact(args, "run_id")));
}

function compact<T extends Record<string, unknown>>(value: T, ...omit: string[]): JsonObject {
  const result: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    if (!omit.includes(key) && item !== undefined) result[key] = item;
  }
  return result;
}

function register<T extends z.ZodObject<any>>(
  server: McpServer,
  name: string,
  description: string,
  schema: T,
  handler: (args: z.infer<T>) => Promise<unknown> | unknown,
): void {
  server.registerTool(name, { description, inputSchema: schema.shape } as never, async (args: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(await handler(args as z.infer<T>), null, 2) }],
  }) as never);
}
