import { useEffect, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { Loading } from "../../components/LoadingAndError";
import { api } from "../../api/client";
import { Link } from "react-router-dom";

interface Overview {
  users: { total: number; active: number; suspended: number };
  meters: { total: number; verified: number };
  transactions: Record<string, number>;
  revenue: { totalSuccessfulVolume: number };
  providers: Array<{ name: string; configured: boolean }>;
}

export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<Overview>("/admin/overview").then(setData);
  }, []);

  if (!data) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="Admin dashboard" back />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="card"><div className="muted">Users</div><div className="stat-value" style={{ fontSize: 28 }}>{data.users.total}</div></div>
        <div className="card"><div className="muted">Verified meters</div><div className="stat-value" style={{ fontSize: 28 }}>{data.meters.verified}/{data.meters.total}</div></div>
        <div className="card"><div className="muted">Revenue (successful)</div><div className="stat-value" style={{ fontSize: 22 }}>₦{data.revenue.totalSuccessfulVolume.toLocaleString()}</div></div>
        <div className="card"><div className="muted">Suspended users</div><div className="stat-value" style={{ fontSize: 28 }}>{data.users.suspended}</div></div>
      </div>

      <div className="section-title">Transactions by status</div>
      <div className="card">
        {Object.entries(data.transactions).map(([status, count]) => (
          <div key={status} className="list-row"><span>{status}</span><span>{count}</span></div>
        ))}
      </div>

      <div className="section-title">Provider status</div>
      <div className="card">
        {data.providers.map((p) => (
          <div key={p.name} className="list-row">
            <span>{p.name}</span>
            <span className={`pill ${p.configured ? "pill-success" : "pill-failed"}`}>
              {p.configured ? "Configured" : "Not configured"}
            </span>
          </div>
        ))}
      </div>

      <div className="section-title">Manage</div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link to="/admin/users" className="list-row"><span>Users</span><span>›</span></Link>
        <Link to="/admin/transactions" className="list-row"><span>Transactions</span><span>›</span></Link>
        <Link to="/admin/support" className="list-row"><span>Support tickets</span><span>›</span></Link>
      </div>
    </div>
  );
}
