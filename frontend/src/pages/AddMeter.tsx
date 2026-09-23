import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { useMeters, Disco, Meter } from "../state/MeterContext";
import { TopBar } from "../components/TopBar";
import { ErrorBanner, Loading } from "../components/LoadingAndError";

export default function AddMeter() {
  const navigate = useNavigate();
  const { refreshMeters } = useMeters();
  const [discos, setDiscos] = useState<Disco[]>([]);
  const [label, setLabel] = useState("My Home");
  const [meterNumber, setMeterNumber] = useState("");
  const [discoId, setDiscoId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "verifying" | "verified">("form");
  const [verifiedMeter, setVerifiedMeter] = useState<Meter | null>(null);
  const [loadingDiscos, setLoadingDiscos] = useState(true);

  useEffect(() => {
    api
      .get<Disco[]>("/meters/discos")
      .then((data) => {
        setDiscos(data);
        setDiscoId(data[0]?.id ?? "");
      })
      .finally(() => setLoadingDiscos(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("verifying");
    try {
      const meter = await api.post<Meter>("/meters", { label, meterNumber, discoId, phoneNumber: phoneNumber || undefined });
      const verified = await api.post<Meter>(`/meters/${meter.id}/verify`, {});
      setVerifiedMeter(verified);
      setStep("verified");
      await refreshMeters();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't add this meter. Please try again.");
      setStep("form");
    }
  }

  if (loadingDiscos) return <Loading />;

  if (step === "verified" && verifiedMeter) {
    return (
      <div className="screen">
        <TopBar title="Meter verified" />
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>✅</div>
          <h2 style={{ margin: "10px 0 4px" }}>{verifiedMeter.customerName ?? "Meter verified"}</h2>
          <p className="muted">{verifiedMeter.meterNumber} · {verifiedMeter.disco.name}</p>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate("/home")}>
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title="Add your meter" back />
      {error && <ErrorBanner message={error} />}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label>What should we call this meter?</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My Home" required />
        </div>
        <div className="field">
          <label>Meter number</label>
          <input value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} placeholder="04212345678" required />
        </div>
        <div className="field">
          <label>DISCO</label>
          <select value={discoId} onChange={(e) => setDiscoId(e.target.value)} required>
            {discos.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Phone number (optional, some DISCOs require this)</label>
          <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="080..." />
        </div>
        <button className="btn btn-primary" disabled={step === "verifying"} type="submit">
          {step === "verifying" ? "Verifying meter..." : "Verify meter"}
        </button>
      </form>
    </div>
  );
}
