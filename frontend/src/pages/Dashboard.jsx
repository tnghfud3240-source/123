import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import client from "../api/client.js";

const TYPE_LABEL = { in: "입고", out: "출고", adjust: "조정", convert: "전환" };

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent || "text-slate-800"}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    client.get("/dashboard/summary").then((res) => setData(res.data));
  }, []);

  if (!data) return <p className="text-slate-500">불러오는 중...</p>;

  const chartData = data.stock_by_branch.map((b) => ({
    name: b.branch_name,
    톤: Math.round(b.total_tons * 100) / 100,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">대시보드</h2>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="관리 지사" value={`${data.branch_count}개`} />
        <StatCard label="관리 창고" value={`${data.warehouse_count}개`} />
        <StatCard label="관리 품목" value={`${data.item_count}종`} />
        <StatCard
          label="부족재고 알림"
          value={`${data.low_stock_count}건`}
          accent={data.low_stock_count > 0 ? "text-rose-600" : "text-emerald-600"}
        />
        <StatCard
          label="최근 등록"
          value={data.recent_transactions[0]?.occurred_at || "-"}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-slate-700 mb-3">지사별 총 재고량 (톤 환산, 전 품목 합계)</h3>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="톤" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 font-semibold text-slate-700 border-b bg-rose-50">
            부족재고 알림
          </div>
          <ul className="divide-y">
            {data.low_stock.length === 0 && (
              <li className="px-4 py-4 text-slate-400 text-sm">부족한 재고가 없습니다.</li>
            )}
            {data.low_stock.map((l) => (
              <li key={`${l.branch_id}-${l.category}`} className="px-4 py-3 text-sm flex justify-between">
                <span>
                  <span className="font-medium text-slate-800">{l.category}</span>
                  <span className="text-slate-400"> · {l.branch_name}</span>
                </span>
                <span className="text-rose-600 font-semibold">
                  {l.total_tons.toLocaleString()} / {l.min_stock_tons.toLocaleString()} 톤
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 font-semibold text-slate-700 border-b bg-brand-50">
            최근 입출고
          </div>
          <ul className="divide-y">
            {data.recent_transactions.length === 0 && (
              <li className="px-4 py-4 text-slate-400 text-sm">등록된 이력이 없습니다.</li>
            )}
            {data.recent_transactions.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm flex justify-between">
                <span>
                  <span className="font-medium text-slate-800">
                    {t.category} <span className="text-slate-400 font-normal">· {t.item_form}</span>
                  </span>
                  <span className="text-slate-400"> · {t.branch_name} {t.warehouse_name}</span>
                </span>
                <span className="text-slate-600">
                  {TYPE_LABEL[t.type]}{" "}
                  {t.type === "convert" && t.delta > 0 ? "+" : ""}
                  {(t.type === "convert" ? t.delta : t.quantity).toLocaleString()} {t.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
