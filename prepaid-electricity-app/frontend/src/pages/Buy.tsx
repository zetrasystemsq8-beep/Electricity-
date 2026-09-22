import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMeters } from "../state/MeterContext";
import { TopBar } from "../components/TopBar";
import { ErrorBanner } from "../components/LoadingAndError";

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000];

export default function Buy() {
  const { meters, selectedMeter, selectMeter } = useMeters();
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number | "">("");
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifiedMeters = meters.filter((m) => m.verificationStatus === "VERIFIED");

  function goToConfirm() {
    if (!selectedMeter) {
      setError("Choose a meter first.");
      return;
    }
    if (selectedMeter.verificationStatus !== "VERIFIED") {
      setError("This meter isn't verified yet. Verify it from Profile > Meters before buying.");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Enter an amount.");
      return;
    }
    navigate("/buy/confirm", { state: { meterId: selectedMeter.id, amount } });
  }

  return (
    <div className="screen">
      <TopBar title="Buy electricity" />
      {error && <ErrorBanner message={error} />}

      <div className="field">
        <label>Meter</label>
        <select value={selectedMeter?.id ?? ""} onChange={(e) => selectMeter(e.target.value)}>
          {verifiedMeters.length === 0 && <option value="">No verified meters</option>}
          {meters.map((m) => (
            <option key={m.id} value={m.id} disabled={m.verificationStatus !== "VERIFIED"}>
              {m.label} {m.verificationStatus !== "VERIFIED" ? "(not verified)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="section-title">Amount</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            className={amount === amt ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => { setAmount(amt); setCustomOpen(false); }}
          >
            ₦{amt.toLocaleString()}
          </button>
        ))}
        <button className={customOpen ? "btn btn-primary" : "btn btn-secondary"} onClick={() => setCustomOpen(true)}>
          Custom
        </button>
      </div>

      {customOpen && (
        <div className="field">
          <label>Custom amount (₦)</label>
          <input
            type="number"
            min={100}
            value={amount === "" ? "" : amount}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
          />
        </div>
      )}

      <button className="btn btn-primary" onClick={goToConfirm}>Continue</button>
    </div>
  );
}
