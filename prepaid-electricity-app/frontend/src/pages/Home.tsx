import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useMeters } from "../state/MeterContext";
import { TopBar } from "../components/TopBar";
import { StatusPill } from "../components/StatusPill";
import { Loading } from "../components/LoadingAndError";

interface BalanceView {
  balanceKwh: number;
  source: string;
  estimatedDaysRemaining: number | null;
  averageDailyUsageKwh: number | null;
}

interface TransactionRecord {
  id: string;
  status: string;
  amountPaid: number | null;
  unitsKwh: number | null;
  createdAt: string;
  purchase: { amountRequested: number; meter: { label: string } };
}

export default function Home() {
  const { meters, selectedMeter, selectMeter, loading: metersLoading } = useMeters();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<BalanceView | null | undefined>(undefined);
  const [lastTxn, setLastTxn] = useState<TransactionRecord | null>(null);
  const [todayUsage, setTodayUsage] = useState<{ totalKwh: number } | null>(null);

  useEffect(() => {
    if (!selectedMeter) return;
    setBalance(undefined);
    api.get<BalanceView | null>(`/meters/${selectedMeter.id}/balance`).then(setBalance);
    api
      .get<TransactionRecord[]>("/transactions")
      .then((all) => setLastTxn(all.find((t) => t.purchase.meter.label === selectedMeter.label && t.status === "SUCCESSFUL") ?? null));
    api.get<{ totalKwh: number }>(`/usage/${selectedMeter.id}/summary?period=TODAY`).then(setTodayUsage);
  }, [selectedMeter]);

  if (metersLoading) return <Loading />;

  if (meters.length === 0) {
    return (
      <div className="screen">
        <TopBar title="PowerPal" />
        <div className="card" style={{ textAlign: "center" }}>
          <p>You haven't added a meter yet.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate("/add-meter")}>
            Add your meter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar
        title="PowerPal"
        right={
          meters.length > 1 ? (
            <select
              value={selectedMeter?.id}
              onChange={(e) => selectMeter(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)" }}
            >
              {meters.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          ) : undefined
        }
      />

      <div className="card">
        <div className="muted">Electricity left · {selectedMeter?.label}</div>
        {balance === undefined ? (
          <Loading label="Loading balance..." />
        ) : balance === null ? (
          <p className="muted" style={{ marginTop: 8 }}>
            No balance yet - buy electricity or enter a meter reading to get started.
          </p>
        ) : (
          <>
            <div style={{ margin: "8px 0" }}>
              <span className="stat-value">{balance.balanceKwh}</span> <span className="stat-unit">kWh</span>
            </div>
            <StatusPill status={balance.source} />
            {balance.estimatedDaysRemaining != null && (
              <p className="muted" style={{ marginTop: 10 }}>
                Estimated remaining time: <strong>{balance.estimatedDaysRemaining} days</strong>
              </p>
            )}
          </>
        )}
      </div>

      {lastTxn && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="muted">Last purchase</div>
          <div style={{ fontSize: 22, fontWeight: 700, margin: "4px 0" }}>₦{lastTxn.amountPaid ?? lastTxn.purchase.amountRequested}</div>
          <div className="muted">
            {new Date(lastTxn.createdAt).toLocaleDateString()} · {lastTxn.unitsKwh ?? "—"} kWh
          </div>
        </div>
      )}

      {todayUsage && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="muted">Today's usage</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{todayUsage.totalKwh} kWh</div>
        </div>
      )}

      <div className="section-title">Quick actions</div>
      <div className="quick-actions">
        <Link to="/buy" className="quick-action"><span className="icon">⚡</span>Buy</Link>
        <Link to="/tokens" className="quick-action"><span className="icon">🔑</span>My Token</Link>
        <Link to={`/meter/${selectedMeter?.id}/guide`} className="quick-action"><span className="icon">📟</span>Check Meter</Link>
        <Link to="/history" className="quick-action"><span className="icon">🧾</span>History</Link>
        <Link to="/usage" className="quick-action"><span className="icon">📊</span>Usage</Link>
      </div>
    </div>
  );
}
