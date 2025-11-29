import dotenv from 'dotenv';
dotenv.config();
import { sendWhatsAppTwilio } from '../src/utils/twilioWhatsApp.js';

async function run() {
  try {
    // replace with a phone that has joined the Twilio WhatsApp sandbox (or a production WhatsApp-enabled number)
    const to = '+251934142258'; // E.164 format
    const res = await sendWhatsAppTwilio(to, 'Test message from Twilio');
    console.log('Sent, sid=', res.sid || res);
  } catch (err) {
    console.error('Send error:', err.message || err);
    process.exit(1);
  }
}

run();