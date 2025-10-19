import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(to, code, name = '') {
  const mailOptions = {
    from: `"Agency System" <${process.env.SMTP_USER}>`,
    to,
    subject: "Verify your email address",
    html: `
      <h2>Email Verification</h2>
      <p>Hello${name ? `, ${name}` : ''}</p> 
      <p>Your verification code is:</p>
      <h3 style="color:green;">${code}</h3>
      <p>This code expires in 15 minutes.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Verification email sent to:", to);
    return info;
  } catch (err) {
    console.error("❌ Error sending verification email:", err.message);
    throw err;
  }
}

export async function sendOtpEmail(to, code, name = '') {
  const mailOptions = {
    from: `"Agency System" <${process.env.SMTP_USER}>`,
    to,
    subject: "Password Reset OTP Code",
    html: `
      <h2>Password Reset</h2>
      <p>Hello${name ? `, ${name}` : ''}</p>
      <p>Your OTP code is:</p>
      <h1 style="color:#008CBA;">${code}</h1>
      <p>This code expires in 10 minutes.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 OTP email sent to ${to}`);
    return info;
  } catch (err) {
    console.error("❌ Error sending OTP email:", err.message);
    throw err;
  }
}
