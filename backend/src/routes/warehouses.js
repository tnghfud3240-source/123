const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");

const router = express.Router();

// 창고 목록(이름·소속 지사)은 전환 시 타지사 목적지 선택 등에 필요해 모든 역할에
// 공개한다. 재고 수량·이력 등 민감한 데이터는 각 라우트에서 별도로 지사 범위를 강제.
router.get("/", requireAuth, (req, res) => {
  const { branch_id: branchId } = req.query;
  const clauses = [];
  const params = [];
  if (branchId) {
    clauses.push("w.branch_id = ?");
    params.push(branchId);
  }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const rows = db
    .prepare(
      `SELECT w.*, b.name AS branch_name
       FROM warehouses w
       JOIN branches b ON b.id = w.branch_id
       ${where}
       ORDER BY b.sort_order, b.name, w.name`
    )
    .all(...params);
  res.json(rows);
});

router.post("/", requireAuth, requireRole("admin", "office"), (req, res) => {
  const { name, branch_id } = req.body || {};
  if (!name || !branch_id) {
    return res.status(400).json({ error: "지사와 창고명을 입력하세요." });
  }
  try {
    const info = db
      .prepare("INSERT INTO warehouses (branch_id, name) VALUES (?, ?)")
      .run(branch_id, name);
    res.status(201).json(
      db
        .prepare(
          `SELECT w.*, b.name AS branch_name FROM warehouses w JOIN branches b ON b.id = w.branch_id WHERE w.id = ?`
        )
        .get(info.lastInsertRowid)
    );
  } catch (e) {
    res.status(400).json({ error: "해당 지사에 이미 존재하는 창고명입니다." });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "office"), (req, res) => {
  const { name, branch_id } = req.body || {};
  const existing = db.prepare("SELECT * FROM warehouses WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "창고를 찾을 수 없습니다." });
  db.prepare("UPDATE warehouses SET name = ?, branch_id = ? WHERE id = ?").run(
    name ?? existing.name,
    branch_id ?? existing.branch_id,
    req.params.id
  );
  res.json(
    db
      .prepare(
        `SELECT w.*, b.name AS branch_name FROM warehouses w JOIN branches b ON b.id = w.branch_id WHERE w.id = ?`
      )
      .get(req.params.id)
  );
});

router.delete("/:id", requireAuth, requireRole("admin", "office"), (req, res) => {
  const used = db
    .prepare("SELECT COUNT(*) c FROM transactions WHERE warehouse_id = ?")
    .get(req.params.id).c;
  if (used > 0) {
    return res.status(400).json({ error: "입출고 이력이 있는 창고는 삭제할 수 없습니다." });
  }
  db.prepare("DELETE FROM warehouses WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
