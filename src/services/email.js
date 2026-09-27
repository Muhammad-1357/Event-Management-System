async function sendVerificationEmail(email, verificationUrl) {
  const requiredSettings = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "EMAIL_FROM",
  ];
  const missingSettings = requiredSettings.filter((key) => !process.env[key]);

  if (missingSettings.length > 0) {
    throw new Error("Email delivery configuration is incomplete");
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }

  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify your EventHorizon email",
    text: `Verify your email address by opening this link: ${verificationUrl}`,
    html: `<p>Verify your email address:</p><p><a href="${verificationUrl}">Verify email</a></p>`,
  });
}

module.exports = { sendVerificationEmail };