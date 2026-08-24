import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { onPendingCountChange } from "../offline/sync.js";

const NAV_ITEMS = [
  { to: "/", label: "대시보드", roles: ["admin", "office"] },
  { to: "/entry", label: "입출고 등록", roles: ["admin", "office", "field"] },
  { to: "/stock", label: "재고 현황", roles: ["admin", "office", "field"] },
  { to: "/history", label: "이력 조회", roles: ["admin", "office", "field"] },
  { to: "/admin/branches", label: "지사 관리", roles: ["admin", "office"] },
  { to: "/admin/warehouses", label: "창고 관리", roles: ["admin", "office"] },
  { to: "/admin/items", label: "품목 관리", roles: ["admin", "office"] },
  { to: "/admin/stock-targets", label: "비축기준 관리", roles: ["admin", "office"] },
  { to: "/admin/users", label: "사용자 관리", roles: ["admin", "office"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => onPendingCountChange(setPending), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const items = NAV_ITEMS.filter((i) => i.roles.includes(user?.role));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-brand-700 text-white sticky top-0 z-10 shadow">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="font-bold text-lg">❄ 제설창고관리시스템</div>
          <div className="flex items-center gap-3 text-sm">
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                online ? "bg-emerald-500" : "bg-amber-500"
              }`}
            >
              {online ? "온라인" : "오프라인"}
            </span>
            {pending > 0 && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-white text-brand-700">
                동기화 대기 {pending}건
              </span>
            )}
            <span className="hidden sm:inline">{user?.name} ({roleLabel(user?.role)})</span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="underline"
            >
              로그아웃
            </button>
          </div>
        </div>
        <nav className="flex overflow-x-auto px-2 border-t border-brand-800 bg-brand-800">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `px-4 py-2 whitespace-nowrap text-sm font-medium border-b-2 ${
                  isActive ? "border-white text-white" : "border-transparent text-brand-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function roleLabel(role) {
  return { admin: "관리자", office: "사무실", field: "현장" }[role] || role;
}
