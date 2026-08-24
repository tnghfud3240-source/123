const path = require("path");
const fs = require("fs");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch (e) {
  throw new Error(
    "이 프로그램은 Node.js 내장 SQLite 모듈(node:sqlite)이 필요합니다. Node.js 22.5 이상 버전을 설치한 뒤 다시 실행해주세요. (터미널에 `node -v`로 버전 확인 가능)"
  );
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "snow_storage.db");
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(branch_id, name)
);

-- field 역할 계정은 branch_id로 소속 지사가 정해지며, 그 지사에 속한 모든 창고에
-- 접근할 수 있다(창고 단위가 아닌 지사 단위 권한 범위).
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','office','field')),
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- items: 품목의 형태(form)별 세부 항목. category가 같은 items는 하나의 "품목"으로 묶여
-- 재고 합계 시 to_ton_factor로 톤 환산되어 합산됨 (예: 소금(제설용)의 톤백/개포)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  to_ton_factor REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(category, name)
);

-- stock_targets: 비축기준(최소 재고)은 창고가 아닌 지사 단위, 품목 카테고리별로 설정
CREATE TABLE IF NOT EXISTS stock_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  category TEXT NOT NULL,
  min_stock_tons REAL NOT NULL DEFAULT 0,
  UNIQUE(branch_id, category)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL UNIQUE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  type TEXT NOT NULL CHECK(type IN ('in','out','adjust','convert')),
  quantity REAL NOT NULL,
  delta REAL NOT NULL,
  memo TEXT,
  user_id INTEGER REFERENCES users(id),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_wh_item ON transactions(warehouse_id, item_id);
CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions(occurred_at);
`);

module.exports = db;
