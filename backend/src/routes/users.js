const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");

const router = express.Router();

function toPublic(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    branch_id: u.branch_id,
  };
}

router.get("/", requireAuth, requireRole("admin", "office"), (req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY role, name").all();
  res.json(rows.map(toPublic));
});

router.post("/", requireAuth, requireRole("admin", "office"), (req, res) => {
  const { username, password, name, role, branch_id } = req.body || {};
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: "필수 항목이 누락되었습니다." });
  }
  if (!["admin", "office", "field"].includes(role)) {
    return res.status(400).json({ error: "유효하지 않은 역할입니다." });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare(
        "INSERT INTO users (username, password_hash, name, role, branch_id) VALUES (?, ?, ?, ?, ?)"
      )
      .run(username, hash, name, role, branch_id || null);
    res.status(201).json(toPublic(db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid)));
  } catch (e) {
    res.status(400).json({ error: "이미 존재하는 아이디입니다." });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "office"), (req, res) => {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
  const { name, role, branch_id, password } = req.body || {};
  db.prepare(
    "UPDATE users SET name = ?, role = ?, branch_id = ? WHERE id = ?"
  ).run(name ?? existing.name, role ?? existing.role, branch_id ?? existing.branch_id, req.params.id);
  if (password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      bcrypt.hashSync(password, 10),
      req.params.id
    );
  }
  res.json(toPublic(db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", requireAuth, requireRole("admin", "office"), (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "자기 자신은 삭제할 수 없습니다." });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
