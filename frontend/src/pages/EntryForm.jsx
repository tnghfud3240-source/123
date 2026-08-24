import React, { useEffect, useMemo, useState } from "react";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { submitTransaction, submitConversion, submitSpray } from "../offline/sync.js";

const TYPE_OPTIONS = [
  { value: "in", label: "입고", color: "bg-emerald-600 active:bg-emerald-700" },
  { value: "out", label: "출고", color: "bg-rose-600 active:bg-rose-700" },
  { value: "convert", label: "전환", color: "bg-violet-600 active:bg-violet-700" },
];

const IN_CATEGORY_ORDER = ["염화칼슘", "소금(제설용)"];

// 염화칼슘은 항상 염수(리터)로 고정 차감, 소금은 화면에서 선택한 형태로 톤 환산 차감
const SPRAY_OPTIONS = [
  { value: "preliminary", label: "예비살포", calciumBrineLiters: 1500, saltTons: 4 },
  { value: "main", label: "본살포", calciumBrineLiters: 3000, saltTons: 8 },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function EntryForm() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState("in");

  // 입고
  const [categoryId, setCategoryId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");

  // 출고 (예비살포/본살포) — 염화칼슘은 항상 염수로 고정 차감되어 형태 선택이 없음
  const [sprayType, setSprayType] = useState("preliminary");
  const [count, setCount] = useState("");
  const [saltItemId, setSaltItemId] = useState("");

  // 전환 (같은 창고 또는 다른 창고/지사로)
  const [fromItemId, setFromItemId] = useState("");
  const [toItemId, setToItemId] = useState("");
  const [destBranchId, setDestBranchId] = useState("");
  const [destWarehouseId, setDestWarehouseId] = useState("");

  const [occurredAt, setOccurredAt] = useState(todayStr());
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isField = user?.role === "field";

  useEffect(() => {
    Promise.all([client.get("/branches"), client.get("/warehouses")]).then(([branchRes, warehouseRes]) => {
      // field 역할은 백엔드가 이미 자신의 지사 데이터만 내려주지만, 지사 선택 목록도
      // 자신의 지사 하나로 고정해 다른 지사가 보이지 않도록 한다.
      const visibleBranches = isField
        ? branchRes.data.filter((b) => b.id === user.branch_id)
        : branchRes.data;
      setBranches(visibleBranches);
      // 전환 목적지 선택은 소속 지사와 무관하게 전체 지사/창고 중에서 고를 수 있어야 한다.
      setAllBranches(branchRes.data);
      setWarehouses(warehouseRes.data);
      const initialBranchId = isField ? user.branch_id : visibleBranches[0]?.id || "";
      setBranchId(String(initialBranchId || ""));
      const firstWarehouse = warehouseRes.data.find((w) => String(w.branch_id) === String(initialBranchId));
      setWarehouseId(String(firstWarehouse?.id || ""));
    });
    client.get("/items").then((res) => setItems(res.data));
  }, [user]);

  const warehousesInBranch = useMemo(
    () => warehouses.filter((w) => String(w.branch_id) === String(branchId)),
    [warehouses, branchId]
  );

  useEffect(() => {
    if (!warehousesInBranch.some((w) => String(w.id) === warehouseId)) {
      setWarehouseId(String(warehousesInBranch[0]?.id || ""));
    }
  }, [warehousesInBranch, warehouseId]);

  const categories = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category).push(it);
    }
    return map;
  }, [items]);

  // 입고: 첫번째 선택창(품목 대분류)을 지정된 순서(염화칼슘, 소금(제설용))로 정렬
  const inCategories = useMemo(() => {
    const keys = [...categories.keys()];
    return keys.sort((a, b) => {
      const ia = IN_CATEGORY_ORDER.indexOf(a);
      const ib = IN_CATEGORY_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [categories]);

  useEffect(() => {
    if (type !== "in") return;
    if (!inCategories.includes(categoryId)) {
      setCategoryId(inCategories[0] || "");
    }
  }, [type, inCategories, categoryId]);

  const itemsInCategory = useMemo(
    () => categories.get(categoryId) || [],
    [categories, categoryId]
  );

  useEffect(() => {
    if (type !== "in") return;
    if (!itemsInCategory.some((it) => String(it.id) === itemId)) {
      setItemId(String(itemsInCategory[0]?.id || ""));
    }
  }, [type, itemsInCategory, itemId]);

  // 출고: 소금(제설용) 형태 선택 목록 및 기본값. 염화칼슘은 항상 염수(리터)로 고정 차감.
  const saltItems = categories.get("소금(제설용)") || [];
  const brineItem = useMemo(
    () => items.find((it) => it.category === "염화칼슘" && it.name === "염수"),
    [items]
  );

  useEffect(() => {
    if (type !== "out") return;
    if (!saltItems.some((it) => String(it.id) === saltItemId)) {
      setSaltItemId(String(saltItems[0]?.id || ""));
    }
  }, [type, saltItems, saltItemId]);

  const sprayOption = SPRAY_OPTIONS.find((o) => o.value === sprayType);
  const saltItem = items.find((it) => String(it.id) === saltItemId);
  const sprayPreview = useMemo(() => {
    if (!sprayOption || !saltItem || !count) return null;
    const n = Number(count);
    const calciumQty = n * sprayOption.calciumBrineLiters;
    const saltQty = (n * sprayOption.saltTons) / saltItem.to_ton_factor;
    return { calciumQty, saltQty };
  }, [sprayOption, saltItem, count]);

  // 전환: 전환 후 형태는 같은 카테고리의 형태(예: 톤백/개포, 톤백/염수)를 모두 보여준다.
  // 전환 전과 같은 형태를 골라도 목적지 창고만 다르면 유효한 이동(형태는 그대로, 창고만 변경)이 된다.
  useEffect(() => {
    if (type !== "convert") return;
    if (!items.some((it) => String(it.id) === fromItemId)) {
      setFromItemId(String(items[0]?.id || ""));
    }
  }, [type, items, fromItemId]);

  const fromItem = useMemo(() => items.find((it) => String(it.id) === fromItemId), [items, fromItemId]);
  const toItemOptions = useMemo(
    () => (fromItem ? items.filter((it) => it.category === fromItem.category) : []),
    [items, fromItem]
  );
  const toItem = useMemo(() => items.find((it) => String(it.id) === toItemId), [items, toItemId]);

  useEffect(() => {
    if (type !== "convert") return;
    if (!toItemOptions.some((it) => String(it.id) === toItemId)) {
      // 처음 고를 때는 전환 전과 다른 형태를 기본값으로 제안한다.
      const other = toItemOptions.find((it) => it.id !== fromItem?.id);
      setToItemId(String(other?.id || toItemOptions[0]?.id || ""));
    }
  }, [type, toItemOptions, toItemId, fromItem]);

  // 전환 목적지: 기본값은 전환 전(소스) 지사/창고와 동일하되, 다른 지사/창고(또는
  // 현장염수분사장치)로 자유롭게 바꿀 수 있다.
  useEffect(() => {
    if (type !== "convert") return;
    setDestBranchId((prev) => prev || branchId);
  }, [type, branchId]);

  const destWarehousesInBranch = useMemo(
    () => warehouses.filter((w) => String(w.branch_id) === String(destBranchId)),
    [warehouses, destBranchId]
  );

  useEffect(() => {
    if (type !== "convert") return;
    if (!destWarehousesInBranch.some((w) => String(w.id) === destWarehouseId)) {
      const fallback = destWarehousesInBranch.find((w) => String(w.id) === warehouseId);
      setDestWarehouseId(String(fallback?.id || destWarehousesInBranch[0]?.id || ""));
    }
  }, [type, destWarehousesInBranch, destWarehouseId, warehouseId]);

  const convertedPreview = useMemo(() => {
    if (!fromItem || !toItem || !quantity) return null;
    const tons = Number(quantity) * fromItem.to_ton_factor;
    return tons / toItem.to_ton_factor;
  }, [fromItem, toItem, quantity]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!warehouseId) {
      setMessage({ type: "error", text: "창고를 확인하세요." });
      return;
    }

    if (type === "convert" && (!fromItemId || !toItemId || !quantity || Number(quantity) <= 0)) {
      setMessage({ type: "error", text: "전환 전/후 형태와 수량을 확인하세요." });
      return;
    }
    if (type === "in" && (!itemId || !quantity || Number(quantity) <= 0)) {
      setMessage({ type: "error", text: "품목과 수량을 확인하세요." });
      return;
    }
    if (type === "out" && (!saltItemId || !count || Number(count) <= 0)) {
      setMessage({ type: "error", text: "형태와 대수를 확인하세요." });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      let result;
      if (type === "convert") {
        result = await submitConversion({
          warehouse_id: Number(warehouseId),
          to_warehouse_id: Number(destWarehouseId || warehouseId),
          from_item_id: Number(fromItemId),
          to_item_id: Number(toItemId),
          quantity: Number(quantity),
          occurred_at: occurredAt,
          memo,
        });
      } else if (type === "out") {
        result = await submitSpray({
          warehouse_id: Number(warehouseId),
          spray_type: sprayType,
          count: Number(count),
          salt_item_id: Number(saltItemId),
          occurred_at: occurredAt,
          memo,
        });
      } else {
        result = await submitTransaction({
          warehouse_id: Number(warehouseId),
          item_id: Number(itemId),
          type: "in",
          quantity: Number(quantity),
          occurred_at: occurredAt,
          memo,
        });
      }
      if (result.queued) {
        setMessage({ type: "warn", text: "오프라인 상태입니다. 연결되면 자동으로 저장됩니다." });
      } else {
        setMessage({ type: "success", text: "저장되었습니다." });
      }
      setQuantity("");
      setCount("");
      setMemo("");
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.error || "저장에 실패했습니다." });
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled =
    submitting || (type === "convert" && toItemOptions.length === 0);

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-4">입출고 등록</h2>

      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : message.type === "warn"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">유형</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`py-4 rounded-xl text-white font-bold text-lg ${opt.color} ${
                  type === opt.value ? "ring-4 ring-offset-2 ring-brand-300" : "opacity-60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {type === "convert" && (
            <p className="text-xs text-slate-500 mt-2">
              형태를 바꾸거나(예: 톤백 → 개포/염수), 형태는 그대로 둔 채 다른 창고(다른 지사 포함,
              현장염수분사장치 포함)로만 옮길 수도 있습니다. 전체 톤 환산 총량은 변하지 않습니다.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">지사</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white disabled:bg-slate-100"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={isField}
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
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
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

        {type === "in" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">품목</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {inCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">형태</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                >
                  {itemsInCategory.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">수량</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-4 text-2xl font-bold text-center"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </>
        )}

        {type === "out" && (
          <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">살포 유형</label>
              <div className="grid grid-cols-2 gap-2">
                {SPRAY_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setSprayType(opt.value)}
                    className={`py-4 rounded-xl font-bold text-lg border-2 ${
                      sprayType === opt.value
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-white text-rose-600 border-rose-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">대수</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="w-full border border-slate-300 rounded-lg px-3 py-4 text-2xl font-bold text-center"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">염화칼슘 형태</label>
                <div className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-3 text-base text-slate-500">
                  염수 (리터) 고정
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">소금 형태</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
                  value={saltItemId}
                  onChange={(e) => setSaltItemId(e.target.value)}
                >
                  {saltItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sprayPreview && (
              <p className="text-sm text-slate-500 text-center">
                → 출고 예정{" "}
                <span className="font-semibold text-rose-700">
                  염화칼슘(염수) {sprayPreview.calciumQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}{" "}
                  {brineItem?.unit || "리터"}
                </span>
                {" · "}
                <span className="font-semibold text-rose-700">
                  소금 {sprayPreview.saltQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {saltItem?.unit}
                </span>
              </p>
            )}
          </>
        )}

        {type === "convert" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">전환 전 형태</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
                  value={fromItemId}
                  onChange={(e) => setFromItemId(e.target.value)}
                >
                  {[...categories.entries()].map(([category, list]) => (
                    <optgroup key={category} label={category || "기타"}>
                      {list.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.unit})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">전환 후 형태</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
                  value={toItemId}
                  onChange={(e) => setToItemId(e.target.value)}
                  disabled={toItemOptions.length === 0}
                >
                  {toItemOptions.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.unit})
                    </option>
                  ))}
                </select>
                {toItemOptions.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">이 품목에는 전환할 다른 형태가 없습니다.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">목적지 지사</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
                  value={destBranchId}
                  onChange={(e) => setDestBranchId(e.target.value)}
                >
                  {allBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">목적지 창고</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base bg-white"
                  value={destWarehouseId}
                  onChange={(e) => setDestWarehouseId(e.target.value)}
                >
                  {destWarehousesInBranch.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">전환 수량 (전환 전 형태 기준)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full border border-slate-300 rounded-lg px-3 py-4 text-2xl font-bold text-center"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                required
              />
              {convertedPreview != null && (
                <p className="text-sm text-slate-500 mt-2 text-center">
                  → 전환 후 약{" "}
                  <span className="font-semibold text-violet-700">
                    {convertedPreview.toLocaleString(undefined, { maximumFractionDigits: 3 })} {toItem?.unit}
                  </span>
                </p>
              )}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">날짜</label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">담당자</label>
            <input
              disabled
              className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-3 text-base text-slate-500"
              value={user?.name || ""}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">메모 (선택)</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 강설 대비 보충"
          />
        </div>

        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full bg-brand-700 text-white font-bold py-4 rounded-xl text-lg active:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}
