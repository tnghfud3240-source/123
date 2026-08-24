const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "12h";

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      branch_id: user.branch_id,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "인증이 필요합니다." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "토큰이 유효하지 않습니다." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }
    next();
  };
}

// field 역할은 소속 지사로 범위가 고정된다. 요청에 담긴 branch_id는 무시하고
// 항상 자신의 branch_id로 강제한다(admin/office는 요청 값을 그대로 사용, 없으면 전체).
function effectiveBranchId(user, requestedBranchId) {
  if (user.role === "field") return user.branch_id || -1; // 소속 지사 없는 field는 아무 것도 조회 불가
  return requestedBranchId || undefined;
}

// field 역할이 자신의 지사에 속하지 않은 창고에 입출고/전환을 기록하지 못하도록 검증
function canAccessWarehouse(user, warehouseId) {
  if (user.role !== "field") return true;
  const wh = db.prepare("SELECT branch_id FROM warehouses WHERE id = ?").get(warehouseId);
  return !!wh && wh.branch_id === user.branch_id;
}

module.exports = { signToken, requireAuth, requireRole, effectiveBranchId, canAccessWarehouse, JWT_SECRET };
