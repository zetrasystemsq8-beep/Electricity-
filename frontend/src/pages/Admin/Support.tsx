import { useEffect, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { Loading } from "../../components/LoadingAndError";
import { api } from "../../api/client";

interface AdminTicket {
  id: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  user: { fullName: string; phoneNumber: string };
}

const STATUSES = ["OPEN", "PROCESSING", "RESOLVED"];

export default function AdminSupport() {
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);

  useEffect(() => {
    api.get<AdminTicket[]>("/admin/support-tickets").then(setTickets);
  }, []);

  async function updateStatus(id: string, status: string) {
    await api.post(`/admin/support-tickets/${id}/status`, { status });
    setTickets((prev) => prev?.map((t) => (t.id === id ? { ...t, status } : t)) ?? null);
  }

  if (!tickets) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="Support tickets" back />
      <div className="card">
        {tickets.map((t) => (
          <div key={t.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ fontWeight: 600 }}>{t.category.replaceAll("_", " ")}</div>
            <div className="muted">{t.user.fullName} · {t.user.phoneNumber}</div>
            <p style={{ margin: "6px 0" }}>{t.description}</p>
            <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
