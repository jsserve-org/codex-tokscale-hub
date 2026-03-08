import { NextResponse } from "next/server";
import { validateSubmission } from "@/lib/validation/submission";
import { handleMergedSubmission } from "@/lib/mergeProxyService";

function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export async function POST(request: Request) {
  const token = getAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  let rawData: unknown;
  try {
    rawData = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateSubmission(rawData);
  if (!validation.valid || !validation.data) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400 }
    );
  }

  const deviceId = request.headers.get("X-Tokscale-Device") || "default";
  const { upstreamResponse, upstreamBody, merged, devices } = await handleMergedSubmission(
    token,
    deviceId,
    validation.data,
  );

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "Forward to Tokscale failed",
        deviceId,
        merged,
        upstream: upstreamBody,
      },
      { status: upstreamResponse.status }
    );
  }

  return NextResponse.json({
    success: true,
    mode: "local-merge",
    deviceId,
    merged,
    upstream: upstreamBody,
    devices,
  });
}
