const express = require("express");
const db = require("../db");

const router = express.Router();

// 비축기준에 실제로 미달하기 전에 담당자가 미리 알 수 있도록, 비축기준의 20%를
// 가산한 값을 경고 기준으로 삼아 재고부족을 사전에 예고한다.
const EARLY_WARNING_RATIO = 1.2;

router.get("/summary", (req, res) => {
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

  const stockByBranchCategory = branchCategoryTotals.map((row) => ({
    branch_id: row.branch_id,
    branch_name: row.branch_name,
    category: row.category,
    total_tons: row.total_tons,
  }));

  const lowStockAll = branchCategoryTotals
    .filter((row) => row.total_tons < row.min_stock_tons * EARLY_WARNING_RATIO)
    .sort((a, b) => b.min_stock_tons - b.total_tons - (a.min_stock_tons - a.total_tons));
  const lowStock = lowStockAll.slice(0, 20);
  const lowStockCountByCategory = lowStockAll.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});

  const recent = db
    .prepare(
      `SELECT t.id, t.type, t.quantity, t.delta, t.occurred_at, t.memo,
              b.name AS branch_name, w.name AS warehouse_name,
              i.category, i.name AS item_form, i.unit, t.operator_name
       FROM transactions t
       JOIN warehouses w ON w.id = t.warehouse_id
       JOIN branches b ON b.id = w.branch_id
       JOIN items i ON i.id = t.item_id
       ORDER BY t.created_at DESC
       LIMIT 20`
    )
    .all();

  res.json({
    branch_count: branchCount,
    warehouse_count: warehouseCount,
    item_count: itemCount,
    low_stock_count: lowStockAll.length,
    low_stock_count_by_category: lowStockCountByCategory,
    stock_by_branch_category: stockByBranchCategory,
    low_stock: lowStock,
    recent_transactions: recent,
  });
});

module.exports = router;
