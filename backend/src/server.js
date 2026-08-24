const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const branchRoutes = require("./routes/branches");
const warehouseRoutes = require("./routes/warehouses");
const itemRoutes = require("./routes/items");
const transactionRoutes = require("./routes/transactions");
const stockRoutes = require("./routes/stock");
const stockTargetRoutes = require("./routes/stock-targets");
const dashboardRoutes = require("./routes/dashboard");
const userRoutes = require("./routes/users");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/stock-targets", stockTargetRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);

// 프론트엔드 빌드 결과물(frontend/dist)을 백엔드에서 함께 서빙한다.
// PC 한 대에서 `npm run build`(프론트) 후 `npm start`(백엔드)만 실행하면
// 같은 포트 하나로 API와 화면을 모두 제공해, 사무실 PC에 상시 켜두고
// 다른 PC에서는 브라우저로 해당 PC의 주소(IP:포트)만 열면 되도록 한다.
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  console.warn(
    "frontend/dist가 없습니다. `cd frontend && npm run build`를 먼저 실행하면 이 서버가 화면도 함께 제공합니다."
  );
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`제설창고관리시스템 서버 실행 중: http://localhost:${PORT}`);
});
