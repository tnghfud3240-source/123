const express = require("express");
const db = require("../db");
const { requireAuth, effectiveBranchId } = require("../auth");

const router = express.Router();

// 지사 x 창고 x 품목(형태)별 현재 재고 = 해당 조합 거래의 delta 합계 (원 단위, 톤 환산 전)
router.get("/", requireAuth, (req, res) => {
  const { warehouse_id } = req.query;
  const branchId = effectiveBranchId(req.user, req.query.branch_id);
  const clauses = [];
  const params = [];
  if (warehouse_id) {
    clauses.push("w.id = ?");
    params.push(warehouse_id);
  }
  if (branchId) {
    clauses.push("w.branch_id = ?");
    params.push(branchId);
  }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const rows = db
    .prepare(
      `SELECT b.id AS branch_id, b.name AS branch_name,
              w.id AS warehouse_id, w.name AS warehouse_name,
              i.id AS item_id, i.name AS item_name, i.category, i.unit, i.to_ton_factor,
              COALESCE(SUM(t.delta), 0) AS quantity
       FROM warehouses w
       JOIN branches b ON b.id = w.branch_id
       CROSS JOIN items i
       LEFT JOIN transactions t ON t.warehouse_id = w.id AND t.item_id = i.id
       ${where}
       GROUP BY w.id, i.id
       ORDER BY b.sort_order, b.name, w.name, i.category, i.sort_order`
    )
    .all(...params);
  res.json(rows);
});

// 지사별 품목 카테고리(예: 소금(제설용), 염화칼슘) 합계 - 톤 환산, 소속 창고 전체 합산
// 비축기준(stock_targets)은 지사+카테고리 단위로만 존재
router.get("/branch-summary", requireAuth, (req, res) => {
  const branchId = effectiveBranchId(req.user, req.query.branch_id);
  const clauses = [];
  const params = [];
  if (branchId) {
    clauses.push("b.id = ?");
    params.push(branchId);
  }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const rows = db
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
       ${where}
       GROUP BY b.id, i.category
       ORDER BY b.sort_order, b.name, i.category`
    )
    .all(...params);
  res.json(rows);
});

module.exports = router;
