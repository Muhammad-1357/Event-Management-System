const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const app = require("../app");

test("health endpoint reports the API status", async () => {
  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
});

test("registration rejects passwords that do not meet the policy", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email: "person@example.com", password: "password" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Request validation failed");
});

test("registration rejects unexpected fields", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email: "person@example.com", password: "meetup2026", isVerified: true });

  assert.equal(response.status, 400);
});

test("resend verification validates the email address", async () => {
  const response = await request(app)
    .post("/api/auth/resend-verification")
    .send({ email: "not-an-email" });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Request validation failed");
});

test("login requires a valid email and password", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "not-an-email" });

  assert.equal(response.status, 400);
});

test("email verification rejects malformed tokens", async () => {
  const response = await request(app)
    .post("/api/auth/verify-email")
    .send({ token: "not-a-token" });

  assert.equal(response.status, 400);
});

test("browser verification links reject malformed tokens", async () => {
  const response = await request(app).get("/api/auth/verify-email?token=invalid");

  assert.equal(response.status, 400);
  assert.match(response.text, /Verification link is invalid/);
});

test("profile access requires a bearer token", async () => {
  const response = await request(app).get("/api/user/profile");

  assert.equal(response.status, 401);
});