import express from 'express';
import type { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { registerProductFeedRoutes } from './server/productFeed.ts';
import {
  injectSeoIntoHtml,
  isNonHtmlRoutePath,
  registerSeoPublicEndpoints,
  resolveSeoPageContext,
} from './server/seoMiddleware.ts';
import { BUSINESS_CONFIG } from './src/config/business.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// ==============================================================================
// 1. HOSTINGER SMTP TRANSPORTER CONFIGURATION
// ==============================================================================

const getSmtpConfig = () => {
  const smtpUser = (process.env.HOSTINGER_SMTP_EMAIL || process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.HOSTINGER_SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.hostinger.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpSecure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465;

  const rawAdminEmails = (process.env.ADMIN_NOTIFICATION_EMAIL || 'teqqnoworld@gmail.com').trim();
  const adminEmailList = rawAdminEmails
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (smtpUser && !adminEmailList.some((e) => e.toLowerCase() === smtpUser.toLowerCase())) {
    adminEmailList.push(smtpUser);
  }

  return {
    smtpUser,
    smtpPass,
    smtpHost,
    smtpPort,
    smtpSecure,
    adminEmailList,
    primaryAdminEmail: adminEmailList[0] || 'teqqnoworld@gmail.com',
  };
};

const getSmtpTransporter = () => {
  const cfg = getSmtpConfig();

  if (!cfg.smtpUser || !cfg.smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: {
      user: cfg.smtpUser,
      pass: cfg.smtpPass,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
};

function escapeHtml(value: string | undefined | null): string {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==============================================================================
// 2. LUXURY DARK/ORANGE B2B HTML EMAIL TEMPLATES (CUSTOMER + ADMIN ALERT)
// ==============================================================================

interface OrderItemPayload {
  name: string;
  color?: string;
  size?: string;
  sizeDistribution?: Record<string, number>;
  printMethod?: string;
  printPlacement?: string;
  frontPlacement?: string;
  backPlacement?: string;
  designPositionSummary?: string;
  logoUrl?: string;
  backLogoUrl?: string;
  mockupFrontUrl?: string;
  mockupBackUrl?: string;
  extraArtworkUrls?: string[];
  customNotes?: string;
  quantity: number;
  price: number;
  totalPrice?: number;
}

interface OrderConfirmationPayload {
  orderId: string;
  orderNumber?: string;
  customerName: string;
  customerEmail: string;
  company?: string;
  phone?: string;
  gstin?: string;
  paymentMode?: string;
  amountPaid?: number;
  balanceDue?: number;
  razorpayPaymentId?: string;
  items: OrderItemPayload[];
  subtotal: number;
  gstAmount: number;
  shippingFee: number;
  total: number;
  estimatedDispatch?: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

interface EmailAttachmentItem {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
  contentDisposition?: 'inline' | 'attachment';
}

interface PreparedOrderMedia {
  imgSrcBySource: Map<string, string>;
  adminAttachments: EmailAttachmentItem[];
  customerInlineAttachments: EmailAttachmentItem[];
}

function parseDataUrl(src: string): { buffer: Buffer; mime: string; ext: string } | null {
  const match = src.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = (mime.split('/')[1] || 'png').replace('svg+xml', 'svg').replace(/[^a-zA-Z0-9]/g, '');
  return {
    buffer: Buffer.from(match[2], 'base64'),
    mime,
    ext: ext || 'png',
  };
}

async function fetchUrlBuffer(url: string): Promise<{ buffer: Buffer; mime: string; ext: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') || 'image/webp').split(';')[0].trim();
    const arr = await resp.arrayBuffer();
    const extFromUrl = url.split('?')[0].split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '');
    const ext = extFromUrl || contentType.split('/')[1]?.replace(/[^a-zA-Z0-9]/g, '') || 'webp';
    return {
      buffer: Buffer.from(arr),
      mime: contentType,
      ext,
    };
  } catch {
    return null;
  }
}

async function prepareOrderMedia(payload: OrderConfirmationPayload): Promise<PreparedOrderMedia> {
  const imgSrcBySource = new Map<string, string>();
  const adminAttachments: EmailAttachmentItem[] = [];
  const customerInlineAttachments: EmailAttachmentItem[] = [];
  const orderTag = (payload.orderNumber || payload.orderId || 'ORDER').replace(/[^a-zA-Z0-9_-]/g, '');
  let cidCounter = 1;

  const processAsset = async (
    src: string | undefined,
    fileBase: string,
    includeForCustomerInline = false
  ) => {
    if (!src) return;
    if (imgSrcBySource.has(src)) return;

    const cleanFileBase = fileBase.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (src.startsWith('data:')) {
      const parsed = parseDataUrl(src);
      if (!parsed) return;
      const cid = `tq_${orderTag}_${cidCounter++}@teqqnoworld.com`;
      imgSrcBySource.set(src, `cid:${cid}`);

      // Inline CID copy so Gmail displays it inside the email card
      adminAttachments.push({
        filename: `${orderTag}_${cleanFileBase}.${parsed.ext}`,
        content: parsed.buffer,
        contentType: parsed.mime,
        cid,
        contentDisposition: 'inline',
      });
      // Explicit downloadable attachment copy for Admin
      adminAttachments.push({
        filename: `${orderTag}_${cleanFileBase}_download.${parsed.ext}`,
        content: parsed.buffer,
        contentType: parsed.mime,
        contentDisposition: 'attachment',
      });
      if (includeForCustomerInline) {
        customerInlineAttachments.push({
          filename: `${orderTag}_${cleanFileBase}.${parsed.ext}`,
          content: parsed.buffer,
          contentType: parsed.mime,
          cid,
          contentDisposition: 'inline',
        });
      }
      return;
    }

    if (src.startsWith('http://') || src.startsWith('https://')) {
      imgSrcBySource.set(src, src);
      const fetched = await fetchUrlBuffer(src);
      if (fetched) {
        adminAttachments.push({
          filename: `${orderTag}_${cleanFileBase}.${fetched.ext}`,
          content: fetched.buffer,
          contentType: fetched.mime,
          contentDisposition: 'attachment',
        });
      }
    }
  };

  for (let idx = 0; idx < payload.items.length; idx++) {
    const item = payload.items[idx];
    const itemNum = idx + 1;
    await Promise.all([
      processAsset(item.mockupFrontUrl, `Item${itemNum}_Product_Mockup_Front`, true),
      processAsset(item.mockupBackUrl, `Item${itemNum}_Product_Mockup_Back`, true),
      processAsset(item.logoUrl, `Item${itemNum}_Customer_Logo_Front`, false),
      processAsset(item.backLogoUrl, `Item${itemNum}_Customer_Logo_Back`, false),
      ...(item.extraArtworkUrls || []).map((extraUrl, eIdx) =>
        processAsset(extraUrl, `Item${itemNum}_Extra_Artwork_${eIdx + 1}`, false)
      ),
    ]);
  }

  return { imgSrcBySource, adminAttachments, customerInlineAttachments };
}

function renderMediaCardHtml(title: string, src: string | undefined, media: PreparedOrderMedia, accentColor = '#FF7A00'): string {
  if (!src) return '';
  const imgSrc = media.imgSrcBySource.get(src) || src;
  const isHttp = src.startsWith('http://') || src.startsWith('https://');
  return `
    <td width="50%" valign="top" style="padding: 6px;">
      <div style="background: #111216; border: 1px solid #2C2E38; border-radius: 10px; padding: 10px; text-align: center;">
        <div style="font-size: 10px; font-weight: 800; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 8px;">${escapeHtml(title)}</div>
        <div style="background: #F8FAFC; border-radius: 8px; padding: 6px; margin-bottom: 8px;">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(title)}" style="max-width: 100%; max-height: 180px; width: auto; height: auto; display: block; margin: 0 auto; border-radius: 6px;" />
        </div>
        ${isHttp ? `<a href="${escapeHtml(src)}" target="_blank" style="display: inline-block; font-size: 11px; font-weight: 700; color: #FFFFFF; background: ${accentColor}; text-decoration: none; padding: 5px 10px; border-radius: 6px;">Open / Download Full-Res</a>` : `<span style="font-size: 10px; color: #9CA3AF;">Attached at bottom of email</span>`}
      </div>
    </td>
  `;
}

function generateAdminOrderAlertHtml(data: OrderConfirmationPayload, media: PreparedOrderMedia): string {
  const displayOrderNum = escapeHtml(data.orderNumber || data.orderId);
  const cleanPhoneDigits = (data.phone || '').replace(/[^0-9]/g, '');
  const waDigits = cleanPhoneDigits.length === 10 ? `91${cleanPhoneDigits}` : cleanPhoneDigits;

  const itemsHtml = data.items
    .map((item, idx) => {
      const lineTotal = item.totalPrice || item.price * item.quantity;
      const specs = [
        item.color ? `Color: ${escapeHtml(item.color)}` : null,
        item.size ? `Size: ${escapeHtml(item.size)}` : null,
        item.printMethod ? `Method: ${escapeHtml(item.printMethod)}` : null,
        item.printPlacement ? `Placement: ${escapeHtml(item.printPlacement)}` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      const cards: string[] = [];
      if (item.mockupFrontUrl) cards.push(renderMediaCardHtml('Product Design (Front View)', item.mockupFrontUrl, media, '#FF7A00'));
      if (item.mockupBackUrl) cards.push(renderMediaCardHtml('Product Design (Back View)', item.mockupBackUrl, media, '#FF7A00'));
      if (item.logoUrl) cards.push(renderMediaCardHtml('Customer Raw Logo / Poster (Front)', item.logoUrl, media, '#1EBE5D'));
      if (item.backLogoUrl) cards.push(renderMediaCardHtml('Customer Raw Logo / Poster (Back)', item.backLogoUrl, media, '#1EBE5D'));
      (item.extraArtworkUrls || []).forEach((u, eIdx) => {
        cards.push(renderMediaCardHtml(`Extra Studio Artwork #${eIdx + 1}`, u, media, '#3B82F6'));
      });

      const rowsHtml: string[] = [];
      for (let c = 0; c < cards.length; c += 2) {
        rowsHtml.push(`<tr>${cards[c]}${cards[c + 1] || '<td width="50%"></td>'}</tr>`);
      }

      return `
        <tr>
          <td colspan="3" style="padding: 14px 12px; border-bottom: 1px solid #282A33;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <div style="font-size: 14px; font-weight: 800; color: #FFFFFF;">${idx + 1}. ${escapeHtml(item.name)}</div>
                  ${specs ? `<div style="font-size: 11px; color: #9CA3AF; margin-top: 3px;">${specs}</div>` : ''}
                </td>
                <td style="text-align: center; font-size: 13px; font-weight: 700; color: #E5E7EB; font-family: monospace; width: 60px;">
                  × ${item.quantity}
                </td>
                <td style="text-align: right; font-size: 14px; font-weight: 800; color: #FF7A00; font-family: monospace; width: 110px;">
                  ₹${lineTotal.toLocaleString('en-IN')}.00
                </td>
              </tr>
            </table>

            ${
              item.designPositionSummary || item.customNotes
                ? `<div style="margin-top: 10px; background: #1B1D24; border-left: 3px solid #FF7A00; border-radius: 6px; padding: 10px 12px; font-size: 11px; color: #E5E7EB; line-height: 1.55;">
                    <div style="font-size: 10px; font-weight: 800; color: #FF7A00; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">📐 Logo & Design Position Specifications</div>
                    ${item.designPositionSummary ? `<div>${escapeHtml(item.designPositionSummary)}</div>` : ''}
                    ${item.customNotes ? `<div style="margin-top: 4px; color: #FCD34D;"><strong>Customer Note:</strong> ${escapeHtml(item.customNotes)}</div>` : ''}
                  </div>`
                : ''
            }

            ${
              rowsHtml.length > 0
                ? `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">${rowsHtml.join('')}</table>`
                : ''
            }
          </td>
        </tr>
      `;
    })
    .join('');

  const formattedAddress = data.shippingAddress
    ? `${escapeHtml(data.shippingAddress.street || '')}, ${escapeHtml(data.shippingAddress.city || '')}, ${escapeHtml(data.shippingAddress.state || '')} - ${escapeHtml(data.shippingAddress.pincode || '')}`
    : 'Not provided';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Order Alert #${displayOrderNum}</title></head>
<body style="margin:0; padding:0; background-color:#0B0B0D; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#FFFFFF;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0B0B0D; padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:660px; background-color:#16171B; border:1px solid #FF7A00; border-radius:16px; overflow:hidden;">
          <tr>
            <td style="background:#1F2026; padding:22px 24px; border-bottom:2px solid #FF7A00;">
              <div style="font-size:11px; font-weight:800; letter-spacing:2px; color:#FF7A00; text-transform:uppercase;">TEQQNOWORLD ADMIN ALERT</div>
              <div style="font-size:22px; font-weight:800; color:#FFFFFF; margin-top:6px;">New Website Order Received: #${displayOrderNum}</div>
              <div style="font-size:13px; color:#D1D5DB; margin-top:4px;">Grand Total: <strong style="color:#1EBE5D;">₹${data.total.toLocaleString('en-IN')}.00</strong> • Payment: ${escapeHtml(data.paymentMode || 'Standard Checkout')}</div>
              ${
                typeof data.amountPaid === 'number'
                  ? `<div style="font-size:12px; color:#E5E7EB; margin-top:6px;">Paid Online: <strong style="color:#1EBE5D;">₹${data.amountPaid.toLocaleString('en-IN')}.00</strong> • Balance Before Dispatch: <strong style="color:${(data.balanceDue || 0) > 0 ? '#FBBF24' : '#1EBE5D'};">₹${(data.balanceDue || 0).toLocaleString('en-IN')}.00</strong>${data.razorpayPaymentId ? ` • Razorpay ID: <span style="font-family:monospace;color:#FF7A00;">${escapeHtml(data.razorpayPaymentId)}</span>` : ''}</div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#111216; border:1px solid #282A33; border-radius:12px; padding:14px;">
                <tr>
                  <td style="font-size:12px; color:#9CA3AF; line-height:1.7;">
                    <strong style="color:#FFFFFF;">Customer:</strong> ${escapeHtml(data.customerName)}${data.company ? ` (${escapeHtml(data.company)})` : ''}<br/>
                    <strong style="color:#FFFFFF;">Email:</strong> <a href="mailto:${escapeHtml(data.customerEmail)}" style="color:#FF7A00;">${escapeHtml(data.customerEmail)}</a><br/>
                    <strong style="color:#FFFFFF;">Phone:</strong> <a href="tel:${escapeHtml(data.phone || '')}" style="color:#FF7A00;">${escapeHtml(data.phone || 'Not provided')}</a><br/>
                    ${data.gstin ? `<strong style="color:#FFFFFF;">GSTIN:</strong> ${escapeHtml(data.gstin)}<br/>` : ''}
                    <strong style="color:#FFFFFF;">Delivery Address:</strong> ${formattedAddress}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 16px 16px 16px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <thead>
                  <tr style="border-bottom:1px solid #2F313B;">
                    <th style="padding:8px 12px; text-align:left; font-size:11px; color:#9CA3AF; text-transform:uppercase;">Ordered Product & Artwork Proof</th>
                    <th style="padding:8px 12px; text-align:center; font-size:11px; color:#9CA3AF; text-transform:uppercase; width:60px;">Qty</th>
                    <th style="padding:8px 12px; text-align:right; font-size:11px; color:#9CA3AF; text-transform:uppercase; width:110px;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px 24px; text-align:center;">
              ${waDigits ? `<a href="https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi ${data.customerName}, we received your TeqqnoWorld order #${data.orderNumber || data.orderId}!`)}" style="display:inline-block; background:#1EBE5D; color:#FFFFFF; font-size:13px; font-weight:700; text-decoration:none; padding:10px 20px; border-radius:10px; margin-right:8px;">WhatsApp Customer</a>` : ''}
              <a href="https://teqqnoworld.com/#admin" style="display:inline-block; background:#FF7A00; color:#FFFFFF; font-size:13px; font-weight:700; text-decoration:none; padding:10px 20px; border-radius:10px;">Open Admin Hub</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateOrderEmailHtml(data: OrderConfirmationPayload, media: PreparedOrderMedia): string {
  const displayOrderNum = data.orderNumber || data.orderId;
  const dispatchTimeline = data.estimatedDispatch || '24-48h Fast Dispatch';

  const itemsHtml = data.items
    .map((item) => {
      const lineTotal = item.totalPrice || item.price * item.quantity;
      const details = [
        item.color ? `Color: ${escapeHtml(item.color)}` : null,
        item.size ? `Size: ${escapeHtml(item.size)}` : null,
        item.printMethod ? `Print: ${escapeHtml(item.printMethod)}` : null,
        item.printPlacement ? `Placement: ${escapeHtml(item.printPlacement)}` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      const frontMockSrc = item.mockupFrontUrl ? (media.imgSrcBySource.get(item.mockupFrontUrl) || item.mockupFrontUrl) : '';
      const backMockSrc = item.mockupBackUrl ? (media.imgSrcBySource.get(item.mockupBackUrl) || item.mockupBackUrl) : '';

      return `
        <tr>
          <td style="padding: 16px 12px; border-bottom: 1px solid #282A33;">
            <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${escapeHtml(item.name)}
            </div>
            ${
              details
                ? `<div style="font-size: 12px; color: #9CA3AF; margin-top: 4px; font-family: -apple-system, sans-serif;">${details}</div>`
                : ''
            }
            ${
              item.designPositionSummary
                ? `<div style="font-size: 11px; color: #D1D5DB; margin-top: 4px; background: #1B1D24; padding: 6px 8px; border-radius: 6px; border-left: 2px solid #FF7A00;">${escapeHtml(item.designPositionSummary)}</div>`
                : ''
            }
            ${
              frontMockSrc || backMockSrc
                ? `<div style="margin-top: 8px; display: flex; gap: 8px;">
                    ${frontMockSrc ? `<img src="${escapeHtml(frontMockSrc)}" alt="Front Mockup" style="height: 84px; width: auto; background: #F8FAFC; padding: 4px; border-radius: 8px; border: 1px solid #2F313B; margin-right: 8px;" />` : ''}
                    ${backMockSrc ? `<img src="${escapeHtml(backMockSrc)}" alt="Back Mockup" style="height: 84px; width: auto; background: #F8FAFC; padding: 4px; border-radius: 8px; border: 1px solid #2F313B;" />` : ''}
                  </div>`
                : ''
            }
          </td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #282A33; text-align: center; font-size: 13px; font-weight: 600; color: #E5E7EB; font-family: monospace;">
            ${item.quantity}
          </td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #282A33; text-align: right; font-size: 14px; font-weight: 700; color: #FF7A00; font-family: monospace;">
            ₹${lineTotal.toLocaleString('en-IN')}.00
          </td>
        </tr>
      `;
    })
    .join('');

  const formattedAddress = data.shippingAddress
    ? `${data.shippingAddress.street || ''}, ${data.shippingAddress.city || ''}, ${data.shippingAddress.state || ''} - ${data.shippingAddress.pincode || ''}`
    : 'Registered Corporate Delivery Address';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - TeqqnoWorld</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0B0D; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0B0B0D; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Wrapper -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #16171B; border: 1px solid #282A33; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.8);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1C1E26 0%, #121319 100%); padding: 32px 32px 24px 32px; border-bottom: 2px solid #FF7A00; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; letter-spacing: 2.5px; color: #FF7A00; text-transform: uppercase; font-family: monospace;">
                      TEQQNOWORLD
                    </div>
                    <div style="font-size: 8px; letter-spacing: 1.5px; color: #9CA3AF; text-transform: uppercase; margin-top: 2px;">
                      CUSTOM MERCHANDISE & PRINTING FACTORY
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(30, 190, 93, 0.15); border: 1px solid rgba(30, 190, 93, 0.4); border-radius: 999px; font-size: 11px; font-weight: 700; color: #1EBE5D; font-family: monospace;">
                      ● CONFIRMED
                    </span>
                  </td>
                </tr>
              </table>

              <div style="font-size: 24px; font-weight: 800; color: #FFFFFF; margin-top: 20px; letter-spacing: -0.5px;">
                Order Confirmation
              </div>
              <div style="font-size: 14px; color: #D1D5DB; margin-top: 6px; line-height: 1.5;">
                Hi <strong style="color: #FFFFFF;">${data.customerName}</strong>${data.company ? ` (${data.company})` : ''}, we have received your custom order and queued it for artwork verification.
              </div>
            </td>
          </tr>

          <!-- Order Summary Meta Box -->
          <tr>
            <td style="padding: 24px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1F2026; border: 1px solid #2F313B; border-radius: 14px; padding: 16px;">
                <tr>
                  <td style="padding: 6px 12px;">
                    <div style="font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</div>
                    <div style="font-size: 15px; font-weight: 800; color: #FF7A00; font-family: monospace; margin-top: 3px;">
                      #${displayOrderNum}
                    </div>
                  </td>
                  <td style="padding: 6px 12px; border-left: 1px solid #2F313B;">
                    <div style="font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">Dispatch Timeline</div>
                    <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; margin-top: 3px;">
                      ⚡ ${dispatchTimeline}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding: 0 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <thead>
                  <tr style="border-bottom: 2px solid #2F313B;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">
                      Product
                    </th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">
                      Qty
                    </th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Price Calculations Box -->
          <tr>
            <td style="padding: 20px 32px 28px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px;">
                <tr>
                  <td style="padding: 4px 12px; font-size: 13px; color: #9CA3AF;">Subtotal:</td>
                  <td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #E5E7EB; font-family: monospace;">₹${data.subtotal.toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td style="padding: 4px 12px; font-size: 13px; color: #9CA3AF;">GST (18% ITC Eligible):</td>
                  <td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #E5E7EB; font-family: monospace;">₹${data.gstAmount.toLocaleString('en-IN')}.00</td>
                </tr>
                <tr>
                  <td style="padding: 4px 12px; font-size: 13px; color: #9CA3AF;">Pan-India Express Shipping:</td>
                  <td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #1EBE5D; font-weight: 600;">FREE (Promo)</td>
                </tr>
                <tr>
                  <td style="padding: 14px 12px 6px 12px; font-size: 16px; font-weight: 800; color: #FFFFFF; border-top: 1px solid #2F313B;">
                    Order Total:
                  </td>
                  <td style="padding: 14px 12px 6px 12px; text-align: right; font-size: 18px; font-weight: 900; color: #FF7A00; font-family: monospace; border-top: 1px solid #2F313B;">
                    ₹${data.total.toLocaleString('en-IN')}.00
                  </td>
                </tr>
                ${
                  typeof data.amountPaid === 'number'
                    ? `<tr>
                        <td style="padding: 4px 12px; font-size: 13px; color: #1EBE5D; font-weight: 700;">Paid Online (${escapeHtml(data.paymentMode || 'Prepaid')}):</td>
                        <td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #1EBE5D; font-family: monospace; font-weight: 700;">₹${data.amountPaid.toLocaleString('en-IN')}.00</td>
                      </tr>
                      ${
                        (data.balanceDue || 0) > 0
                          ? `<tr>
                              <td style="padding: 4px 12px; font-size: 13px; color: #FBBF24; font-weight: 700;">Balance Payable Before Dispatch:</td>
                              <td style="padding: 4px 12px; text-align: right; font-size: 13px; color: #FBBF24; font-family: monospace; font-weight: 700;">₹${(data.balanceDue || 0).toLocaleString('en-IN')}.00</td>
                            </tr>`
                          : ''
                      }
                      ${
                        data.razorpayPaymentId
                          ? `<tr>
                              <td style="padding: 4px 12px; font-size: 11px; color: #9CA3AF;">Razorpay Transaction ID:</td>
                              <td style="padding: 4px 12px; text-align: right; font-size: 11px; color: #E5E7EB; font-family: monospace;">${escapeHtml(data.razorpayPaymentId)}</td>
                            </tr>`
                          : ''
                      }`
                    : ''
                }
              </table>
            </td>
          </tr>

          <!-- Shipping Destination -->
          <tr>
            <td style="padding: 0 32px 28px 32px;">
              <div style="background-color: #121317; border: 1px solid #24252D; border-radius: 12px; padding: 14px 18px;">
                <div style="font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase;">
                  📍 Delivery Destination
                </div>
                <div style="font-size: 13px; color: #E5E7EB; margin-top: 4px; line-height: 1.4;">
                  ${formattedAddress}
                </div>
              </div>
            </td>
          </tr>

          <!-- Next Steps & Direct WhatsApp CTA -->
          <tr>
            <td style="padding: 0 32px 32px 32px; text-align: center;">
              <div style="background-color: #1C1E26; border: 1px solid #FF7A00; border-radius: 14px; padding: 18px; text-align: center;">
                <div style="font-size: 14px; font-weight: 700; color: #FFFFFF;">
                  Need immediate design approval or corporate PO assistance?
                </div>
                <div style="font-size: 12px; color: #9CA3AF; margin-top: 4px; margin-bottom: 14px;">
                  Our production leads are ready to share your high-res mockup on WhatsApp.
                </div>
                <a href="https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=Hi%20TeqqnoWorld,%20checking%20status%20for%20Order%20%23${displayOrderNum}" style="display: inline-block; background-color: #1EBE5D; color: #FFFFFF; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 22px; border-radius: 10px; box-shadow: 0 4px 15px rgba(30, 190, 93, 0.3);">
                  Chat with Production Team on WhatsApp
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer Legal -->
          <tr>
            <td style="background-color: #0E0F12; padding: 20px 32px; text-align: center; border-top: 1px solid #24252D;">
              <div style="font-size: 11px; color: #6B7280; line-height: 1.5;">
                ${BUSINESS_CONFIG.name} • ${BUSINESS_CONFIG.address.full}<br />
                Phone / WhatsApp: ${BUSINESS_CONFIG.contact.phone} • Email: ${BUSINESS_CONFIG.contact.secondaryEmail} / ${BUSINESS_CONFIG.contact.email}<br />
                All orders backed by 100% Quality Print Guarantee & Digital Pre-Production Proof Sign-Off.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ==============================================================================
// 3. API ROUTES: /api/send-order-email, /api/test-email, /api/smtp-status
// ==============================================================================

app.post('/api/send-order-email', async (req: Request, res: Response) => {
  try {
    const payload: OrderConfirmationPayload = req.body;

    if (!payload || !payload.orderId || !payload.customerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order details: orderId and customerEmail are required.',
      });
    }

    const cfg = getSmtpConfig();
    const transporter = getSmtpTransporter();
    const senderEmail = cfg.smtpUser || 'orders@teqqnoworld.com';
    const recipientEmail = payload.customerEmail.trim();
    const displayOrderNum = payload.orderNumber || payload.orderId;

    const media = await prepareOrderMedia(payload);

    const customerHtml = generateOrderEmailHtml(payload, media);
    const customerSubject = `Order Confirmed: #${displayOrderNum} - TeqqnoWorld`;

    const adminHtml = generateAdminOrderAlertHtml(payload, media);
    const adminSubject = `New Order #${displayOrderNum} (₹${Number(payload.total || 0).toLocaleString('en-IN')}) - ${payload.customerName}`;

    // If Hostinger credentials are not yet set in environment, return simulated status clearly
    if (!transporter) {
      console.log(`[Hostinger SMTP Simulation] Transporter not configured in environment.`);
      console.log(`[Hostinger SMTP Simulation] Customer recipient: ${recipientEmail}`);
      console.log(`[Hostinger SMTP Simulation] Admin recipients: ${cfg.adminEmailList.join(', ')}`);

      return res.status(200).json({
        success: true,
        simulated: true,
        customerSent: false,
        adminSent: false,
        message: 'Order confirmation email is in simulation mode (set HOSTINGER_SMTP_EMAIL, HOSTINGER_SMTP_PASSWORD, and ADMIN_NOTIFICATION_EMAIL in environment variables to send real emails).',
        recipient: recipientEmail,
        adminRecipients: cfg.adminEmailList,
      });
    }

    // Send Customer Confirmation & Admin New Order Alert independently
    const [customerResult, adminResult] = await Promise.allSettled([
      transporter.sendMail({
        from: `"TeqqnoWorld Orders" <${senderEmail}>`,
        to: recipientEmail,
        replyTo: senderEmail,
        subject: customerSubject,
        text: `Thank you for your order with TeqqnoWorld.\nOrder ID: ${payload.orderNumber || payload.orderId}\nCustomer: ${payload.customerName}\nTotal: INR ${Number(payload.total || 0).toLocaleString('en-IN')}\nYou can track your order anytime at https://teqqnoworld.com/#dashboard`,
        html: customerHtml,
        attachments: media.customerInlineAttachments,
      }),
      transporter.sendMail({
        from: `"TeqqnoWorld Store Alerts" <${senderEmail}>`,
        to: cfg.adminEmailList.join(', '),
        replyTo: recipientEmail,
        subject: adminSubject,
        html: adminHtml,
        attachments: media.adminAttachments,
      }),
    ]);

    const customerSent = customerResult.status === 'fulfilled';
    const adminSent = adminResult.status === 'fulfilled';

    if (!customerSent) {
      console.error('[Hostinger SMTP Customer Email Error]:', customerResult.reason);
    }
    if (!adminSent) {
      console.error('[Hostinger SMTP Admin Alert Error]:', adminResult.reason);
    }

    if (!customerSent && !adminSent) {
      const errReason: any = customerResult.status === 'rejected' ? customerResult.reason : (adminResult as PromiseRejectedResult).reason;
      return res.status(500).json({
        success: false,
        customerSent: false,
        adminSent: false,
        message: errReason?.message || 'Failed to send both customer and admin emails via Hostinger SMTP.',
      });
    }

    const customerMsgId = customerSent ? customerResult.value.messageId : undefined;
    const adminMsgId = adminSent ? adminResult.value.messageId : undefined;

    console.log('[Hostinger SMTP Success]', { customerSent, adminSent, customerMsgId, adminMsgId });

    return res.status(200).json({
      success: true,
      customerSent,
      adminSent,
      messageId: customerMsgId,
      adminMessageId: adminMsgId,
      recipient: recipientEmail,
      adminRecipients: cfg.adminEmailList,
      message: `Dispatched via Hostinger SMTP (Customer: ${customerSent ? 'Sent' : 'Failed'}, Admin Alert: ${adminSent ? 'Sent' : 'Failed'}).`,
    });
  } catch (err: any) {
    console.error('[Hostinger SMTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to dispatch email via Hostinger SMTP.',
    });
  }
});

// Test SMTP endpoint for Admin Hub diagnostics
app.post('/api/test-email', async (req: Request, res: Response) => {
  try {
    const cfg = getSmtpConfig();
    const transporter = getSmtpTransporter();

    if (!transporter) {
      return res.status(400).json({
        success: false,
        simulated: true,
        message: 'HOSTINGER_SMTP_EMAIL or HOSTINGER_SMTP_PASSWORD is not configured in server environment variables.',
      });
    }

    await transporter.verify();

    const targetEmail = (req.body?.toEmail || cfg.primaryAdminEmail).trim();
    const info = await transporter.sendMail({
      from: `"TeqqnoWorld Orders" <${cfg.smtpUser}>`,
      to: Array.from(new Set([targetEmail, ...cfg.adminEmailList])).join(', '),
      subject: `TeqqnoWorld SMTP Test Successful (${new Date().toLocaleString('en-IN')})`,
      html: `<div style="font-family:sans-serif;padding:20px;background:#16171B;color:#fff;border-radius:12px;border:1px solid #FF7A00;">
        <h2 style="color:#FF7A00;margin-top:0;">TeqqnoWorld Email Notifications Working!</h2>
        <p>Your Hostinger SMTP configuration (<strong>${escapeHtml(cfg.smtpHost)}:${cfg.smtpPort}</strong>) verified and delivered this test email.</p>
        <p style="font-size:12px;color:#9CA3AF;">Sender: ${escapeHtml(cfg.smtpUser)}<br/>Admin Alert Recipients: ${escapeHtml(cfg.adminEmailList.join(', '))}</p>
      </div>`,
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      adminRecipients: cfg.adminEmailList,
      message: `Test email delivered successfully to ${targetEmail}!`,
    });
  } catch (err: any) {
    console.error('[Hostinger SMTP Test Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'SMTP verification/send failed. Check email, password, host, and port.',
    });
  }
});

// New Customer Registration Welcome (Customer) + Full Details Alert (Admin)
app.post('/api/send-registration-email', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      firstName,
      lastName,
      fullName,
      email,
      phone,
      company,
      accountType,
      registeredAt,
      originUrl,
    } = req.body || {};

    const cleanEmail = String(email || '').trim();
    const cleanName = String(fullName || `${firstName || ''} ${lastName || ''}`.trim() || 'Valued Customer').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanCompany = String(company || '').trim();
    const cleanAccountType = cleanCompany ? 'Business / Corporate' : (accountType === 'business' ? 'Business / Corporate' : 'Individual');
    const cleanUserId = String(userId || `USR-${Date.now().toString().slice(-6)}`).trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'A valid customer email address is required.',
      });
    }

    const cfg = getSmtpConfig();
    const transporter = getSmtpTransporter();
    const configuredBase = (process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
    const isCustomDomain = (u: string) =>
      /^https?:\/\//i.test(u) && !/localhost|127\.0\.0\.1|\.run\.app|\.ai\.studio/i.test(u);
    const siteOrigin = isCustomDomain(configuredBase)
      ? configuredBase
      : isCustomDomain(String(originUrl || ''))
      ? String(originUrl).trim().replace(/\/$/, '')
      : 'https://teqqnoworld.com';

    const formattedTimeIst = new Date(registeredAt || Date.now()).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const waDigits = cleanPhone.replace(/[^0-9]/g, '');
    const waNumber = waDigits.length === 10 ? `91${waDigits}` : waDigits;

    if (!transporter) {
      console.log('[Registration Email - Simulation Mode]', {
        cleanName,
        cleanEmail,
        cleanPhone,
        cleanCompany,
        adminRecipients: cfg.adminEmailList,
      });
      return res.status(200).json({
        success: true,
        simulated: true,
        customerSent: false,
        adminSent: false,
        recipient: cleanEmail,
        adminRecipients: cfg.adminEmailList,
        message: 'Registration emails prepared in Simulation Mode (configure HOSTINGER_SMTP_EMAIL & HOSTINGER_SMTP_PASSWORD in .env for live delivery).',
      });
    }

    const customerHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="max-width:580px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#071B35;padding:22px 28px;border-bottom:3px solid #FF7900;">
              <div style="font-size:21px;font-weight:800;letter-spacing:-0.3px;color:#FFFFFF;">
                Teqqno<span style="color:#FF7900;">World</span>
              </div>
              <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#CBD5E1;margin-top:3px;">
                Account Confirmation
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.6px;">
                Email Verified &bull; Account Active
              </p>
              <h1 style="margin:0 0 12px 0;font-size:21px;line-height:1.35;color:#0F172A;">
                Congratulations ${escapeHtml(cleanName)}, your account is ready.
              </h1>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.65;color:#334155;">
                Your TeqqnoWorld account has been successfully created and your email address is verified. Aapka account ab active hai aur aap apne dashboard me login karke orders aur invoices manage kar sakte hain.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:22px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;margin-bottom:10px;">
                      Account Details
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;color:#1E293B;">
                      <tr>
                        <td style="padding:5px 0;color:#64748B;width:36%;">Full Name</td>
                        <td style="padding:5px 0;font-weight:600;color:#0F172A;">${escapeHtml(cleanName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#64748B;">Email</td>
                        <td style="padding:5px 0;font-weight:600;color:#0F172A;">${escapeHtml(cleanEmail)}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#64748B;">Mobile</td>
                        <td style="padding:5px 0;font-weight:600;color:#0F172A;">${escapeHtml(cleanPhone || '—')}</td>
                      </tr>
                      ${cleanCompany ? `<tr>
                        <td style="padding:5px 0;color:#64748B;">Company</td>
                        <td style="padding:5px 0;font-weight:600;color:#0F172A;">${escapeHtml(cleanCompany)}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:5px 0;color:#64748B;">Created On</td>
                        <td style="padding:5px 0;color:#334155;">${escapeHtml(formattedTimeIst)} IST</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">
                Access your dashboard anytime at <a href="${escapeHtml(siteOrigin)}/#dashboard" style="color:#EA580C;font-weight:600;text-decoration:underline;">${escapeHtml(siteOrigin.replace(/^https?:\/\//, ''))}</a>.
              </p>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748B;">
                If you have any questions, simply reply to this email and our team will assist you.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 28px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">
              &copy; ${new Date().getFullYear()} TeqqnoWorld &bull; Hyderabad, India &bull; This is an automated account confirmation for ${escapeHtml(cleanEmail)}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const customerText = [
      `Hi ${cleanName},`,
      ``,
      `Congratulations! Your TeqqnoWorld account has been successfully created and verified.`,
      `Aapka TeqqnoWorld account successfully create ho gaya hai.`,
      ``,
      `Account Details:`,
      `- Name: ${cleanName}`,
      `- Email: ${cleanEmail}`,
      `- Mobile: ${cleanPhone || 'N/A'}`,
      cleanCompany ? `- Company: ${cleanCompany}` : '',
      `- Created On: ${formattedTimeIst} IST`,
      ``,
      `Dashboard: ${siteOrigin}/#dashboard`,
      ``,
      `Regards,`,
      `TeqqnoWorld Team`,
    ]
      .filter(Boolean)
      .join('\n');

    const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0F1117;padding:24px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#161922;border-radius:16px;overflow:hidden;border:1px solid #FF790066;">
          <tr>
            <td style="background:#071B35;padding:22px 28px;border-bottom:3px solid #FF7900;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#FF7900;">
                NEW CUSTOMER REGISTRATION ALERT
              </div>
              <h2 style="margin:6px 0 0 0;font-size:20px;color:#FFFFFF;">
                ${escapeHtml(cleanName)} joined TeqqnoWorld
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">
              <p style="margin:0 0 18px 0;font-size:13px;color:#CBD5E1;line-height:1.6;">
                A new customer has verified their Gmail OTP and registered an account on TeqqnoWorld. Complete customer details are below:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F131C;border:1px solid #262C3D;border-radius:12px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;color:#E2E8F0;">
                      <tr>
                        <td style="padding:7px 0;color:#94A3B8;width:36%;">Customer Name</td>
                        <td style="padding:7px 0;font-weight:700;color:#FFFFFF;">${escapeHtml(cleanName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#94A3B8;">Email Address</td>
                        <td style="padding:7px 0;"><a href="mailto:${escapeHtml(cleanEmail)}" style="color:#60A5FA;text-decoration:none;font-weight:600;">${escapeHtml(cleanEmail)}</a></td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#94A3B8;">Mobile / WhatsApp</td>
                        <td style="padding:7px 0;font-weight:700;color:#34D399;">${escapeHtml(cleanPhone || 'Not provided')}</td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#94A3B8;">Company / Brand</td>
                        <td style="padding:7px 0;font-weight:600;color:#FFFFFF;">${escapeHtml(cleanCompany || 'Individual Customer')}</td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#94A3B8;">Account Type</td>
                        <td style="padding:7px 0;color:#FBBF24;font-weight:600;">${escapeHtml(cleanAccountType)}</td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#94A3B8;">User ID</td>
                        <td style="padding:7px 0;font-family:monospace;font-size:12px;color:#CBD5E1;">${escapeHtml(cleanUserId)}</td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;color:#94A3B8;">Registered At</td>
                        <td style="padding:7px 0;color:#CBD5E1;">${escapeHtml(formattedTimeIst)} IST</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="text-align:center;">
                ${waNumber ? `<a href="https://wa.me/${escapeHtml(waNumber)}" style="display:inline-block;background:#1EBE5D;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:10px;margin:4px;">WhatsApp Customer</a>` : ''}
                <a href="mailto:${escapeHtml(cleanEmail)}" style="display:inline-block;background:#FF7900;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:10px;margin:4px;">Email Customer</a>
                <a href="${escapeHtml(siteOrigin)}/#admin" style="display:inline-block;background:#1E293B;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:10px;margin:4px;border:1px solid #334155;">Open Admin Hub</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const adminText = [
      `New Customer Registration on TeqqnoWorld`,
      `Name: ${cleanName}`,
      `Email: ${cleanEmail}`,
      `Mobile: ${cleanPhone || 'Not provided'}`,
      `Company: ${cleanCompany || 'Individual Customer'}`,
      `Account Type: ${cleanAccountType}`,
      `User ID: ${cleanUserId}`,
      `Registered At: ${formattedTimeIst} IST`,
    ].join('\n');

    // Helper: send sequentially with 1 automatic retry so Hostinger SMTP never drops concurrent TLS logins
    const sendWithRetry = async (mailOptions: Parameters<typeof transporter.sendMail>[0], label: string) => {
      try {
        return await transporter.sendMail(mailOptions);
      } catch (firstErr: any) {
        console.warn(`[Registration Email - ${label} Attempt 1 Failed, retrying...]:`, firstErr?.message || firstErr);
        await new Promise((r) => setTimeout(r, 700));
        const freshTransporter = getSmtpTransporter() || transporter;
        return await freshTransporter.sendMail(mailOptions);
      }
    };

    // 1. Send Customer Congratulations Email FIRST (strictly aligned From + Reply-To for Gmail Primary Inbox)
    let customerSent = false;
    let customerMessageId: string | undefined;
    let customerError: string | undefined;
    try {
      const custInfo = await sendWithRetry(
        {
          from: `"TeqqnoWorld" <${cfg.smtpUser}>`,
          to: cleanEmail,
          replyTo: cfg.smtpUser,
          subject: `Your TeqqnoWorld account is confirmed, ${cleanName}`,
          text: customerText,
          html: customerHtml,
        },
        'Customer'
      );
      customerSent = true;
      customerMessageId = custInfo?.messageId;
    } catch (err: any) {
      customerError = err?.message || String(err);
      console.error('[Registration Email - Customer Failed]:', err);
    }

    // Small pause before 2nd SMTP send to respect Hostinger per-second connection limit
    await new Promise((r) => setTimeout(r, 350));

    // 2. Send Admin Registration Alert Email SECOND
    let adminSent = false;
    let adminMessageId: string | undefined;
    let adminError: string | undefined;
    try {
      const adminInfo = await sendWithRetry(
        {
          from: `"TeqqnoWorld Registrations" <${cfg.smtpUser}>`,
          to: cfg.adminEmailList.join(', '),
          replyTo: cleanEmail,
          subject: `[New Customer Signup] ${cleanName}${cleanCompany ? ` (${cleanCompany})` : ''} — ${cleanPhone || cleanEmail}`,
          text: adminText,
          html: adminHtml,
        },
        'Admin'
      );
      adminSent = true;
      adminMessageId = adminInfo?.messageId;
    } catch (err: any) {
      adminError = err?.message || String(err);
      console.error('[Registration Email - Admin Failed]:', err);
    }

    // Persist lightweight audit record for debugging delivery status
    try {
      const logPath = path.join(os.tmpdir(), 'teqqno-reg-email-log.json');
      const existingLogs = fs.existsSync(logPath)
        ? JSON.parse(fs.readFileSync(logPath, 'utf8') || '[]')
        : [];
      const nextLogs = [
        {
          at: new Date().toISOString(),
          email: cleanEmail,
          name: cleanName,
          customerSent,
          customerMessageId,
          customerError,
          adminSent,
          adminMessageId,
          adminError,
        },
        ...(Array.isArray(existingLogs) ? existingLogs : []),
      ].slice(0, 20);
      fs.writeFileSync(logPath, JSON.stringify(nextLogs, null, 2), 'utf8');
    } catch {
      // non-fatal log write
    }

    return res.status(customerSent || adminSent ? 200 : 500).json({
      success: customerSent || adminSent,
      customerSent,
      adminSent,
      recipient: cleanEmail,
      adminRecipients: cfg.adminEmailList,
      messageId: customerMessageId,
      adminMessageId,
      message: `Registration emails dispatched (Customer: ${customerSent ? 'Sent' : 'Failed'}, Admin: ${adminSent ? 'Sent' : 'Failed'}).`,
    });
  } catch (err: any) {
    console.error('[Registration Email Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to send registration emails.',
    });
  }
});

// ==============================================================================
// 3A-2. EMAIL 6-DIGIT OTP VERIFICATION (HOSTINGER SMTP — ZERO EXTRA COST)
// ==============================================================================

interface EmailOtpRecord {
  email: string;
  purpose: 'register' | 'login' | 'reset';
  hash: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
}

const EMAIL_OTP_LEDGER_PATH = path.join(os.tmpdir(), 'teqqno-email-otp.json');

function loadEmailOtpStore(): Record<string, EmailOtpRecord> {
  try {
    if (fs.existsSync(EMAIL_OTP_LEDGER_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(EMAIL_OTP_LEDGER_PATH, 'utf8'));
      const now = Date.now();
      const cleaned: Record<string, EmailOtpRecord> = {};
      for (const [k, rec] of Object.entries(parsed || {})) {
        const r = rec as EmailOtpRecord;
        if (r && r.expiresAt > now) cleaned[k] = r;
      }
      return cleaned;
    }
  } catch {
    // ignore corrupt otp file
  }
  return {};
}

function saveEmailOtpStore(store: Record<string, EmailOtpRecord>) {
  try {
    fs.writeFileSync(EMAIL_OTP_LEDGER_PATH, JSON.stringify(store), 'utf8');
  } catch (err) {
    console.warn('[Email OTP Store Write Warning]:', err);
  }
}

function hashEmailOtp(email: string, otp: string, purpose: string): string {
  const secret = (process.env.HOSTINGER_SMTP_PASSWORD || process.env.AISENSY_WEBHOOK_SECRET || 'teqqno_otp_salt_2026').trim();
  return crypto
    .createHmac('sha256', secret)
    .update(`${email.toLowerCase()}:${purpose}:${otp}`)
    .digest('hex');
}

app.post('/api/auth/send-email-otp', async (req: Request, res: Response) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const cleanName = String(req.body?.fullName || 'Valued Customer').trim();
    const purpose: 'register' | 'login' = req.body?.purpose === 'login' ? 'login' : 'register';

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    const store = loadEmailOtpStore();
    const key = `${purpose}:${cleanEmail}`;
    const existing = store[key];
    const now = Date.now();

    if (existing && now - existing.sentAt < 25_000) {
      const waitSec = Math.ceil((25_000 - (now - existing.sentAt)) / 1000);
      return res.status(429).json({
        success: false,
        retryAfterSec: waitSec,
        message: `Please wait ${waitSec}s before requesting a new verification code.`,
      });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes
    store[key] = {
      email: cleanEmail,
      purpose,
      hash: hashEmailOtp(cleanEmail, otp, purpose),
      expiresAt,
      sentAt: now,
      attempts: 0,
    };
    saveEmailOtpStore(store);

    const cfg = getSmtpConfig();
    const transporter = getSmtpTransporter();

    if (!transporter) {
      return res.status(200).json({
        success: true,
        simulated: true,
        devOtp: otp,
        expiresInMinutes: 10,
        message: 'SMTP not configured — running in Simulation Mode.',
      });
    }

    const spacedOtp = `${otp.slice(0, 3)} ${otp.slice(3)}`;
    const otpHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0F1117;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background-color:#161922;border-radius:16px;overflow:hidden;border:1px solid #262A36;">
          <tr>
            <td style="background:linear-gradient(135deg,#071B35 0%,#0E294D 100%);padding:24px 28px;border-bottom:3px solid #FF7900;">
              <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#FFFFFF;">
                Teqqno<span style="color:#FF7900;">World</span>
              </div>
              <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#94A3B8;margin-top:4px;">
                Email Verification Code
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px;text-align:center;">
              <h1 style="margin:0 0 10px 0;font-size:20px;color:#FFFFFF;">
                Hi ${escapeHtml(cleanName)}, verify your email
              </h1>
              <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#CBD5E1;">
                Enter this 6-digit verification code on TeqqnoWorld to verify <strong style="color:#FFFFFF;">${escapeHtml(cleanEmail)}</strong> and complete your account setup:
              </p>

              <div style="display:inline-block;background:#0B1220;border:2px solid #FF7900;border-radius:14px;padding:18px 34px;margin:6px 0 20px;">
                <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#FF9E44;">
                  ${escapeHtml(spacedOtp)}
                </div>
              </div>

              <p style="margin:0 0 10px 0;font-size:12px;color:#94A3B8;">
                This code is valid for <strong style="color:#E2E8F0;">10 minutes</strong>. Do not share this code with anyone.
              </p>
              <p style="margin:0;font-size:11px;color:#64748B;">
                If you didn&apos;t request this code on TeqqnoWorld, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#0D1018;padding:16px 28px;border-top:1px solid #232837;text-align:center;font-size:11px;color:#64748B;">
              © ${new Date().getFullYear()} TeqqnoWorld • Printing · Branding · Solutions
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"TeqqnoWorld Verification" <${cfg.smtpUser}>`,
      to: cleanEmail,
      subject: `${otp} is your TeqqnoWorld verification code`,
      html: otpHtml,
    });

    return res.status(200).json({
      success: true,
      simulated: false,
      expiresInMinutes: 10,
      message: `6-digit verification code sent to ${cleanEmail}. Check your Gmail inbox (or Spam folder).`,
    });
  } catch (err: any) {
    console.error('[Send Email OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to send verification code email. Please try again.',
    });
  }
});

app.post('/api/auth/verify-email-otp', (req: Request, res: Response) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const cleanOtp = String(req.body?.otp || '').replace(/[^0-9]/g, '');
    const purpose: 'register' | 'login' = req.body?.purpose === 'login' ? 'login' : 'register';

    if (!cleanEmail || cleanOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Please enter the exact 6-digit verification code sent to your email.',
      });
    }

    const store = loadEmailOtpStore();
    const key = `${purpose}:${cleanEmail}`;
    const record = store[key];

    if (!record || Date.now() > record.expiresAt) {
      delete store[key];
      saveEmailOtpStore(store);
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Verification code has expired. Please click "Resend Code" to get a new one.',
      });
    }

    if (record.attempts >= 5) {
      delete store[key];
      saveEmailOtpStore(store);
      return res.status(429).json({
        success: false,
        verified: false,
        message: 'Too many wrong attempts. Please request a fresh verification code.',
      });
    }

    const expectedHash = hashEmailOtp(cleanEmail, cleanOtp, purpose);
    const bufA = Buffer.from(record.hash, 'utf8');
    const bufB = Buffer.from(expectedHash, 'utf8');
    const isMatch = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

    if (!isMatch) {
      record.attempts += 1;
      store[key] = record;
      saveEmailOtpStore(store);
      const left = Math.max(0, 5 - record.attempts);
      return res.status(400).json({
        success: false,
        verified: false,
        message: left > 0
          ? `Incorrect verification code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Too many wrong attempts. Please request a fresh verification code.',
      });
    }

    delete store[key];
    saveEmailOtpStore(store);

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Email verified successfully!',
    });
  } catch (err: any) {
    console.error('[Verify Email OTP Error]:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      message: err?.message || 'Verification failed. Please try again.',
    });
  }
});

