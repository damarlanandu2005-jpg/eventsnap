/**
 * Resend email client singleton.
 * Sends transactional emails (zip ready notification, etc.)
 *
 * Required env var: RESEND_API_KEY
 */

import { Resend } from "resend";

let _resend = null;

export function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set.");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Send a "zip download ready" email to a guest.
 * @param {string} to
 * @param {string} downloadUrl
 * @param {string} eventName
 */
export async function sendZipReadyEmail(to, downloadUrl, eventName = "your event") {
  const resend = getResend();
  await resend.emails.send({
    from: "EventSnap <photos@eventsnap.in>",
    to,
    subject: `Your photos from ${eventName} are ready to download`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0D0A14;color:#fff;border-radius:16px;">
        <div style="font-size:24px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#F0C060,#F7D98A);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">✦ EventSnap</div>
        <h1 style="font-size:20px;font-weight:700;margin-bottom:12px;color:#fff;">Your photos are ready!</h1>
        <p style="color:rgba(255,255,255,0.65);line-height:1.6;margin-bottom:24px;">
          Your photo pack from <strong style="color:#F0C060;">${eventName}</strong> has been zipped and is ready for download.
        </p>
        <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#E8A830,#F0C060);color:#0D0A14;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:15px;">
          Download My Photos →
        </a>
        <p style="color:rgba(255,255,255,0.35);font-size:12px;margin-top:24px;">
          This link expires in 24 hours. Photos are deleted after download for your privacy.
        </p>
      </div>
    `,
  });
}
