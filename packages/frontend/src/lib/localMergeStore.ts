import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SubmissionData } from "./validation/submission";

interface StoredSubmission {
  deviceId: string;
  updatedAt: string;
  payload: SubmissionData;
}

export interface StoredDeviceSubmission extends StoredSubmission {}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sanitizeDeviceId(deviceId: string): string {
  return deviceId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "default";
}

function getStorageRoot(): string {
  return process.env.TOKSCALE_MERGE_STORAGE_DIR || join(homedir(), ".config", "tokscale", "merge-cache");
}

function getTtlMs(): number {
  const raw = process.env.TOKSCALE_MERGE_TTL_HOURS;
  const hours = raw ? Number(raw) : 24 * 14;
  if (!Number.isFinite(hours) || hours <= 0) {
    return 24 * 14 * 60 * 60 * 1000;
  }
  return hours * 60 * 60 * 1000;
}

function isExpired(updatedAt: string): boolean {
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(updated)) return true;
  return Date.now() - updated > getTtlMs();
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function saveDeviceSubmission(
  token: string,
  deviceId: string,
  payload: SubmissionData
): Promise<void> {
  const dir = join(getStorageRoot(), tokenHash(token));
  await ensureDir(dir);
  const filePath = join(dir, `${sanitizeDeviceId(deviceId)}.json`);
  const record: StoredSubmission = {
    deviceId,
    updatedAt: new Date().toISOString(),
    payload,
  };
  await writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
}

export async function loadDeviceSubmissions(token: string): Promise<StoredDeviceSubmission[]> {
  const dir = join(getStorageRoot(), tokenHash(token));

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const content = await readFile(join(dir, entry.name), "utf8");
          return {
            fileName: entry.name,
            record: JSON.parse(content) as StoredSubmission,
          };
        })
    );

    const validRecords: StoredDeviceSubmission[] = [];
    await Promise.all(records.map(async ({ fileName, record }) => {
      if (isExpired(record.updatedAt)) {
        await unlink(join(dir, fileName)).catch(() => undefined);
        return;
      }
      validRecords.push(record);
    }));

    return validRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function removeDeviceSubmission(token: string, deviceId: string): Promise<void> {
  const dir = join(getStorageRoot(), tokenHash(token));
  const filePath = join(dir, `${sanitizeDeviceId(deviceId)}.json`);
  await unlink(filePath).catch(() => undefined);
}

export async function resetDeviceSubmissions(token: string): Promise<void> {
  const dir = join(getStorageRoot(), tokenHash(token));
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