// ==============================================================================
// 3A-3. FORGOT PASSWORD WITH 6-DIGIT GMAIL OTP (HOSTINGER SMTP + SUPABASE ADMIN)
// ==============================================================================

const DEFAULT_SUPABASE_URL = 'https://jqajzfftaxwafctquzjr.supabase.co';

function getSupabaseAdminConfig() {
  const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '');
  const url = rawUrl && !rawUrl.includes('your-project') ? rawUrl : DEFAULT_SUPABASE_URL;
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim();
  return { url, serviceRoleKey };
}

function buildSupabaseAdminHeaders(
  serviceRoleKey: string,
  includeJsonContentType = false
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
  };
  // New Supabase secret keys (sb_secret_...) are opaque strings and must be sent via `apikey` only,
  // whereas legacy service_role JWTs (eyJ...) require both `apikey` and `Authorization: Bearer`.
  if (!serviceRoleKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function findSupabaseAuthUserByEmail(
  email: string
): Promise<{ id: string; email: string; fullName?: string } | null> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  if (!serviceRoleKey) return null;

  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page += 1) {
    const resp = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      method: 'GET',
      headers: buildSupabaseAdminHeaders(serviceRoleKey, false),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Supabase user lookup failed (HTTP ${resp.status}): ${errText.slice(0, 160)}`);
    }
    const payload = (await resp.json()) as { users?: Array<any> };
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const match = users.find((u) => String(u?.email || '').trim().toLowerCase() === target);
    if (match?.id) {
      const meta = match.user_metadata || {};
      const fullName =
        meta.full_name ||
        `${meta.first_name || ''} ${meta.last_name || ''}`.trim() ||
        undefined;
      return { id: String(match.id), email: String(match.email || target), fullName };
    }
    if (users.length < 200) break;
  }
  return null;
}

app.post('/api/auth/forgot-password/send-otp', async (req: Request, res: Response) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid registered email address.',
      });
    }

    const { serviceRoleKey } = getSupabaseAdminConfig();
    if (!serviceRoleKey) {
      return res.status(200).json({
        success: false,
        needsServiceRoleKey: true,
        message:
          'Password reset OTP needs SUPABASE_SERVICE_ROLE_KEY added in server secrets once. Please add it or use the reset link option.',
      });
    }

    const existingUser = await findSupabaseAuthUserByEmail(cleanEmail);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'No TeqqnoWorld account found with this email address. Please check your email or register first.',
      });
    }

    const store = loadEmailOtpStore();
    const key = `reset:${cleanEmail}`;
    const existingOtp = store[key];
    const now = Date.now();

    if (existingOtp && now - existingOtp.sentAt < 25_000) {
      const waitSec = Math.ceil((25_000 - (now - existingOtp.sentAt)) / 1000);
      return res.status(429).json({
        success: false,
        retryAfterSec: waitSec,
        message: `Please wait ${waitSec}s before requesting a new reset code.`,
      });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes
    store[key] = {
      email: cleanEmail,
      purpose: 'reset',
      hash: hashEmailOtp(cleanEmail, otp, 'reset'),
      expiresAt,
      sentAt: now,
      attempts: 0,
    };
    saveEmailOtpStore(store);

    const cfg = getSmtpConfig();
    const transporter = getSmtpTransporter();
    const displayName = existingUser.fullName || 'Customer';

    if (!transporter) {
      return res.status(200).json({
        success: true,
        simulated: true,
        devOtp: otp,
        expiresInMinutes: 10,
        message: 'SMTP not configured — running in Simulation Mode.',
      });
    }

    const spacedOtp = `${otp.slice(0, 3)} ${otp.slice(3)}`;
    const resetOtpHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#071B35;padding:20px 28px;border-bottom:3px solid #FF7900;">
              <div style="font-size:21px;font-weight:800;letter-spacing:-0.3px;color:#FFFFFF;">
                Teqqno<span style="color:#FF7900;">World</span>
              </div>
              <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#CBD5E1;margin-top:3px;">
                Password Reset Verification
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:center;">
              <h1 style="margin:0 0 10px 0;font-size:20px;color:#0F172A;">
                Hi ${escapeHtml(displayName)}, reset your password
              </h1>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#334155;">
                Enter this 6-digit verification code on TeqqnoWorld to reset the password for <strong style="color:#0F172A;">${escapeHtml(cleanEmail)}</strong>:
              </p>

              <div style="display:inline-block;background-color:#FFF7ED;border:2px solid #FF7900;border-radius:12px;padding:16px 32px;margin:4px 0 20px;">
                <div style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#C2410C;">
                  ${escapeHtml(spacedOtp)}
                </div>
              </div>

              <p style="margin:0 0 8px 0;font-size:12px;color:#475569;">
                This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
              </p>
              <p style="margin:0;font-size:11px;color:#64748B;">
                If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:14px 28px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#64748B;">
              &copy; ${new Date().getFullYear()} TeqqnoWorld &bull; Hyderabad, India
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resetOtpText = [
      `Hi ${displayName},`,
      ``,
      `Your TeqqnoWorld password reset verification code is: ${otp}`,
      ``,
      `Enter this 6-digit code on TeqqnoWorld to set a new password for ${cleanEmail}.`,
      `This code is valid for 10 minutes. Do not share it with anyone.`,
      ``,
      `If you did not request this, you can safely ignore this email.`,
      ``,
      `TeqqnoWorld Team`,
    ].join('\n');

    await transporter.sendMail({
      from: `"TeqqnoWorld Security" <${cfg.smtpUser}>`,
      to: cleanEmail,
      replyTo: cfg.smtpUser,
      subject: `${otp} is your TeqqnoWorld password reset code`,
      text: resetOtpText,
      html: resetOtpHtml,
    });

    return res.status(200).json({
      success: true,
      simulated: false,
      expiresInMinutes: 10,
      message: `6-digit password reset code sent to ${cleanEmail}. Please check your Gmail inbox.`,
    });
  } catch (err: any) {
    console.error('[Forgot Password Send OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to send password reset verification code.',
    });
  }
});

app.post('/api/auth/forgot-password/reset', async (req: Request, res: Response) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const cleanOtp = String(req.body?.otp || '').replace(/[^0-9]/g, '');
    const newPassword = String(req.body?.newPassword || '');

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        passwordUpdated: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (cleanOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        passwordUpdated: false,
        message: 'Please enter the exact 6-digit verification code sent to your Gmail.',
      });
    }

    const validateStrongServerPassword = (pw: string, emailStr: string): string | null => {
      if (pw.length < 8) {
        return 'Password must be at least 8 characters long (e.g. Teqqno@2026).';
      }
      if (/\s/.test(pw)) {
        return 'Password cannot contain spaces.';
      }
      if (!/[A-Z]/.test(pw)) {
        return 'Password must include at least 1 uppercase letter (A-Z).';
      }
      if (!/[a-z]/.test(pw)) {
        return 'Password must include at least 1 lowercase letter (a-z).';
      }
      if (!/[0-9]/.test(pw)) {
        return 'Password must include at least 1 number (0-9).';
      }
      if (!/[^A-Za-z0-9\s]/.test(pw)) {
        return 'Password must include at least 1 special character (@, #, $, !, %, &).';
      }
      const lower = pw.toLowerCase();
      const emailLocal = emailStr.toLowerCase().split('@')[0] || '';
      if (emailLocal.length >= 4 && lower.includes(emailLocal)) {
        return 'Password should not contain your email username.';
      }
      if (/(.)\1{3,}/.test(pw)) {
        return 'Password cannot have 4 or more repeated characters in a row.';
      }
      const weakPatterns = [
        '01234', '12345', '23456', '34567', '45678', '56789',
        '98765', '87654', '76543', '65432', '54321', '43210',
        'qwerty', 'asdfg', 'zxcvb', 'password', 'admin123', 'welcome',
      ];
      if (weakPatterns.some((pat) => lower.includes(pat))) {
        return 'Password is too simple or sequential. Please choose a stronger combination (e.g. Teqqno@2026).';
      }
      return null;
    };

    const passwordPolicyError = validateStrongServerPassword(newPassword, cleanEmail);
    if (passwordPolicyError) {
      return res.status(400).json({
        success: false,
        passwordUpdated: false,
        message: passwordPolicyError,
      });
    }

    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    if (!serviceRoleKey) {
      return res.status(503).json({
        success: false,
        passwordUpdated: false,
        needsServiceRoleKey: true,
        message: 'Server requires SUPABASE_SERVICE_ROLE_KEY in environment secrets to complete password reset.',
      });
    }

    // 1. Strictly verify the 6-digit OTP first
    const store = loadEmailOtpStore();
    const key = `reset:${cleanEmail}`;
    const record = store[key];

    if (!record || Date.now() > record.expiresAt) {
      delete store[key];
      saveEmailOtpStore(store);
      return res.status(400).json({
        success: false,
        passwordUpdated: false,
        message: 'Verification code has expired. Please click "Resend Code" to get a new one.',
      });
    }

    if (record.attempts >= 5) {
      delete store[key];
      saveEmailOtpStore(store);
      return res.status(429).json({
        success: false,
        passwordUpdated: false,
        message: 'Too many wrong attempts. Please request a fresh verification code.',
      });
    }

    const expectedHash = hashEmailOtp(cleanEmail, cleanOtp, 'reset');
    const bufA = Buffer.from(record.hash, 'utf8');
    const bufB = Buffer.from(expectedHash, 'utf8');
    const isMatch = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

    if (!isMatch) {
      record.attempts += 1;
      store[key] = record;
      saveEmailOtpStore(store);
      const left = Math.max(0, 5 - record.attempts);
      return res.status(400).json({
        success: false,
        passwordUpdated: false,
        message:
          left > 0
            ? `Incorrect verification code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
            : 'Too many wrong attempts. Please request a fresh verification code.',
      });
    }

    // 2. Find user in Supabase Auth and update their password via Admin API
    const existingUser = await findSupabaseAuthUserByEmail(cleanEmail);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        passwordUpdated: false,
        message: 'Account not found for this email address.',
      });
    }

    const updateResp = await fetch(`${url}/auth/v1/admin/users/${existingUser.id}`, {
      method: 'PUT',
      headers: buildSupabaseAdminHeaders(serviceRoleKey, true),
      body: JSON.stringify({
        password: newPassword,
        email_confirm: true,
      }),
    });

    if (!updateResp.ok) {
      const errText = await updateResp.text().catch(() => '');
      console.error('[Forgot Password Supabase Update Error]:', updateResp.status, errText);
      return res.status(500).json({
        success: false,
        passwordUpdated: false,
        message: 'Could not update password on authentication server. Please try again.',
      });
    }

    // 3. Consume OTP only after password update succeeded
    delete store[key];
    saveEmailOtpStore(store);

    // 4. Send clean transactional Password Updated Confirmation Email (non-blocking if SMTP hiccups)
    const cfg = getSmtpConfig();
    const transporter = getSmtpTransporter();
    if (transporter) {
      const displayName = existingUser.fullName || 'Customer';
      const timeIst = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const confirmHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#071B35;padding:20px 28px;border-bottom:3px solid #FF7900;">
              <div style="font-size:21px;font-weight:800;color:#FFFFFF;">
                Teqqno<span style="color:#FF7900;">World</span>
              </div>
              <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#CBD5E1;margin-top:3px;">
                Password Security Notice
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.6px;">
                Password Updated
              </p>
              <h1 style="margin:0 0 12px 0;font-size:20px;color:#0F172A;">
                Hi ${escapeHtml(displayName)}, your password was changed.
              </h1>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155;">
                The password for your TeqqnoWorld account (<strong>${escapeHtml(cleanEmail)}</strong>) was successfully updated on ${escapeHtml(timeIst)} IST. You can now sign in with your new password at <a href="https://teqqnoworld.com" style="color:#EA580C;font-weight:600;">teqqnoworld.com</a>.
              </p>
              <p style="margin:0;font-size:12px;color:#64748B;">
                If you did not make this change, reply to this email immediately so our team can secure your account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:14px 28px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">
              &copy; ${new Date().getFullYear()} TeqqnoWorld &bull; Hyderabad, India
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      transporter
        .sendMail({
          from: `"TeqqnoWorld Security" <${cfg.smtpUser}>`,
          to: cleanEmail,
          replyTo: cfg.smtpUser,
          subject: `Your TeqqnoWorld password was updated`,
          text: `Hi ${displayName},\n\nYour TeqqnoWorld account password for ${cleanEmail} was successfully updated on ${timeIst} IST.\nYou can now sign in at https://teqqnoworld.com with your new password.\n\nTeqqnoWorld Team`,
          html: confirmHtml,
        })
        .catch((mailErr) => console.warn('[Password Updated Confirmation Email Warning]:', mailErr));
    }

    return res.status(200).json({
      success: true,
      passwordUpdated: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    });
  } catch (err: any) {
    console.error('[Forgot Password Reset Error]:', err);
    return res.status(500).json({
      success: false,
      passwordUpdated: false,
      message: err?.message || 'Failed to reset password. Please try again.',
    });
  }
});

