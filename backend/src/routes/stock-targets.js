const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT st.id, st.branch_id, b.name AS branch_name, st.category, st.min_stock_tons
       FROM stock_targets st
       JOIN branches b ON b.id = st.branch_id
       ORDER BY b.sort_order, b.name, st.category`
    )
    .all();
  res.json(rows);
});

// 지사+카테고리 조합을 upsert (없으면 생성, 있으면 갱신)
router.put("/", requireAuth, requireRole("admin", "office"), (req, res) => {
  const { branch_id, category, min_stock_tons } = req.body || {};
  if (!branch_id || !category || min_stock_tons == null) {
    return res.status(400).json({ error: "지사, 카테고리, 비축기준(톤)을 입력하세요." });
  }
  const existing = db
    .prepare("SELECT * FROM stock_targets WHERE branch_id = ? AND category = ?")
    .get(branch_id, category);
  if (existing) {
    db.prepare("UPDATE stock_targets SET min_stock_tons = ? WHERE id = ?").run(
      min_stock_tons,
      existing.id
    );
  } else {
    db.prepare(
      "INSERT INTO stock_targets (branch_id, category, min_stock_tons) VALUES (?, ?, ?)"
    ).run(branch_id, category, min_stock_tons);
  }
  res.json(
    db
      .prepare(
        `SELECT st.id, st.branch_id, b.name AS branch_name, st.category, st.min_stock_tons
         FROM stock_targets st JOIN branches b ON b.id = st.branch_id
         WHERE st.branch_id = ? AND st.category = ?`
      )
      .get(branch_id, category)
  );
});

module.exports = router;
