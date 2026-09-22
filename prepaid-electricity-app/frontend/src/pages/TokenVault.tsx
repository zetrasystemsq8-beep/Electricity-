import { useEffect, useState } from "react";
import { TopBar } from "../components/TopBar";
import { Loading } from "../components/LoadingAndError";
import { api } from "../api/client";

interface TokenEntry {
  id: string;
  tokenValue: string;
  units: number | null;
  amount: number;
  loadingStatus: string;
  createdAt: string;
  meter: { label: string; disco: { name: string } };
}

export default function TokenVault() {
  const [tokens, setTokens] = useState<TokenEntry[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    api.get<TokenEntry[]>("/tokens").then(setTokens);
  }, []);

  function copy(t: TokenEntry) {
    navigator.clipboard.writeText(t.tokenValue);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function toggleLoaded(t: TokenEntry) {
    const loaded = t.loadingStatus !== "LOADED";
    await api.post(`/tokens/${t.id}/loaded`, { loaded });
    setTokens((prev) => prev?.map((x) => (x.id === t.id ? { ...x, loadingStatus: loaded ? "LOADED" : "NOT_LOADED" } : x)) ?? null);
  }

  if (!tokens) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="My Tokens" back />
      {tokens.length === 0 && <p className="muted">No tokens yet. Buy electricity to see them saved here.</p>}
      {tokens.map((t) => (
        <div className="card" key={t.id} style={{ marginBottom: 12 }}>
          <div className="muted">{t.meter.label} · {t.meter.disco.name}</div>
          <div className="token-value" style={{ margin: "8px 0" }}>{t.tokenValue}</div>
          <div className="muted">
            ₦{t.amount} {t.units ? `· ${t.units} kWh` : ""} · {new Date(t.createdAt).toLocaleDateString()}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={() => copy(t)}>{copiedId === t.id ? "Copied!" : "Copy"}</button>
            <button className="btn btn-ghost" onClick={() => toggleLoaded(t)}>
              {t.loadingStatus === "LOADED" ? "Marked loaded ✓" : "Mark as loaded"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
