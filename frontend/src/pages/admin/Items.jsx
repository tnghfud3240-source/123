import React, { useEffect, useMemo, useState } from "react";
import client from "../../api/client.js";

const EMPTY = { name: "", category: "", unit: "", to_ton_factor: 1 };

export default function AdminItems() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});

  function reload() {
    client.get("/items").then((res) => setRows(res.data));
  }

  useEffect(reload, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/items", form);
      setForm(EMPTY);
      reload();
    } catch (err) {
      setError(err.response?.data?.error || "추가에 실패했습니다.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("이 품목을 삭제하시겠습니까?")) return;
    try {
      await client.delete(`/items/${id}`);
      reload();
    } catch (err) {
      alert(err.response?.data?.error || "삭제에 실패했습니다.");
    }
  }

  function updateDraft(itemId, patch) {
    setDrafts((d) => ({ ...d, [itemId]: { ...d[itemId], ...patch } }));
  }

  async function handleRowSave(item) {
    const draft = drafts[item.id] || {};
    const unit = draft.unit ?? item.unit;
    const factorRaw = draft.to_ton_factor ?? item.to_ton_factor;
    const factor = Number(factorRaw);
    if (!unit.trim()) {
      alert("단위를 입력하세요.");
      return;
    }
    if (Number.isNaN(factor) || factor <= 0) {
      alert("환산계수는 0보다 큰 숫자여야 합니다.");
      return;
    }
    await client.put(`/items/${item.id}`, { ...item, unit, to_ton_factor: factor });
    setDrafts((d) => ({ ...d, [item.id]: undefined }));
    reload();
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of rows) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category).push(it);
    }
    return map;
  }, [rows]);

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-slate-800 mb-4">품목 관리</h2>
      <p className="text-sm text-slate-500 mb-4">
        같은 "품목(카테고리)" 아래 여러 형태(톤백/개포/염수 등)를 등록할 수 있습니다. 환산계수는 해당
        형태 1단위(포대, 리터 등)가 몇 톤에 해당하는지를 나타내며, 재고 합계·비축기준 비교에 사용됩니다.
      </p>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">품목(카테고리)</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="예: 소금(제설용)"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">형태명</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예: 톤백"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">단위</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 w-20"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            placeholder="포대"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">환산계수(톤/단위)</label>
          <input
            type="number"
            step="0.0001"
            className="border border-slate-300 rounded-lg px-3 py-2 w-32"
            value={form.to_ton_factor}
            onChange={(e) => setForm({ ...form, to_ton_factor: Number(e.target.value) })}
          />
        </div>
        <button className="bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold">추가</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </form>

      {[...grouped.entries()].map(([category, list]) => (
        <div key={category} className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-brand-50 px-4 py-2 font-semibold text-brand-800">{category}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="px-4 py-2">형태</th>
                <th className="px-4 py-2">단위</th>
                <th className="px-4 py-2">환산계수(톤/단위)</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((it) => {
                const draft = drafts[it.id];
                return (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-800">{it.name}</td>
                  <td className="px-4 py-2">
                    <input
                      className="border border-slate-300 rounded-lg px-2 py-1 w-20"
                      value={draft?.unit ?? it.unit}
                      onChange={(e) => updateDraft(it.id, { unit: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.000001"
                        className="border border-slate-300 rounded-lg px-2 py-1 w-32"
                        value={draft?.to_ton_factor ?? it.to_ton_factor}
                        onChange={(e) => updateDraft(it.id, { to_ton_factor: e.target.value })}
                      />
                      {draft != null && (
                        <button
                          onClick={() => handleRowSave(it)}
                          className="text-xs bg-brand-700 text-white px-2 py-1 rounded"
                        >
                          저장
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleDelete(it.id)} className="text-sm text-red-600 font-medium">
                      삭제
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
