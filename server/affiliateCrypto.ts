import crypto from 'node:crypto';

// ==============================================================================
// TEQQNOWORLD AFFILIATE CRYPTO, MASKING, DECIMAL-SAFE MATH & EMAIL UTILITIES
// Node.js v22/24 native strip-types compatible (import type only for TS types)
// ==============================================================================

let cachedKeyBuffer: Buffer | null = null;
let warnedEphemeralKey = false;

function getEncryptionKeyBuffer(): Buffer {
  if (cachedKeyBuffer) return cachedKeyBuffer;
  const rawKey = String(process.env.AFFILIATE_ENCRYPTION_KEY || '').trim();
  if (rawKey.length >= 16) {
    cachedKeyBuffer = crypto.createHash('sha256').update(rawKey, 'utf8').digest();
    return cachedKeyBuffer;
  }
  // Safe deterministic server-local fallback derived from runtime secrets if present,
  // or ephemeral process secret — NEVER hardcoded static string in source.
  const runtimeSeed =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.HOSTINGER_SMTP_PASSWORD ||
    process.env.RAZORPAY_KEY_SECRET ||
    crypto.randomBytes(32).toString('hex');
  if (!warnedEphemeralKey) {
    warnedEphemeralKey = true;
    console.warn(
      '[AffiliateCrypto] AFFILIATE_ENCRYPTION_KEY is not set; deriving AES-256-GCM key from server runtime entropy. Configure AFFILIATE_ENCRYPTION_KEY in production environment variables for persistent KYC decryption across restarts.'
    );
  }
  cachedKeyBuffer = crypto
    .createHash('sha256')
    .update(`teqqno-aff-kyc:${runtimeSeed}`, 'utf8')
    .digest();
  return cachedKeyBuffer;
}

