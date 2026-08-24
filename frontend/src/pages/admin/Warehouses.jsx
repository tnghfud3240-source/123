import React, { useEffect, useMemo, useState } from "react";
import client from "../../api/client.js";

export default function AdminWarehouses() {
  const [branches, setBranches] = useState([]);
  const [rows, setRows] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function reload() {
    client.get("/warehouses").then((res) => setRows(res.data));
  }

  useEffect(() => {
    client.get("/branches").then((res) => {
      setBranches(res.data);
      setBranchId(String(res.data[0]?.id || ""));
    });
    reload();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/warehouses", { name, branch_id: Number(branchId) });
      setName("");
      reload();
    } catch (err) {
      setError(err.response?.data?.error || "추가에 실패했습니다.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("이 창고를 삭제하시겠습니까?")) return;
    try {
      await client.delete(`/warehouses/${id}`);
      reload();
    } catch (err) {
      alert(err.response?.data?.error || "삭제에 실패했습니다.");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const w of rows) {
      if (!map.has(w.branch_name)) map.set(w.branch_name, []);
      map.get(w.branch_name).push(w);
    }
    return map;
  }, [rows]);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-4">창고 관리</h2>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">지사</label>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">창고명</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 서청주IC"
            required
          />
        </div>
        <button className="bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold">추가</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </form>

      {[...grouped.entries()].map(([branchName, list]) => (
        <div key={branchName} className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-brand-50 px-4 py-2 font-semibold text-brand-800">{branchName}</div>
          <div className="divide-y">
            {list.map((w) => (
              <div key={w.id} className="px-4 py-3 flex items-center justify-between">
                <div className="font-medium text-slate-800">{w.name}</div>
                <button onClick={() => handleDelete(w.id)} className="text-sm text-red-600 font-medium">
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
