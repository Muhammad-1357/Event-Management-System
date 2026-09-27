const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/user");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.status(200).json({ service: "EventHorizon API", status: "ok" });
});

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  authRoutes
);
app.use("/api/user", userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Request body must be valid JSON" });
  }

  console.error("Unhandled request error:", error.message);
  return res.status(500).json({ message: "Internal server error" });
});

module.exports = app;