# mcpz

设计分析： [Multica MCP on Cloudflare Workers：语言与实现方案](docs/research/multica-mcp-cloudflare-language.md)

这是一个独立的 TypeScript Cloudflare Worker。它在 `/mcp/multica` 提供 Streamable HTTP MCP
服务，工具通过 Worker 的 `fetch` 直接调用 Multica API，不启动本地 `workctl` 或
`multica` 进程。

## 本地运行

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

环境变量只用于配置 API 地址：`MULTICA_SERVER_URL`（self-host 优先，覆盖默认的
`https://api.multica.ai`；`MULTICA_API_URL` 仍作为兼容别名）。连接 `/mcp/multica`
时，客户端必须在请求 header 发送 `Authorization: Bearer <multica-api-token>` 和
`X-Multica-Workspace-Id: <workspace-id>`；token 和 workspace 不再从 Worker 环境变量读取。

```bash
npm run typecheck
npm test
npx wrangler deploy
```
