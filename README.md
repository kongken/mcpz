# mcpz

设计分析：[Multica MCP on Cloudflare Workers：语言与实现方案](docs/research/multica-mcp-cloudflare-language.md)

这是一个独立的 TypeScript MCP 服务，同一个 handler 支持两种部署形态：

- **Cloudflare Worker**：在 `/mcp/multica` 提供 Streamable HTTP MCP，`src/index.ts` 为入口。
- **Docker / 自托管**：`src/server.ts` 用 Node HTTP 适配器托管同一个 handler，镜像发布到 GHCR。

两种形态都通过 `fetch` 直接调用 Multica API，不启动本地 `workctl` 或 `multica` 进程。

## 认证

客户端必须在请求 header 发送：

- `Authorization: Bearer <multica-api-token>`
- `X-Multica-Workspace-Id: <workspace-id>`

缺少任一 header 返回 `401`。token 和 workspace 不从服务端环境变量读取。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `MULTICA_SERVER_URL` | 可选。self-host Multica 根地址，例如 `https://multica.example.com`；默认 `https://api.multica.ai`。不要带 `/api`。 |
| `MULTICA_API_URL` | 兼容别名，`MULTICA_SERVER_URL` 优先。 |
| `PORT` | 仅 Docker/Node：监听端口，默认 `8787`。 |

## 本地运行

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

## Docker / GHCR

`.github/workflows/docker.yml` 在 push 到 `main`、打 `v*` tag 或手动触发时构建
`linux/amd64` 与 `linux/arm64` 镜像并推送到 `ghcr.io/kongken/mcpz`；PR 只构建不推送。

```bash
docker build -t ghcr.io/kongken/mcpz:local .
docker run --rm -p 8787:8787 \
  -e MULTICA_SERVER_URL=https://api.multica.ai \
  ghcr.io/kongken/mcpz:local
curl http://127.0.0.1:8787/healthz
```

也可以用 `docker-compose.yml` 起一个实例：

```bash
docker compose up
```

MCP 地址为 `http://<host>:8787/mcp/multica`，健康检查为 `/healthz`。

本地构建并推送到 GHCR（需要带 `write:packages` 的 GitHub token）：

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
docker build -t ghcr.io/kongken/mcpz:latest .
docker push ghcr.io/kongken/mcpz:latest
```

## 验证

```bash
npm run typecheck
npm test
npx wrangler deploy --dry-run   # Worker 形态
npm run build                   # Node/Docker 形态，产物 dist/server.mjs
```
