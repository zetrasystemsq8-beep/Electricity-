import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export function TopBar({ title, right, back }: { title: string; right?: ReactNode; back?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="top-bar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {back && (
          <button className="btn-ghost" style={{ background: "none", border: "none", fontSize: 20 }} onClick={() => navigate(-1)}>
            ←
          </button>
        )}
        <h1>{title}</h1>
      </div>
      {right}
    </div>
  );
}
