import axios from "axios";
import dotenv from "dotenv";
import Twilio from 'twilio';
dotenv.config();

export async function sendOtpWhatsApp(phone, otp) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    to: phone, // must be in full international format, e.g. "251934142258"
    type: "text",
    text: {
      body: `Your password reset OTP is ${otp}. It expires in 5 minutes.`,
    },
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneId}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("✅ WhatsApp OTP sent:", response.data);
  } catch (err) {
    console.error("❌ WhatsApp send failed:", err.response?.data || err.message);
  }
}


// NEW: generic text message sender for notifications
export async function sendWhatsAppText(phone, text) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    to: phone, // e.g. "2519xxxxxxx"
    type: "text",
    text: { body: text },
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneId}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("✅ WhatsApp notification sent:", response.data);
  } catch (err) {
    console.error(
      "❌ WhatsApp notification failed:",
      err.response?.data || err.message
    );
  }
}

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_RAW = process.env.TWILIO_WHATSAPP_FROM; // E.164 like +1415...
const FROM = FROM_RAW ? `whatsapp:${FROM_RAW.replace(/\s+/g, '')}` : null;

const client = SID && TOKEN ? Twilio(SID, TOKEN) : null;

function normalizePhone(phone) {
  if (!phone) return null;
  let s = String(phone).trim();
  // remove common separators
  s = s.replace(/[\s()-]/g, '');
  // ensure starts with +, if starts with 0 attempt to not break (you may need to adapt)
  if (!s.startsWith('+')) s = `+${s}`;
  return s;
}

export async function sendWhatsAppTwilio(phone, message) {
  if (!client) throw new Error('Twilio client not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)');
  if (!FROM) throw new Error('TWILIO_WHATSAPP_FROM not set. Use sandbox or approved WhatsApp number.');

  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Invalid phone number');

  const to = `whatsapp:${normalized}`;
  try {
    const msg = await client.messages.create({ body: message, from: FROM, to });
    return msg;
  } catch (err) {
    // Improve error message for common Twilio errors
    if (err.code === 21212) {
      console.error('Twilio 21212: Invalid From number for WhatsApp. Ensure TWILIO_WHATSAPP_FROM is the sandbox or an approved WhatsApp sender and formatted as E.164.');
    } else {
      console.error('Twilio error', err.code || err.message);
    }
    throw err;
  }
}