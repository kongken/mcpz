import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pathToFileURL } from "node:url";
import type { Env } from "./env";
import worker from "./index";

const DEFAULT_PORT = 8787;

/** Environment variables the container reads; credentials still come from request headers. */
export function envFromProcess(source: Record<string, string | undefined> = process.env): Env {
  return {
    MULTICA_SERVER_URL: source.MULTICA_SERVER_URL,
    MULTICA_API_URL: source.MULTICA_API_URL,
  };
}

/**
 * Translate a Node HTTP request into a web `Request` so the Worker entry can
 * serve it unchanged. Hop-by-hop headers are dropped; everything else
 * (including the Multica credential headers) is forwarded verbatim.
 */
export async function toWebRequest(request: IncomingMessage, port = DEFAULT_PORT): Promise<Request> {
  const host = headerValue(request.headers.host) ?? `127.0.0.1:${port}`;
  const forwardedProto = headerValue(request.headers["x-forwarded-proto"])?.split(",")[0]?.trim();
  const url = new URL(request.url ?? "/", `${forwardedProto || "http"}://${host}`);

  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || isHopByHop(name)) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  const method = request.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(request);
  return new Request(url, { method, headers, body });
}

/** Build the request listener the Docker image runs; exported so tests can drive it. */
export function createRequestListener(env: Env = envFromProcess()) {
  return (request: IncomingMessage, response: ServerResponse): void => {
    void handleRequest(request, response, env);
  };
}

export function createNodeServer(env: Env = envFromProcess()) {
  return createServer(createRequestListener(env));
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, env: Env): Promise<void> {
  try {
    const webRequest = await toWebRequest(request);
    const webResponse = await worker.fetch(webRequest, env);
    const headers: Record<string, string> = {};
    webResponse.headers.forEach((value, name) => {
      headers[name] = value;
    });
    response.writeHead(webResponse.status, headers);
    if (!webResponse.body) {
      response.end();
      return;
    }
    Readable.fromWeb(webResponse.body as unknown as NodeReadableStream).pipe(response);
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}

async function readBody(request: IncomingMessage): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
  }
  const buffer = new ArrayBuffer(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  const body = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isHopByHop(name: string): boolean {
  return name === "connection" || name === "content-length" || name === "transfer-encoding" || name === "keep-alive" || name === "upgrade";
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createNodeServer();
  server.listen(port, () => {
    console.log(`mcpz listening on http://0.0.0.0:${port}`);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
    });
  }
}
