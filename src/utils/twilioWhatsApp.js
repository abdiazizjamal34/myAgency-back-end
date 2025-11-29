// src/utils/twilioWhatsApp.js
import dotenv from "dotenv";
import twilio from "twilio";
dotenv.config();

const SID = (process.env.TWILIO_ACCOUNT_SID || "").trim();
const TOKEN = (process.env.TWILIO_AUTH_TOKEN || "").trim();
let FROM_RAW = (process.env.TWILIO_WHATSAPP_FROM || "").trim();
// remove optional "whatsapp:" prefix if user included it
FROM_RAW = FROM_RAW.replace(/^whatsapp:\s*/i, "");
const FROM = FROM_RAW ? `whatsapp:${FROM_RAW}` : null;

const client = SID && TOKEN ? twilio(SID, TOKEN) : null;

function normalizePhone(phone) {
  if (!phone) return null;
  let s = String(phone).trim().replace(/[\s()-]/g, "");
  if (!s.startsWith("+")) s = `+${s}`;
  return s;
}

export async function sendWhatsAppTwilio(phone, message) {
  if (!client) throw new Error("Twilio client not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)");
  if (!FROM) throw new Error("TWILIO_WHATSAPP_FROM not set. Use sandbox or approved WhatsApp number in .env");
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Invalid recipient phone number");
  const to = `whatsapp:${normalized}`;
  try {
    const msg = await client.messages.create({ body: message, from: FROM, to });
    return msg;
  } catch (err) {
    console.error("Twilio send error", err.code || err.status || err.message || err);
    throw err;
  }
}
