import { Link } from "react-router-dom";

export default function Welcome() {
  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", justifyContent: "center", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>⚡</div>
        <h1 style={{ fontSize: 26, margin: "12px 0 6px" }}>PowerPal</h1>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.5 }}>
          Understand your electricity. Buy units. Track your usage. Never get surprised.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link to="/register" className="btn btn-primary">Create account</Link>
        <Link to="/login" className="btn btn-secondary">I already have an account</Link>
      </div>
    </div>
  );
}
