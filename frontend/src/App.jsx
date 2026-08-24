import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Stock from "./pages/Stock.jsx";
import EntryForm from "./pages/EntryForm.jsx";
import History from "./pages/History.jsx";
import AdminBranches from "./pages/admin/Branches.jsx";
import AdminWarehouses from "./pages/admin/Warehouses.jsx";
import AdminItems from "./pages/admin/Items.jsx";
import AdminStockTargets from "./pages/admin/StockTargets.jsx";
import AdminUsers from "./pages/admin/Users.jsx";

function RequireAuth({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/entry" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <RequireAuth roles={["admin", "office"]}>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="entry" element={<EntryForm />} />
        <Route path="stock" element={<Stock />} />
        <Route path="history" element={<History />} />
        <Route
          path="admin/branches"
          element={
            <RequireAuth roles={["admin", "office"]}>
              <AdminBranches />
            </RequireAuth>
          }
        />
        <Route
          path="admin/warehouses"
          element={
            <RequireAuth roles={["admin", "office"]}>
              <AdminWarehouses />
            </RequireAuth>
          }
        />
        <Route
          path="admin/items"
          element={
            <RequireAuth roles={["admin", "office"]}>
              <AdminItems />
            </RequireAuth>
          }
        />
        <Route
          path="admin/stock-targets"
          element={
            <RequireAuth roles={["admin", "office"]}>
              <AdminStockTargets />
            </RequireAuth>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAuth roles={["admin", "office"]}>
              <AdminUsers />
            </RequireAuth>
          }
        />
      </Route>
      <Route
        path="*"
        element={<Navigate to={user?.role === "field" ? "/entry" : "/"} replace />}
      />
    </Routes>
  );
}
