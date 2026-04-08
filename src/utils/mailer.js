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

export async function sendMail({ to, subject, html, text }) {
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

export async function sendGenericEmail(to, subject, text) {
  const mailOptions = {
    from: `"Agency System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text, // plain text (you can change to html if you want)
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Notification email sent to ${to}`);
}

export async function sendTicketEmail(to, subject, data, pdf, pdfName) {
  const html = loadTemplate("ticketEmail", {
    agencyName: data.agencyName || "Afro Trip Express",
    logoTag: data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" style="max-height: 50px; margin-bottom: 10px;"/>` : "",
    primaryColor: data.primaryColor || "#004d40",
    passengerName: data.passengerName ? ` ${data.passengerName}` : "",
    messageBody: data.messageBody ? `<p>${data.messageBody}</p>` : "<p>Attached is your e-ticket and itinerary. Thank you for booking with us!</p>",
    footerText: data.footerText || "",
    year: new Date().getFullYear(),
  });

  const attachments = [];
  // Accept either a file path (string) or an in-memory Buffer
  if (pdf) {
    if (typeof pdf === "string") {
      attachments.push({ filename: pdfName || "ETicket.pdf", path: pdf });
    } else if (Buffer.isBuffer(pdf)) {
      attachments.push({ filename: pdfName || "ETicket.pdf", content: pdf });
    }
  }

  const mailOptions = {
    from: `"${data.agencyName || "Agency System"}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Ticket Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Error sending ticket email to ${to}:`, err.message);
    throw err;
  }
}
