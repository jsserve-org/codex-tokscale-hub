import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { clearMergeProxyDevices, deleteMergeProxyDevice, getMergeProxyState } from "@/lib/mergeProxyService";
import { apiTokens, db } from "@/lib/db";

async function getScopedToken(request: Request): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get("tokenId");
  if (!tokenId) return null;

  const [token] = await db
    .select({ token: apiTokens.token })
    .from(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, session.id)))
    .limit(1);

  return token?.token ?? null;
}

export async function GET(request: Request) {
  const token = await getScopedToken(request);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const state = await getMergeProxyState(token);
  return NextResponse.json(state);
}

export async function DELETE(request: Request) {
  const token = await getScopedToken(request);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId");

  const devices = deviceId
    ? await deleteMergeProxyDevice(token, deviceId)
    : await clearMergeProxyDevices(token);

  const state = await getMergeProxyState(token);
  return NextResponse.json({ success: true, devices, merged: state.merged });
}
