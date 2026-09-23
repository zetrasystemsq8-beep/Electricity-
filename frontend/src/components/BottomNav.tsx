import { NavLink } from "react-router-dom";

const items = [
  { to: "/home", icon: "🏠", label: "Home" },
  { to: "/buy", icon: "⚡", label: "Buy" },
  { to: "/usage", icon: "📊", label: "Usage" },
  { to: "/history", icon: "🧾", label: "History" },
  { to: "/profile", icon: "👤", label: "Profile" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
