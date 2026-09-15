import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { onPendingCountChange } from "../offline/sync.js";

const NAV_ITEMS = [
  { to: "/", label: "대시보드" },
  { to: "/entry", label: "입출고 등록" },
  { to: "/stock", label: "재고 현황" },
  { to: "/history", label: "이력 조회" },
  { to: "/admin/stock-targets", label: "비축기준 관리" },
];

const SETTINGS_ITEMS = [
  { to: "/admin/branches", label: "지사 관리" },
  { to: "/admin/warehouses", label: "창고 관리" },
  { to: "/admin/items", label: "품목 관리" },
];

const navLinkClass = ({ isActive }) =>
  `px-4 py-2 whitespace-nowrap text-sm font-medium border-b-2 ${
    isActive ? "border-white text-white" : "border-transparent text-brand-100"
  }`;

export default function Layout() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const location = useLocation();
  const isSettingsActive = SETTINGS_ITEMS.some((item) => location.pathname === item.to);

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

  useEffect(() => {
    setSettingsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [settingsOpen]);

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
          </div>
        </div>
        <nav className="flex items-center overflow-x-auto px-2 border-t border-brand-800 bg-brand-800">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <div className="relative ml-auto" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`px-4 py-2 whitespace-nowrap text-sm font-medium border-b-2 ${
                isSettingsActive ? "border-white text-white" : "border-transparent text-brand-100"
              }`}
            >
              설정 ▾
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg overflow-hidden z-20">
                {SETTINGS_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block px-4 py-2 text-sm whitespace-nowrap ${
                        isActive ? "bg-brand-50 text-brand-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1 p-4 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
