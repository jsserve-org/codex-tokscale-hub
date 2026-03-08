import { createServer } from "node:http";
import { validateSubmission } from "@/lib/validation/submission";
import { getMergeProxyState, handleMergedSubmission } from "@/lib/mergeProxyService";

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function parseJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}

function getBearerToken(req: import("node:http").IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function startMergeProxyServer(port = 3456) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      const token = getBearerToken(req);
      if (!token) {
        sendJson(res, 401, { error: "Missing or invalid Authorization header" });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/submit/merge/devices") {
        const state = await getMergeProxyState(token);
        sendJson(res, 200, state);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/submit/merge") {
        const rawData = await parseJsonBody(req);
        const validation = validateSubmission(rawData);
        if (!validation.valid || !validation.data) {
          sendJson(res, 400, { error: "Validation failed", details: validation.errors });
          return;
        }

        const deviceId = req.headers["x-tokscale-device"]?.toString() || "default";
        const { upstreamResponse, upstreamBody, merged, devices } = await handleMergedSubmission(
          token,
          deviceId,
          validation.data,
        );

        if (!upstreamResponse.ok) {
          sendJson(res, upstreamResponse.status, {
            error: "Forward to Tokscale failed",
            deviceId,
            merged,
            upstream: upstreamBody,
          });
          return;
        }

        sendJson(res, 200, {
          success: true,
          mode: "local-merge",
          deviceId,
          merged,
          upstream: upstreamBody,
          devices,
        });
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });

  return server;
}