// Health check / SMTP status endpoint
app.get('/api/smtp-status', (_req: Request, res: Response) => {
  const cfg = getSmtpConfig();
  const supaAdmin = getSupabaseAdminConfig();

  res.json({
    configured: Boolean(cfg.smtpUser && cfg.smtpPass),
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    senderEmail: cfg.smtpUser || '(not set)',
    adminEmail: cfg.adminEmailList.join(', '),
    passwordResetOtpReady: Boolean(supaAdmin.serviceRoleKey),
  });
});

// ==============================================================================
// 3A-4. ADMIN PANEL SECURITY (PIN + 3-STRIKE LOCKOUT + 2FA EMAIL OTP + PIN CHANGE)
// ==============================================================================

interface AdminSecurityEventRecord {
  at: string;
  event: string;
  detail: string;
}

interface AdminSecurityState {
  pinHash: string;
  failedAttempts: number;
  pinLocked: boolean;
  lockedAt: string | null;
  twoStepEnabled: boolean;
  pinUpdatedAt: string | null;
  lastLoginAt: string | null;
  recentEvents: AdminSecurityEventRecord[];
}

const ADMIN_SECURITY_STORE_PATH = path.join(os.tmpdir(), 'teqqno-admin-security.json');
const ADMIN_OTP_STORE_PATH = path.join(os.tmpdir(), 'teqqno-admin-otp.json');

interface AdminOtpEntry {
  purpose: 'admin_login' | 'reset_pin' | 'change_pin' | 'toggle_2fa';
  hash: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
}

function getAdminSecretSalt(): string {
  return (
    process.env.ADMIN_SECURITY_SECRET ||
    process.env.HOSTINGER_SMTP_PASSWORD ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'teqqno_admin_vault_salt_2026'
  ).trim();
}

function hashAdminPin(pin: string): string {
  return crypto
    .createHmac('sha256', getAdminSecretSalt())
    .update(`admin-pin:${pin.trim()}`)
    .digest('hex');
}

function hashAdminOtp(purpose: string, otp: string): string {
  return crypto
    .createHmac('sha256', getAdminSecretSalt())
    .update(`admin-otp:${purpose}:${otp.trim()}`)
    .digest('hex');
}

function createSignedAdminToken(type: 'session' | 'challenge', ttlMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      t: type,
      exp: Date.now() + ttlMs,
      nonce: crypto.randomBytes(12).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAdminSecretSalt())
    .update(`${type}:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySignedAdminToken(token: string, expectedType: 'session' | 'challenge'): boolean {
  try {
    const clean = String(token || '').trim();
    const parts = clean.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getAdminSecretSalt())
      .update(`${expectedType}:${payload}`)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsed?.t !== expectedType) return false;
    if (!parsed?.exp || Date.now() > Number(parsed.exp)) return false;
    return true;
  } catch {
    return false;
  }
}

function extractAdminBearerToken(req: Request): string {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function maskEmailForPublic(email: string): string {
  const clean = String(email || '').trim();
  const [local, domain] = clean.split('@');
  if (!local || !domain) return 'owner email';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function loadAdminSecurityState(): AdminSecurityState {
  const defaultSeedPin = (process.env.ADMIN_MASTER_PIN || '9949').trim();
  try {
    if (fs.existsSync(ADMIN_SECURITY_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(ADMIN_SECURITY_STORE_PATH, 'utf8'));
      if (parsed && typeof parsed.pinHash === 'string' && parsed.pinHash.length >= 32) {
        return {
          pinHash: parsed.pinHash,
          failedAttempts: Number(parsed.failedAttempts) || 0,
          pinLocked: Boolean(parsed.pinLocked),
          lockedAt: parsed.lockedAt || null,
          twoStepEnabled: typeof parsed.twoStepEnabled === 'boolean' ? parsed.twoStepEnabled : true,
          pinUpdatedAt: parsed.pinUpdatedAt || null,
          lastLoginAt: parsed.lastLoginAt || null,
          recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents.slice(0, 15) : [],
        };
      }
    }
  } catch {
    // fallback to initial state
  }
  const initial: AdminSecurityState = {
    pinHash: hashAdminPin(defaultSeedPin),
    failedAttempts: 0,
    pinLocked: false,
    lockedAt: null,
    twoStepEnabled: true,
    pinUpdatedAt: null,
    lastLoginAt: null,
    recentEvents: [],
  };
  saveAdminSecurityState(initial);
  return initial;
}

function saveAdminSecurityState(state: AdminSecurityState) {
  try {
    fs.writeFileSync(ADMIN_SECURITY_STORE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Admin Security Store Write Warning]:', err);
  }
}

function appendAdminSecurityEvent(state: AdminSecurityState, event: string, detail: string) {
  state.recentEvents = [
    { at: new Date().toISOString(), event, detail },
    ...(Array.isArray(state.recentEvents) ? state.recentEvents : []),
  ].slice(0, 15);
}

function loadAdminOtpStore(): Record<string, AdminOtpEntry> {
  try {
    if (fs.existsSync(ADMIN_OTP_STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(ADMIN_OTP_STORE_PATH, 'utf8'));
      const now = Date.now();
      const cleaned: Record<string, AdminOtpEntry> = {};
      for (const [k, rec] of Object.entries(parsed || {})) {
        const entry = rec as AdminOtpEntry;
        if (entry && entry.expiresAt > now) cleaned[k] = entry;
      }
      return cleaned;
    }
  } catch {
    // ignore corrupt otp file
  }
  return {};
}

function saveAdminOtpStore(store: Record<string, AdminOtpEntry>) {
  try {
    fs.writeFileSync(ADMIN_OTP_STORE_PATH, JSON.stringify(store), 'utf8');
  } catch (err) {
    console.warn('[Admin OTP Store Write Warning]:', err);
  }
}

function validateNewAdminPin(pin: string): string | null {
  const clean = String(pin || '').trim();
  if (!/^[0-9]{4,8}$/.test(clean)) {
    return 'Admin PIN must be 4 to 8 numeric digits.';
  }
  const weakPins = new Set([
    '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
    '1234', '4321', '12345', '54321', '123456', '654321', '12345678', '000000', '111111',
  ]);
  if (weakPins.has(clean) || /^(\d)\1+$/.test(clean)) {
    return 'This PIN is too easy to guess (avoid 1234, 0000, 1111, etc.). Please choose a stronger 4-8 digit PIN.';
  }
  return null;
}

async function sendOwnerAdminSecurityEmail(params: {
  subject: string;
  badge: string;
  heading: string;
  bodyText: string;
  otpCode?: string;
  note?: string;
}): Promise<{ sent: boolean; simulated: boolean }> {
  const cfg = getSmtpConfig();
  const transporter = getSmtpTransporter();
  if (!transporter) {
    console.log('[Admin Security Email - Simulation Mode]', {
      to: cfg.adminEmailList,
      subject: params.subject,
      otpCode: params.otpCode,
    });
    return { sent: true, simulated: true };
  }

  const spacedOtp = params.otpCode
    ? `${params.otpCode.slice(0, 3)} ${params.otpCode.slice(3)}`
    : '';
  const timeIst = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#071B35;padding:20px 28px;border-bottom:3px solid #FF7900;">
              <div style="font-size:21px;font-weight:800;color:#FFFFFF;">
                Teqqno<span style="color:#FF7900;">World</span>
              </div>
              <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#CBD5E1;margin-top:3px;">
                ${escapeHtml(params.badge)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:center;">
              <h1 style="margin:0 0 10px 0;font-size:20px;color:#0F172A;">
                ${escapeHtml(params.heading)}
              </h1>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">
                ${escapeHtml(params.bodyText)}
              </p>
              ${
                spacedOtp
                  ? `<div style="display:inline-block;background-color:#FFF7ED;border:2px solid #FF7900;border-radius:12px;padding:16px 32px;margin:4px 0 20px;">
                <div style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#C2410C;">
                  ${escapeHtml(spacedOtp)}
                </div>
              </div>`
                  : ''
              }
              <p style="margin:0;font-size:12px;color:#64748B;">
                ${escapeHtml(params.note || `Time: ${timeIst} IST. If you did not initiate this action, change your Admin PIN immediately.`)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:14px 28px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#64748B;">
              &copy; ${new Date().getFullYear()} TeqqnoWorld Admin Security &bull; Hyderabad, India
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    params.heading,
    '',
    params.bodyText,
    params.otpCode ? `\nVerification Code: ${params.otpCode}\n` : '',
    params.note || `Time: ${timeIst} IST.`,
  ].join('\n');

  await transporter.sendMail({
    from: `"TeqqnoWorld Admin Security" <${cfg.smtpUser}>`,
    to: cfg.adminEmailList.join(', '),
    replyTo: cfg.smtpUser,
    subject: params.subject,
    text,
    html,
  });
  return { sent: true, simulated: false };
}

function verifyStoredAdminOtp(
  purpose: AdminOtpEntry['purpose'],
  rawOtp: string
): { valid: boolean; error?: string } {
  const cleanOtp = String(rawOtp || '').replace(/[^0-9]/g, '');
  if (cleanOtp.length !== 6) {
    return { valid: false, error: 'Please enter the exact 6-digit verification code sent to Owner Email.' };
  }
  const store = loadAdminOtpStore();
  const rec = store[purpose];
  if (!rec || Date.now() > rec.expiresAt) {
    delete store[purpose];
    saveAdminOtpStore(store);
    return { valid: false, error: 'Verification code has expired. Please request a fresh 6-digit code.' };
  }
  if (rec.attempts >= 5) {
    delete store[purpose];
    saveAdminOtpStore(store);
    return { valid: false, error: 'Too many wrong code attempts. Please request a fresh 6-digit code.' };
  }
  const expected = hashAdminOtp(purpose, cleanOtp);
  const a = Buffer.from(rec.hash, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    rec.attempts += 1;
    store[purpose] = rec;
    saveAdminOtpStore(store);
    const left = Math.max(0, 5 - rec.attempts);
    return {
      valid: false,
      error:
        left > 0
          ? `Incorrect verification code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Too many wrong code attempts. Please request a fresh 6-digit code.',
    };
  }
  delete store[purpose];
  saveAdminOtpStore(store);
  return { valid: true };
}

