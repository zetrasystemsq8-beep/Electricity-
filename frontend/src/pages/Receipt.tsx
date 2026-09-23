import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusPill } from "../components/StatusPill";
import { Loading } from "../components/LoadingAndError";
import { api } from "../api/client";

interface TransactionDetail {
  id: string;
  internalRef: string;
  providerTransactionId: string | null;
  status: string;
  amountPaid: number | null;
  electricityCreditRaw: number | null;
  otherChargesRaw: number | null;
  unitsKwh: number | null;
  createdAt: string;
  purchase: {
    amountRequested: number;
    meter: { label: string; meterNumber: string; disco: { name: string } };
    token?: { tokenValue: string } | null;
  };
  events: Array<{ toStatus: string; note: string | null; createdAt: string }>;
}

export default function Receipt() {
  const { id } = useParams();
  const [txn, setTxn] = useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (id) api.get<TransactionDetail>(`/transactions/${id}`).then(setTxn);
  }, [id]);

  if (!txn) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="Receipt" back />

      <div className="card">
        <StatusPill status={txn.status} />
        <div style={{ fontSize: 26, fontWeight: 800, margin: "10px 0" }}>
          ₦{txn.amountPaid ?? txn.purchase.amountRequested}
        </div>

        <Row label="Meter" value={txn.purchase.meter.meterNumber} />
        <Row label="DISCO" value={txn.purchase.meter.disco.name} />
        {txn.electricityCreditRaw != null && <Row label="Electricity credit" value={`₦${txn.electricityCreditRaw}`} />}
        {txn.otherChargesRaw != null && <Row label="Other applicable charges" value={`₦${txn.otherChargesRaw}`} />}
        {txn.unitsKwh != null && <Row label="Units received" value={`${txn.unitsKwh} kWh`} />}
        {txn.purchase.token && <Row label="Token" value={txn.purchase.token.tokenValue} />}
        <Row label="Receipt number" value={txn.internalRef} />
        <Row label="Date" value={new Date(txn.createdAt).toLocaleString()} />
      </div>

      <div className="section-title">Transaction timeline</div>
      <div className="card">
        {txn.events.map((e, i) => (
          <div key={i} className="list-row">
            <span>{e.toStatus}</span>
            <span className="muted">{new Date(e.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="list-row">
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}
