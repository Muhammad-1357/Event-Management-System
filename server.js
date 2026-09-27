require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");

const port = Number(process.env.PORT) || 4555;

async function start() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be configured");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  app.listen(port, () => {
    console.log(`EventHorizon API listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exitCode = 1;
});