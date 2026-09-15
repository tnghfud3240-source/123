import React, { useEffect, useMemo, useState } from "react";
import client from "../api/client.js";
import { HOURS, formatOccurredAt } from "../utils/datetime.js";

const TYPE_LABEL = { in: "입고", out: "사용", adjust: "조정", convert: "전환" };
const TYPE_STYLE = {
  in: "bg-emerald-100 text-emerald-700",
  out: "bg-rose-100 text-rose-700",
  adjust: "bg-amber-100 text-amber-700",
  convert: "bg-violet-100 text-violet-700",
};

export default function History() {
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({
    branch_id: "",
    warehouse_id: "",
    type: "",
    from: "",
    fromHour: "",
    to: "",
    toHour: "",
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([client.get("/branches"), client.get("/warehouses")]).then(([branchRes, warehouseRes]) => {
      setBranches(branchRes.data);
      setWarehouses(warehouseRes.data);
    });
  }, []);

  const warehousesInBranch = useMemo(
    () => (filters.branch_id ? warehouses.filter((w) => String(w.branch_id) === filters.branch_id) : warehouses),
    [warehouses, filters.branch_id]
  );

  // 염수(리터)도 톤 환산해서 다른 품목과 같은 단위(톤)로 합산한다.
  const totalTons = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const qty = r.type === "convert" ? Math.abs(r.delta) : r.quantity;
        return sum + qty * r.item_to_ton_factor;
      }, 0),
    [rows]
  );

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filters.branch_id) params.branch_id = filters.branch_id;
    if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
    if (filters.type) params.type = filters.type;
    // 시간을 선택하지 않으면 시작은 00시, 끝은 23시(59분59초)까지로 하루 전체를 조회한다.
    if (filters.from) params.from = `${filters.from}T${filters.fromHour || "00"}:00:00`;
    if (filters.to) params.to = `${filters.to}T${filters.toHour || "23"}:59:59`;
    client
      .get("/transactions", { params })
      .then((res) => setRows(res.data))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold text-slate-800">입출고 이력</h2>
        {rows.length > 0 && (
          <div className="text-sm text-slate-600">
            합계:{" "}
            <span className="font-semibold text-slate-800">
              {totalTons.toLocaleString(undefined, { maximumFractionDigits: 2 })} 톤
            </span>
            <span className="text-slate-400"> ({rows.length.toLocaleString()}건)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          value={filters.branch_id}
          onChange={(e) => setFilters({ ...filters, branch_id: e.target.value, warehouse_id: "" })}
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
          value={filters.warehouse_id}
          onChange={(e) => setFilters({ ...filters, warehouse_id: e.target.value })}
        >
          <option value="">전체 창고</option>
          {warehousesInBranch.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">전체 유형</option>
          <option value="in">입고</option>
          <option value="out">사용</option>
          <option value="adjust">조정</option>
          <option value="convert">전환</option>
        </select>
        <div className="flex gap-1">
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm w-full min-w-0"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <select
            className="border border-slate-300 rounded-lg px-1 py-2 bg-white text-sm"
            value={filters.fromHour}
            onChange={(e) => setFilters({ ...filters, fromHour: e.target.value })}
          >
            <option value="">시작</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}시
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          <input
            type="date"
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm w-full min-w-0"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
          <select
            className="border border-slate-300 rounded-lg px-1 py-2 bg-white text-sm"
            value={filters.toHour}
            onChange={(e) => setFilters({ ...filters, toHour: e.target.value })}
          >
            <option value="">종료</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}시
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="px-4 py-2">날짜</th>
              <th className="px-4 py-2">지사</th>
              <th className="px-4 py-2">창고</th>
              <th className="px-4 py-2">품목</th>
              <th className="px-4 py-2">유형</th>
              <th className="px-4 py-2 text-right">수량</th>
              <th className="px-4 py-2">담당자</th>
              <th className="px-4 py-2">메모</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  불러오는 중...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  이력이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">{formatOccurredAt(r.occurred_at)}</td>
                  <td className="px-4 py-2">{r.branch_name}</td>
                  <td className="px-4 py-2">{r.warehouse_name}</td>
                  <td className="px-4 py-2">
                    {r.item_category} <span className="text-slate-400">· {r.item_name}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLE[r.type]}`}>
                      {TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {r.type === "convert" && r.delta > 0 ? "+" : ""}
                    {(r.type === "convert" ? r.delta : r.quantity).toLocaleString()} {r.item_unit}
                    {r.item_unit === "리터" && (
                      <span className="block text-xs font-normal text-slate-400">
                        (
                        {(
                          (r.type === "convert" ? Math.abs(r.delta) : r.quantity) * r.item_to_ton_factor
                        ).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                        톤)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{r.operator_name || "-"}</td>
                  <td className="px-4 py-2 text-slate-500">{r.memo || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