// 1. Public Admin Gate Status (never reveals PIN or full email)
app.get('/api/admin/auth/status', (_req: Request, res: Response) => {
  const state = loadAdminSecurityState();
  const cfg = getSmtpConfig();
  return res.json({
    pinLocked: state.pinLocked,
    failedAttempts: state.failedAttempts,
    maxAttempts: 3,
    twoStepEnabled: state.twoStepEnabled,
    maskedOwnerEmail: maskEmailForPublic(cfg.primaryAdminEmail),
    smtpConfigured: Boolean(cfg.smtpUser && cfg.smtpPass),
  });
});

// 2. Step 1 Admin Login: Verify Master PIN (strict 3-wrong-PIN lockout + 2FA Email OTP trigger)
app.post('/api/admin/auth/verify-pin', async (req: Request, res: Response) => {
  try {
    const pin = String(req.body?.pin || '').trim();
    const state = loadAdminSecurityState();
    const cfg = getSmtpConfig();
    const maskedOwnerEmail = maskEmailForPublic(cfg.primaryAdminEmail);

    if (state.pinLocked) {
      return res.status(423).json({
        success: false,
        pinLocked: true,
        failedAttempts: state.failedAttempts,
        attemptsRemaining: 0,
        maskedOwnerEmail,
        message:
          'Admin Panel is LOCKED after 3 wrong PIN attempts. Owner must verify the 6-digit Email code and create a new PIN.',
      });
    }

    if (!pin) {
      return res.status(400).json({
        success: false,
        pinLocked: false,
        failedAttempts: state.failedAttempts,
        attemptsRemaining: Math.max(0, 3 - state.failedAttempts),
        message: 'Please enter your Admin Master PIN.',
      });
    }

    const enteredHash = hashAdminPin(pin);
    const a = Buffer.from(enteredHash, 'utf8');
    const b = Buffer.from(state.pinHash, 'utf8');
    const pinMatches = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!pinMatches) {
      state.failedAttempts += 1;
      if (state.failedAttempts >= 3) {
        state.pinLocked = true;
        state.lockedAt = new Date().toISOString();
        appendAdminSecurityEvent(
          state,
          'Admin Panel Locked (3 Wrong PINs)',
          '3 consecutive wrong PIN attempts detected. Mandatory Owner Email OTP PIN reset activated.'
        );
        saveAdminSecurityState(state);

        // Alert owner immediately by email
        sendOwnerAdminSecurityEmail({
          subject: 'Security Alert: TeqqnoWorld Admin Panel locked after 3 wrong PIN attempts',
          badge: 'Urgent Admin Security Alert',
          heading: 'Admin Panel Locked (3 Failed PIN Attempts)',
          bodyText:
            'Someone entered the wrong TeqqnoWorld Admin PIN 3 times in a row. For your protection, the Admin Panel has been automatically locked. To unlock it, open the Admin Panel, request a 6-digit Owner Email verification code, and set a new Admin PIN.',
        }).catch((e) => console.warn('[Admin Lockout Alert Email Warning]:', e));

        return res.status(423).json({
          success: false,
          pinLocked: true,
          failedAttempts: state.failedAttempts,
          attemptsRemaining: 0,
          maskedOwnerEmail,
          message:
            '3 wrong PIN attempts detected! Admin Panel is now LOCKED. Verify Owner Email code to create a new PIN.',
        });
      }

      const remaining = Math.max(0, 3 - state.failedAttempts);
      appendAdminSecurityEvent(
        state,
        'Failed Admin PIN Attempt',
        `Wrong PIN entered (${state.failedAttempts}/3 attempts used).`
      );
      saveAdminSecurityState(state);

      return res.status(401).json({
        success: false,
        pinLocked: false,
        failedAttempts: state.failedAttempts,
        attemptsRemaining: remaining,
        maskedOwnerEmail,
        message: `Incorrect Admin PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before security lockout.`,
      });
    }

    // Correct PIN -> reset failed attempt counter
    state.failedAttempts = 0;

    if (state.twoStepEnabled) {
      const otp = String(crypto.randomInt(100000, 999999));
      const otpStore = loadAdminOtpStore();
      otpStore.admin_login = {
        purpose: 'admin_login',
        hash: hashAdminOtp('admin_login', otp),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 mins
        sentAt: Date.now(),
        attempts: 0,
      };
      saveAdminOtpStore(otpStore);
      saveAdminSecurityState(state);

      const mailRes = await sendOwnerAdminSecurityEmail({
        subject: `${otp} is your TeqqnoWorld Admin login code`,
        badge: 'Admin 2-Step Verification',
        heading: 'Verify your Admin Hub login',
        bodyText:
          'Your Admin Master PIN was verified. Enter this 6-digit code to finish signing in to the TeqqnoWorld Admin Operations Hub:',
        otpCode: otp,
        note: 'This code expires in 5 minutes. Never share this code with anyone.',
      });

      const challengeToken = createSignedAdminToken('challenge', 5 * 60 * 1000);
      return res.status(200).json({
        success: true,
        requiresTwoStep: true,
        challengeToken,
        maskedOwnerEmail,
        simulated: mailRes.simulated,
        devOtp: mailRes.simulated ? otp : undefined,
        message: `PIN verified! 6-digit login code sent to Owner Email (${maskedOwnerEmail}).`,
      });
    }

    // 2-Step Verification OFF -> Issue 12-hour Admin Session Token directly
    state.lastLoginAt = new Date().toISOString();
    appendAdminSecurityEvent(state, 'Admin Login Successful', 'Signed in with Master PIN.');
    saveAdminSecurityState(state);

    const sessionToken = createSignedAdminToken('session', 12 * 60 * 60 * 1000);
    return res.status(200).json({
      success: true,
      requiresTwoStep: false,
      sessionToken,
      message: 'Admin Operations Hub unlocked.',
    });
  } catch (err: any) {
    console.error('[Admin Verify PIN Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to verify Admin PIN.',
    });
  }
});

// 3. Step 2 Admin Login: Verify 6-Digit Owner Email 2FA Code
app.post('/api/admin/auth/verify-login-otp', (req: Request, res: Response) => {
  try {
    const challengeToken = String(req.body?.challengeToken || '').trim();
    const otp = String(req.body?.otp || '').trim();

    if (!verifySignedAdminToken(challengeToken, 'challenge')) {
      return res.status(401).json({
        success: false,
        message: 'Login verification session expired. Please re-enter your Admin PIN.',
      });
    }

    const otpCheck = verifyStoredAdminOtp('admin_login', otp);
    if (!otpCheck.valid) {
      return res.status(400).json({
        success: false,
        message: otpCheck.error || 'Invalid 6-digit verification code.',
      });
    }

    const state = loadAdminSecurityState();
    state.lastLoginAt = new Date().toISOString();
    state.failedAttempts = 0;
    appendAdminSecurityEvent(
      state,
      'Admin Login Successful (2-Step Verified)',
      'Master PIN + 6-digit Owner Email verification code passed.'
    );
    saveAdminSecurityState(state);

    const sessionToken = createSignedAdminToken('session', 12 * 60 * 60 * 1000);
    return res.status(200).json({
      success: true,
      sessionToken,
      message: '2-Step Verification successful! Opening Admin Operations Hub...',
    });
  } catch (err: any) {
    console.error('[Admin Verify Login OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to verify login code.',
    });
  }
});

// 3b. Resend Admin 2-Step Login Code (requires valid challengeToken)
app.post('/api/admin/auth/resend-login-otp', async (req: Request, res: Response) => {
  try {
    const challengeToken = String(req.body?.challengeToken || '').trim();
    if (!verifySignedAdminToken(challengeToken, 'challenge')) {
      return res.status(401).json({
        success: false,
        message: 'Login session expired. Please re-enter your Admin PIN.',
      });
    }

    const otpStore = loadAdminOtpStore();
    const existing = otpStore.admin_login;
    const now = Date.now();
    if (existing && now - existing.sentAt < 25_000) {
      const waitSec = Math.ceil((25_000 - (now - existing.sentAt)) / 1000);
      return res.status(429).json({
        success: false,
        retryAfterSec: waitSec,
        message: `Please wait ${waitSec}s before requesting another code.`,
      });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    otpStore.admin_login = {
      purpose: 'admin_login',
      hash: hashAdminOtp('admin_login', otp),
      expiresAt: now + 5 * 60 * 1000,
      sentAt: now,
      attempts: 0,
    };
    saveAdminOtpStore(otpStore);

    const cfg = getSmtpConfig();
    const maskedOwnerEmail = maskEmailForPublic(cfg.primaryAdminEmail);
    const mailRes = await sendOwnerAdminSecurityEmail({
      subject: `${otp} is your TeqqnoWorld Admin login code`,
      badge: 'Admin 2-Step Verification',
      heading: 'New Admin login verification code',
      bodyText: 'Enter this 6-digit code to finish signing in to the TeqqnoWorld Admin Hub:',
      otpCode: otp,
      note: 'This code expires in 5 minutes.',
    });

    return res.status(200).json({
      success: true,
      maskedOwnerEmail,
      simulated: mailRes.simulated,
      devOtp: mailRes.simulated ? otp : undefined,
      expiresInMinutes: 5,
      message: `New 6-digit login code sent to Owner Email (${maskedOwnerEmail}).`,
    });
  } catch (err: any) {
    console.error('[Admin Resend Login OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to resend login verification code.',
    });
  }
});

// 4. Send 6-Digit Owner Email Verification Code (for Lockout PIN Reset, Dashboard PIN Change, or 2FA Disable)
app.post('/api/admin/auth/send-pin-reset-otp', async (req: Request, res: Response) => {
  try {
    const rawPurpose = String(req.body?.purpose || 'reset_pin');
    const purpose: AdminOtpEntry['purpose'] =
      rawPurpose === 'change_pin'
        ? 'change_pin'
        : rawPurpose === 'toggle_2fa'
        ? 'toggle_2fa'
        : 'reset_pin';

    // Dashboard-only purposes require a valid authenticated admin session
    if (purpose === 'change_pin' || purpose === 'toggle_2fa') {
      const token = extractAdminBearerToken(req);
      if (!verifySignedAdminToken(token, 'session')) {
        return res.status(401).json({
          success: false,
          message: 'Admin session expired. Please unlock Admin Hub again.',
        });
      }
    }

    const otpStore = loadAdminOtpStore();
    const existing = otpStore[purpose];
    const now = Date.now();
    if (existing && now - existing.sentAt < 25_000) {
      const waitSec = Math.ceil((25_000 - (now - existing.sentAt)) / 1000);
      return res.status(429).json({
        success: false,
        retryAfterSec: waitSec,
        message: `Please wait ${waitSec}s before requesting a new verification code.`,
      });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    otpStore[purpose] = {
      purpose,
      hash: hashAdminOtp(purpose, otp),
      expiresAt: now + 10 * 60 * 1000,
      sentAt: now,
      attempts: 0,
    };
    saveAdminOtpStore(otpStore);

    const cfg = getSmtpConfig();
    const maskedOwnerEmail = maskEmailForPublic(cfg.primaryAdminEmail);

    const emailCopy =
      purpose === 'change_pin'
        ? {
            subject: `${otp} is your TeqqnoWorld Admin PIN change code`,
            badge: 'Admin PIN Change Verification',
            heading: 'Verify Owner Email to Change Admin PIN',
            bodyText:
              'Enter this 6-digit verification code in your TeqqnoWorld Admin Security settings to save your new Master PIN:',
          }
        : purpose === 'toggle_2fa'
        ? {
            subject: `${otp} is your TeqqnoWorld Admin 2FA change code`,
            badge: 'Admin 2-Step Verification Setting',
            heading: 'Verify Owner Email to Update 2-Step Verification',
            bodyText:
              'Enter this 6-digit code in Admin Security settings to confirm turning OFF 2-Step Email Verification:',
          }
        : {
            subject: `${otp} is your TeqqnoWorld Admin PIN reset code`,
            badge: 'Admin PIN Recovery Verification',
            heading: 'Verify Owner Email to Reset Admin PIN',
            bodyText:
              'Enter this 6-digit verification code on the TeqqnoWorld Admin Panel screen to set a new Master PIN and unlock access:',
          };

    const mailRes = await sendOwnerAdminSecurityEmail({
      ...emailCopy,
      otpCode: otp,
      note: 'This code is valid for 10 minutes. Never share it with anyone.',
    });

    return res.status(200).json({
      success: true,
      maskedOwnerEmail,
      expiresInMinutes: 10,
      simulated: mailRes.simulated,
      devOtp: mailRes.simulated ? otp : undefined,
      message: `6-digit verification code sent to Owner Email (${maskedOwnerEmail}).`,
    });
  } catch (err: any) {
    console.error('[Admin Send PIN Reset OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to send Owner verification code.',
    });
  }
});

// 5. Reset Locked / Forgotten Admin PIN using Owner Email 6-Digit Code
app.post('/api/admin/auth/reset-pin', async (req: Request, res: Response) => {
  try {
    const otp = String(req.body?.otp || '').trim();
    const newPin = String(req.body?.newPin || '').trim();

    const pinValidationErr = validateNewAdminPin(newPin);
    if (pinValidationErr) {
      return res.status(400).json({
        success: false,
        pinUpdated: false,
        message: pinValidationErr,
      });
    }

    const otpCheck = verifyStoredAdminOtp('reset_pin', otp);
    if (!otpCheck.valid) {
      return res.status(400).json({
        success: false,
        pinUpdated: false,
        message: otpCheck.error || 'Invalid or expired Owner verification code.',
      });
    }

    const state = loadAdminSecurityState();
    state.pinHash = hashAdminPin(newPin);
    state.failedAttempts = 0;
    state.pinLocked = false;
    state.lockedAt = null;
    state.pinUpdatedAt = new Date().toISOString();
    appendAdminSecurityEvent(
      state,
      'Admin PIN Reset & Panel Unlocked',
      'Owner verified 6-digit email code and configured a new Admin Master PIN.'
    );
    saveAdminSecurityState(state);

    sendOwnerAdminSecurityEmail({
      subject: 'Your TeqqnoWorld Admin PIN was updated',
      badge: 'Admin Security Confirmation',
      heading: 'Admin Master PIN Updated & Unlocked',
      bodyText:
        'Your TeqqnoWorld Admin Panel Master PIN has been successfully changed via Owner Email verification and any lockout has been cleared.',
    }).catch((e) => console.warn('[Admin PIN Reset Confirm Mail Warning]:', e));

    return res.status(200).json({
      success: true,
      pinUpdated: true,
      message: 'New Admin PIN saved and panel unlocked! You can now sign in with your new PIN.',
    });
  } catch (err: any) {
    console.error('[Admin Reset PIN Error]:', err);
    return res.status(500).json({
      success: false,
      pinUpdated: false,
      message: err?.message || 'Failed to reset Admin PIN.',
    });
  }
});

// 6. Authenticated Admin Security Summary
app.get('/api/admin/security/summary', (req: Request, res: Response) => {
  const token = extractAdminBearerToken(req);
  if (!verifySignedAdminToken(token, 'session')) {
    return res.status(401).json({
      success: false,
      unauthorized: true,
      message: 'Admin session expired. Please unlock Admin Hub again.',
    });
  }
  const state = loadAdminSecurityState();
  const cfg = getSmtpConfig();
  return res.json({
    success: true,
    twoStepEnabled: state.twoStepEnabled,
    pinLocked: state.pinLocked,
    failedAttempts: state.failedAttempts,
    maxAttempts: 3,
    maskedOwnerEmail: maskEmailForPublic(cfg.primaryAdminEmail),
    ownerEmailsCount: cfg.adminEmailList.length,
    pinUpdatedAt: state.pinUpdatedAt,
    lastLoginAt: state.lastLoginAt,
    recentEvents: state.recentEvents,
  });
});

// 7. Authenticated Dashboard: Change Admin PIN (Current PIN + Owner Email 6-Digit Code + New PIN)
app.post('/api/admin/security/change-pin', async (req: Request, res: Response) => {
  try {
    const token = extractAdminBearerToken(req);
    if (!verifySignedAdminToken(token, 'session')) {
      return res.status(401).json({
        success: false,
        pinUpdated: false,
        message: 'Admin session expired. Please sign in again.',
      });
    }

    const currentPin = String(req.body?.currentPin || '').trim();
    const otp = String(req.body?.otp || '').trim();
    const newPin = String(req.body?.newPin || '').trim();

    const state = loadAdminSecurityState();
    const currHash = hashAdminPin(currentPin);
    const a = Buffer.from(currHash, 'utf8');
    const b = Buffer.from(state.pinHash, 'utf8');
    if (!currentPin || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({
        success: false,
        pinUpdated: false,
        message: 'Current Admin PIN is incorrect.',
      });
    }

    if (currentPin === newPin) {
      return res.status(400).json({
        success: false,
        pinUpdated: false,
        message: 'New PIN must be different from your current PIN.',
      });
    }

    const pinErr = validateNewAdminPin(newPin);
    if (pinErr) {
      return res.status(400).json({
        success: false,
        pinUpdated: false,
        message: pinErr,
      });
    }

    const otpCheck = verifyStoredAdminOtp('change_pin', otp);
    if (!otpCheck.valid) {
      return res.status(400).json({
        success: false,
        pinUpdated: false,
        message: otpCheck.error || 'Invalid or expired Owner verification code.',
      });
    }

    state.pinHash = hashAdminPin(newPin);
    state.failedAttempts = 0;
    state.pinLocked = false;
    state.pinUpdatedAt = new Date().toISOString();
    appendAdminSecurityEvent(
      state,
      'Admin PIN Changed from Dashboard',
      'Owner verified Current PIN + 6-digit email code and updated Master PIN.'
    );
    saveAdminSecurityState(state);

    sendOwnerAdminSecurityEmail({
      subject: 'Your TeqqnoWorld Admin PIN was changed',
      badge: 'Admin Security Confirmation',
      heading: 'Admin Master PIN Changed',
      bodyText:
        'Your TeqqnoWorld Admin Panel Master PIN was updated from the Admin Dashboard after Owner Email verification.',
    }).catch((e) => console.warn('[Admin PIN Change Mail Warning]:', e));

    return res.status(200).json({
      success: true,
      pinUpdated: true,
      message: 'Admin Master PIN updated successfully!',
    });
  } catch (err: any) {
    console.error('[Admin Change PIN Error]:', err);
    return res.status(500).json({
      success: false,
      pinUpdated: false,
      message: err?.message || 'Failed to update Admin PIN.',
    });
  }
});

// 8. Authenticated Dashboard: Toggle 2-Step Email OTP Verification ON / OFF
app.post('/api/admin/security/toggle-2fa', async (req: Request, res: Response) => {
  try {
    const token = extractAdminBearerToken(req);
    if (!verifySignedAdminToken(token, 'session')) {
      return res.status(401).json({
        success: false,
        message: 'Admin session expired. Please sign in again.',
      });
    }

    const enabled = Boolean(req.body?.enabled);
    const otp = String(req.body?.otp || '').trim();
    const state = loadAdminSecurityState();

    // Turning OFF 2FA requires Owner Email 6-digit verification code
    if (!enabled && state.twoStepEnabled) {
      const otpCheck = verifyStoredAdminOtp('toggle_2fa', otp);
      if (!otpCheck.valid) {
        return res.status(400).json({
          success: false,
          requiresOtp: true,
          message: otpCheck.error || 'Enter the 6-digit Owner Email code to turn OFF 2-Step Verification.',
        });
      }
    }

    state.twoStepEnabled = enabled;
    appendAdminSecurityEvent(
      state,
      enabled ? '2-Step Verification Enabled' : '2-Step Verification Turned OFF',
      enabled
        ? 'Every Admin login now requires Master PIN + 6-digit Owner Email code.'
        : 'Owner confirmed turning OFF 2-Step Verification via email code.'
    );
    saveAdminSecurityState(state);

    sendOwnerAdminSecurityEmail({
      subject: `TeqqnoWorld Admin 2-Step Verification ${enabled ? 'Enabled' : 'Disabled'}`,
      badge: 'Admin Security Notice',
      heading: `2-Step Verification ${enabled ? 'Enabled' : 'Turned OFF'}`,
      bodyText: enabled
        ? 'Two-Step Email OTP Verification is now ACTIVE on your TeqqnoWorld Admin Panel. Every login requires both Master PIN and a 6-digit Owner Email code.'
        : 'Two-Step Email OTP Verification was turned OFF from your Admin Security panel. Note that the 3-wrong-PIN auto lockout remains active.',
    }).catch((e) => console.warn('[Admin 2FA Toggle Mail Warning]:', e));

    return res.status(200).json({
      success: true,
      twoStepEnabled: state.twoStepEnabled,
      message: enabled
        ? '2-Step Email Verification enabled for Admin Panel!'
        : '2-Step Email Verification turned OFF.',
    });
  } catch (err: any) {
    console.error('[Admin Toggle 2FA Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to update 2-Step Verification.',
    });
  }
});

// ==============================================================================
// 3A-5. CUSTOMER PROFILE TWO-STEP VERIFICATION (EMAIL OTP)
// ==============================================================================

const CUSTOMER_2FA_PREFS_PATH = path.join(os.tmpdir(), 'teqqno-customer-2fa-prefs.json');
const CUSTOMER_2FA_OTP_PATH = path.join(os.tmpdir(), 'teqqno-customer-2fa-otp.json');
const CUSTOMER_2FA_SECRET = (
  process.env.CUSTOMER_2FA_SECRET ||
  process.env.ADMIN_SESSION_SECRET ||
  process.env.HOSTINGER_SMTP_PASSWORD ||
  crypto.randomBytes(32).toString('hex')
).trim();

const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IgO3t6DbnmDpanEfJMCwyw_bqnQytYb';

interface CustomerTwoStepPref {
  userId: string;
  accountEmail: string;
  enabled: boolean;
  twoStepEmail: string;
  updatedAt: string;
  totpEnabled?: boolean;
  totpSecretEnc?: string;
  totpUpdatedAt?: string | null;
}

