import React, { useEffect, useMemo, useState } from "react";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Stock() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [detailRows, setDetailRows] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const isField = user?.role === "field";

  useEffect(() => {
    Promise.all([client.get("/branches"), client.get("/warehouses")]).then(([branchRes, warehouseRes]) => {
      const visibleBranches = isField ? branchRes.data.filter((b) => b.id === user.branch_id) : branchRes.data;
      setBranches(visibleBranches);
      setWarehouses(warehouseRes.data);
      if (isField && user.branch_id) {
        setBranchId(String(user.branch_id));
      }
    });
  }, [user]);

  const warehousesInBranch = useMemo(
    () => (branchId ? warehouses.filter((w) => String(w.branch_id) === String(branchId)) : warehouses),
    [warehouses, branchId]
  );

  useEffect(() => {
    setLoading(true);
    const detailParams = {};
    if (branchId) detailParams.branch_id = branchId;
    if (warehouseId) detailParams.warehouse_id = warehouseId;
    const summaryParams = branchId ? { branch_id: branchId } : {};
    Promise.all([
      client.get("/stock", { params: detailParams }),
      client.get("/stock/branch-summary", { params: summaryParams }),
    ])
      .then(([detailRes, summaryRes]) => {
        setDetailRows(detailRes.data);
        setSummaryRows(summaryRes.data);
      })
      .finally(() => setLoading(false));
  }, [branchId, warehouseId]);

  const groupedDetail = useMemo(() => {
    const map = new Map();
    for (const r of detailRows) {
      const branchKey = r.branch_name;
      if (!map.has(branchKey)) map.set(branchKey, new Map());
      const whMap = map.get(branchKey);
      if (!whMap.has(r.warehouse_name)) whMap.set(r.warehouse_name, []);
      whMap.get(r.warehouse_name).push(r);
    }
    return map;
  }, [detailRows]);

  const summaryByBranch = useMemo(() => {
    const map = new Map();
    for (const r of summaryRows) {
      if (!map.has(r.branch_name)) map.set(r.branch_name, []);
      map.get(r.branch_name).push(r);
    }
    return map;
  }, [summaryRows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-slate-800">재고 현황</h2>
        <div className="flex gap-2">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setWarehouseId("");
            }}
            disabled={isField}
          >
            <option value="">전체 지사</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">전체 창고</option>
            {warehousesInBranch.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">불러오는 중...</p>
      ) : (
        [...groupedDetail.entries()].map(([branchName, whMap]) => (
          <div key={branchName} className="mb-8">
            <h3 className="text-base font-bold text-brand-800 mb-2">{branchName}</h3>

            <div className="mb-3 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-700 text-sm">
                지사 합계 (소속 창고 전체, 톤 환산)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="px-4 py-2">품목</th>
                    <th className="px-4 py-2 text-right">합계(톤)</th>
                    <th className="px-4 py-2 text-right">비축기준(톤)</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(summaryByBranch.get(branchName) || []).map((s) => {
                    const low = s.total_tons < s.min_stock_tons;
                    return (
                      <tr key={s.category} className={`border-b last:border-0 ${low ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-2 font-medium text-slate-800">{s.category}</td>
                        <td className="px-4 py-2 text-right font-bold">{s.total_tons.toLocaleString()} 톤</td>
                        <td className="px-4 py-2 text-right text-slate-500">
                          {s.min_stock_tons.toLocaleString()} 톤
                        </td>
                        <td className="px-4 py-2 text-right">
                          {low && (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                              부족
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {[...whMap.entries()].map(([warehouseName, list]) => (
              <div key={warehouseName} className="mb-4 bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-brand-50 px-4 py-2 font-semibold text-brand-800">{warehouseName}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="px-4 py-2">품목</th>
                      <th className="px-4 py-2">형태</th>
                      <th className="px-4 py-2 text-right">재고</th>
                      <th className="px-4 py-2 text-right">톤 환산</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.item_id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium text-slate-800">{r.category}</td>
                        <td className="px-4 py-2 text-slate-500">{r.item_name}</td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {r.quantity.toLocaleString()} {r.unit}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-500">
                          {(r.quantity * r.to_ton_factor).toLocaleString()} 톤
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
