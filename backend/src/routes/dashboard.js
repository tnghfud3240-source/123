const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");

const router = express.Router();

// 대시보드는 전체 지사 현황을 보여주므로 본부 권한(admin/office)만 접근
router.get("/summary", requireAuth, requireRole("admin", "office"), (req, res) => {
  const branchCount = db.prepare("SELECT COUNT(*) c FROM branches").get().c;
  const warehouseCount = db.prepare("SELECT COUNT(*) c FROM warehouses").get().c;
  const itemCount = db.prepare("SELECT COUNT(*) c FROM items").get().c;

  // 지사 x 카테고리별 톤 환산 합계 (소속 창고 전체 합산) + 비축기준 대비 부족 여부
  const branchCategoryTotals = db
    .prepare(
      `SELECT b.id AS branch_id, b.name AS branch_name,
              i.category,
              SUM(COALESCE(t.delta, 0) * i.to_ton_factor) AS total_tons,
              COALESCE(st.min_stock_tons, 0) AS min_stock_tons
       FROM branches b
       CROSS JOIN items i
       LEFT JOIN warehouses w ON w.branch_id = b.id
       LEFT JOIN transactions t ON t.warehouse_id = w.id AND t.item_id = i.id
       LEFT JOIN stock_targets st ON st.branch_id = b.id AND st.category = i.category
       GROUP BY b.id, i.category
       ORDER BY b.sort_order, b.name, i.category`
    )
    .all();

  const stockByBranch = Object.values(
    branchCategoryTotals.reduce((acc, row) => {
      if (!acc[row.branch_id]) {
        acc[row.branch_id] = { branch_id: row.branch_id, branch_name: row.branch_name, total_tons: 0 };
      }
      acc[row.branch_id].total_tons += row.total_tons;
      return acc;
    }, {})
  );

  const lowStockAll = branchCategoryTotals
    .filter((row) => row.total_tons < row.min_stock_tons)
    .sort((a, b) => b.min_stock_tons - b.total_tons - (a.min_stock_tons - a.total_tons));
  const lowStock = lowStockAll.slice(0, 20);

  const recent = db
    .prepare(
      `SELECT t.id, t.type, t.quantity, t.delta, t.occurred_at, t.memo,
              b.name AS branch_name, w.name AS warehouse_name,
              i.category, i.name AS item_form, i.unit, u.name AS user_name
       FROM transactions t
       JOIN warehouses w ON w.id = t.warehouse_id
       JOIN branches b ON b.id = w.branch_id
       JOIN items i ON i.id = t.item_id
       LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC
       LIMIT 20`
    )
    .all();

  res.json({
    branch_count: branchCount,
    warehouse_count: warehouseCount,
    item_count: itemCount,
    low_stock_count: lowStockAll.length,
    stock_by_branch: stockByBranch,
    low_stock: lowStock,
    recent_transactions: recent,
  });
});

module.exports = router;
