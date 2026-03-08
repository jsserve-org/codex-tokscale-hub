"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "nextjs-toploader/app";
import styled from "styled-components";
import { toast } from "react-toastify";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";

interface SessionUser {
  username: string;
}

interface ApiToken {
  id: string;
  name: string;
}

interface MergeDevice {
  deviceId: string;
  updatedAt: string;
  summary: {
    totalTokens: number;
    totalCost: number;
    activeDays: number;
    clients: string[];
  };
  meta: {
    dateRange: {
      start: string;
      end: string;
    };
  };
}

interface MergedPreview {
  summary: {
    totalTokens: number;
    totalCost: number;
    activeDays: number;
    clients: string[];
    models: string[];
  };
  meta: {
    dateRange: {
      start: string;
      end: string;
    };
  };
}

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 28%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 24%),
    linear-gradient(180deg, var(--color-bg-default) 0%, var(--color-bg-subtle) 100%);
`;

const Main = styled.main`
  flex: 1;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 40px 24px 64px;
`;

const Hero = styled.section`
  display: grid;
  gap: 16px;
  margin-bottom: 28px;
`;

const Eyebrow = styled.p`
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 700;
`;

const Title = styled.h1`
  font-size: clamp(32px, 5vw, 54px);
  line-height: 0.95;
  font-weight: 800;
  max-width: 12ch;
  color: var(--color-fg-default);
`;

const Lead = styled.p`
  max-width: 62ch;
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-fg-muted);
`;

const Grid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: 320px minmax(0, 1fr);

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.section`
  border: 1px solid var(--color-border-default);
  border-radius: 24px;
  padding: 22px;
  background: color-mix(in srgb, var(--color-bg-default) 88%, white 12%);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.06);
`;

const CardTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--color-fg-default);
`;

const Copy = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-fg-muted);
`;

const Select = styled.select`
  width: 100%;
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-default);
  color: var(--color-fg-default);
`;

const Code = styled.code`
  display: block;
  margin-top: 14px;
  padding: 14px;
  border-radius: 16px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
`;

const DeviceList = styled.div`
  display: grid;
  gap: 14px;
  margin-top: 10px;
`;

const DeviceCard = styled.article`
  border: 1px solid var(--color-border-default);
  border-radius: 20px;
  padding: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.56), rgba(255,255,255,0.28));
`;

const DeviceHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
`;

const DeviceName = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: var(--color-fg-default);
`;

const Meta = styled.p`
  font-size: 13px;
  color: var(--color-fg-muted);
`;

const StatRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const Pill = styled.span`
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
`;

const Button = styled.button<{ $danger?: boolean }>`
  border: 0;
  border-radius: 14px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $danger }) => ($danger ? "#7f1d1d" : "white")};
  background: ${({ $danger }) => ($danger ? "#fee2e2" : "linear-gradient(135deg, #2563eb, #0ea5e9)")};

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const Empty = styled.div`
  padding: 32px 18px;
  border: 1px dashed var(--color-border-default);
  border-radius: 18px;
  text-align: center;
  color: var(--color-fg-muted);
`;

const PreviewStats = styled.div`
  display: grid;
  gap: 12px;
  margin-top: 16px;
`;

const PreviewPanel = styled.div`
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--color-border-default);
  background: rgba(37, 99, 235, 0.06);
`;

