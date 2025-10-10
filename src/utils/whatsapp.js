import axios from "axios";
import dotenv from "dotenv";
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