interface CustomerTwoStepOtpEntry {
  otpHash: string;
  targetEmail: string;
  action: 'enable' | 'disable' | 'change_email';
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

interface CustomerPendingTotpSetup {
  secretBase32: string;
  accountEmail: string;
  expiresAt: number;
  attempts: number;
}

interface CustomerLoginChallenge {
  challengeId: string;
  userId: string;
  accountEmail: string;
  twoStepEmail: string;
  customerName: string;
  activeMethod: 'totp' | 'email';
  emailEnabled: boolean;
  totpEnabled: boolean;
  totpSecretEnc: string;
  otpHash: string;
  accessToken: string;
  refreshToken: string;
  userPayload: any;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const customerLoginChallenges = new Map<string, CustomerLoginChallenge>();
const customerPendingTotpSetups = new Map<string, CustomerPendingTotpSetup>();
const customerTotpLastStep = new Map<string, number>();

// RFC 4648 Base32 & RFC 6238 TOTP (Google Authenticator / Microsoft Authenticator / Authy)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i += 1) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecretBase32(): string {
  return base32Encode(crypto.randomBytes(20));
}

function formatManualTotpKey(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

function computeTotpAtStep(secretBase32: string, step: number): string {
  const key = base32Decode(secretBase32);
  const counterBuf = Buffer.alloc(8);
  const high = Math.floor(step / 0x100000000);
  const low = step >>> 0;
  counterBuf.writeUInt32BE(high, 0);
  counterBuf.writeUInt32BE(low, 4);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

function verifyTotpToken(
  secretBase32: string,
  code: string,
  lastUsedStep?: number | null
): { valid: boolean; matchedStep: number | null; replayed?: boolean } {
  const cleanCode = String(code || '').replace(/[^0-9]/g, '').trim();
  if (cleanCode.length !== 6 || !secretBase32) {
    return { valid: false, matchedStep: null };
  }
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const providedBuf = Buffer.from(cleanCode, 'utf8');
  for (const offset of [-1, 0, 1]) {
    const step = currentStep + offset;
    const expected = computeTotpAtStep(secretBase32, step);
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      providedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      if (typeof lastUsedStep === 'number' && step <= lastUsedStep) {
        return { valid: false, matchedStep: step, replayed: true };
      }
      return { valid: true, matchedStep: step };
    }
  }
  return { valid: false, matchedStep: null };
}

function getTotpEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(`totp_aes_key:${CUSTOMER_2FA_SECRET}`).digest();
}

function encryptTotpSecret(secretBase32: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getTotpEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptTotpSecret(payload: string): string | null {
  try {
    const parts = String(payload || '').split('.');
    if (parts.length !== 3) return null;
    const [ivStr, tagStr, dataStr] = parts;
    const iv = Buffer.from(ivStr, 'base64url');
    const tag = Buffer.from(tagStr, 'base64url');
    const data = Buffer.from(dataStr, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getTotpEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function getSupabasePublicConfig() {
  const { url } = getSupabaseAdminConfig();
  const rawAnon = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();
  const anonKey =
    rawAnon && !rawAnon.includes('your-anon') ? rawAnon : DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  return { url, anonKey };
}

function hashCustomerTwoStepOtp(scope: string, otp: string): string {
  return crypto
    .createHmac('sha256', CUSTOMER_2FA_SECRET)
    .update(`cust_2fa:${scope}:${otp.trim()}`)
    .digest('hex');
}

function signCustomerChallengeToken(challengeId: string, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ cid: challengeId, exp: expiresAt })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', CUSTOMER_2FA_SECRET)
    .update(`cust_chal:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyCustomerChallengeToken(token: string): string | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = crypto
      .createHmac('sha256', CUSTOMER_2FA_SECRET)
      .update(`cust_chal:${payload}`)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.cid || !decoded?.exp || Date.now() > Number(decoded.exp)) return null;
    return String(decoded.cid);
  } catch {
    return null;
  }
}

function loadCustomerTwoStepPrefs(): Record<string, CustomerTwoStepPref> {
  try {
    if (fs.existsSync(CUSTOMER_2FA_PREFS_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CUSTOMER_2FA_PREFS_PATH, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore corrupt mirror file
  }
  return {};
}

function saveCustomerTwoStepPrefs(store: Record<string, CustomerTwoStepPref>) {
  try {
    fs.writeFileSync(CUSTOMER_2FA_PREFS_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Customer 2FA Prefs Write Warning]:', err);
  }
}

function loadCustomerTwoStepOtpStore(): Record<string, CustomerTwoStepOtpEntry> {
  try {
    if (fs.existsSync(CUSTOMER_2FA_OTP_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CUSTOMER_2FA_OTP_PATH, 'utf8'));
      const now = Date.now();
      const cleaned: Record<string, CustomerTwoStepOtpEntry> = {};
      for (const [k, v] of Object.entries(parsed || {})) {
        const entry = v as CustomerTwoStepOtpEntry;
        if (entry && entry.expiresAt > now) cleaned[k] = entry;
      }
      return cleaned;
    }
  } catch {
    // ignore corrupt otp file
  }
  return {};
}

function saveCustomerTwoStepOtpStore(store: Record<string, CustomerTwoStepOtpEntry>) {
  try {
    fs.writeFileSync(CUSTOMER_2FA_OTP_PATH, JSON.stringify(store), 'utf8');
  } catch (err) {
    console.warn('[Customer 2FA OTP Store Write Warning]:', err);
  }
}

function pruneExpiredCustomerChallenges() {
  const now = Date.now();
  for (const [cid, entry] of customerLoginChallenges.entries()) {
    if (entry.expiresAt <= now) {
      customerLoginChallenges.delete(cid);
    }
  }
}

function resolveCustomerTwoStepConfig(userObj: any): {
  enabled: boolean;
  twoStepEmail: string;
  updatedAt: string | null;
  totpEnabled: boolean;
  totpSecretEnc: string;
  totpUpdatedAt: string | null;
} {
  const userId = String(userObj?.id || '');
  const accountEmail = String(userObj?.email || '').trim().toLowerCase();
  const meta = userObj?.user_metadata || {};
  const mirror = loadCustomerTwoStepPrefs()[userId];

  const emailEnabled =
    typeof meta.two_step_enabled === 'boolean'
      ? meta.two_step_enabled
      : Boolean(mirror?.enabled);
  const twoStepEmail = String(
    meta.two_step_email || mirror?.twoStepEmail || accountEmail
  )
    .trim()
    .toLowerCase();
  const updatedAt = meta.two_step_updated_at
    ? String(meta.two_step_updated_at)
    : mirror?.updatedAt || null;

  const totpSecretEnc = String(meta.totp_secret_enc || mirror?.totpSecretEnc || '').trim();
  const rawTotpEnabled =
    typeof meta.totp_enabled === 'boolean'
      ? meta.totp_enabled
      : Boolean(mirror?.totpEnabled);
  const totpEnabled = Boolean(rawTotpEnabled && totpSecretEnc);
  const totpUpdatedAt = meta.totp_updated_at
    ? String(meta.totp_updated_at)
    : mirror?.totpUpdatedAt || null;

  return {
    enabled: emailEnabled,
    twoStepEmail: twoStepEmail || accountEmail,
    updatedAt,
    totpEnabled,
    totpSecretEnc,
    totpUpdatedAt,
  };
}

async function authenticateCustomerBearerToken(
  req: Request
): Promise<{ user: any; accessToken: string } | null> {
  const authHeader = String(req.headers.authorization || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const accessToken = authHeader.slice(7).trim();
  if (!accessToken || accessToken.length < 20) return null;

  const { url, anonKey } = getSupabasePublicConfig();
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!resp.ok) return null;
    const user = (await resp.json()) as any;
    if (!user?.id || !user?.email) return null;
    return { user, accessToken };
  } catch {
    return null;
  }
}

async function sendCustomerTwoStepSecurityEmail(params: {
  toEmail: string;
  customerName?: string;
  subject: string;
  badge: string;
  heading: string;
  bodyText: string;
  otpCode?: string;
  note?: string;
}): Promise<{ sent: boolean; simulated: boolean }> {
  const cfg = getSmtpConfig();
  const transporter = getSmtpTransporter();
  if (!transporter) {
    console.log('[Customer 2FA Email - Simulation Mode]', {
      to: params.toEmail,
      subject: params.subject,
      otpCode: params.otpCode,
    });
    return { sent: true, simulated: true };
  }

  const spacedOtp = params.otpCode
    ? `${params.otpCode.slice(0, 3)} ${params.otpCode.slice(3)}`
    : '';
  const timeIst = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const safeGreeting = params.customerName ? `Hi ${params.customerName}, ` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F6F9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#071B35;padding:20px 28px;border-bottom:3px solid #FF7900;">
              <div style="font-size:21px;font-weight:800;color:#FFFFFF;">
                Teqqno<span style="color:#FF7900;">World</span>
              </div>
              <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#CBD5E1;margin-top:3px;">
                ${escapeHtml(params.badge)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:center;">
              <h1 style="margin:0 0 10px 0;font-size:20px;color:#0F172A;">
                ${escapeHtml(params.heading)}
              </h1>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">
                ${escapeHtml(safeGreeting + params.bodyText)}
              </p>
              ${
                spacedOtp
                  ? `<div style="display:inline-block;background-color:#FFF7ED;border:2px solid #FF7900;border-radius:12px;padding:16px 32px;margin:4px 0 20px;">
                <div style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#C2410C;">
                  ${escapeHtml(spacedOtp)}
                </div>
              </div>`
                  : ''
              }
              <p style="margin:0;font-size:12px;color:#64748B;">
                ${escapeHtml(
                  params.note ||
                    `This code expires in 10 minutes (${timeIst} IST). If you did not request this, please change your TeqqnoWorld account password immediately.`
                )}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:14px 28px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#64748B;">
              &copy; ${new Date().getFullYear()} TeqqnoWorld Account Security &bull; Hyderabad, India
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    params.heading,
    '',
    safeGreeting + params.bodyText,
    params.otpCode ? `\nVerification Code: ${params.otpCode}\n` : '',
    params.note || `Expires in 10 minutes (${timeIst} IST).`,
  ].join('\n');

  await transporter.sendMail({
    from: `"TeqqnoWorld" <${cfg.smtpUser}>`,
    to: params.toEmail,
    replyTo: cfg.smtpUser,
    subject: params.subject,
    text,
    html,
  });

  return { sent: true, simulated: false };
}

// 1. Get authenticated customer's Two-Step Verification status
app.get('/api/customer/2fa/status', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateCustomerBearerToken(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Please sign in to manage Two-Step Verification.',
      });
    }

    const cfg = getSmtpConfig();
    const resolved = resolveCustomerTwoStepConfig(auth.user);
    const accountEmail = String(auth.user.email || '').trim().toLowerCase();

    return res.status(200).json({
      success: true,
      enabled: resolved.enabled,
      twoStepEmail: resolved.twoStepEmail || accountEmail,
      maskedEmail: maskEmailForPublic(resolved.twoStepEmail || accountEmail),
      totpEnabled: resolved.totpEnabled,
      totpUpdatedAt: resolved.totpUpdatedAt,
      anyTwoStepEnabled: Boolean(resolved.enabled || resolved.totpEnabled),
      accountEmail,
      updatedAt: resolved.updatedAt,
      smtpConfigured: Boolean(cfg.smtpUser && cfg.smtpPass),
    });
  } catch (err: any) {
    console.error('[Customer 2FA Status Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to load Two-Step Verification status.',
    });
  }
});

// 2. Send 6-digit Email OTP to enable, change email, or turn OFF Customer 2-Step Verification
app.post('/api/customer/2fa/send-setup-otp', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateCustomerBearerToken(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Session expired. Please sign in again.',
      });
    }

    const rawAction = String(req.body?.action || 'enable').trim();
    const action: 'enable' | 'disable' | 'change_email' =
      rawAction === 'disable' || rawAction === 'change_email' ? rawAction : 'enable';

    const resolved = resolveCustomerTwoStepConfig(auth.user);
    const accountEmail = String(auth.user.email || '').trim().toLowerCase();
    const requestedEmail = String(req.body?.email || '').trim().toLowerCase();

    // When disabling, always send verification code to the currently protected 2FA email
    const targetEmail =
      action === 'disable'
        ? resolved.twoStepEmail || accountEmail
        : requestedEmail || resolved.twoStepEmail || accountEmail;

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address for Two-Step Verification.',
      });
    }

    const otpKey = `${auth.user.id}:${action}`;
    const otpStore = loadCustomerTwoStepOtpStore();
    const existing = otpStore[otpKey];
    const now = Date.now();
    if (existing && now - existing.lastSentAt < 30 * 1000) {
      const retryAfterSec = Math.ceil((30 * 1000 - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        retryAfterSec,
        message: `Please wait ${retryAfterSec}s before requesting another verification code.`,
      });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    otpStore[otpKey] = {
      otpHash: hashCustomerTwoStepOtp(`${auth.user.id}:${action}:${targetEmail}`, otpCode),
      targetEmail,
      action,
      expiresAt: now + 10 * 60 * 1000,
      lastSentAt: now,
      attempts: 0,
    };
    saveCustomerTwoStepOtpStore(otpStore);

    const meta = auth.user.user_metadata || {};
    const customerName =
      meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || undefined;

    const mailCopy =
      action === 'disable'
        ? {
            subject: `${otpCode} is your TeqqnoWorld code to disable 2-Step Verification`,
            heading: 'Confirm Turning OFF 2-Step Verification',
            bodyText:
              'enter this 6-digit code in your TeqqnoWorld Security settings to confirm disabling Email Two-Step Verification.',
          }
        : action === 'change_email'
        ? {
            subject: `${otpCode} is your TeqqnoWorld 2-Step Email verification code`,
            heading: 'Verify Your New 2-Step Email',
            bodyText:
              'enter this 6-digit code to verify this email address for your TeqqnoWorld Two-Step Verification logins.',
          }
        : {
            subject: `${otpCode} is your TeqqnoWorld 2-Step Verification setup code`,
            heading: 'Activate Two-Step Verification',
            bodyText:
              'enter this 6-digit code in your TeqqnoWorld profile to activate Two-Step Email Verification for future logins.',
          };

    const mailRes = await sendCustomerTwoStepSecurityEmail({
      toEmail: targetEmail,
      customerName,
      subject: mailCopy.subject,
      badge: 'Account Security',
      heading: mailCopy.heading,
      bodyText: mailCopy.bodyText,
      otpCode,
    });

    return res.status(200).json({
      success: true,
      targetEmail,
      maskedEmail: maskEmailForPublic(targetEmail),
      simulated: mailRes.simulated,
      devOtp: mailRes.simulated ? otpCode : undefined,
      message: mailRes.simulated
        ? `Simulation Mode: Use verification code ${otpCode}.`
        : `6-digit verification code sent to ${targetEmail}.`,
    });
  } catch (err: any) {
    console.error('[Customer 2FA Send Setup OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Could not send verification code. Please try again.',
    });
  }
});

// 3. Verify 6-digit Email OTP & persist Customer 2-Step Verification ON/OFF
app.post('/api/customer/2fa/toggle', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateCustomerBearerToken(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Session expired. Please sign in again.',
      });
    }

    const enabled = Boolean(req.body?.enabled);
    const rawAction = String(req.body?.action || (enabled ? 'enable' : 'disable')).trim();
    const action: 'enable' | 'disable' | 'change_email' =
      rawAction === 'disable' || rawAction === 'change_email' ? rawAction : 'enable';
    const cleanOtp = String(req.body?.otp || '').replace(/[^0-9]/g, '').trim();

    if (cleanOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the complete 6-digit verification code sent to your email.',
      });
    }

    const otpKey = `${auth.user.id}:${action}`;
    const otpStore = loadCustomerTwoStepOtpStore();
    const entry = otpStore[otpKey];
    if (!entry) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired or not requested. Please request a new code.',
      });
    }
    if (Date.now() > entry.expiresAt) {
      delete otpStore[otpKey];
      saveCustomerTwoStepOtpStore(otpStore);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new 6-digit code.',
      });
    }
    if (entry.attempts >= 5) {
      delete otpStore[otpKey];
      saveCustomerTwoStepOtpStore(otpStore);
      return res.status(429).json({
        success: false,
        message: 'Too many wrong attempts. Please request a fresh verification code.',
      });
    }

    const providedHash = hashCustomerTwoStepOtp(
      `${auth.user.id}:${action}:${entry.targetEmail}`,
      cleanOtp
    );
    const a = Buffer.from(providedHash, 'hex');
    const b = Buffer.from(entry.otpHash, 'hex');
    const isMatch = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!isMatch) {
      entry.attempts += 1;
      otpStore[otpKey] = entry;
      saveCustomerTwoStepOtpStore(otpStore);
      return res.status(400).json({
        success: false,
        message: `Incorrect 6-digit verification code (${5 - entry.attempts} attempts left).`,
      });
    }

    // Consume single-use OTP
    delete otpStore[otpKey];
    saveCustomerTwoStepOtpStore(otpStore);

    const updatedAt = new Date().toISOString();
    const accountEmail = String(auth.user.email || '').trim().toLowerCase();
    const finalTwoStepEmail = entry.targetEmail || accountEmail;

    // Persist in Supabase Auth user_metadata using the customer's verified session token
    const { url, anonKey } = getSupabasePublicConfig();
    const updateResp = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          two_step_enabled: enabled,
          two_step_email: finalTwoStepEmail,
          two_step_updated_at: updatedAt,
        },
      }),
    });

    if (!updateResp.ok) {
      const errText = await updateResp.text().catch(() => '');
      console.warn('[Customer 2FA Metadata Update Warning]:', updateResp.status, errText.slice(0, 180));
    }

    // Also mirror on server filesystem for instant consistency (preserving any active TOTP config)
    const prefsStore = loadCustomerTwoStepPrefs();
    const existingMirror = prefsStore[auth.user.id];
    prefsStore[auth.user.id] = {
      ...(existingMirror || {}),
      userId: auth.user.id,
      accountEmail,
      enabled,
      twoStepEmail: finalTwoStepEmail,
      updatedAt,
    };
    saveCustomerTwoStepPrefs(prefsStore);

    // Send confirmation notice to the verified email (non-blocking)
    const meta = auth.user.user_metadata || {};
    const customerName =
      meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || undefined;

    sendCustomerTwoStepSecurityEmail({
      toEmail: finalTwoStepEmail,
      customerName,
      subject: enabled
        ? 'Two-Step Verification is now active on your TeqqnoWorld account'
        : 'Two-Step Verification turned OFF on your TeqqnoWorld account',
      badge: 'Account Security Confirmation',
      heading: enabled ? 'Two-Step Verification Activated' : 'Two-Step Verification Disabled',
      bodyText: enabled
        ? `Two-Step Email Verification is now ON for your TeqqnoWorld account (${accountEmail}). Future logins will require a 6-digit code sent to ${finalTwoStepEmail}.`
        : `Two-Step Email Verification has been turned OFF for your TeqqnoWorld account (${accountEmail}). You can re-enable it anytime from Account & Security.`,
      note: 'If you did not make this change, reset your password immediately.',
    }).catch((e) => console.warn('[Customer 2FA Confirmation Email Warning]:', e));

    return res.status(200).json({
      success: true,
      enabled,
      twoStepEmail: finalTwoStepEmail,
      maskedEmail: maskEmailForPublic(finalTwoStepEmail),
      updatedAt,
      message: enabled
        ? `Two-Step Verification is now ACTIVE! Login codes will be sent to ${finalTwoStepEmail}.`
        : 'Two-Step Verification has been turned OFF.',
    });
  } catch (err: any) {
    console.error('[Customer 2FA Toggle Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to update Two-Step Verification settings.',
    });
  }
});

// 4. Server-Gated Customer Login Step 1 (Password check -> returns session ONLY if 2FA is OFF; else triggers 6-digit Email OTP)
app.post('/api/customer/2fa/login-step1', async (req: Request, res: Response) => {
  try {
    pruneExpiredCustomerChallenges();
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your password.',
      });
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const authResp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password,
      }),
    });

    const authJson = (await authResp.json().catch(() => ({}))) as any;

    if (!authResp.ok || !authJson?.access_token || !authJson?.user) {
      const rawErr = String(
        authJson?.error_description || authJson?.msg || authJson?.message || ''
      );
      if (rawErr.toLowerCase().includes('invalid login credentials')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password. Please verify and try again.',
        });
      }
      if (rawErr.toLowerCase().includes('email not confirmed')) {
        return res.status(403).json({
          success: false,
          message: 'Please check your email inbox to confirm your account first.',
        });
      }
      return res.status(authResp.status >= 400 ? authResp.status : 401).json({
        success: false,
        message: rawErr || 'Invalid email or password. Please try again.',
      });
    }

    const userObj = authJson.user;
    const resolved = resolveCustomerTwoStepConfig(userObj);

    // If customer has NEITHER Google Authenticator NOR Email OTP enabled -> log them in directly
    if (!resolved.totpEnabled && !resolved.enabled) {
      return res.status(200).json({
        success: true,
        requiresTwoStep: false,
        session: {
          access_token: authJson.access_token,
          refresh_token: authJson.refresh_token,
        },
        user: userObj,
      });
    }

    // Two-Step Verification IS ENABLED -> Hold session tokens strictly on server until 6-digit verification passes
    const targetEmail = resolved.twoStepEmail || cleanEmail;
    const challengeId = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;
    const meta = userObj.user_metadata || {};
    const customerName =
      meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || '';

    // Prefer Google Authenticator (instant, offline) when active; otherwise send 6-digit Email OTP
    if (resolved.totpEnabled) {
      customerLoginChallenges.set(challengeId, {
        challengeId,
        userId: String(userObj.id),
        accountEmail: cleanEmail,
        twoStepEmail: targetEmail,
        customerName,
        activeMethod: 'totp',
        emailEnabled: resolved.enabled,
        totpEnabled: true,
        totpSecretEnc: resolved.totpSecretEnc,
        otpHash: '',
        accessToken: String(authJson.access_token),
        refreshToken: String(authJson.refresh_token),
        userPayload: userObj,
        expiresAt,
        lastSentAt: 0,
        attempts: 0,
      });

      const challengeToken = signCustomerChallengeToken(challengeId, expiresAt);
      return res.status(200).json({
        success: true,
        requiresTwoStep: true,
        method: 'totp',
        canSwitchToEmail: resolved.enabled,
        challengeToken,
        maskedEmail: maskEmailForPublic(targetEmail),
        message: 'Password verified! Open Google Authenticator and enter the 6-digit code for TeqqnoWorld.',
      });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    customerLoginChallenges.set(challengeId, {
      challengeId,
      userId: String(userObj.id),
      accountEmail: cleanEmail,
      twoStepEmail: targetEmail,
      customerName,
      activeMethod: 'email',
      emailEnabled: true,
      totpEnabled: false,
      totpSecretEnc: '',
      otpHash: hashCustomerTwoStepOtp(`login:${challengeId}`, otpCode),
      accessToken: String(authJson.access_token),
      refreshToken: String(authJson.refresh_token),
      userPayload: userObj,
      expiresAt,
      lastSentAt: now,
      attempts: 0,
    });

    const mailRes = await sendCustomerTwoStepSecurityEmail({
      toEmail: targetEmail,
      customerName: customerName || undefined,
      subject: `${otpCode} is your TeqqnoWorld login verification code`,
      badge: '2-Step Login Verification',
      heading: 'Verify Your Sign-In',
      bodyText:
        'someone entered your correct password on TeqqnoWorld. Enter this 6-digit verification code to complete your sign-in:',
      otpCode,
    });

    const challengeToken = signCustomerChallengeToken(challengeId, expiresAt);

    return res.status(200).json({
      success: true,
      requiresTwoStep: true,
      method: 'email',
      canSwitchToEmail: false,
      challengeToken,
      maskedEmail: maskEmailForPublic(targetEmail),
      simulated: mailRes.simulated,
      devOtp: mailRes.simulated ? otpCode : undefined,
      message: mailRes.simulated
        ? `Simulation Mode: Use 2-Step login code ${otpCode}.`
        : `Password verified! Enter the 6-digit code sent to ${maskEmailForPublic(targetEmail)}.`,
    });
  } catch (err: any) {
    console.error('[Customer Login Step 1 Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Sign-in failed. Please check your connection and try again.',
    });
  }
});

// 5. Server-Gated Customer Login Step 2 (Verify 6-digit TOTP Authenticator OR Email OTP -> Release Supabase session)
app.post('/api/customer/2fa/login-verify-otp', (req: Request, res: Response) => {
  try {
    pruneExpiredCustomerChallenges();
    const challengeToken = String(req.body?.challengeToken || '').trim();
    const cleanOtp = String(req.body?.otp || '').replace(/[^0-9]/g, '').trim();

    const challengeId = verifyCustomerChallengeToken(challengeToken);
    if (!challengeId) {
      return res.status(401).json({
        success: false,
        expired: true,
        message: 'Login verification session expired. Please sign in again.',
      });
    }

    const challenge = customerLoginChallenges.get(challengeId);
    if (!challenge || Date.now() > challenge.expiresAt) {
      customerLoginChallenges.delete(challengeId);
      return res.status(401).json({
        success: false,
        expired: true,
        message: 'Login verification code expired. Please sign in again.',
      });
    }

    if (cleanOtp.length !== 6) {
      return res.status(400).json({
        success: false,
        message:
          challenge.activeMethod === 'totp'
            ? 'Please enter the 6-digit code from your Google Authenticator app.'
            : 'Please enter the complete 6-digit code sent to your email.',
      });
    }

    if (challenge.attempts >= 5) {
      customerLoginChallenges.delete(challengeId);
      return res.status(429).json({
        success: false,
        expired: true,
        message: 'Too many wrong attempts. Please sign in again from Step 1.',
      });
    }

    let isMatch = false;
    if (challenge.activeMethod === 'totp') {
      const secretBase32 = decryptTotpSecret(challenge.totpSecretEnc);
      if (!secretBase32) {
        return res.status(500).json({
          success: false,
          message: 'Authenticator verification key unavailable. Please use Email verification or contact support.',
        });
      }
      const lastStep = customerTotpLastStep.get(challenge.userId) ?? null;
      const totpCheck = verifyTotpToken(secretBase32, cleanOtp, lastStep);
      if (totpCheck.replayed) {
        return res.status(400).json({
          success: false,
          message: 'That 6-digit code was already used. Please wait for the next 30-second code in Google Authenticator.',
        });
      }
      isMatch = totpCheck.valid;
      if (isMatch && totpCheck.matchedStep !== null) {
        customerTotpLastStep.set(challenge.userId, totpCheck.matchedStep);
      }
    } else {
      const providedHash = hashCustomerTwoStepOtp(`login:${challengeId}`, cleanOtp);
      const a = Buffer.from(providedHash, 'hex');
      const b = Buffer.from(challenge.otpHash, 'hex');
      isMatch = a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    if (!isMatch) {
      challenge.attempts += 1;
      customerLoginChallenges.set(challengeId, challenge);
      return res.status(400).json({
        success: false,
        message: `Incorrect 6-digit code (${5 - challenge.attempts} attempts left).`,
      });
    }

    // Consume single-use challenge and release session tokens
    customerLoginChallenges.delete(challengeId);

    return res.status(200).json({
      success: true,
      session: {
        access_token: challenge.accessToken,
        refresh_token: challenge.refreshToken,
      },
      user: challenge.userPayload,
    });
  } catch (err: any) {
    console.error('[Customer Login Verify OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to verify login code.',
    });
  }
});

// 6. Resend 6-digit 2-Step Login Email OTP (or switch from TOTP to Email OTP if both enabled)
app.post('/api/customer/2fa/login-resend', async (req: Request, res: Response) => {
  try {
    pruneExpiredCustomerChallenges();
    const challengeToken = String(req.body?.challengeToken || '').trim();
    const challengeId = verifyCustomerChallengeToken(challengeToken);

    if (!challengeId) {
      return res.status(401).json({
        success: false,
        expired: true,
        message: 'Login verification session expired. Please sign in again.',
      });
    }

    const challenge = customerLoginChallenges.get(challengeId);
    if (!challenge || Date.now() > challenge.expiresAt) {
      customerLoginChallenges.delete(challengeId);
      return res.status(401).json({
        success: false,
        expired: true,
        message: 'Login verification session expired. Please sign in again.',
      });
    }

    if (!challenge.emailEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Email OTP fallback is not enabled on this account. Please enter the code from Google Authenticator.',
      });
    }

    const now = Date.now();
    if (challenge.lastSentAt > 0 && now - challenge.lastSentAt < 30 * 1000) {
      const retryAfterSec = Math.ceil((30 * 1000 - (now - challenge.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        retryAfterSec,
        message: `Please wait ${retryAfterSec}s before requesting a new code.`,
      });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    challenge.activeMethod = 'email';
    challenge.otpHash = hashCustomerTwoStepOtp(`login:${challengeId}`, otpCode);
    challenge.lastSentAt = now;
    challenge.expiresAt = now + 10 * 60 * 1000;
    challenge.attempts = 0;
    customerLoginChallenges.set(challengeId, challenge);

    const mailRes = await sendCustomerTwoStepSecurityEmail({
      toEmail: challenge.twoStepEmail,
      customerName: challenge.customerName || undefined,
      subject: `${otpCode} is your TeqqnoWorld login verification code`,
      badge: '2-Step Login Verification',
      heading: 'Sign-In Verification Code',
      bodyText: 'here is your 6-digit verification code to complete your TeqqnoWorld login:',
      otpCode,
    });

    return res.status(200).json({
      success: true,
      method: 'email',
      maskedEmail: maskEmailForPublic(challenge.twoStepEmail),
      simulated: mailRes.simulated,
      devOtp: mailRes.simulated ? otpCode : undefined,
      message: mailRes.simulated
        ? `Simulation Mode: Code is ${otpCode}.`
        : `6-digit verification code sent to ${maskEmailForPublic(challenge.twoStepEmail)}.`,
    });
  } catch (err: any) {
    console.error('[Customer Login Resend OTP Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Could not send verification code.',
    });
  }
});

// 7. Google Authenticator (TOTP) Step 1: Generate local QR Code + Manual Key (Zero Google APIs!)
app.post('/api/customer/2fa/totp/setup', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateCustomerBearerToken(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Please sign in to set up Google Authenticator.',
      });
    }

    const accountEmail = String(auth.user.email || '').trim().toLowerCase();
    const secretBase32 = generateTotpSecretBase32();
    const issuer = 'TeqqnoWorld';
    const label = `${issuer}:${accountEmail}`;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Render QR locally on our server (secret never leaves our server to any third-party QR site)
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#0B1530', light: '#FFFFFF' },
    });

    customerPendingTotpSetups.set(auth.user.id, {
      secretBase32,
      accountEmail,
      expiresAt: Date.now() + 15 * 60 * 1000,
      attempts: 0,
    });

    return res.status(200).json({
      success: true,
      qrDataUrl,
      manualKey: formatManualTotpKey(secretBase32),
      accountEmail,
      issuer,
      message: 'Scan this QR code in Google Authenticator, then enter the 6-digit code to activate.',
    });
  } catch (err: any) {
    console.error('[Customer TOTP Setup Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to generate Google Authenticator QR code.',
    });
  }
});

// 8. Google Authenticator (TOTP) Step 2: Verify 6-digit App Code & Activate
app.post('/api/customer/2fa/totp/confirm', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateCustomerBearerToken(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Session expired. Please sign in again.',
      });
    }

    const cleanCode = String(req.body?.code || '').replace(/[^0-9]/g, '').trim();
    if (cleanCode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the 6-digit code shown in your Google Authenticator app.',
      });
    }

    const pending = customerPendingTotpSetups.get(auth.user.id);
    if (!pending || Date.now() > pending.expiresAt) {
      customerPendingTotpSetups.delete(auth.user.id);
      return res.status(400).json({
        success: false,
        message: 'QR setup session expired. Please click Setup Google Authenticator again.',
      });
    }

    if (pending.attempts >= 5) {
      customerPendingTotpSetups.delete(auth.user.id);
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect codes. Please generate a fresh QR code.',
      });
    }

    const check = verifyTotpToken(pending.secretBase32, cleanCode, null);
    if (!check.valid) {
      pending.attempts += 1;
      customerPendingTotpSetups.set(auth.user.id, pending);
      return res.status(400).json({
        success: false,
        message: `Incorrect 6-digit Authenticator code (${5 - pending.attempts} attempts left). Make sure your phone time is set to Automatic.`,
      });
    }

    customerPendingTotpSetups.delete(auth.user.id);
    if (check.matchedStep !== null) {
      customerTotpLastStep.set(auth.user.id, check.matchedStep);
    }

    const encryptedSecret = encryptTotpSecret(pending.secretBase32);
    const totpUpdatedAt = new Date().toISOString();
    const accountEmail = String(auth.user.email || '').trim().toLowerCase();

    // Persist encrypted TOTP secret in Supabase Auth user_metadata
    const { url, anonKey } = getSupabasePublicConfig();
    const updateResp = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          totp_enabled: true,
          totp_secret_enc: encryptedSecret,
          totp_updated_at: totpUpdatedAt,
        },
      }),
    });

    if (!updateResp.ok) {
      const errText = await updateResp.text().catch(() => '');
      console.warn('[Customer TOTP Metadata Save Warning]:', updateResp.status, errText.slice(0, 180));
    }

    // Mirror on server filesystem
    const prefsStore = loadCustomerTwoStepPrefs();
    const existing = prefsStore[auth.user.id];
    prefsStore[auth.user.id] = {
      userId: auth.user.id,
      accountEmail,
      enabled: Boolean(existing?.enabled),
      twoStepEmail: existing?.twoStepEmail || accountEmail,
      updatedAt: existing?.updatedAt || totpUpdatedAt,
      totpEnabled: true,
      totpSecretEnc: encryptedSecret,
      totpUpdatedAt,
    };
    saveCustomerTwoStepPrefs(prefsStore);

    // Send confirmation notice to account email (non-blocking)
    const meta = auth.user.user_metadata || {};
    const customerName =
      meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || undefined;
    sendCustomerTwoStepSecurityEmail({
      toEmail: accountEmail,
      customerName,
      subject: 'Google Authenticator 2-Step Verification Activated — TeqqnoWorld',
      badge: 'Account Security Confirmation',
      heading: 'Google Authenticator Activated',
      bodyText: `Google Authenticator (TOTP) is now active on your TeqqnoWorld account (${accountEmail}). Future logins will require a 6-digit code from your Authenticator app.`,
      note: 'If you did not enable this, reset your password immediately.',
    }).catch((e) => console.warn('[Customer TOTP Enable Mail Warning]:', e));

    return res.status(200).json({
      success: true,
      totpEnabled: true,
      totpUpdatedAt,
      message: 'Google Authenticator is now ACTIVE! Your account is protected with app-based 2-Step Verification.',
    });
  } catch (err: any) {
    console.error('[Customer TOTP Confirm Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to activate Google Authenticator.',
    });
  }
});

// 9. Google Authenticator (TOTP) Disable: Requires a valid live 6-digit Authenticator code
app.post('/api/customer/2fa/totp/disable', async (req: Request, res: Response) => {
  try {
    const auth = await authenticateCustomerBearerToken(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Session expired. Please sign in again.',
      });
    }

    const cleanCode = String(req.body?.code || '').replace(/[^0-9]/g, '').trim();
    if (cleanCode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Enter the current 6-digit code from your Google Authenticator app to turn it OFF.',
      });
    }

    const resolved = resolveCustomerTwoStepConfig(auth.user);
    if (!resolved.totpEnabled || !resolved.totpSecretEnc) {
      return res.status(400).json({
        success: false,
        message: 'Google Authenticator is already turned OFF.',
      });
    }

    const secretBase32 = decryptTotpSecret(resolved.totpSecretEnc);
    if (!secretBase32) {
      return res.status(500).json({
        success: false,
        message: 'Unable to verify Authenticator key. Please contact support.',
      });
    }

    const check = verifyTotpToken(secretBase32, cleanCode, customerTotpLastStep.get(auth.user.id) ?? null);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.replayed
          ? 'Code already used. Wait for the next 30-second code in Google Authenticator.'
          : 'Incorrect 6-digit Google Authenticator code.',
      });
    }
    if (check.matchedStep !== null) {
      customerTotpLastStep.set(auth.user.id, check.matchedStep);
    }

    const totpUpdatedAt = new Date().toISOString();
    const accountEmail = String(auth.user.email || '').trim().toLowerCase();

    const { url, anonKey } = getSupabasePublicConfig();
    await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          totp_enabled: false,
          totp_secret_enc: '',
          totp_updated_at: totpUpdatedAt,
        },
      }),
    }).catch(() => {});

    const prefsStore = loadCustomerTwoStepPrefs();
    const existing = prefsStore[auth.user.id];
    prefsStore[auth.user.id] = {
      userId: auth.user.id,
      accountEmail,
      enabled: Boolean(existing?.enabled),
      twoStepEmail: existing?.twoStepEmail || accountEmail,
      updatedAt: existing?.updatedAt || totpUpdatedAt,
      totpEnabled: false,
      totpSecretEnc: '',
      totpUpdatedAt,
    };
    saveCustomerTwoStepPrefs(prefsStore);

    return res.status(200).json({
      success: true,
      totpEnabled: false,
      totpUpdatedAt,
      message: 'Google Authenticator has been turned OFF for your account.',
    });
  } catch (err: any) {
    console.error('[Customer TOTP Disable Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to turn OFF Google Authenticator.',
    });
  }
});

// 10. Iframe-Safe Google OAuth Popup Callback Bridge (supports both PKCE ?code= and Implicit #access_token=)
app.get(['/auth/google-callback', '/auth/google-callback/'], (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Completing Google Sign-In — TeqqnoWorld</title>
  <style>
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#071B35; color:#FFFFFF; display:flex; align-items:center; justify-content:center; min-height:100vh; text-align:center; padding:24px; }
    .card { max-width:360px; background:#0D2445; border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:28px; }
    .dot { width:36px; height:36px; border:3px solid rgba(255,121,0,0.3); border-top-color:#FF7900; border-radius:50%; margin:0 auto 14px; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    p { font-size:13px; color:#CBD5E1; margin:8px 0 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot"></div>
    <strong style="font-size:16px;">Completing Google Sign-In...</strong>
    <p id="status">Returning securely to TeqqnoWorld.</p>
  </div>
  <script>
    (function() {
      var hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
      var queryParams = new URLSearchParams(window.location.search || '');
      var payload = {
        type: 'TEQQNO_GOOGLE_AUTH',
        access_token: hashParams.get('access_token') || '',
        refresh_token: hashParams.get('refresh_token') || '',
        code: queryParams.get('code') || '',
        error: queryParams.get('error_description') || hashParams.get('error_description') || queryParams.get('error') || hashParams.get('error') || ''
      };
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(payload, window.location.origin);
          setTimeout(function() { window.close(); }, 200);
          return;
        } catch (e) {}
      }
      // Top-level browser fallback (when user opened outside iframe without popup)
      var suffix = window.location.search + window.location.hash;
      window.location.replace('/' + suffix);
    })();
  </script>
</body>
</html>`);
});

// ==============================================================================
// 3B. RAZORPAY PAYMENT GATEWAY ROUTES (100% PREPAID + 50% PARTIAL ADVANCE, NO COD)
// ==============================================================================

const getRazorpayConfig = () => ({
  keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
  keySecret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
});

app.get('/api/razorpay/status', (_req: Request, res: Response) => {
  const rzp = getRazorpayConfig();
  const mode = rzp.keyId.startsWith('rzp_live_')
    ? 'live'
    : rzp.keyId.startsWith('rzp_test_')
    ? 'test'
    : null;
  res.json({
    configured: Boolean(rzp.keyId && rzp.keySecret),
    keyId: rzp.keyId || null,
    mode,
  });
});

app.get('/api/razorpay/test', async (_req: Request, res: Response) => {
  try {
    const rzp = getRazorpayConfig();
    if (!rzp.keyId || !rzp.keySecret) {
      return res.status(400).json({
        success: false,
        mode: null,
        message: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing in environment variables.',
      });
    }
    const mode = rzp.keyId.startsWith('rzp_live_') ? 'live' : 'test';
    const authHeader = 'Basic ' + Buffer.from(`${rzp.keyId}:${rzp.keySecret}`).toString('base64');
    const rzpResp = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      method: 'GET',
      headers: { Authorization: authHeader },
    });
    const rzpData: any = await rzpResp.json().catch(() => ({}));
    if (!rzpResp.ok) {
      return res.status(rzpResp.status || 401).json({
        success: false,
        mode,
        message: rzpData?.error?.description || 'Razorpay authentication failed. Recheck Key ID and Secret.',
      });
    }
    return res.json({
      success: true,
      mode,
      message: `Razorpay ${mode.toUpperCase()} API authenticated cleanly (${rzp.keyId}).`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      mode: null,
      message: err?.message || 'Unable to reach Razorpay API.',
    });
  }
});

