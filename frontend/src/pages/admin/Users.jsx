import React, { useEffect, useState } from "react";
import client from "../../api/client.js";
import { roleLabel } from "../../components/Layout.jsx";

const EMPTY = { username: "", password: "", name: "", role: "field", branch_id: "" };

export default function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  function reload() {
    client.get("/users").then((res) => setRows(res.data));
  }

  useEffect(() => {
    reload();
    client.get("/branches").then((res) => setBranches(res.data));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/users", {
        ...form,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
      });
      setForm(EMPTY);
      reload();
    } catch (err) {
      setError(err.response?.data?.error || "추가에 실패했습니다.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("이 사용자를 삭제하시겠습니까?")) return;
    try {
      await client.delete(`/users/${id}`);
      reload();
    } catch (err) {
      alert(err.response?.data?.error || "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold text-slate-800 mb-4">사용자 관리</h2>
      <p className="text-sm text-slate-500 mb-4">
        현장 역할은 소속 지사에 속한 모든 창고에 접근할 수 있습니다 (창고 단위가 아닌 지사 단위 권한).
      </p>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">아이디</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">초기 비밀번호</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">이름</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">역할</label>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="field">현장</option>
            <option value="office">사무실</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">소속 지사 (현장)</label>
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
          >
            <option value="">-</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button className="bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold">추가</button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {rows.map((u) => (
          <div key={u.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800">
                {u.name} <span className="text-slate-400 font-normal">({u.username})</span>
              </div>
              <div className="text-sm text-slate-500">
                {roleLabel(u.role)}
                {u.branch_id
                  ? ` · ${branches.find((b) => b.id === u.branch_id)?.name || ""}`
                  : ""}
              </div>
            </div>
            <button onClick={() => handleDelete(u.id)} className="text-sm text-red-600 font-medium">
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
