import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./state/AuthContext";
import { MeterProvider } from "./state/MeterContext";
import { BottomNav } from "./components/BottomNav";
import { Loading } from "./components/LoadingAndError";

import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import AddMeter from "./pages/AddMeter";
import Home from "./pages/Home";
import Buy from "./pages/Buy";
import Confirm from "./pages/Confirm";
import PurchaseSuccess from "./pages/PurchaseSuccess";
import TokenVault from "./pages/TokenVault";
import History from "./pages/History";
import Receipt from "./pages/Receipt";
import Usage from "./pages/Usage";
import MeterGuide from "./pages/MeterGuide";
import Support from "./pages/Support";
import Budget from "./pages/Budget";
import Profile from "./pages/Profile";
import AdminOverview from "./pages/Admin/Overview";
import AdminUsers from "./pages/Admin/Users";
import AdminTransactions from "./pages/Admin/Transactions";
import AdminSupport from "./pages/Admin/Support";

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/welcome" state={{ from: location }} replace />;
  return (
    <MeterProvider>
      <Outlet />
    </MeterProvider>
  );
}

function RequireAdmin() {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/home" replace />;
  return <Outlet />;
}

function MainTabsLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Navigate to={user ? "/home" : "/welcome"} replace />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route path="/add-meter" element={<AddMeter />} />
          <Route path="/buy/confirm" element={<Confirm />} />
          <Route path="/purchase/success" element={<PurchaseSuccess />} />
          <Route path="/tokens" element={<TokenVault />} />
          <Route path="/receipt/:id" element={<Receipt />} />
          <Route path="/meter/:meterId/guide" element={<MeterGuide />} />
          <Route path="/support" element={<Support />} />

          <Route element={<MainTabsLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/history" element={<History />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/transactions" element={<AdminTransactions />} />
            <Route path="/admin/support" element={<AdminSupport />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
