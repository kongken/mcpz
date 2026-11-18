# mcpz

设计分析： [Multica MCP on Cloudflare Workers：语言与实现方案](docs/research/multica-mcp-cloudflare-language.md)

这是一个独立的 TypeScript Cloudflare Worker。它在 `/mcp/multica` 提供 Streamable HTTP MCP
服务，工具通过 Worker 的 `fetch` 直接调用 Multica API，不启动本地 `workctl` 或
`multica` 进程。

## 本地运行

```bash
npm install
npx wrangler secret put MULTICA_API_TOKEN
npm run dev
```

可选环境变量：`MULTICA_SERVER_URL`（self-host 优先，覆盖默认的
`https://api.multica.ai`；`MULTICA_API_URL` 仍作为兼容别名）、
`MULTICA_WORKSPACE_ID` 和 `MCP_ACCESS_TOKEN`。设置 `MCP_ACCESS_TOKEN` 后，
连接 `/mcp/multica` 的客户端必须发送对应的 `Authorization: Bearer ...`。

```bash
npm run typecheck
npm test
npx wrangler deploy
```
