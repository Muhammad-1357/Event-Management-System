const crypto = require("node:crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const User = require("../models/User");
const validate = require("../middleware/validate");
const { sendVerificationEmail } = require("../services/email");

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/)
    .required()
    .messages({
      "string.pattern.base": "Password must contain only letters and numbers, with at least one of each",
    }),
}).unknown(false);

const loginSchema = Joi.object({
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string().min(1).max(128).required(),
}).unknown(false);

const resendVerificationSchema = Joi.object({
  email: Joi.string().trim().email().max(254).required(),
}).unknown(false);

const verifyEmailSchema = Joi.object({
  token: Joi.string().hex().length(64).required(),
}).unknown(false);

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getTokenExpiry() {
  const hours = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("EMAIL_VERIFICATION_TTL_HOURS must be greater than zero");
  }
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function createVerificationUrl(token) {
  const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4555}`;
  const verificationUrl = new URL("/api/auth/verify-email", apiBaseUrl);
  verificationUrl.searchParams.set("token", token);
  return verificationUrl.toString();
}

async function verifyToken(token) {
  return User.findOneAndUpdate(
    {
      verificationTokenHash: hashVerificationToken(token),
      verificationTokenExpiresAt: { $gt: new Date() },
      isVerified: false,
    },
    {
      $set: { isVerified: true },
      $unset: { verificationTokenHash: 1, verificationTokenExpiresAt: 1 },
    },
    { new: true }
  );
}

function verificationPage(message, success) {
  const color = success ? "#16794b" : "#b42318";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email verification</title><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 1.5rem;color:#202124"><h1 style="color:${color}">${message}</h1><p>You can close this page and return to EventHorizon.</p></body></html>`;
}

router.post("/register", validate(registerSchema), async (req, res) => {
  const email = req.body.email.toLowerCase();

  try {
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const user = await User.create({
      email,
      passwordHash: await bcrypt.hash(req.body.password, 12),
      verificationTokenHash: hashVerificationToken(verificationToken),
      verificationTokenExpiresAt: getTokenExpiry(),
    });
    try {
      await sendVerificationEmail(user.email, createVerificationUrl(verificationToken));
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      console.error("Verification email delivery failed:", error.message);
      return res.status(503).json({ message: "Verification email could not be sent" });
    }

    return res.status(201).json({
      message: "Registration successful. Check your email to verify your account.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    if (error.message === "EMAIL_VERIFICATION_TTL_HOURS must be greater than zero") {
      return res.status(500).json({ message: "Email verification is not configured" });
    }
    console.error("Registration failed:", error.message);
    return res.status(500).json({ message: "Registration could not be completed" });
  }
});

router.post("/resend-verification", validate(resendVerificationSchema), async (req, res) => {
  const genericResponse = {
    message: "If an unverified account exists for that email, a new verification link will be sent.",
  };

  try {
    const email = req.body.email.toLowerCase();
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const user = await User.findOneAndUpdate(
      { email, isVerified: false },
      {
        $set: {
          verificationTokenHash: hashVerificationToken(verificationToken),
          verificationTokenExpiresAt: getTokenExpiry(),
        },
      },
      { new: true }
    );

    if (user) {
      try {
        await sendVerificationEmail(user.email, createVerificationUrl(verificationToken));
      } catch (error) {
        console.error("Verification email resend failed:", error.message);
      }
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Verification resend request failed:", error.message);
    return res.status(200).json(genericResponse);
  }
});

router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Verify your email before logging in" });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ message: "Authentication is not configured" });
    }

    const token = jwt.sign({}, process.env.JWT_SECRET, {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      issuer: "eventhorizon-api",
      audience: "eventhorizon-client",
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    });
  } catch (error) {
    console.error("Login failed:", error.message);
    return res.status(500).json({ message: "Login could not be completed" });
  }
});

router.get("/verify-email", async (req, res) => {
  const { error, value } = verifyEmailSchema.validate({ token: req.query.token });
  if (error) {
    return res.status(400).type("html").send(verificationPage("Verification link is invalid", false));
  }

  try {
    const user = await verifyToken(value.token);

    if (!user) {
      return res.status(400).type("html").send(verificationPage("Link is invalid or expired", false));
    }

    return res.status(200).type("html").send(verificationPage("Email verified successfully", true));
  } catch (error) {
    console.error("Email verification failed:", error.message);
    return res.status(500).type("html").send(verificationPage("Verification could not be completed", false));
  }
});

router.post("/verify-email", validate(verifyEmailSchema), async (req, res) => {
  try {
    const user = await verifyToken(req.body.token);

    if (!user) {
      return res.status(400).json({ message: "Verification token is invalid or expired" });
    }

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification failed:", error.message);
    return res.status(500).json({ message: "Email verification could not be completed" });
  }
});

module.exports = router;