const bcrypt = require("bcryptjs");
const db = require("./db");

function upsertBranch(name, sortOrder) {
  const existing = db.prepare("SELECT * FROM branches WHERE name = ?").get(name);
  if (existing) return existing;
  const info = db
    .prepare("INSERT INTO branches (name, sort_order) VALUES (?, ?)")
    .run(name, sortOrder);
  return db.prepare("SELECT * FROM branches WHERE id = ?").get(info.lastInsertRowid);
}

function upsertWarehouse(branchId, name) {
  const existing = db
    .prepare("SELECT * FROM warehouses WHERE branch_id = ? AND name = ?")
    .get(branchId, name);
  if (existing) return existing;
  const info = db
    .prepare("INSERT INTO warehouses (branch_id, name) VALUES (?, ?)")
    .run(branchId, name);
  return db.prepare("SELECT * FROM warehouses WHERE id = ?").get(info.lastInsertRowid);
}

function upsertItem(category, name, unit, to_ton_factor, sortOrder) {
  const existing = db
    .prepare("SELECT * FROM items WHERE category = ? AND name = ?")
    .get(category, name);
  if (existing) return existing;
  const info = db
    .prepare("INSERT INTO items (name, category, unit, to_ton_factor, sort_order) VALUES (?, ?, ?, ?, ?)")
    .run(name, category, unit, to_ton_factor, sortOrder);
  return db.prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid);
}

function upsertStockTarget(branchId, category, minStockTons) {
  const existing = db
    .prepare("SELECT * FROM stock_targets WHERE branch_id = ? AND category = ?")
    .get(branchId, category);
  if (existing) return existing;
  const info = db
    .prepare("INSERT INTO stock_targets (branch_id, category, min_stock_tons) VALUES (?, ?, ?)")
    .run(branchId, category, minStockTons);
  return db.prepare("SELECT * FROM stock_targets WHERE id = ?").get(info.lastInsertRowid);
}

function upsertUser(username, password, name, role, branch_id) {
  const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (existing) return existing;
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, name, role, branch_id) VALUES (?, ?, ?, ?, ?)"
    )
    .run(username, hash, name, role, branch_id || null);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
}

// 충북본부 지사별 제설창고 구성
const BRANCH_WAREHOUSES = {
  진천지사: ["서청주IC", "지사", "일죽IC", "남이천IC", "마장휴게소", "현장염수분사장치"],
  제천지사: ["지사", "단양영업소", "치악휴게소", "현장염수분사장치"],
  충주지사: ["지사", "감곡IC", "괴산IC", "연풍IC", "현장염수분사장치"],
  보은지사: ["지사", "문의IC", "화서IC", "남상주IC", "내서", "현장염수분사장치"],
  엄정지사: ["지사", "서충주IC", "북진천IC", "현장염수분사장치"],
  상주지사: ["연풍IC", "점촌함창IC", "지사", "선산IC", "현장염수분사장치"],
};

const branchesByName = {};
const warehousesByBranch = {};
Object.entries(BRANCH_WAREHOUSES).forEach(([branchName, warehouseNames], index) => {
  const branch = upsertBranch(branchName, index);
  branchesByName[branchName] = branch;
  warehousesByBranch[branchName] = warehouseNames.map((wname) => upsertWarehouse(branch.id, wname));
});

// 품목: 카테고리(대분류)별 형태(톤백/개포/염수) 구분. to_ton_factor는 해당 형태의 1단위가
// 몇 톤에 해당하는지를 나타내며, 재고 합계 계산에 쓰임. sort_order로 톤백이 항상 먼저 표시됨.
upsertItem("소금(제설용)", "톤백", "톤", 1, 0);
upsertItem("소금(제설용)", "개포", "톤", 1, 1); // 톤백을 개포해도 무게는 그대로(톤 단위 동일)
upsertItem("염화칼슘", "톤백", "톤", 1, 0);
upsertItem("염화칼슘", "염수", "리터", 1 / 1935, 1); // 염화칼슘 1톤으로 염수 1,935리터 제조 기준

// 지사별 비축기준(톤). 지사마다 실제 기준이 다름.
const BRANCH_STOCK_TARGETS_TONS = {
  진천지사: { "소금(제설용)": 3150, 염화칼슘: 294 },
  제천지사: { "소금(제설용)": 2745, 염화칼슘: 342 },
  충주지사: { "소금(제설용)": 2376, 염화칼슘: 228 },
  보은지사: { "소금(제설용)": 2064, 염화칼슘: 360 },
  엄정지사: { "소금(제설용)": 3159, 염화칼슘: 219 },
  상주지사: { "소금(제설용)": 1911, 염화칼슘: 132 },
};

for (const [branchName, targets] of Object.entries(BRANCH_STOCK_TARGETS_TONS)) {
  const branch = branchesByName[branchName];
  for (const [category, minTons] of Object.entries(targets)) {
    upsertStockTarget(branch.id, category, minTons);
  }
}

// 사무실 담당자: 모든 권한(지사/창고/품목/비축기준/사용자 관리 포함)
upsertUser("of", "1111", "사무실 담당자", "office", null);

// 지사별 현장 담당자: 소속 지사에 속한 모든 창고에 접근 가능(창고 단위 아님)
const FIELD_USERS = [
  { username: "fd1", branch: "진천지사", name: "진천지사 현장담당자" },
  { username: "fd2", branch: "제천지사", name: "제천지사 현장담당자" },
  { username: "fd3", branch: "충주지사", name: "충주지사 현장담당자" },
  { username: "fd4", branch: "보은지사", name: "보은지사 현장담당자" },
  { username: "fd5", branch: "엄정지사", name: "엄정지사 현장담당자" },
  { username: "fd6", branch: "상주지사", name: "상주지사 현장담당자" },
];
for (const { username, branch, name } of FIELD_USERS) {
  upsertUser(username, "1111", name, "field", branchesByName[branch].id);
}

console.log("시드 데이터 생성 완료");
console.log(`- 지사 ${Object.keys(BRANCH_WAREHOUSES).length}개, 창고 ${Object.values(warehousesByBranch).flat().length}개 생성`);
console.log("- 품목: 소금(제설용) 톤백/개포(톤), 염화칼슘 톤백/염수(리터, 1톤=1,935리터 기준)");
console.log("- 지사별 비축기준(톤) 반영 완료");
console.log("- of / 1111 (사무실 담당자, 모든 권한)");
for (const { username, branch } of FIELD_USERS) {
  console.log(`- ${username} / 1111 (현장 담당자, ${branch})`);
}