export default function MergeClient() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [devices, setDevices] = useState<MergeDevice[]>([]);
  const [merged, setMerged] = useState<MergedPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((res) => res.json()),
      fetch("/api/settings/tokens").then((res) => res.json()),
    ])
      .then(([sessionData, tokenData]) => {
        if (!sessionData.user) {
          router.push("/api/auth/github?returnTo=/merge");
          return;
        }

        setUser(sessionData.user || null);
        const fetchedTokens = tokenData.tokens || [];
        setTokens(fetchedTokens);
        if (fetchedTokens[0]) {
          setSelectedToken(fetchedTokens[0].id);
        }
      })
      .catch(() => {
        toast.error("Failed to load merge proxy settings");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    if (!selectedToken) {
      setDevices([]);
      return;
    }

    setBusy(true);
    fetch(`/api/submit/merge/devices?tokenId=${encodeURIComponent(selectedToken)}`)
      .then((res) => res.json())
      .then((data) => {
        setDevices(data.devices || []);
        setMerged(data.merged || null);
      })
      .catch(() => {
        toast.error("Failed to load cached devices");
      })
      .finally(() => {
        setBusy(false);
      });
  }, [selectedToken]);

  const command = useMemo(() => {
    if (!selectedToken || typeof window === "undefined") {
      return "Select an API token to generate a command.";
    }

    return [
      `TOKSCALE_API_URL=${window.location.origin}`,
      `tokscale submit --merge-proxy ${window.location.origin} --device laptop`,
    ].join(" \\\n+");
  }, [selectedToken]);

  async function removeDevice(deviceId: string) {
    if (!selectedToken) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/submit/merge/devices?tokenId=${encodeURIComponent(selectedToken)}&deviceId=${encodeURIComponent(deviceId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove device");
      setDevices(data.devices || []);
      setMerged(data.merged || null);
      toast.success(`Removed ${deviceId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove device");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!selectedToken) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/submit/merge/devices?tokenId=${encodeURIComponent(selectedToken)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset merge cache");
      setDevices(data.devices || []);
      setMerged(data.merged || null);
      toast.success("Cleared merge cache");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear merge cache");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Page><Navigation /><Main>Loading merge proxy...</Main><Footer /></Page>;
  }

  return (
    <Page>
      <Navigation />
      <Main>
        <Hero>
          <Eyebrow>Local Merge Proxy</Eyebrow>
          <Title>Merge every device before Tokscale sees it.</Title>
          <Lead>
            Point each laptop, desktop, or server at your self-hosted merge endpoint, inspect the cached device payloads here, and reset stale snapshots without touching your Tokscale account.
          </Lead>
        </Hero>

        <Grid>
          <Card>
            <CardTitle>CLI Setup</CardTitle>
            <Copy>
              Pick one token, then use the generated command on every device. The `--device` value should be unique per machine.
            </Copy>
            <Select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)}>
              <option value="">Select API token</option>
              {tokens.map((token) => (
                <option key={token.id} value={token.id}>{token.name}</option>
              ))}
            </Select>
            <Code>{command}</Code>
            <ActionRow>
              <Button
                disabled={!selectedToken}
                onClick={() => {
                  navigator.clipboard.writeText(command);
                  toast.success("Command copied");
                }}
              >
                Copy command
              </Button>
              <Button $danger onClick={clearAll} disabled={busy || !selectedToken}>
                Reset all devices
              </Button>
            </ActionRow>

            {merged ? (
              <PreviewStats>
                <PreviewPanel>
                  <CardTitle>Current merged preview</CardTitle>
                  <StatRow>
                    <Pill>{merged.summary.totalTokens.toLocaleString()} tokens</Pill>
                    <Pill>${merged.summary.totalCost.toFixed(2)}</Pill>
                    <Pill>{merged.summary.activeDays} active days</Pill>
                  </StatRow>
                  <Meta>
                    {merged.meta.dateRange.start} - {merged.meta.dateRange.end}
                  </Meta>
                  <StatRow>
                    {merged.summary.clients.map((client) => <Pill key={client}>{client}</Pill>)}
                  </StatRow>
                </PreviewPanel>
              </PreviewStats>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Cached Devices</CardTitle>
            <Copy>
              {user ? `Signed in as @${user.username}.` : "Sign in first."} Each card shows the last payload snapshot currently feeding the merged upstream submit.
            </Copy>
            {devices.length === 0 ? (
              <Empty>No cached devices yet. Submit from one of your machines to populate this view.</Empty>
            ) : (
              <DeviceList>
                {devices.map((device) => (
                  <DeviceCard key={device.deviceId}>
                    <DeviceHeader>
                      <div>
                        <DeviceName>{device.deviceId}</DeviceName>
                        <Meta>
                          {device.meta.dateRange.start} - {device.meta.dateRange.end} · updated {new Date(device.updatedAt).toLocaleString()}
                        </Meta>
                      </div>
                      <Button $danger onClick={() => removeDevice(device.deviceId)} disabled={busy}>
                        Remove
                      </Button>
                    </DeviceHeader>
                    <StatRow>
                      <Pill>{device.summary.totalTokens.toLocaleString()} tokens</Pill>
                      <Pill>${device.summary.totalCost.toFixed(2)}</Pill>
                      <Pill>{device.summary.activeDays} active days</Pill>
                      <Pill>{device.summary.clients.join(", ")}</Pill>
                    </StatRow>
                  </DeviceCard>
                ))}
              </DeviceList>
            )}
          </Card>
        </Grid>
      </Main>
      <Footer />
    </Page>
  );
}
