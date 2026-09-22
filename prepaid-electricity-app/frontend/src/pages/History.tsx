import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusPill } from "../components/StatusPill";
import { Loading } from "../components/LoadingAndError";
import { api } from "../api/client";

interface TransactionRow {
  id: string;
  status: string;
  amountPaid: number | null;
  unitsKwh: number | null;
  createdAt: string;
  purchase: { amountRequested: number; meter: { label: string } };
}

export default function History() {
  const [txns, setTxns] = useState<TransactionRow[] | null>(null);

  useEffect(() => {
    api.get<TransactionRow[]>("/transactions").then(setTxns);
  }, []);

  if (!txns) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="History" />
      {txns.length === 0 && <p className="muted">No purchases yet.</p>}
      {txns.map((t) => (
        <Link to={`/receipt/${t.id}`} key={t.id} className="list-row">
          <div>
            <div style={{ fontWeight: 600 }}>{t.purchase.meter.label}</div>
            <div className="muted">{new Date(t.createdAt).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>₦{t.amountPaid ?? t.purchase.amountRequested}</div>
            <StatusPill status={t.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
