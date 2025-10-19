import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export async function verifyEmailWithMailboxLayer(email) {
  try {
    const apiKey = process.env.MAILBOXLAYER_API_KEY;
    const url = `https://apilayer.net/api/check?access_key=${apiKey}&email=${email}&smtp=1&format=1`;

    const response = await axios.get(url);
    const data = response.data;

    // Basic debug info
    console.log("📧 MailboxLayer response:", {
      email: data.email,
      format_valid: data.format_valid,
      smtp_check: data.smtp_check,
      disposable: data.disposable,
      catch_all: data.catch_all
    });

    // Return true only if mailbox is real and valid
    return (
      data.format_valid === true &&
      data.smtp_check === true &&
      data.disposable === false
    );
  } catch (error) {
    console.error("❌ Email verification failed:", error.message);
    // Fallback: assume invalid if API fails
    return false;
  }
}