app.post('/api/razorpay/create-order', async (req: Request, res: Response) => {
  try {
    const rzp = getRazorpayConfig();
    if (!rzp.keyId || !rzp.keySecret) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured on the server.',
      });
    }

    const { amountInr, totalOrderValue, balanceDue, paymentPlan, receipt, customerName, customerEmail, customerPhone } = req.body || {};
    const numericAmount = Number(amountInr);
    if (!Number.isFinite(numericAmount) || numericAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payable amount for Razorpay order.',
      });
    }

    const amountPaise = Math.round(numericAmount * 100);
    const authHeader = 'Basic ' + Buffer.from(`${rzp.keyId}:${rzp.keySecret}`).toString('base64');

    const rzpResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: String(receipt || `tq_${Date.now()}`).slice(0, 40),
        notes: {
          payment_plan: paymentPlan || 'prepaid_100',
          total_order_value_inr: String(totalOrderValue || numericAmount),
          advance_paid_inr: String(numericAmount),
          balance_due_inr: String(balanceDue || 0),
          customer_name: String(customerName || ''),
          customer_email: String(customerEmail || ''),
          customer_phone: String(customerPhone || ''),
        },
      }),
    });

    const rzpData: any = await rzpResp.json();
    if (!rzpResp.ok || !rzpData?.id) {
      return res.status(rzpResp.status || 500).json({
        success: false,
        message: rzpData?.error?.description || 'Failed to create Razorpay order.',
      });
    }

    return res.json({
      success: true,
      orderId: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency,
      keyId: rzp.keyId,
    });
  } catch (err: any) {
    console.error('[Razorpay Create Order Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Error creating Razorpay order.',
    });
  }
});

app.post('/api/razorpay/verify-payment', (req: Request, res: Response) => {
  try {
    const rzp = getRazorpayConfig();
    if (!rzp.keySecret) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'RAZORPAY_KEY_SECRET not configured on server.',
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Missing Razorpay verification signature fields.',
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', rzp.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const sigBufExpected = Buffer.from(expectedSignature, 'utf8');
    const sigBufReceived = Buffer.from(String(razorpay_signature), 'utf8');
    const isValid =
      sigBufExpected.length === sigBufReceived.length &&
      crypto.timingSafeEqual(sigBufExpected, sigBufReceived);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Payment signature mismatch. Possible tampering detected.',
      });
    }

    return res.json({
      success: true,
      verified: true,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (err: any) {
    console.error('[Razorpay Verify Error]:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      message: err?.message || 'Payment verification failed.',
    });
  }
});

// ==============================================================================
// 3C. DELHIVERY ONE LOGISTICS API ROUTES (PREPAID ONLY - NO COD)
// ==============================================================================

const DELHIVERY_PICKUPS = [
  { name: 'Teqqnoworld', city: 'Hyderabad', state: 'Telangana', pin: '502032' },
  { name: 'Teqqnoworld 2', city: 'Hyderabad', state: 'Telangana', pin: '500090' },
];

const getDelhiveryConfig = () => ({
  token: (process.env.DELHIVERY_API_TOKEN || '').trim(),
  defaultPickup: (process.env.DELHIVERY_PICKUP_LOCATION || 'Teqqnoworld').trim(),
  defaultOriginPin: (process.env.DELHIVERY_PICKUP_PINCODE || '502032').trim(),
});

app.get('/api/delhivery/status', (_req: Request, res: Response) => {
  const cfg = getDelhiveryConfig();
  res.json({
    configured: Boolean(cfg.token),
    defaultPickup: cfg.defaultPickup,
    defaultOriginPin: cfg.defaultOriginPin,
    pickups: DELHIVERY_PICKUPS,
  });
});