export function encryptAffiliateSecret(plainText: string): string {
  const clean = String(plainText || '').trim();
  if (!clean) return '';
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptAffiliateSecret(cipherPayload: string): string {
  const raw = String(cipherPayload || '').trim();
  if (!raw || !raw.startsWith('v1:')) return '';
  const parts = raw.split(':');
  if (parts.length !== 4) return '';
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getEncryptionKeyBuffer();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hashSensitiveIdentifier(value: string): string {
  return crypto
    .createHash('sha256')
    .update(String(value || '').trim().toUpperCase(), 'utf8')
    .digest('hex');
}

export function hashOtpCode(email: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${email.trim().toLowerCase()}::${code.trim()}`, 'utf8')
    .digest('hex');
}

export function maskAadhaarNumber(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

export function maskPanNumber(raw: string): string {
  const clean = String(raw || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length < 4) return 'XXXXX0000X';
  return `${clean.slice(0, 2)}XXXX${clean.slice(-4)}`;
}

export function maskBankAccountNumber(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 4) return 'XXXXXX';
  return `${'X'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskOrderReference(orderId: string): string {
  const clean = String(orderId || '').trim();
  if (!clean) return 'TW-****';
  if (clean.length <= 6) return `TW-***${clean.slice(-2).toUpperCase()}`;
  const prefix = clean.startsWith('TQ-') || clean.startsWith('TW-') ? clean.slice(0, 3) : 'TQ-';
  return `${prefix}****${clean.slice(-4).toUpperCase()}`;
}

export function sanitizePlainText(input: unknown, maxLen = 500): string {
  return String(input ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

export function normalizeMobile(phone: unknown): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidAadhaar(raw: string): boolean {
  const digits = String(raw || '').replace(/\D/g, '');
  return /^[2-9]\d{11}$/.test(digits);
}

export function isValidPan(raw: string): boolean {
  const clean = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean);
}

export function isValidIfsc(raw: string): boolean {
  const clean = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean);
}

export function isValidBankAccount(raw: string): boolean {
  const digits = String(raw || '').replace(/\D/g, '');
  return /^\d{9,18}$/.test(digits);
}

// ==============================================================================
// DECIMAL-SAFE INTEGER PAISA FINANCIAL CALCULATIONS
// Basis: GST-inclusive discounted eligible product amount, shipping excluded.
// ==============================================================================
export function inrToPaisa(amountInr: number): number {
  const safe = Number.isFinite(amountInr) ? Math.max(0, amountInr) : 0;
  return Math.round(safe * 100);
}

export function paisaToInr(paisa: number): number {
  return Math.round(paisa) / 100;
}

export function formatInrFromPaisa(paisa: number): string {
  const rupees = paisaToInr(paisa);
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Computes exact integer-paisa commission from GST-inclusive discounted product amount.
 * Uses basis-points integer arithmetic to avoid floating point drift:
 * ratePct (e.g. 5.25%) -> rateBps = Math.round(5.25 * 100) = 525 (out of 10,000)
 * commissionPaisa = Math.round((eligibleAmountPaisa * rateBps) / 10000)
 */
export function calculateCommissionPaisa(
  gstInclusiveDiscountedAmountPaisa: number,
  commissionRatePct: number
): number {
  const eligible = Math.max(0, Math.round(gstInclusiveDiscountedAmountPaisa));
  const rateBps = Math.max(0, Math.min(5000, Math.round(commissionRatePct * 100)));
  return Math.round((eligible * rateBps) / 10000);
}

export function calculateProportionalRefundCommissionPaisa(params: {
  originalCommissionPaisa: number;
  totalQuantity: number;
  refundedQuantity: number;
}): number {
  const totalQty = Math.max(1, Math.round(params.totalQuantity));
  const refundedQty = Math.max(0, Math.min(totalQty, Math.round(params.refundedQuantity)));
  const remainingQty = totalQty - refundedQty;
  if (remainingQty <= 0) return 0;
  return Math.round((params.originalCommissionPaisa * remainingQty) / totalQty);
}

export function escapeHtmlEmail(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildAffiliateBrandedEmailHtml(params: {
  badge: string;
  heading: string;
  greeting?: string;
  bodyParagraphs: string[];
  highlightRows?: Array<{ label: string; value: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): { html: string; text: string } {
  const rowsHtml = (params.highlightRows || [])
    .map(
      (row) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;font-weight:600;">${escapeHtmlEmail(row.label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#071B35;font-weight:700;text-align:right;">${escapeHtmlEmail(row.value)}</td>
      </tr>`
    )
    .join('');

  const paragraphsHtml = params.bodyParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:14px;line-height:1.65;color:#334155;">${escapeHtmlEmail(p)}</p>`
    )
    .join('');

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<div style="margin:22px 0 8px 0;">
          <a href="${escapeHtmlEmail(params.ctaUrl)}" style="display:inline-block;background-color:#FF7A00;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;">${escapeHtmlEmail(params.ctaLabel)}</a>
        </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="max-width:580px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#071B35;padding:20px 28px;border-bottom:3px solid #FF7A00;">
              <div style="font-size:21px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">Teqqno<span style="color:#FF7A00;">World</span></div>
              <div style="font-size:11px;letter-spacing:1.1px;text-transform:uppercase;color:#CBD5E1;margin-top:4px;">${escapeHtmlEmail(params.badge)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.3;color:#071B35;">${escapeHtmlEmail(params.heading)}</h1>
              ${params.greeting ? `<p style="margin:0 0 14px 0;font-size:14px;color:#0F172A;font-weight:600;">${escapeHtmlEmail(params.greeting)}</p>` : ''}
              ${paragraphsHtml}
              ${
                rowsHtml
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;background-color:#F8FAFC;">${rowsHtml}</table>`
                  : ''
              }
              ${ctaHtml}
              <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#64748B;border-top:1px solid #E2E8F0;padding-top:14px;">
                ${escapeHtmlEmail(
                  params.footerNote ||
                    'TeqqnoWorld Affiliate Partner Program • Official Website: https://teqqnoworld.com • Never share your OTP, Aadhaar, PAN, or bank credentials with unauthorized individuals.'
                )}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    `TeqqnoWorld — ${params.badge}`,
    params.heading,
    '',
    ...(params.greeting ? [params.greeting, ''] : []),
    ...params.bodyParagraphs,
    ...(params.highlightRows?.length
      ? ['', ...params.highlightRows.map((r) => `${r.label}: ${r.value}`)]
      : []),
    ...(params.ctaLabel && params.ctaUrl ? ['', `${params.ctaLabel}: ${params.ctaUrl}`] : []),
    '',
    params.footerNote || 'TeqqnoWorld Affiliate Partner Program • https://teqqnoworld.com',
  ];

  return { html, text: textLines.join('\n') };
}
