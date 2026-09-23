import { useEffect, useState } from "react";
import { TopBar } from "../components/TopBar";
import { Loading } from "../components/LoadingAndError";
import { useMeters } from "../state/MeterContext";
import { api } from "../api/client";

type Period = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "PREVIOUS_MONTH";
const PERIODS: Period[] = ["TODAY", "THIS_WEEK", "THIS_MONTH", "PREVIOUS_MONTH"];
const PERIOD_LABEL: Record<Period, string> = {
  TODAY: "Today", THIS_WEEK: "This week", THIS_MONTH: "This month", PREVIOUS_MONTH: "Previous month",
};

interface Summary { totalKwh: number; averageDailyKwh: number | null; note?: string; }
interface Comparison {
  hasEnoughData: boolean;
  normalDailyKwh?: number;
  currentDailyKwh?: number;
  percentChange?: number;
  direction?: string;
  message?: string;
}

export default function Usage() {
  const { selectedMeter } = useMeters();
  const [period, setPeriod] = useState<Period>("THIS_WEEK");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [reading, setReading] = useState("");
  const [savingReading, setSavingReading] = useState(false);

  useEffect(() => {
    if (!selectedMeter) return;
    api.get<Summary>(`/usage/${selectedMeter.id}/summary?period=${period}`).then(setSummary);
  }, [selectedMeter, period]);

  useEffect(() => {
    if (!selectedMeter) return;
    api.get<Comparison>(`/usage/${selectedMeter.id}/comparison`).then(setComparison);
  }, [selectedMeter]);

  async function submitReading() {
    if (!selectedMeter || !reading) return;
    setSavingReading(true);
    try {
      await api.post(`/meters/${selectedMeter.id}/reading`, { balanceKwh: Number(reading) });
      setReading("");
    } finally {
      setSavingReading(false);
    }
  }

  if (!selectedMeter) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="Usage" />

      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            className={p === period ? "btn btn-primary" : "btn btn-secondary"}
            style={{ width: "auto", padding: "8px 14px", whiteSpace: "nowrap" }}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="card">
        {summary === null ? (
          <Loading />
        ) : (
          <>
            <div className="muted">Units consumed</div>
            <div className="stat-value">{summary.totalKwh} <span className="stat-unit">kWh</span></div>
            {summary.averageDailyKwh != null && <p className="muted">Average daily: {summary.averageDailyKwh} kWh</p>}
            {summary.note && <p className="muted">{summary.note}</p>}
          </>
        )}
      </div>

      {comparison && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="section-title" style={{ marginTop: 0 }}>Why are my units finishing fast?</div>
          {!comparison.hasEnoughData ? (
            <p className="muted">{comparison.message}</p>
          ) : (
            <>
              <p>
                Your electricity usage is{" "}
                {comparison.direction === "UP" ? "higher" : comparison.direction === "DOWN" ? "lower" : "about the same"} this week.
              </p>
              <Row label="Normal daily usage" value={`${comparison.normalDailyKwh} kWh`} />
              <Row label="Current daily usage" value={`${comparison.currentDailyKwh} kWh`} />
              <Row label="Change" value={`${comparison.percentChange! > 0 ? "+" : ""}${comparison.percentChange}%`} />
            </>
          )}
        </div>
      )}

      <div className="section-title">Update your meter reading</div>
      <div className="card">
        <p className="muted">Enter the units currently showing on your meter to refresh your estimate.</p>
        <div className="field">
          <input type="number" value={reading} onChange={(e) => setReading(e.target.value)} placeholder="e.g. 42.7" />
        </div>
        <button className="btn btn-primary" disabled={savingReading || !reading} onClick={submitReading}>
          {savingReading ? "Saving..." : "Update balance"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="list-row">
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
