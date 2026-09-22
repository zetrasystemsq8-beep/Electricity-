import { useEffect, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { Loading } from "../../components/LoadingAndError";
import { api } from "../../api/client";

interface AdminUser { id: string; phoneNumber: string; fullName: string; status: string; role: string; createdAt: string; }

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  useEffect(() => {
    api.get<AdminUser[]>("/admin/users").then(setUsers);
  }, []);

  async function toggleStatus(u: AdminUser) {
    const status = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await api.post(`/admin/users/${u.id}/status`, { status });
    setUsers((prev) => prev?.map((x) => (x.id === u.id ? { ...x, status } : x)) ?? null);
  }

  if (!users) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="Users" back />
      <div className="card">
        {users.map((u) => (
          <div key={u.id} className="list-row">
            <div>
              <div style={{ fontWeight: 600 }}>{u.fullName}</div>
              <div className="muted">{u.phoneNumber}</div>
            </div>
            <button
              className={`btn ${u.status === "ACTIVE" ? "btn-danger" : "btn-secondary"}`}
              style={{ width: "auto", padding: "8px 12px" }}
              onClick={() => toggleStatus(u)}
            >
              {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
