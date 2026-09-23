import { useEffect, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { StatusPill } from "../../components/StatusPill";
import { Loading } from "../../components/LoadingAndError";
import { api } from "../../api/client";

interface AdminTxn {
  id: string;
  status: string;
  amountPaid: number | null;
  createdAt: string;
  purchase: { amountRequested: number; meter: { label: string }; user: { fullName: string } };
}

export default function AdminTransactions() {
  const [txns, setTxns] = useState<AdminTxn[] | null>(null);

  useEffect(() => {
    api.get<AdminTxn[]>("/admin/transactions").then(setTxns);
  }, []);

  if (!txns) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="Transactions" back />
      <div className="card">
        {txns.map((t) => (
          <div key={t.id} className="list-row">
            <div>
              <div style={{ fontWeight: 600 }}>{t.purchase.user.fullName}</div>
              <div className="muted">{t.purchase.meter.label} · {new Date(t.createdAt).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>₦{t.amountPaid ?? t.purchase.amountRequested}</div>
              <StatusPill status={t.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
