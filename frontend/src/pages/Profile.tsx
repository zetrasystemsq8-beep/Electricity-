import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { StatusPill } from "../components/StatusPill";
import { Loading } from "../components/LoadingAndError";
import { useAuth } from "../state/AuthContext";
import { useMeters } from "../state/MeterContext";
import { api } from "../api/client";

interface Notification { id: string; title: string; body: string; category: string; readAt: string | null; createdAt: string; }

export default function Profile() {
  const { user, logout } = useAuth();
  const { meters, refreshMeters } = useMeters();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    api.get<Notification[]>("/notifications").then(setNotifications);
  }, []);

  async function verifyMeter(id: string) {
    await api.post(`/meters/${id}/verify`, {});
    await refreshMeters();
  }

  function doLogout() {
    logout();
    navigate("/welcome");
  }

  if (!user) return <Loading />;

  return (
    <div className="screen">
      <TopBar title="Profile" />

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 18 }}>{user.fullName}</div>
        <div className="muted">{user.phoneNumber}</div>
      </div>

      <div className="section-title">My meters</div>
      <div className="card">
        {meters.map((m) => (
          <div key={m.id} className="list-row">
            <div>
              <div style={{ fontWeight: 600 }}>{m.label}</div>
              <div className="muted">{m.meterNumber} · {m.disco.name}</div>
            </div>
            {m.verificationStatus === "VERIFIED" ? (
              <StatusPill status="SUCCESSFUL" />
            ) : (
              <button className="btn btn-secondary" style={{ width: "auto", padding: "8px 12px" }} onClick={() => verifyMeter(m.id)}>
                Verify
              </button>
            )}
          </div>
        ))}
        <Link to="/add-meter" className="btn btn-secondary" style={{ marginTop: 12 }}>Add another meter</Link>
      </div>

      <div className="section-title">Manage</div>
      <div className="card">
        <Link to="/budget" className="list-row"><span>Electricity budget</span><span>›</span></Link>
        <Link to="/support" className="list-row"><span>Support</span><span>›</span></Link>
        {user.role === "ADMIN" && <Link to="/admin" className="list-row"><span>Admin dashboard</span><span>›</span></Link>}
      </div>

      <div className="section-title">Notifications</div>
      <div className="card">
        {notifications === null ? (
          <Loading />
        ) : notifications.length === 0 ? (
          <p className="muted">No notifications yet.</p>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <div key={n.id} className="list-row">
              <div>
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                <div className="muted">{n.body}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="btn btn-danger" style={{ marginTop: 20 }} onClick={doLogout}>Log out</button>
    </div>
  );
}
