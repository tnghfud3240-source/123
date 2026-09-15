import React, { useEffect, useMemo, useState } from "react";
import client from "../../api/client.js";
import { submitTransaction } from "../../offline/sync.js";
import { todayStr, withCurrentTime } from "../../utils/datetime.js";

const OPERATOR_NAME_KEY = "snow_operator_name";

export default function StockAdjustment() {
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [stockRows, setStockRows] = useState([]);
  const [itemId, setItemId] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [date, setDate] = useState(todayStr());
  const [memo, setMemo] = useState("");
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem(OPERATOR_NAME_KEY) || "");
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleOperatorNameChange(value) {
    setOperatorName(value);
    localStorage.setItem(OPERATOR_NAME_KEY, value);
  }

  useEffect(() => {
    Promise.all([client.get("/branches"), client.get("/warehouses")]).then(([branchRes, warehouseRes]) => {
      setBranches(branchRes.data);
      setWarehouses(warehouseRes.data);
      setBranchId(String(branchRes.data[0]?.id || ""));
    });
  }, []);

  const warehousesInBranch = useMemo(
    () => warehouses.filter((w) => String(w.branch_id) === String(branchId)),
    [warehouses, branchId]
  );

  useEffect(() => {
    if (!warehousesInBranch.some((w) => String(w.id) === warehouseId)) {
      setWarehouseId(String(warehousesInBranch[0]?.id || ""));
    }
  }, [warehousesInBranch, warehouseId]);

  function reloadStock() {
    if (!warehouseId) {
      setStockRows([]);
      return;
    }
    client.get("/stock", { params: { warehouse_id: warehouseId } }).then((res) => setStockRows(res.data));
  }

  useEffect(reloadStock, [warehouseId]);

  useEffect(() => {
    if (!stockRows.some((r) => String(r.item_id) === itemId)) {
      setItemId(String(stockRows[0]?.item_id || ""));
    }
  }, [stockRows, itemId]);

  const selectedRow = stockRows.find((r) => String(r.item_id) === itemId);

  // 창고/품목을 바꿀 때마다 입력칸을 현재 재고량으로 초기화한다.
  useEffect(() => {
    setActualQty(selectedRow ? String(selectedRow.quantity) : "");
  }, [warehouseId, itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const diff = selectedRow && actualQty !== "" ? Number(actualQty) - selectedRow.quantity : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!warehouseId || !selectedRow) {
      setMessage({ type: "error", text: "창고와 품목을 확인하세요." });
      return;
    }
    if (actualQty === "" || Number.isNaN(Number(actualQty)) || Number(actualQty) < 0) {
      setMessage({ type: "error", text: "실제 재고 수량을 확인하세요." });
      return;
    }
    if (diff === 0) {
      setMessage({ type: "error", text: "기존 재고와 동일합니다. 변경할 수량을 입력하세요." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitTransaction({
        warehouse_id: Number(warehouseId),
        item_id: Number(itemId),
        type: "adjust",
        quantity: diff,
        occurred_at: withCurrentTime(date),
        memo,
        operator_name: operatorName,
      });
      if (result.queued) {
        setMessage({ type: "warn", text: "오프라인 상태입니다. 연결되면 자동으로 저장됩니다." });
      } else {
        setMessage({ type: "success", text: "재고가 조정되었습니다." });
      }
      setMemo("");
      reloadStock();
    } catch (err) {
      setMessage({ type: "error", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-slate-800 mb-2">재고 조정</h2>
      <p className="text-sm text-slate-500 mb-4">
        실사 등으로 확인한 실제 잔량과 시스템 재고가 다를 때, 창고별 품목의 재고를 직접 맞춰줍니다.
        입력한 실제 재고량과 현재 재고량의 차이만큼 조정 이력이 남습니다.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">지사</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">창고</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              {warehousesInBranch.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">품목</label>
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            {stockRows.map((r) => (
              <option key={r.item_id} value={r.item_id}>
                {r.category} · {r.item_name}
              </option>
            ))}
          </select>
        </div>

        {selectedRow && (
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            현재 재고: <span className="font-semibold text-slate-800">{selectedRow.quantity.toLocaleString()} {selectedRow.unit}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            실제 재고{selectedRow ? ` (${selectedRow.unit})` : ""}
          </label>
          <input
            type="number"
            step="any"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={actualQty}
            onChange={(e) => setActualQty(e.target.value)}
          />
          {selectedRow && actualQty !== "" && diff !== 0 && (
            <p className={`mt-1 text-sm font-semibold ${diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
              조정량: {diff > 0 ? "+" : ""}
              {diff.toLocaleString()} {selectedRow.unit}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">조정 일자</label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">담당자</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
              value={operatorName}
              onChange={(e) => handleOperatorNameChange(e.target.value)}
              placeholder="이름"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">사유 (메모)</label>
          <input
            type="text"
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 실사 결과 반영"
          />
        </div>

        {message && (
          <p
            className={`text-sm font-medium ${
              message.type === "success"
                ? "text-emerald-600"
                : message.type === "warn"
                ? "text-amber-600"
                : "text-rose-600"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-700 text-white font-semibold rounded-lg py-3 disabled:opacity-60"
        >
          {submitting ? "저장 중..." : "재고 조정 저장"}
        </button>
      </form>
    </div>
  );
}