const PIN_REGION_DIRECTORY: Record<string, { city: string; state: string; estimatedDays: string }> = {
  '11': { city: 'New Delhi', state: 'Delhi', estimatedDays: '2–3 business days' },
  '12': { city: 'Gurugram / NCR', state: 'Haryana', estimatedDays: '2–4 business days' },
  '13': { city: 'Karnal / Ambala', state: 'Haryana', estimatedDays: '3–4 business days' },
  '14': { city: 'Ludhiana / Amritsar', state: 'Punjab', estimatedDays: '3–5 business days' },
  '15': { city: 'Bathinda / Firozpur', state: 'Punjab', estimatedDays: '3–5 business days' },
  '16': { city: 'Chandigarh', state: 'Chandigarh / Punjab', estimatedDays: '3–4 business days' },
  '17': { city: 'Shimla / Solan', state: 'Himachal Pradesh', estimatedDays: '4–6 business days' },
  '18': { city: 'Jammu', state: 'Jammu & Kashmir', estimatedDays: '5–7 business days' },
  '19': { city: 'Srinagar', state: 'Jammu & Kashmir', estimatedDays: '5–7 business days' },
  '20': { city: 'Noida / Ghaziabad', state: 'Uttar Pradesh', estimatedDays: '2–4 business days' },
  '21': { city: 'Prayagraj / Kanpur', state: 'Uttar Pradesh', estimatedDays: '3–5 business days' },
  '22': { city: 'Lucknow', state: 'Uttar Pradesh', estimatedDays: '3–4 business days' },
  '23': { city: 'Varanasi', state: 'Uttar Pradesh', estimatedDays: '3–5 business days' },
  '24': { city: 'Bareilly / Dehradun', state: 'UP / Uttarakhand', estimatedDays: '3–5 business days' },
  '25': { city: 'Meerut / Muzaffarnagar', state: 'Uttar Pradesh', estimatedDays: '3–5 business days' },
  '26': { city: 'Nainital / Haldwani', state: 'Uttarakhand', estimatedDays: '4–6 business days' },
  '27': { city: 'Gorakhpur', state: 'Uttar Pradesh', estimatedDays: '3–5 business days' },
  '28': { city: 'Agra / Mathura', state: 'Uttar Pradesh', estimatedDays: '3–5 business days' },
  '30': { city: 'Jaipur', state: 'Rajasthan', estimatedDays: '3–4 business days' },
  '31': { city: 'Udaipur / Kota', state: 'Rajasthan', estimatedDays: '3–5 business days' },
  '32': { city: 'Kota / Bharatpur', state: 'Rajasthan', estimatedDays: '3–5 business days' },
  '33': { city: 'Bikaner / Sikar', state: 'Rajasthan', estimatedDays: '4–5 business days' },
  '34': { city: 'Jodhpur', state: 'Rajasthan', estimatedDays: '4–5 business days' },
  '36': { city: 'Rajkot', state: 'Gujarat', estimatedDays: '3–5 business days' },
  '37': { city: 'Bhuj / Kachchh', state: 'Gujarat', estimatedDays: '4–5 business days' },
  '38': { city: 'Ahmedabad / Gandhinagar', state: 'Gujarat', estimatedDays: '2–4 business days' },
  '39': { city: 'Surat / Vadodara', state: 'Gujarat', estimatedDays: '2–4 business days' },
  '40': { city: 'Mumbai / Thane', state: 'Maharashtra', estimatedDays: '2–3 business days' },
  '41': { city: 'Pune', state: 'Maharashtra', estimatedDays: '2–3 business days' },
  '42': { city: 'Nashik / Jalgaon', state: 'Maharashtra', estimatedDays: '3–4 business days' },
  '43': { city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', estimatedDays: '2–4 business days' },
  '44': { city: 'Nagpur', state: 'Maharashtra', estimatedDays: '2–3 business days' },
  '45': { city: 'Indore', state: 'Madhya Pradesh', estimatedDays: '3–4 business days' },
  '46': { city: 'Bhopal', state: 'Madhya Pradesh', estimatedDays: '3–4 business days' },
  '47': { city: 'Gwalior / Jabalpur', state: 'Madhya Pradesh', estimatedDays: '3–5 business days' },
  '48': { city: 'Jabalpur / Rewa', state: 'Madhya Pradesh', estimatedDays: '3–5 business days' },
  '49': { city: 'Raipur / Bhilai', state: 'Chhattisgarh', estimatedDays: '2–4 business days' },
  '50': { city: 'Hyderabad', state: 'Telangana', estimatedDays: '1–2 business days' },
  '51': { city: 'Tirupati / Kurnool', state: 'Andhra Pradesh', estimatedDays: '2–3 business days' },
  '52': { city: 'Vijayawada / Guntur', state: 'Andhra Pradesh', estimatedDays: '2–3 business days' },
  '53': { city: 'Visakhapatnam', state: 'Andhra Pradesh', estimatedDays: '2–3 business days' },
  '56': { city: 'Bengaluru', state: 'Karnataka', estimatedDays: '2–3 business days' },
  '57': { city: 'Mysuru / Mangaluru', state: 'Karnataka', estimatedDays: '2–4 business days' },
  '58': { city: 'Hubballi / Belagavi', state: 'Karnataka', estimatedDays: '2–4 business days' },
  '59': { city: 'Belagavi / Kalaburagi', state: 'Karnataka', estimatedDays: '2–4 business days' },
  '60': { city: 'Chennai', state: 'Tamil Nadu', estimatedDays: '2–3 business days' },
  '61': { city: 'Thanjavur / Tiruchirappalli', state: 'Tamil Nadu', estimatedDays: '3–4 business days' },
  '62': { city: 'Madurai / Tirunelveli', state: 'Tamil Nadu', estimatedDays: '3–4 business days' },
  '63': { city: 'Salem / Vellore', state: 'Tamil Nadu', estimatedDays: '2–4 business days' },
  '64': { city: 'Coimbatore', state: 'Tamil Nadu', estimatedDays: '2–4 business days' },
  '67': { city: 'Kozhikode / Kannur', state: 'Kerala', estimatedDays: '3–5 business days' },
  '68': { city: 'Kochi / Ernakulam', state: 'Kerala', estimatedDays: '3–4 business days' },
  '69': { city: 'Thiruvananthapuram', state: 'Kerala', estimatedDays: '3–5 business days' },
  '70': { city: 'Kolkata', state: 'West Bengal', estimatedDays: '2–3 business days' },
  '71': { city: 'Howrah / Durgapur', state: 'West Bengal', estimatedDays: '3–4 business days' },
  '72': { city: 'Kharagpur / Medinipur', state: 'West Bengal', estimatedDays: '3–5 business days' },
  '73': { city: 'Siliguri / Jalpaiguri', state: 'West Bengal / Sikkim', estimatedDays: '4–6 business days' },
  '74': { city: 'North 24 Parganas / Port Blair', state: 'West Bengal / A&N', estimatedDays: '4–6 business days' },
  '75': { city: 'Bhubaneswar / Cuttack', state: 'Odisha', estimatedDays: '2–4 business days' },
  '76': { city: 'Berhampur / Sambalpur', state: 'Odisha', estimatedDays: '3–5 business days' },
  '77': { city: 'Rourkela / Balangir', state: 'Odisha', estimatedDays: '3–5 business days' },
  '78': { city: 'Guwahati', state: 'Assam', estimatedDays: '4–6 business days' },
  '79': { city: 'Shillong / Imphal / Agartala', state: 'North-East India', estimatedDays: '5–7 business days' },
  '80': { city: 'Patna', state: 'Bihar', estimatedDays: '3–5 business days' },
  '81': { city: 'Bhagalpur / Dumka', state: 'Bihar / Jharkhand', estimatedDays: '4–5 business days' },
  '82': { city: 'Dhanbad / Gaya', state: 'Jharkhand / Bihar', estimatedDays: '3–5 business days' },
  '83': { city: 'Ranchi / Jamshedpur', state: 'Jharkhand', estimatedDays: '3–5 business days' },
  '84': { city: 'Muzaffarpur / Darbhanga', state: 'Bihar', estimatedDays: '4–5 business days' },
  '85': { city: 'Purnia / Saharsa', state: 'Bihar', estimatedDays: '4–6 business days' },
};

function estimateEtaByPinAndState(pin: string, stateName?: string): string {
  const prefix2 = pin.slice(0, 2);
  if (prefix2 === '50') return '1–2 business days';
  if (['51', '52', '53', '56', '60', '40', '41', '44', '70', '11'].includes(prefix2)) {
    return '2–3 business days';
  }
  if (['18', '19', '79'].includes(prefix2) || pin.startsWith('744') || pin.startsWith('682')) {
    return '5–7 business days';
  }
  const s = (stateName || '').toLowerCase();
  if (s.includes('telangana')) return '1–2 business days';
  if (s.includes('jammu') || s.includes('ladakh') || s.includes('manipur') || s.includes('mizoram') || s.includes('nagaland') || s.includes('arunachal') || s.includes('andaman') || s.includes('sikkim')) {
    return '5–7 business days';
  }
  return PIN_REGION_DIRECTORY[prefix2]?.estimatedDays || '3–5 business days';
}

app.get('/api/delhivery/pincode', async (req: Request, res: Response) => {
  try {
    const pin = String(req.query.pin || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (pin.length !== 6) {
      return res.status(400).json({ success: false, serviceable: false, pincode: pin, message: 'Enter a valid 6-digit pincode.' });
    }

    // Army Postal Service (9xxxxx) and 0xxxxx are not civilian Delhivery courier pins
    if (pin.startsWith('0') || pin.startsWith('9')) {
      return res.json({
        success: true,
        configured: Boolean(getDelhiveryConfig().token),
        serviceable: false,
        pincode: pin,
        prepaid: false,
        cod: false,
        courier: 'Delhivery Express',
        dispatchHub: 'Hyderabad Facility (502032)',
        message: pin.startsWith('9')
          ? `Army Post Office (APO/FPO) pincode ${pin} is not serviceable via Delhivery courier.`
          : `Pincode ${pin} is not a valid Indian delivery pincode.`,
      });
    }

    const cfg = getDelhiveryConfig();
    if (!cfg.token) {
      // Verify real Indian pincode against India Post directory first (fast 2.5s timeout)
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const postalResp = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);

        if (postalResp.ok) {
          const postalData: any = await postalResp.json();
          const firstEntry = Array.isArray(postalData) ? postalData[0] : null;

          if (firstEntry?.Status === 'Error' || !firstEntry?.PostOffice?.length) {
            return res.json({
              success: true,
              configured: false,
              serviceable: false,
              pincode: pin,
              prepaid: false,
              cod: false,
              courier: 'Delhivery Express',
              dispatchHub: 'Hyderabad Facility (502032)',
              source: 'india_post_verified',
              message: `Pincode ${pin} was not found. Delhivery delivery is not available for this pincode.`,
            });
          }

          const po = firstEntry.PostOffice[0];
          const city = po.District || po.Block || po.Division || '';
          const state = po.State || '';
          const areaName = po.Name || '';
          const eta = estimateEtaByPinAndState(pin, state);

          return res.json({
            success: true,
            configured: false,
            serviceable: true,
            pincode: pin,
            city,
            state,
            areaName,
            prepaid: true,
            cod: false,
            estimatedDays: eta,
            courier: 'Delhivery Express',
            dispatchHub: 'Hyderabad Facility (502032)',
            source: 'india_post_verified',
            message: `Delhivery Express delivers to ${areaName ? `${areaName}, ` : ''}${city}${state ? `, ${state}` : ''} (${pin}).`,
          });
        }
      } catch {
        // External lookup timed out; fall back cleanly to regional PIN prefix directory
      }

      const prefix2 = pin.slice(0, 2);
      const region = PIN_REGION_DIRECTORY[prefix2];
      if (!region) {
        return res.json({
          success: true,
          configured: false,
          serviceable: false,
          pincode: pin,
          prepaid: false,
          cod: false,
          courier: 'Delhivery Express',
          dispatchHub: 'Hyderabad Facility (502032)',
          source: 'pin_directory',
          message: `Pincode ${pin} is not in an active Indian postal zone for Delhivery delivery.`,
        });
      }

      return res.json({
        success: true,
        configured: false,
        serviceable: true,
        pincode: pin,
        city: region.city,
        state: region.state,
        prepaid: true,
        cod: false,
        estimatedDays: region.estimatedDays,
        courier: 'Delhivery Express',
        dispatchHub: 'Hyderabad Facility (502032)',
        source: 'pin_directory',
        message: `Delhivery Prepaid Express serviceable in ${region.city}, ${region.state} (${pin}).`,
      });
    }

    const resp = await fetch(`https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pin}`, {
      headers: {
        Authorization: `Token ${cfg.token}`,
        Accept: 'application/json',
      },
    });
    const data: any = await resp.json();
    const record = data?.delivery_codes?.[0]?.postal_code;

    if (!record) {
      return res.json({
        success: true,
        configured: true,
        serviceable: false,
        pincode: pin,
        prepaid: false,
        cod: false,
        courier: 'Delhivery Express',
        dispatchHub: 'Hyderabad Facility (502032)',
        source: 'delhivery_live',
        message: `Pincode ${pin} is currently non-serviceable on Delhivery Express.`,
      });
    }

    const prepaidOk = String(record.pre_paid || '').toUpperCase() === 'Y';
    const isEmbargo = String(record.remarks || '').toLowerCase().includes('embargo');
    const serviceable = prepaidOk && !isEmbargo;
    const city = record.city || record.district || PIN_REGION_DIRECTORY[pin.slice(0, 2)]?.city || '';
    const state = record.state_code || PIN_REGION_DIRECTORY[pin.slice(0, 2)]?.state || '';
    const eta = estimateEtaByPinAndState(pin, state);

    return res.json({
      success: true,
      configured: true,
      serviceable,
      pincode: pin,
      city,
      state,
      prepaid: prepaidOk,
      cod: false, // Store policy: Prepaid & 50% Partial Advance only (no COD)
      estimatedDays: eta,
      courier: 'Delhivery Express',
      dispatchHub: 'Hyderabad Facility (502032)',
      source: 'delhivery_live',
      message: serviceable
        ? `Delhivery Prepaid Express serviceable (${city || pin})`
        : `Pincode ${pin} has delivery restrictions (${record.remarks || 'Not serviceable'}).`,
    });
  } catch (err: any) {
    console.error('[Delhivery Pincode Error]:', err);
    return res.status(500).json({
      success: false,
      serviceable: false,
      pincode: String(req.query.pin || ''),
      message: err?.message || 'Delhivery pincode lookup failed.',
    });
  }
});

app.post('/api/delhivery/create-shipment', async (req: Request, res: Response) => {
  try {
    const cfg = getDelhiveryConfig();
    if (!cfg.token) {
      return res.status(400).json({
        success: false,
        message: 'DELHIVERY_API_TOKEN is not configured in server environment variables.',
      });
    }

    const {
      orderId,
      orderNumber,
      pickupLocation,
      customerName,
      phone,
      address,
      city,
      state,
      pincode,
      productDesc,
      quantity,
      totalAmount,
      weightGrams,
      lengthCm,
      breadthCm,
      heightCm,
    } = req.body || {};

    const cleanPin = String(pincode || '').replace(/[^0-9]/g, '').slice(0, 6);
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '').slice(-10);

    if (!customerName || cleanPin.length !== 6 || !cleanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, 10-digit phone, and valid 6-digit delivery pincode are required for Delhivery manifest.',
      });
    }

    const selectedPickup = (pickupLocation || cfg.defaultPickup || 'Teqqnoworld').trim();
    const cmuPayload = {
      shipments: [
        {
          name: String(customerName).slice(0, 100),
          add: String(address || `${city}, ${state}`).slice(0, 250),
          pin: cleanPin,
          city: String(city || ''),
          state: String(state || ''),
          country: 'India',
          phone: cleanPhone,
          order: String(orderNumber || orderId || `TQ-${Date.now()}`),
          payment_mode: 'Prepaid',
          return_pin: '',
          return_city: '',
          return_phone: '',
          return_add: '',
          return_state: '',
          return_country: '',
          products_desc: String(productDesc || 'Custom Printed Corporate Merchandise').slice(0, 200),
          hsn_code: '9989',
          cod_amount: '0',
          order_date: new Date().toISOString().split('T')[0],
          total_amount: String(Math.round(Number(totalAmount) || 0)),
          seller_add: '',
          seller_name: 'TeqqnoWorld',
          seller_inv: String(orderNumber || orderId || ''),
          quantity: String(Number(quantity) || 1),
          waybill: '',
          shipment_width: String(Number(breadthCm) || 25),
          shipment_height: String(Number(heightCm) || 12),
          shipment_length: String(Number(lengthCm) || 30),
          weight: String(Number(weightGrams) || 500),
          seller_gst_tin: '',
          shipping_mode: 'Surface',
          address_type: 'home',
        },
      ],
      pickup_location: {
        name: selectedPickup,
      },
    };

    const formBody = new URLSearchParams();
    formBody.set('format', 'json');
    formBody.set('data', JSON.stringify(cmuPayload));

    const resp = await fetch('https://track.delhivery.com/api/cmu/create.json', {
      method: 'POST',
      headers: {
        Authorization: `Token ${cfg.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody.toString(),
    });

    const data: any = await resp.json();
    const pkg = data?.packages?.[0];
    const waybill = pkg?.waybill;

    if (!data?.success || !waybill) {
      const errMsg = pkg?.remarks?.join(', ') || data?.rmk || data?.error || 'Delhivery rejected shipment creation.';
      return res.status(400).json({
        success: false,
        message: errMsg,
        raw: data,
      });
    }

    return res.json({
      success: true,
      waybill,
      uploadWbn: data?.upload_wbn,
      courierPartner: `Delhivery (${selectedPickup})`,
      pickupLocation: selectedPickup,
      message: `Delhivery Shipment Created! Waybill: ${waybill}`,
      raw: data,
    });
  } catch (err: any) {
    console.error('[Delhivery Create Shipment Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Delhivery shipment creation failed.',
    });
  }
});

app.get('/api/delhivery/label', async (req: Request, res: Response) => {
  try {
    const cfg = getDelhiveryConfig();
    const wbns = String(req.query.wbns || '').trim();
    if (!cfg.token || !wbns) {
      return res.status(400).send('Missing DELHIVERY_API_TOKEN or waybill (wbns).');
    }

    const resp = await fetch(`https://track.delhivery.com/api/p/packing_slip?wbns=${encodeURIComponent(wbns)}&pdf=true`, {
      headers: {
        Authorization: `Token ${cfg.token}`,
      },
    });

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const pdfBuf = Buffer.from(await resp.arrayBuffer());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Delhivery_Label_${wbns}.pdf"`);
      return res.send(pdfBuf);
    }

    const jsonData: any = await resp.json();
    if (jsonData?.packages?.[0]?.pdf_download_link) {
      return res.redirect(jsonData.packages[0].pdf_download_link);
    }
    return res.json(jsonData);
  } catch (err: any) {
    return res.status(500).send(err?.message || 'Failed to fetch Delhivery shipping label.');
  }
});

app.post('/api/delhivery/pickup', async (req: Request, res: Response) => {
  try {
    const cfg = getDelhiveryConfig();
    if (!cfg.token) {
      return res.status(400).json({ success: false, message: 'DELHIVERY_API_TOKEN not configured.' });
    }

    const { pickupLocation, pickupDate, pickupTime, expectedPackageCount } = req.body || {};
    const resp = await fetch('https://track.delhivery.com/fm/request/new/', {
      method: 'POST',
      headers: {
        Authorization: `Token ${cfg.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        pickup_location: pickupLocation || cfg.defaultPickup,
        pickup_date: pickupDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        pickup_time: pickupTime || '14:00:00',
        expected_package_count: Number(expectedPackageCount) || 1,
      }),
    });

    const data: any = await resp.json();
    if (!resp.ok || data?.pr_exist === false && !data?.pickup_id) {
      return res.status(400).json({
        success: false,
        message: data?.error?.message || data?.message || 'Delhivery pickup request failed.',
      });
    }

    return res.json({
      success: true,
      pickupId: String(data?.pickup_id || ''),
      message: `Delhivery Pickup scheduled (${pickupLocation || cfg.defaultPickup})! ID: ${data?.pickup_id || 'Confirmed'}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Pickup request failed.' });
  }
});

app.get('/api/delhivery/track', async (req: Request, res: Response) => {
  try {
    const cfg = getDelhiveryConfig();
    const waybill = String(req.query.waybill || '').trim();
    if (!cfg.token || !waybill) {
      return res.status(400).json({
        success: false,
        waybill,
        scans: [],
        message: !cfg.token ? 'DELHIVERY_API_TOKEN not configured.' : 'Waybill number required.',
      });
    }

    const resp = await fetch(`https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`, {
      headers: {
        Authorization: `Token ${cfg.token}`,
        Accept: 'application/json',
      },
    });
    const data: any = await resp.json();
    const shipment = data?.ShipmentData?.[0]?.Shipment;

    if (!shipment) {
      return res.json({
        success: false,
        waybill,
        scans: [],
        message: `No tracking data found yet for Waybill ${waybill}.`,
      });
    }

    const scans = (shipment.Scans || []).map((s: any) => ({
      status: s?.ScanDetail?.Scan || '',
      location: s?.ScanDetail?.ScannedLocation || '',
      time: s?.ScanDetail?.ScanDateTime || '',
      instructions: s?.ScanDetail?.Instructions || '',
    }));

    return res.json({
      success: true,
      waybill,
      currentStatus: shipment?.Status?.Status || 'In Progress',
      statusLocation: shipment?.Status?.StatusLocation || '',
      expectedDelivery: shipment?.ExpectedDeliveryDate || '',
      origin: shipment?.Origin || '',
      destination: shipment?.Destination || '',
      scans,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      waybill: String(req.query.waybill || ''),
      scans: [],
      message: err?.message || 'Delhivery tracking lookup failed.',
    });
  }
});

// ==============================================================================
// 3D. AISENSY WHATSAPP BUSINESS API ROUTES (ORDER CONFIRM/CANCEL & 5% DROP RECOVERY)
// ==============================================================================

const AISENSY_API_ENDPOINT = 'https://backend.aisensy.com/campaign/t1/api/v2';
const AISENSY_LEDGER_PATH = path.join(os.tmpdir(), 'teqqno-aisensy-state.json');

interface WhatsAppOrderRecord {
  orderId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  total: number;
  whatsappActionStatus: 'pending' | 'confirmed' | 'cancelled';
  confirmUrl: string;
  cancelUrl: string;
  createdAt: string;
  updatedAt: string;
  actionSource?: string;
}

interface WhatsAppDispatchLog {
  id: string;
  type: 'order_confirmation' | 'checkout_drop_5off' | 'order_action' | 'test';
  phone: string;
  customerName: string;
  campaignName: string;
  status: 'sent' | 'simulated' | 'failed' | 'action_recorded';
  orderNumber?: string;
  couponCode?: string;
  triggerReason?: string;
  actionResult?: string;
  messagePreview: string;
  createdAt: string;
}

interface AiSensyLedgerState {
  orders: Record<string, WhatsAppOrderRecord>;
  recoverySentSessions: Record<string, { sentAt: number; couponCode: string; expiresAt: number }>;
  logs: WhatsAppDispatchLog[];
}

function loadAiSensyLedger(): AiSensyLedgerState {
  try {
    if (fs.existsSync(AISENSY_LEDGER_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(AISENSY_LEDGER_PATH, 'utf8'));
      return {
        orders: parsed.orders || {},
        recoverySentSessions: parsed.recoverySentSessions || {},
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    }
  } catch {
    // ignore corrupt cache
  }
  return { orders: {}, recoverySentSessions: {}, logs: [] };
}

function saveAiSensyLedger(state: AiSensyLedgerState) {
  try {
    state.logs = state.logs.slice(0, 100);
    fs.writeFileSync(AISENSY_LEDGER_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('[AiSensy Ledger Write Warning]:', err);
  }
}

const getAiSensyConfig = () => ({
  apiKey: (process.env.AISENSY_API_KEY || '').trim(),
  orderConfirmCampaign: (process.env.AISENSY_ORDER_CONFIRM_CAMPAIGN || 'order_confirmation_action').trim(),
  checkoutDropCampaign: (process.env.AISENSY_CHECKOUT_DROP_CAMPAIGN || 'checkout_drop_5_off').trim(),
  webhookSecret: (process.env.AISENSY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || 'teqqno_aisensy_secret_2026').trim(),
  appBaseUrl: (process.env.APP_BASE_URL || '').trim().replace(/\/$/, ''),
});

function normalizeWhatsAppPhone(rawPhone?: string | null): string {
  const digits = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `91${digits.slice(1)}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
}

function createOrderActionToken(orderId: string, action: 'confirm' | 'cancel'): string {
  const secret = getAiSensyConfig().webhookSecret;
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}:${action}`)
    .digest('hex')
    .slice(0, 24);
}

function verifyOrderActionToken(orderId: string, action: 'confirm' | 'cancel', token?: string): boolean {
  if (!token) return false;
  const expected = createOrderActionToken(orderId, action);
  const bufA = Buffer.from(expected, 'utf8');
  const bufB = Buffer.from(String(token), 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function resolveAppOrigin(req: Request, bodyOrigin?: string): string {
  const cfgOrigin = getAiSensyConfig().appBaseUrl;
  if (cfgOrigin) return cfgOrigin;
  if (bodyOrigin && (bodyOrigin.startsWith('http://') || bodyOrigin.startsWith('https://'))) {
    return bodyOrigin.replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'teqqnoworld.com';
  return `${proto}://${host}`;
}

async function dispatchAiSensyCampaign(payload: {
  campaignName: string;
  destination: string;
  userName: string;
  templateParams: string[];
  source: string;
  buttons?: any[];
}): Promise<{ ok: boolean; simulated: boolean; status?: number; raw?: any; errorMessage?: string }> {
  const cfg = getAiSensyConfig();
  if (!cfg.apiKey) {
    return {
      ok: true,
      simulated: true,
      errorMessage: 'AISENSY_API_KEY not configured on server (running in simulation mode).',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(AISENSY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        apiKey: cfg.apiKey,
        campaignName: payload.campaignName,
        destination: payload.destination,
        userName: payload.userName || 'Valued Customer',
        templateParams: payload.templateParams,
        source: payload.source,
        ...(payload.buttons && payload.buttons.length > 0 ? { buttons: payload.buttons } : {}),
      }),
    });
    clearTimeout(timer);

    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.success === false || data?.status === 'error') {
      return {
        ok: false,
        simulated: false,
        status: resp.status,
        raw: data,
        errorMessage: data?.message || data?.error || `AiSensy API returned status ${resp.status}`,
      };
    }

    return {
      ok: true,
      simulated: false,
      status: resp.status,
      raw: data,
    };
  } catch (err: any) {
    return {
      ok: false,
      simulated: false,
      errorMessage: err?.message || 'Unable to reach AiSensy API endpoint.',
    };
  }
}

app.get('/api/aisensy/status', (_req: Request, res: Response) => {
  const cfg = getAiSensyConfig();
  const ledger = loadAiSensyLedger();
  res.json({
    configured: Boolean(cfg.apiKey),
    endpoint: AISENSY_API_ENDPOINT,
    orderConfirmCampaign: cfg.orderConfirmCampaign,
    checkoutDropCampaign: cfg.checkoutDropCampaign,
    webhookPath: '/api/aisensy/webhook',
    recentLogsCount: ledger.logs.length,
    trackedOrdersCount: Object.keys(ledger.orders).length,
  });
});

app.get('/api/aisensy/logs', (_req: Request, res: Response) => {
  const ledger = loadAiSensyLedger();
  res.json({
    success: true,
    logs: ledger.logs.slice(0, 50),
    orders: Object.values(ledger.orders).slice(0, 50),
  });
});

app.get('/api/aisensy/order-status', (req: Request, res: Response) => {
  const orderId = String(req.query.orderId || '').trim();
  const orderNumber = String(req.query.orderNumber || '').trim();
  const ledger = loadAiSensyLedger();
  const record =
    (orderId && ledger.orders[orderId]) ||
    Object.values(ledger.orders).find((o) => o.orderNumber === orderNumber) ||
    null;

  if (!record) {
    return res.json({
      found: false,
      whatsappActionStatus: 'pending',
    });
  }

  return res.json({
    found: true,
    ...record,
  });
});

app.post('/api/aisensy/send-order-confirmation', async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      orderNumber,
      customerName,
      phone,
      total,
      amountPaid,
      balanceDue,
      paymentMode,
      itemsSummary,
      shippingCity,
      originUrl,
    } = req.body || {};

    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!orderId || !normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and valid customer WhatsApp number are required.',
      });
    }

    const cfg = getAiSensyConfig();
    const displayOrderNum = String(orderNumber || orderId);
    const firstName = String(customerName || 'Customer').trim().split(' ')[0] || 'Customer';
    const baseOrigin = resolveAppOrigin(req, originUrl);

    const confirmToken = createOrderActionToken(String(orderId), 'confirm');
    const cancelToken = createOrderActionToken(String(orderId), 'cancel');
    const confirmUrl = `${baseOrigin}/#order-action?action=confirm&orderId=${encodeURIComponent(String(orderId))}&orderNumber=${encodeURIComponent(displayOrderNum)}&token=${confirmToken}`;
    const cancelUrl = `${baseOrigin}/#order-action?action=cancel&orderId=${encodeURIComponent(String(orderId))}&orderNumber=${encodeURIComponent(displayOrderNum)}&token=${cancelToken}`;

    const formattedTotal = `₹${Math.round(Number(total) || 0).toLocaleString('en-IN')}`;
    const formattedPaid = `₹${Math.round(Number(amountPaid) || Number(total) || 0).toLocaleString('en-IN')}`;
    const itemLine = String(itemsSummary || 'Custom Branded Corporate Merchandise').slice(0, 120);

    const previewMessage = [
      `Namaste ${firstName}! 🙏 Aapka TeqqnoWorld Order #${displayOrderNum} place ho gaya hai!`,
      `📦 Items: ${itemLine}`,
      `💰 Order Total: ${formattedTotal} (Paid: ${formattedPaid}${Number(balanceDue) > 0 ? ` · Balance: ₹${Math.round(Number(balanceDue)).toLocaleString('en-IN')}` : ''})`,
      shippingCity ? `📍 Delivery City: ${shippingCity}` : '',
      ``,
      `Kripya apna order status choose karein:`,
      `✅ Confirm Order: ${confirmUrl}`,
      `❌ Cancel Order: ${cancelUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    const aisensyResp = await dispatchAiSensyCampaign({
      campaignName: cfg.orderConfirmCampaign,
      destination: normalizedPhone,
      userName: String(customerName || firstName),
      templateParams: [
        firstName,
        displayOrderNum,
        itemLine,
        formattedTotal,
        String(paymentMode || 'Prepaid'),
        confirmUrl,
        cancelUrl,
      ],
      source: 'teqqnoworld-order-confirm',
    });

    const nowIso = new Date().toISOString();
    const ledger = loadAiSensyLedger();
    ledger.orders[String(orderId)] = {
      orderId: String(orderId),
      orderNumber: displayOrderNum,
      customerName: String(customerName || 'Customer'),
      phone: normalizedPhone,
      total: Number(total) || 0,
      whatsappActionStatus: 'pending',
      confirmUrl,
      cancelUrl,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    ledger.logs.unshift({
      id: `wa_ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'order_confirmation',
      phone: normalizedPhone,
      customerName: String(customerName || firstName),
      campaignName: cfg.orderConfirmCampaign,
      status: aisensyResp.simulated ? 'simulated' : aisensyResp.ok ? 'sent' : 'failed',
      orderNumber: displayOrderNum,
      messagePreview: previewMessage,
      createdAt: nowIso,
    });
    saveAiSensyLedger(ledger);

    return res.json({
      success: aisensyResp.ok || aisensyResp.simulated,
      simulated: aisensyResp.simulated,
      phone: normalizedPhone,
      campaignName: cfg.orderConfirmCampaign,
      confirmUrl,
      cancelUrl,
      previewMessage,
      whatsappActionStatus: 'pending',
      message: aisensyResp.simulated
        ? 'WhatsApp order notification prepared in Simulation Mode (add AISENSY_API_KEY in .env to send live).'
        : aisensyResp.ok
        ? `Order notification with Confirm/Cancel options sent to +${normalizedPhone} via AiSensy.`
        : aisensyResp.errorMessage || 'AiSensy dispatch failed.',
    });
  } catch (err: any) {
    console.error('[AiSensy Order Confirmation Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to dispatch AiSensy order notification.',
    });
  }
});

