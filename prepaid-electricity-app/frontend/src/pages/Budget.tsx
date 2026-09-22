import { useEffect, useState } from "react";
import { TopBar } from "../components/TopBar";
import { Loading } from "../components/LoadingAndError";
import { useMeters } from "../state/MeterContext";
import { api } from "../api/client";

interface BudgetStatus {
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export default function Budget() {
  const { selectedMeter } = useMeters();
  const [status, setStatus] = useState<BudgetStatus | null | undefined>(undefined);
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(undefined);
    api.get<BudgetStatus | null>(`/budget${selectedMeter ? `?meterId=${selectedMeter.id}` : ""}`).then(setStatus);
  }, [selectedMeter]);

  async function save() {
    if (!limit) return;
    setSaving(true);
    try {
      await api.post("/budget", { monthlyLimit: Number(limit), meterId: selectedMeter?.id });
      const updated = await api.get<BudgetStatus | null>(`/budget${selectedMeter ? `?meterId=${selectedMeter.id}` : ""}`);
      setStatus(updated);
      setLimit("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <TopBar title="Electricity budget" back />

      {status === undefined ? (
        <Loading />
      ) : status ? (
        <div className="card">
          <div className="muted">This month</div>
          <div style={{ fontSize: 22, fontWeight: 700, margin: "6px 0" }}>
            ₦{status.spent.toLocaleString()} / ₦{status.monthlyLimit.toLocaleString()}
          </div>
          <div style={{ background: "var(--color-border)", borderRadius: 8, height: 10, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, status.percentUsed)}%`,
                background: status.percentUsed > 90 ? "var(--color-danger)" : "var(--color-primary)",
                height: "100%",
              }}
            />
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            You have ₦{status.remaining.toLocaleString()} remaining in your monthly electricity budget.
          </p>
        </div>
      ) : (
        <p className="muted">No budget set for this month yet.</p>
      )}

      <div className="section-title">{status ? "Update budget" : "Set a budget"}</div>
      <div className="card">
        <div className="field">
          <label>Monthly limit (₦)</label>
          <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="50000" />
        </div>
        <button className="btn btn-primary" disabled={saving || !limit} onClick={save}>
          {saving ? "Saving..." : "Save budget"}
        </button>
      </div>
    </div>
  );
}
