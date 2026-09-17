const express = require("express");
const db = require("../db");

const router = express.Router();

function computeDelta(type, quantity) {
  const q = Number(quantity);
  if (type === "in") return Math.abs(q);
  if (type === "out") return -Math.abs(q);
  return q; // adjust: signed값 그대로
}

function insertTransaction(tx) {
  const { client_id, warehouse_id, item_id, type, quantity, memo, operator_name, occurred_at } = tx;
  if (!client_id || !warehouse_id || !item_id || !type || quantity == null || !occurred_at) {
    return { error: "필수 항목이 누락되었습니다.", client_id };
  }
  if (!["in", "out", "adjust"].includes(type)) {
    return { error: "유효하지 않은 입출고 유형입니다.", client_id };
  }

  const existing = db
    .prepare("SELECT * FROM transactions WHERE client_id = ?")
    .get(client_id);
  if (existing) {
    return { status: "duplicate", transaction: existing };
  }

  const delta = computeDelta(type, quantity);
  try {
    const info = db
      .prepare(
        `INSERT INTO transactions
          (client_id, warehouse_id, item_id, type, quantity, delta, memo, operator_name, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        client_id,
        warehouse_id,
        item_id,
        type,
        Math.abs(Number(quantity)),
        delta,
        memo || null,
        operator_name || null,
        occurred_at
      );
    return {
      status: "created",
      transaction: db.prepare("SELECT * FROM transactions WHERE id = ?").get(info.lastInsertRowid),
    };
  } catch (e) {
    return { error: "저장 중 오류가 발생했습니다: " + e.message, client_id };
  }
}

// 전환: 같은 카테고리 내에서 형태만 바꿔 재기록(예: 톤백 -> 개포). 목적지 창고를
// 출발 창고와 다르게 지정하면(타지사 포함) 형태 변경과 동시에 재고 이동도 된다.
// 톤 환산 총량은 변하지 않고, 두 개의 ledger row(감소/증가)로 기록한다.
function insertConversion(payload) {
  const {
    client_id,
    warehouse_id,
    to_warehouse_id,
    from_item_id,
    to_item_id,
    quantity,
    memo,
    operator_name,
    occurred_at,
  } = payload;
  const destWarehouseId = to_warehouse_id || warehouse_id;
  if (!client_id || !warehouse_id || !from_item_id || !to_item_id || quantity == null || !occurred_at) {
    return { error: "필수 항목이 누락되었습니다.", client_id };
  }
  if (from_item_id === to_item_id && warehouse_id === destWarehouseId) {
    return { error: "전환 전/후 형태나 창고 중 하나는 달라야 합니다.", client_id };
  }

  const fromClientId = `${client_id}:from`;
  const existing = db.prepare("SELECT * FROM transactions WHERE client_id = ?").get(fromClientId);
  if (existing) {
    const toRow = db
      .prepare("SELECT * FROM transactions WHERE client_id = ?")
      .get(`${client_id}:to`);
    return { status: "duplicate", transactions: [existing, toRow].filter(Boolean) };
  }

  const destWarehouse = db.prepare("SELECT * FROM warehouses WHERE id = ?").get(destWarehouseId);
  if (!destWarehouse) {
    return { error: "목적지 창고를 찾을 수 없습니다.", client_id };
  }
  const fromItem = db.prepare("SELECT * FROM items WHERE id = ?").get(from_item_id);
  const toItem = db.prepare("SELECT * FROM items WHERE id = ?").get(to_item_id);
  if (!fromItem || !toItem) {
    return { error: "품목을 찾을 수 없습니다.", client_id };
  }
  if (fromItem.category !== toItem.category) {
    return { error: "같은 품목(카테고리) 안에서만 전환할 수 있습니다.", client_id };
  }

  const fromQty = Math.abs(Number(quantity));
  const tons = fromQty * fromItem.to_ton_factor;
  const toQty = tons / toItem.to_ton_factor;

  try {
    db.exec("BEGIN");
    const infoFrom = db
      .prepare(
        `INSERT INTO transactions
          (client_id, warehouse_id, item_id, type, quantity, delta, memo, operator_name, occurred_at)
         VALUES (?, ?, ?, 'convert', ?, ?, ?, ?, ?)`
      )
      .run(fromClientId, warehouse_id, from_item_id, fromQty, -fromQty, memo || null, operator_name || null, occurred_at);
    const infoTo = db
      .prepare(
        `INSERT INTO transactions
          (client_id, warehouse_id, item_id, type, quantity, delta, memo, operator_name, occurred_at)
         VALUES (?, ?, ?, 'convert', ?, ?, ?, ?, ?)`
      )
      .run(`${client_id}:to`, destWarehouseId, to_item_id, toQty, toQty, memo || null, operator_name || null, occurred_at);
    db.exec("COMMIT");
    return {
      status: "created",
      transactions: [
        db.prepare("SELECT * FROM transactions WHERE id = ?").get(infoFrom.lastInsertRowid),
        db.prepare("SELECT * FROM transactions WHERE id = ?").get(infoTo.lastInsertRowid),
      ],
    };
  } catch (e) {
    db.exec("ROLLBACK");
    return { error: "저장 중 오류가 발생했습니다: " + e.message, client_id };
  }
}

// 출고(예비살포/본살포): 살포 유형과 대수만으로 염화칼슘·소금 출고량을 자동 계산해
// 같은 창고에서 두 품목을 동시에 차감한다. 염화칼슘은 항상 염수(리터)로 고정 차감,
// 소금은 화면에서 선택한 형태(톤백/개포)로 톤 환산해 차감한다.
const SPRAY_LABELS = { preliminary: "예비살포", main: "본살포" };
const SPRAY_CALCIUM_BRINE_LITERS = { preliminary: 1500, main: 3000 };
const SPRAY_SALT_TONS_PER_UNIT = { preliminary: 4, main: 8 };

function currentStockTons(warehouseId, item) {
  const row = db
    .prepare("SELECT COALESCE(SUM(delta), 0) AS qty FROM transactions WHERE warehouse_id = ? AND item_id = ?")
    .get(warehouseId, item.id);
  return row.qty * item.to_ton_factor;
}

function insertSpray(payload) {
  const { client_id, warehouse_id, spray_type, count, memo, operator_name, occurred_at } = payload;
  if (!client_id || !warehouse_id || !spray_type || count == null || !occurred_at) {
    return { error: "필수 항목이 누락되었습니다.", client_id };
  }
  if (!SPRAY_CALCIUM_BRINE_LITERS[spray_type]) {
    return { error: "유효하지 않은 살포 유형입니다.", client_id };
  }
  const countNum = Math.abs(Number(count));
  if (!countNum) {
    return { error: "대수를 입력하세요.", client_id };
  }

  const calciumClientId = `${client_id}:calcium`;
  const gaepoClientId = `${client_id}:salt-gaepo`;
  const tonbackClientId = `${client_id}:salt-tonback`;
  const existing = db.prepare("SELECT * FROM transactions WHERE client_id = ?").get(calciumClientId);
  if (existing) {
    const saltRows = db
      .prepare("SELECT * FROM transactions WHERE client_id IN (?, ?)")
      .all(gaepoClientId, tonbackClientId);
    return { status: "duplicate", transactions: [existing, ...saltRows] };
  }

  const calciumItem = db
    .prepare("SELECT * FROM items WHERE category = ? AND name = ?")
    .get("염화칼슘", "염수");
  const gaepoItem = db.prepare("SELECT * FROM items WHERE category = ? AND name = ?").get("소금(제설용)", "개포");
  const tonbackItem = db.prepare("SELECT * FROM items WHERE category = ? AND name = ?").get("소금(제설용)", "톤백");
  if (!calciumItem) {
    return { error: "염화칼슘 염수 품목을 찾을 수 없습니다. 품목 관리에서 확인하세요.", client_id };
  }
  if (!gaepoItem || !tonbackItem) {
    return { error: "소금(제설용) 톤백/개포 품목을 찾을 수 없습니다. 품목 관리에서 확인하세요.", client_id };
  }

  const calciumQty = countNum * SPRAY_CALCIUM_BRINE_LITERS[spray_type];
  const totalSaltTons = countNum * SPRAY_SALT_TONS_PER_UNIT[spray_type];
  const label = `${SPRAY_LABELS[spray_type]} ${countNum}대${memo ? " · " + memo : ""}`;
  const calcium_item_id = calciumItem.id;

  // 소금은 개포 재고를 먼저 소진하고, 모자란 만큼만 톤백에서 차감한다.
  const gaepoStockTons = Math.max(currentStockTons(warehouse_id, gaepoItem), 0);
  const gaepoUseTons = Math.min(totalSaltTons, gaepoStockTons);
  const tonbackUseTons = totalSaltTons - gaepoUseTons;
  const gaepoQty = gaepoUseTons / gaepoItem.to_ton_factor;
  const tonbackQty = tonbackUseTons / tonbackItem.to_ton_factor;

  try {
    db.exec("BEGIN");
    const infoCalcium = db
      .prepare(
        `INSERT INTO transactions
          (client_id, warehouse_id, item_id, type, quantity, delta, memo, operator_name, occurred_at)
         VALUES (?, ?, ?, 'out', ?, ?, ?, ?, ?)`
      )
      .run(calciumClientId, warehouse_id, calcium_item_id, calciumQty, -calciumQty, label, operator_name || null, occurred_at);

    const saltTransactions = [];
    if (gaepoQty > 0) {
      const infoGaepo = db
        .prepare(
          `INSERT INTO transactions
            (client_id, warehouse_id, item_id, type, quantity, delta, memo, operator_name, occurred_at)
           VALUES (?, ?, ?, 'out', ?, ?, ?, ?, ?)`
        )
        .run(gaepoClientId, warehouse_id, gaepoItem.id, gaepoQty, -gaepoQty, label, operator_name || null, occurred_at);
      saltTransactions.push(db.prepare("SELECT * FROM transactions WHERE id = ?").get(infoGaepo.lastInsertRowid));
    }
    if (tonbackQty > 0) {
      const infoTonback = db
        .prepare(
          `INSERT INTO transactions
            (client_id, warehouse_id, item_id, type, quantity, delta, memo, operator_name, occurred_at)
           VALUES (?, ?, ?, 'out', ?, ?, ?, ?, ?)`
        )
        .run(tonbackClientId, warehouse_id, tonbackItem.id, tonbackQty, -tonbackQty, label, operator_name || null, occurred_at);
      saltTransactions.push(db.prepare("SELECT * FROM transactions WHERE id = ?").get(infoTonback.lastInsertRowid));
    }

    db.exec("COMMIT");
    return {
      status: "created",
      transactions: [
        db.prepare("SELECT * FROM transactions WHERE id = ?").get(infoCalcium.lastInsertRowid),
        ...saltTransactions,
      ],
    };
  } catch (e) {
    db.exec("ROLLBACK");
    return { error: "저장 중 오류가 발생했습니다: " + e.message, client_id };
  }
}

router.post("/spray", (req, res) => {
  const payload = req.body || {};
  const result = insertSpray(payload);
  if (result.error) return res.status(400).json(result);
  const code = result.status === "created" ? 201 : 200;
  res.status(code).json(result);
});

router.post("/spray/sync", (req, res) => {
  const items = Array.isArray(req.body?.sprays) ? req.body.sprays : [];
  const results = items.map((payload) => ({ client_id: payload.client_id, ...insertSpray(payload) }));
  res.json({ results });
});

router.post("/convert", (req, res) => {
  const payload = req.body || {};
  const result = insertConversion(payload);
  if (result.error) return res.status(400).json(result);
  const code = result.status === "created" ? 201 : 200;
  res.status(code).json(result);
});

router.post("/convert/sync", (req, res) => {
  const items = Array.isArray(req.body?.conversions) ? req.body.conversions : [];
  const results = items.map((payload) => ({ client_id: payload.client_id, ...insertConversion(payload) }));
  res.json({ results });
});

router.get("/", (req, res) => {
  const { warehouse_id, item_id, type, from, to, limit } = req.query;
  const branchId = req.query.branch_id;
  const clauses = [];
  const params = [];
  if (warehouse_id) {
    clauses.push("t.warehouse_id = ?");
    params.push(warehouse_id);
  }
  if (branchId) {
    clauses.push("w.branch_id = ?");
    params.push(branchId);
  }
  if (item_id) {
    clauses.push("t.item_id = ?");
    params.push(item_id);
  }
  if (type) {
    clauses.push("t.type = ?");
    params.push(type);
  }
  if (from) {
    clauses.push("t.occurred_at >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("t.occurred_at <= ?");
    params.push(to);
  }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const lim = Math.min(Number(limit) || 200, 1000);
  const rows = db
    .prepare(
      `SELECT t.*, b.name AS branch_name, w.name AS warehouse_name,
              i.category AS item_category, i.name AS item_name, i.unit AS item_unit,
              i.to_ton_factor AS item_to_ton_factor
       FROM transactions t
       JOIN warehouses w ON w.id = t.warehouse_id
       JOIN branches b ON b.id = w.branch_id
       JOIN items i ON i.id = t.item_id
       ${where}
       ORDER BY t.occurred_at DESC, t.id DESC
       LIMIT ?`
    )
    .all(...params, lim);
  res.json(rows);
});

router.post("/", (req, res) => {
  const tx = req.body || {};
  const result = insertTransaction(tx);
  if (result.error) return res.status(400).json(result);
  const code = result.status === "created" ? 201 : 200;
  res.status(code).json(result);
});

router.post("/sync", (req, res) => {
  const items = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
  const results = items.map((tx) => ({ client_id: tx.client_id, ...insertTransaction(tx) }));
  res.json({ results });
});

module.exports = router;