app.post('/api/aisensy/send-checkout-recovery', async (req: Request, res: Response) => {
  try {
    const {
      checkoutSessionId,
      customerName,
      phone,
      cartTotal,
      couponCode = 'SAVE5NOW',
      discountPercent = 5,
      validMinutes = 15,
      triggerReason = 'checkout_drop',
      itemsSummary,
      originUrl,
    } = req.body || {};

    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Valid 10-digit WhatsApp phone number is required.',
      });
    }

    const sessionKey = `${checkoutSessionId || normalizedPhone}_${normalizedPhone}`;
    const ledger = loadAiSensyLedger();
    const existingSent = ledger.recoverySentSessions[sessionKey];
    const nowMs = Date.now();
    if (existingSent && nowMs - existingSent.sentAt < 15 * 60 * 1000) {
      return res.json({
        success: true,
        deduplicated: true,
        simulated: !getAiSensyConfig().apiKey,
        phone: normalizedPhone,
        couponCode: existingSent.couponCode,
        expiresAt: new Date(existingSent.expiresAt).toISOString(),
        message: '5% OFF limited-time WhatsApp offer already sent for this checkout session.',
      });
    }

    const cfg = getAiSensyConfig();
    const firstName = String(customerName || 'Customer').trim().split(' ')[0] || 'Customer';
    const baseOrigin = resolveAppOrigin(req, originUrl);
    const resumeUrl = `${baseOrigin}/#checkout?coupon=${encodeURIComponent(String(couponCode))}&recovery=${encodeURIComponent(String(checkoutSessionId || ''))}`;
    const numericTotal = Math.round(Number(cartTotal) || 0);
    const estSavings = Math.max(1, Math.round(numericTotal * (Number(discountPercent) / 100)));
    const expiresAtMs = nowMs + Number(validMinutes) * 60 * 1000;
    const itemLine = String(itemsSummary || 'Your Custom TeqqnoWorld Merchandise').slice(0, 100);

    const previewMessage = [
      `Hi ${firstName}! 👋 Dekha aap TeqqnoWorld Checkout par order complete karte-karte ruk gaye.`,
      `Koi problem aa rahi hai ya price thoda zyada laga?`,
      `🎁 Special Limited-Time Offer (${validMinutes} Mins Valid): Extra *${discountPercent}% OFF*!`,
      `🏷️ Coupon Code: *${couponCode}* (Extra ₹${estSavings.toLocaleString('en-IN')} bachat on ₹${numericTotal.toLocaleString('en-IN')})`,
      `🛒 Complete Order Now: ${resumeUrl}`,
    ].join('\n');

    const aisensyResp = await dispatchAiSensyCampaign({
      campaignName: cfg.checkoutDropCampaign,
      destination: normalizedPhone,
      userName: String(customerName || firstName),
      templateParams: [
        firstName,
        itemLine,
        `₹${numericTotal.toLocaleString('en-IN')}`,
        `${discountPercent}% OFF`,
        String(couponCode),
        `${validMinutes} mins`,
        resumeUrl,
      ],
      source: `teqqnoworld-${triggerReason}`,
    });

    const nowIso = new Date().toISOString();
    ledger.recoverySentSessions[sessionKey] = {
      sentAt: nowMs,
      couponCode: String(couponCode),
      expiresAt: expiresAtMs,
    };

    ledger.logs.unshift({
      id: `wa_drop_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'checkout_drop_5off',
      phone: normalizedPhone,
      customerName: String(customerName || firstName),
      campaignName: cfg.checkoutDropCampaign,
      status: aisensyResp.simulated ? 'simulated' : aisensyResp.ok ? 'sent' : 'failed',
      couponCode: String(couponCode),
      triggerReason: String(triggerReason),
      messagePreview: previewMessage,
      createdAt: nowIso,
    });
    saveAiSensyLedger(ledger);

    return res.json({
      success: aisensyResp.ok || aisensyResp.simulated,
      simulated: aisensyResp.simulated,
      phone: normalizedPhone,
      campaignName: cfg.checkoutDropCampaign,
      couponCode: String(couponCode),
      discountPercent: Number(discountPercent),
      expiresAt: new Date(expiresAtMs).toISOString(),
      resumeUrl,
      previewMessage,
      message: aisensyResp.simulated
        ? `5% OFF limited-time WhatsApp message (${couponCode}) prepared in Simulation Mode.`
        : aisensyResp.ok
        ? `Limited-time 5% OFF coupon (${couponCode}) sent on WhatsApp (+${normalizedPhone}) via AiSensy!`
        : aisensyResp.errorMessage || 'AiSensy recovery dispatch failed.',
    });
  } catch (err: any) {
    console.error('[AiSensy Checkout Recovery Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to send 5% OFF WhatsApp recovery notification.',
    });
  }
});

async function notifyAdminOrderActionEmail(record: WhatsAppOrderRecord, action: 'confirmed' | 'cancelled', source: string) {
  try {
    const cfg = getSmtpConfig();
    const transporter = getSmtpTransporter();
    if (!transporter) return;
    await transporter.sendMail({
      from: `"TeqqnoWorld WhatsApp Alerts" <${cfg.smtpUser}>`,
      to: cfg.adminEmailList.join(', '),
      subject: `[WhatsApp ${action === 'confirmed' ? 'CONFIRMED' : 'CANCELLED'}] Order #${record.orderNumber} - ${record.customerName}`,
      html: `<div style="font-family:sans-serif;padding:20px;background:#16171B;color:#fff;border-radius:12px;border:1px solid ${action === 'confirmed' ? '#1EBE5D' : '#EF4444'};">
        <h2 style="color:${action === 'confirmed' ? '#1EBE5D' : '#EF4444'};margin-top:0;">Customer ${action.toUpperCase()} Order via WhatsApp</h2>
        <p><strong>Order:</strong> #${escapeHtml(record.orderNumber)}<br/>
        <strong>Customer:</strong> ${escapeHtml(record.customerName)} (+${escapeHtml(record.phone)})<br/>
        <strong>Order Value:</strong> ₹${Number(record.total || 0).toLocaleString('en-IN')}<br/>
        <strong>Source:</strong> ${escapeHtml(source)}</p>
      </div>`,
    });
  } catch (err) {
    console.warn('[WhatsApp Order Action Admin Email Warning]:', err);
  }
}

app.post('/api/aisensy/order-action', async (req: Request, res: Response) => {
  try {
    const { orderId, orderNumber, action, token, source = 'whatsapp_link' } = req.body || {};
    const cleanAction = action === 'cancel' || action === 'cancelled' ? 'cancel' : action === 'confirm' || action === 'confirmed' ? 'confirm' : null;
    if (!cleanAction || (!orderId && !orderNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Valid action (confirm/cancel) and orderId or orderNumber are required.',
      });
    }

    const ledger = loadAiSensyLedger();
    let record =
      (orderId && ledger.orders[String(orderId)]) ||
      Object.values(ledger.orders).find((o) => o.orderNumber === String(orderNumber)) ||
      null;

    // Validate token when token is supplied for an existing orderId
    if (token && record && !verifyOrderActionToken(record.orderId, cleanAction, String(token))) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired WhatsApp order action token.',
      });
    }

    const targetStatus: 'confirmed' | 'cancelled' = cleanAction === 'confirm' ? 'confirmed' : 'cancelled';
    const nowIso = new Date().toISOString();

    if (!record) {
      const resolvedId = String(orderId || orderNumber);
      record = {
        orderId: resolvedId,
        orderNumber: String(orderNumber || resolvedId),
        customerName: 'Customer',
        phone: '',
        total: 0,
        whatsappActionStatus: targetStatus,
        confirmUrl: '',
        cancelUrl: '',
        createdAt: nowIso,
        updatedAt: nowIso,
        actionSource: String(source),
      };
      ledger.orders[resolvedId] = record;
    } else {
      record.whatsappActionStatus = targetStatus;
      record.updatedAt = nowIso;
      record.actionSource = String(source);
    }

    ledger.logs.unshift({
      id: `wa_act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'order_action',
      phone: record.phone || 'Storefront',
      customerName: record.customerName,
      campaignName: 'whatsapp_order_response',
      status: 'action_recorded',
      orderNumber: record.orderNumber,
      actionResult: targetStatus.toUpperCase(),
      messagePreview: `Customer ${targetStatus === 'confirmed' ? 'CONFIRMED ✅' : 'CANCELLED ❌'} Order #${record.orderNumber} via ${source}.`,
      createdAt: nowIso,
    });
    saveAiSensyLedger(ledger);

    void notifyAdminOrderActionEmail(record, targetStatus, String(source));

    return res.json({
      success: true,
      orderId: record.orderId,
      orderNumber: record.orderNumber,
      whatsappActionStatus: targetStatus,
      updatedAt: nowIso,
      message:
        targetStatus === 'confirmed'
          ? `Order #${record.orderNumber} confirmed! Production & proof verification queued.`
          : `Order #${record.orderNumber} has been marked cancelled per your WhatsApp request.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unable to process WhatsApp order action.',
    });
  }
});

// AiSensy Incoming Webhook for Quick Reply Buttons ("Confirm Order" / "Cancel Order")
app.post('/api/aisensy/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const rawSender =
      body.phone_number ||
      body.destination ||
      body.sender ||
      body.from ||
      body?.data?.customer?.phone_number ||
      body?.contact?.phone_number ||
      '';
    const normalizedPhone = normalizeWhatsAppPhone(rawSender);

    const buttonPayload = String(
      body.payload ||
        body.button_payload ||
        body?.button?.payload ||
        body?.data?.message?.button_reply?.id ||
        body?.message?.button?.payload ||
        ''
    ).trim();

    const textMessage = String(
      body.message_content ||
        body.text ||
        body.button_text ||
        body?.button?.text ||
        body?.data?.message?.text?.body ||
        body?.data?.message?.button_reply?.title ||
        ''
    )
      .trim()
      .toLowerCase();

    let detectedAction: 'confirmed' | 'cancelled' | null = null;
    let payloadOrderId = '';

    if (buttonPayload.toUpperCase().startsWith('CONFIRM_ORDER:')) {
      detectedAction = 'confirmed';
      payloadOrderId = buttonPayload.split(':')[1] || '';
    } else if (buttonPayload.toUpperCase().startsWith('CANCEL_ORDER:')) {
      detectedAction = 'cancelled';
      payloadOrderId = buttonPayload.split(':')[1] || '';
    } else if (
      textMessage.includes('confirm') ||
      textMessage === 'yes' ||
      textMessage === '1' ||
      textMessage.includes('ha')
    ) {
      detectedAction = 'confirmed';
    } else if (
      textMessage.includes('cancel') ||
      textMessage === 'no' ||
      textMessage === '2' ||
      textMessage.includes('nahi')
    ) {
      detectedAction = 'cancelled';
    }

    if (!detectedAction) {
      return res.json({
        success: true,
        ignored: true,
        message: 'Webhook received (no confirm/cancel order intent matched).',
      });
    }

    const ledger = loadAiSensyLedger();
    let matchedOrder: WhatsAppOrderRecord | undefined =
      (payloadOrderId && ledger.orders[payloadOrderId]) || undefined;

    if (!matchedOrder && normalizedPhone) {
      const candidates = Object.values(ledger.orders)
        .filter((o) => o.phone === normalizedPhone)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      matchedOrder = candidates[0];
    }

    const nowIso = new Date().toISOString();
    if (matchedOrder) {
      matchedOrder.whatsappActionStatus = detectedAction;
      matchedOrder.updatedAt = nowIso;
      matchedOrder.actionSource = 'aisensy_webhook';
      ledger.logs.unshift({
        id: `wa_wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'order_action',
        phone: matchedOrder.phone || normalizedPhone,
        customerName: matchedOrder.customerName,
        campaignName: 'aisensy_webhook',
        status: 'action_recorded',
        orderNumber: matchedOrder.orderNumber,
        actionResult: detectedAction.toUpperCase(),
        messagePreview: `AiSensy Webhook: Customer replied "${textMessage || buttonPayload}" -> Order #${matchedOrder.orderNumber} ${detectedAction.toUpperCase()}.`,
        createdAt: nowIso,
      });
      saveAiSensyLedger(ledger);
      void notifyAdminOrderActionEmail(matchedOrder, detectedAction, 'aisensy_webhook');
    }

    return res.json({
      success: true,
      matchedOrderId: matchedOrder?.orderId || null,
      orderNumber: matchedOrder?.orderNumber || null,
      whatsappActionStatus: detectedAction,
    });
  } catch (err: any) {
    console.error('[AiSensy Webhook Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Webhook processing error.',
    });
  }
});

app.post('/api/aisensy/test', async (req: Request, res: Response) => {
  try {
    const cfg = getAiSensyConfig();
    const cleanPhone = normalizeWhatsAppPhone(req.body?.phone);
    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit WhatsApp number to send a test message.',
      });
    }

    const testType = req.body?.testType === 'checkout_drop_5off' ? 'checkout_drop_5off' : 'order_confirmation';
    const campaignName = String(
      req.body?.campaignName ||
        (testType === 'checkout_drop_5off' ? cfg.checkoutDropCampaign : cfg.orderConfirmCampaign)
    );
    const baseOrigin = resolveAppOrigin(req, req.body?.originUrl);

    const isDropTest = testType === 'checkout_drop_5off';
    const previewMessage = isDropTest
      ? `TeqqnoWorld 5% OFF Test: Hi Test Customer! Special 5% OFF (Code: SAVE5NOW, 15 mins valid) -> ${baseOrigin}/#checkout?coupon=SAVE5NOW`
      : `TeqqnoWorld AiSensy Test: Order #TQ-TEST99 confirmed! Confirm: ${baseOrigin}/#order-action?action=confirm&orderId=TQ-TEST99 | Cancel: ${baseOrigin}/#order-action?action=cancel&orderId=TQ-TEST99`;

    const templateParams = isDropTest
      ? [
          'Test Customer',
          '230 GSM Custom Corporate Polo (10 pcs)',
          '₹5,400',
          '5% OFF',
          'SAVE5NOW',
          '15 mins',
          `${baseOrigin}/#checkout?coupon=SAVE5NOW`,
        ]
      : [
          'Test Customer',
          'TQ-TEST99',
          '230 GSM Custom Corporate Polo (10 pcs)',
          '₹5,400',
          'Full Prepaid',
          `${baseOrigin}/#order-action?action=confirm&orderId=TQ-TEST99`,
          `${baseOrigin}/#order-action?action=cancel&orderId=TQ-TEST99`,
        ];

    const resp = await dispatchAiSensyCampaign({
      campaignName,
      destination: cleanPhone,
      userName: 'TeqqnoWorld Test',
      templateParams,
      source: isDropTest ? 'teqqnoworld-admin-drop-test' : 'teqqnoworld-admin-test',
    });

    const ledger = loadAiSensyLedger();
    ledger.logs.unshift({
      id: `wa_test_${Date.now()}`,
      type: isDropTest ? 'checkout_drop_5off' : 'test',
      phone: cleanPhone,
      customerName: 'Admin Test',
      campaignName,
      couponCode: isDropTest ? 'SAVE5NOW' : undefined,
      status: resp.simulated ? 'simulated' : resp.ok ? 'sent' : 'failed',
      messagePreview: previewMessage,
      createdAt: new Date().toISOString(),
    });
    saveAiSensyLedger(ledger);

    return res.json({
      success: resp.ok || resp.simulated,
      simulated: resp.simulated,
      phone: cleanPhone,
      message: resp.simulated
        ? `Simulation Ready for +${cleanPhone} (Campaign: ${campaignName}). Set AISENSY_API_KEY in .env to fire live WhatsApp messages.`
        : resp.ok
        ? `Live AiSensy WhatsApp test dispatched to +${cleanPhone} (Campaign: ${campaignName})!`
        : resp.errorMessage || 'AiSensy test call failed.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'AiSensy test request failed.',
    });
  }
});

// ==============================================================================
// 3Z. DYNAMIC PUBLIC PRODUCT FEEDS & PHASE 1 SEO (ROBOTS, SITEMAP, 301, META, 404)
// ==============================================================================

const seoAndFeedOptions = {
  rootDir: __dirname,
  getSupabaseConfig: () => {
    const pub = getSupabasePublicConfig();
    return {
      url: pub.url,
      apiKey: pub.anonKey,
    };
  },
};

registerProductFeedRoutes(app, seoAndFeedOptions);
registerSeoPublicEndpoints(app, seoAndFeedOptions);

// ==============================================================================
// 4. DEV SERVER & STATIC FILE SERVING
// ==============================================================================

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Initialize Vite dev middleware in 'custom' mode so Express controls HTML meta & 404 status
    let viteServerPromise: Promise<any> | null = null;
    const getViteServer = () => {
      if (!viteServerPromise) {
        viteServerPromise = import('vite').then(async ({ createServer: createViteServer }) => {
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom',
          });
          console.log('[TeqqnoWorld] Vite dev middleware ready');
          return vite;
        });
      }
      return viteServerPromise;
    };

    void getViteServer().catch((err) => {
      console.error('[TeqqnoWorld] Vite dev middleware initialization error:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await getViteServer();
        return vite.middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });

    app.get('*', async (req: Request, res: Response, next) => {
      if (isNonHtmlRoutePath(req.path)) {
        return res.status(404).type('text/plain; charset=utf-8').send('Not Found');
      }
      try {
        const vite = await getViteServer();
        const indexPath = path.join(__dirname, 'index.html');
        const rawHtml = fs.readFileSync(indexPath, 'utf8');
        const seoPage = await resolveSeoPageContext(req.path, seoAndFeedOptions);
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const finalHtml = injectSeoIntoHtml(transformed, seoPage);

        if (seoPage.isPrivateNoindex || seoPage.statusCode === 404) {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        }
        res.status(seoPage.statusCode).setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(finalHtml);
      } catch (err) {
        return next(err);
      }
    });
  } else {
    const distDir = path.join(__dirname, 'dist');
    const clientBuildDir = path.join(__dirname, 'client-build');
    const publicDir = path.join(__dirname, 'public');

    const activeBuildDir = fs.existsSync(path.join(distDir, 'index.html'))
      ? distDir
      : clientBuildDir;
    const activeIndex = path.join(activeBuildDir, 'index.html');

    if (!fs.existsSync(activeIndex)) {
      console.error('[TeqqnoWorld] ERROR: No production build found in dist/ or client-build/. Run `npm run build` before deploying.');
    } else {
      console.log(`[TeqqnoWorld] Serving frontend from: ${path.basename(activeBuildDir)}/`);
    }

    // Serve pre-built Vite bundle + static public assets (index: false so / also receives SEO meta)
    app.use(express.static(activeBuildDir, { maxAge: '1d', index: false }));
    app.use(express.static(publicDir, { maxAge: '7d', index: false }));

    app.get('*', async (req: Request, res: Response) => {
      if (isNonHtmlRoutePath(req.path)) {
        return res.status(404).type('text/plain; charset=utf-8').send('Not Found');
      }
      if (!fs.existsSync(activeIndex)) {
        return res.status(503).send('Production build missing. Please run npm run build and redeploy.');
      }
      try {
        const rawHtml = fs.readFileSync(activeIndex, 'utf8');
        const seoPage = await resolveSeoPageContext(req.path, seoAndFeedOptions);
        const finalHtml = injectSeoIntoHtml(rawHtml, seoPage);
        if (seoPage.isPrivateNoindex || seoPage.statusCode === 404) {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        }
        res.status(seoPage.statusCode).setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(finalHtml);
      } catch (err) {
        console.error('[TeqqnoWorld] Error serving SEO HTML:', err);
        return res.sendFile(activeIndex);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TeqqnoWorld] Server running on port ${PORT}`);
    console.log(`[TeqqnoWorld] Hostinger SMTP configured: ${Boolean(process.env.HOSTINGER_SMTP_EMAIL)}`);
  });
}

startServer();
