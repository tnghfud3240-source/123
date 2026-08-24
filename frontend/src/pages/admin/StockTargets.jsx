import React, { useEffect, useMemo, useState } from "react";
import client from "../../api/client.js";

export default function AdminStockTargets() {
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [targets, setTargets] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  function reloadTargets() {
    client.get("/stock-targets").then((res) => setTargets(res.data));
  }

  useEffect(() => {
    client.get("/branches").then((res) => setBranches(res.data));
    client.get("/items").then((res) => setItems(res.data));
    reloadTargets();
  }, []);

  const categories = useMemo(() => [...new Set(items.map((it) => it.category))], [items]);

  const targetMap = useMemo(() => {
    const map = new Map();
    for (const t of targets) map.set(`${t.branch_id}:${t.category}`, t.min_stock_tons);
    return map;
  }, [targets]);

  async function handleSave(branchId, category) {
    const key = `${branchId}:${category}`;
    const draft = drafts[key];
    const value = Number(draft);
    if (draft === undefined || Number.isNaN(value) || value < 0) {
      alert("비축기준은 0 이상의 숫자여야 합니다.");
      return;
    }
    setSavingKey(key);
    try {
      await client.put("/stock-targets", { branch_id: branchId, category, min_stock_tons: value });
      setDrafts((d) => ({ ...d, [key]: undefined }));
      reloadTargets();
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-slate-800 mb-2">비축기준 관리</h2>
      <p className="text-sm text-slate-500 mb-4">
        지사별 품목 비축기준(톤)입니다. 각 지사 소속 창고 전체의 재고 합계(톤 환산)가 이 값보다 낮으면
        대시보드에 부족재고로 표시됩니다.
      </p>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="px-4 py-2">지사</th>
              {categories.map((c) => (
                <th key={c} className="px-4 py-2">
                  {c} (톤)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{b.name}</td>
                {categories.map((category) => {
                  const key = `${b.id}:${category}`;
                  const current = targetMap.get(key) ?? 0;
                  return (
                    <td key={category} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          className="border border-slate-300 rounded-lg px-2 py-1 w-24"
                          value={drafts[key] ?? current}
                          onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                        />
                        {drafts[key] !== undefined && (
                          <button
                            onClick={() => handleSave(b.id, category)}
                            disabled={savingKey === key}
                            className="text-xs bg-brand-700 text-white px-2 py-1 rounded disabled:opacity-60"
                          >
                            저장
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
