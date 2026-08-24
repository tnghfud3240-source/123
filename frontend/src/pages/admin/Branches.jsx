import React, { useEffect, useState } from "react";
import client from "../../api/client.js";

export default function AdminBranches() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function reload() {
    client.get("/branches").then((res) => setRows(res.data));
  }

  useEffect(reload, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/branches", { name });
      setName("");
      reload();
    } catch (err) {
      setError(err.response?.data?.error || "추가에 실패했습니다.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("이 지사를 삭제하시겠습니까?")) return;
    try {
      await client.delete(`/branches/${id}`);
      reload();
    } catch (err) {
      alert(err.response?.data?.error || "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-4">지사 관리</h2>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">지사명</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 진천지사"
            required
          />
        </div>
        <button className="bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold">추가</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {rows.map((b) => (
          <div key={b.id} className="px-4 py-3 flex items-center justify-between">
            <div className="font-medium text-slate-800">{b.name}</div>
            <button onClick={() => handleDelete(b.id)} className="text-sm text-red-600 font-medium">
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
