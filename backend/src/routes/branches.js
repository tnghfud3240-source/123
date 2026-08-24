const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM branches ORDER BY sort_order, name").all();
  res.json(rows);
});

router.post("/", requireAuth, requireRole("admin", "office"), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "지사명을 입력하세요." });
  try {
    const nextOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM branches").get().n;
    const info = db
      .prepare("INSERT INTO branches (name, sort_order) VALUES (?, ?)")
      .run(name, nextOrder);
    res.status(201).json(db.prepare("SELECT * FROM branches WHERE id = ?").get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: "이미 존재하는 지사명입니다." });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "office"), (req, res) => {
  const existing = db.prepare("SELECT * FROM branches WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "지사를 찾을 수 없습니다." });
  const { name } = req.body || {};
  db.prepare("UPDATE branches SET name = ? WHERE id = ?").run(name ?? existing.name, req.params.id);
  res.json(db.prepare("SELECT * FROM branches WHERE id = ?").get(req.params.id));
});

router.delete("/:id", requireAuth, requireRole("admin", "office"), (req, res) => {
  const used = db
    .prepare("SELECT COUNT(*) c FROM warehouses WHERE branch_id = ?")
    .get(req.params.id).c;
  if (used > 0) {
    return res.status(400).json({ error: "소속 창고가 있는 지사는 삭제할 수 없습니다." });
  }
  db.prepare("DELETE FROM branches WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
