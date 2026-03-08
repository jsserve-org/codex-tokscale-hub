import type { SubmissionData } from "./validation/submission";
import { loadDeviceSubmissions, removeDeviceSubmission, resetDeviceSubmissions, saveDeviceSubmission } from "./localMergeStore";
import { mergeSubmissions } from "./mergeSubmissions";

const FORWARD_SUBMIT_URL = process.env.TOKSCALE_FORWARD_SUBMIT_URL || "https://tokscale.ai/api/submit";

export interface MergeProxySnapshot {
  deviceId: string;
  updatedAt: string;
  summary: SubmissionData["summary"];
  meta: SubmissionData["meta"];
}

export interface MergeProxyState {
  devices: MergeProxySnapshot[];
  merged: SubmissionData | null;
}

export async function getMergeProxyState(token: string): Promise<MergeProxyState> {
  const submissions = await loadDeviceSubmissions(token);
  const devices = submissions.map((entry) => ({
    deviceId: entry.deviceId,
    updatedAt: entry.updatedAt,
    summary: entry.payload.summary,
    meta: entry.payload.meta,
  }));

  return {
    devices,
    merged: submissions.length > 0 ? mergeSubmissions(submissions.map((entry) => entry.payload)) : null,
  };
}

export async function listMergeProxyDevices(token: string): Promise<MergeProxySnapshot[]> {
  const state = await getMergeProxyState(token);
  return state.devices;
}

export async function handleMergedSubmission(token: string, deviceId: string, payload: SubmissionData) {
  await saveDeviceSubmission(token, deviceId, payload);

  const submissions = await loadDeviceSubmissions(token);
  const merged = mergeSubmissions(submissions.map((entry) => entry.payload));

  const upstreamResponse = await fetch(FORWARD_SUBMIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(merged),
  });

  const upstreamBody = await upstreamResponse.json().catch(() => null);

  return {
    upstreamResponse,
    upstreamBody,
    merged,
    devices: submissions.map((entry) => ({
      deviceId: entry.deviceId,
      updatedAt: entry.updatedAt,
    })),
  };
}

export async function deleteMergeProxyDevice(token: string, deviceId: string) {
  await removeDeviceSubmission(token, deviceId);
  return listMergeProxyDevices(token);
}

export async function clearMergeProxyDevices(token: string) {
  await resetDeviceSubmissions(token);
  return [];
}
