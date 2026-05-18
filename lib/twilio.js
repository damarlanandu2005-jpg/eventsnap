import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send a WhatsApp message via Twilio.
 * @param {string} to - Recipient phone number in E.164 format (e.g. +1234567890)
 * @param {string} body - Message text
 * @param {string[]} [mediaUrls] - Optional array of publicly accessible media URLs
 * @returns {Promise<object>} Twilio message object
 */
export async function sendWhatsAppMessage(to, body, mediaUrls = []) {
  const messageParams = {
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${to}`,
    body,
  };

  if (mediaUrls.length > 0) {
    messageParams.mediaUrl = mediaUrls;
  }

  return client.messages.create(messageParams);
}
