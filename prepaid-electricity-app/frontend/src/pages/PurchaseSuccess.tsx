import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { TopBar } from "../components/TopBar";
import { StatusPill } from "../components/StatusPill";
import { Loading } from "../components/LoadingAndError";

interface TransactionDetail {
  id: string;
  status: string;
  amountPaid: number | null;
  unitsKwh: number | null;
  purchase: {
    amountRequested: number;
    meter: { id: string; label: string; meterNumber: string; disco: { name: string } };
    token?: { id: string; tokenValue: string } | null;
  };
}

export default function PurchaseSuccess() {
  const location = useLocation() as { state?: { transactionId: string } };
  const navigate = useNavigate();
  const [txn, setTxn] = useState<TransactionDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!location.state?.transactionId) return;
    api.get<TransactionDetail>(`/transactions/${location.state.transactionId}`).then(setTxn);
  }, [location.state]);

  if (!location.state?.transactionId) {
    return (
      <div className="screen">
        <TopBar title="Purchase" />
        <p className="muted">No purchase to show. Check History for your recent purchases.</p>
        <button className="btn btn-secondary" onClick={() => navigate("/history")}>Go to History</button>
      </div>
    );
  }

  if (!txn) return <Loading />;

  const token = txn.purchase.token;

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token.tokenValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="screen">
      <TopBar title="Purchase" />

      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36 }}>{txn.status === "SUCCESSFUL" ? "✅" : txn.status === "FAILED" ? "❌" : "⏳"}</div>
        <StatusPill status={txn.status} />
        <div style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 2px" }}>₦{txn.amountPaid ?? txn.purchase.amountRequested}</div>
        <p className="muted">{txn.purchase.meter.label} · {txn.purchase.meter.disco.name}</p>
      </div>

      {token && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="muted">Electricity token</div>
          <div className="token-value" style={{ margin: "10px 0" }}>{token.tokenValue}</div>
          {txn.unitsKwh && <p className="muted">Units: {txn.unitsKwh} kWh</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={copyToken}>{copied ? "Copied!" : "Copy token"}</button>
            <button
              className="btn btn-secondary"
              onClick={() => navigator.share?.({ text: `PowerPal token: ${token.tokenValue}` })}
            >
              Share
            </button>
          </div>
        </div>
      )}

      {txn.status === "PENDING" && (
        <p className="muted" style={{ marginTop: 12 }}>
          Your provider is still confirming this purchase. Check History in a few minutes if the token doesn't
          appear here.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        <Link to={`/meter/${txn.purchase.meter.id}/guide`} className="btn btn-secondary">How to load</Link>
        <Link to="/home" className="btn btn-primary">Back to Home</Link>
      </div>
    </div>
  );
}
