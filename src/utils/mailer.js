import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

function loadTemplate(name, data = {}) {
  const filePath = path.resolve(`templates/${name}.html`);
  let html = fs.readFileSync(filePath, "utf8");
  Object.entries(data).forEach(([key, val]) => {
    html = html.replace(new RegExp(`{{${key}}}`, "g"), val || "");
  });
  return html;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, html, text }) {
  const mailOptions = {
    from: `"Agency System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Error sending email to ${to}:`, err.message);
    throw err;
  }
}

export async function sendVerificationEmail(to, code, name = "") {
  const html = loadTemplate("welcomeVerify", {
    name,
    code,
    verifyLink: `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(to)}`,
    supportEmail: process.env.SUPPORT_EMAIL,
    year: new Date().getFullYear(),
  });
  const subject = "Verify your email address";
  return sendMail({ to, subject, html, text: `Your verification code is ${code}` });
}

export async function sendOtpEmail(to, code, name = "") {
  const html = loadTemplate("passwordReset", {
    name,
    code,
    year: new Date().getFullYear(),
  });
  const subject = "Password reset OTP code";
  return sendMail({ to, subject, html, text: `Your OTP code is ${code}` });
}

export async function sendPasswordChangedEmail(to, name = "") {
  const html = loadTemplate("passwordChanged", {
    name,
    loginLink: `${process.env.FRONTEND_URL}/login`,
    year: new Date().getFullYear(),
  });
  const subject = "Your password has been changed";
  return sendMail({ to, subject, html, text: "Your password was changed. If you did not do this, contact support." });
}

// Generic email sender for notifications / bulk messages
export async function sendGenericEmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"Agency System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text, // plain text (you can change to html if you want)
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Notification email sent to ${to}`);
}
