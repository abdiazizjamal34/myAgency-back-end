import { sendWhatsAppText } from "./whatsapp.js";
import { sendGenericEmail } from "./mailer.js";

// user: a User document
// options: { channel, subject, text }
export async function sendMessageToUser(user, { channel, subject, text }) {
  const target = channel || "whatsapp"; // default to whatsapp

  // WhatsApp notification
  if ((target === "whatsapp" || target === "both") && user.phone) {
    await sendWhatsAppText(user.phone, text);
  }

  // Email notification
  if ((target === "email" || target === "both") && user.email) {
    await sendGenericEmail(
      user.email,
      subject || "Notification from Agency System",
      text
    );
  }
}
