/**
 * lib/email.ts — transactional email via Resend.
 *
 * Resend has a free tier and a simple API. The API key lives in RESEND_API_KEY
 * (env only). APP_URL is the site's base URL (e.g. https://yoursite.vercel.app),
 * used to build the verification link.
 *
 * If RESEND_API_KEY is not set (e.g. local dev without email), sendVerifyEmail
 * logs the link to the console instead of throwing, so you can still test the
 * flow by copying the link from server logs.
 */
import { Resend } from 'resend';

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export async function sendVerifyEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/verify?token=${encodeURIComponent(token)}`;

  // Read the key at call time (not module load) and treat empty/placeholder
  // values as "not configured" so a leftover .env line can't half-enable email.
  const key = (process.env.RESEND_API_KEY || '').trim();
  const keyLooksReal = key.startsWith('re_') && key.length > 10;

  if (!keyLooksReal) {
    // No usable provider — print the link so dev/testing still works.
    console.log('\n==================================================');
    console.log(`[email] No valid RESEND_API_KEY — verification link for ${to}:`);
    console.log(link);
    console.log('==================================================\n');
    return;
  }

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Verify your Comment Exporter account',
      html: `
        <div style="font-family:Inter,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0b1220">
          <div style="font-family:monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a15c00">Comment Exporter</div>
          <h1 style="font-size:20px;margin:8px 0 12px">Confirm your email</h1>
          <p style="color:#374151;font-size:14px;line-height:1.6">
            Click the button below to verify your address and activate your account.
            This link expires in 24 hours.
          </p>
          <a href="${link}" style="display:inline-block;margin:18px 0;background:#f5b301;color:#0b1220;
            text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;font-size:14px">Verify email</a>
          <p style="color:#6b7280;font-size:12px;line-height:1.6">
            If the button doesn't work, paste this link into your browser:<br>
            <span style="word-break:break-all;color:#2563eb">${link}</span>
          </p>
          <p style="color:#9ca3af;font-size:11px;margin-top:20px">
            If you didn't create this account, you can ignore this email.
          </p>
        </div>`,
    });
    if (error) {
      // Don't crash registration — log and fall back to printing the link.
      console.error('[email] Resend rejected the send:', JSON.stringify(error));
      console.log(`[email] Fallback verification link for ${to}: ${link}`);
    }
  } catch (e) {
    // Network or config failure — again, never crash registration.
    console.error('[email] send threw:', e instanceof Error ? e.message : e);
    console.log(`[email] Fallback verification link for ${to}: ${link}`);
  }
}
