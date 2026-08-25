import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Stock from "./pages/Stock.jsx";
import EntryForm from "./pages/EntryForm.jsx";
import History from "./pages/History.jsx";
import AdminBranches from "./pages/admin/Branches.jsx";
import AdminWarehouses from "./pages/admin/Warehouses.jsx";
import AdminItems from "./pages/admin/Items.jsx";
import AdminStockTargets from "./pages/admin/StockTargets.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="entry" element={<EntryForm />} />
        <Route path="stock" element={<Stock />} />
        <Route path="history" element={<History />} />
        <Route path="admin/branches" element={<AdminBranches />} />
        <Route path="admin/warehouses" element={<AdminWarehouses />} />
        <Route path="admin/items" element={<AdminItems />} />
        <Route path="admin/stock-targets" element={<AdminStockTargets />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
