import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, TaxInvoice, UserProfile, Product } from '../types';
import { CustomOrderRow } from '../lib/supabase';
import { BUSINESS_CONFIG } from '../config/business';

/**
 * Resilient jsPDF instance constructor that works across all bundler environments (Vite, Rollup, ESM, CJS).
 */
function createPdfDocument(options: { orientation?: 'portrait' | 'landscape'; unit?: string; format?: string } = { orientation: 'portrait', unit: 'mm', format: 'a4' }): any {
  let DocConstructor: any = jsPDF;
  if (typeof DocConstructor !== 'function') {
    DocConstructor = (jsPDF as any)?.jsPDF || (jsPDF as any)?.default;
  }
  if (typeof DocConstructor !== 'function' && typeof window !== 'undefined') {
    DocConstructor = (window as any)?.jspdf?.jsPDF || (window as any)?.jsPDF;
  }
  return new DocConstructor(options);
}

/**
 * Resilient autoTable caller that works whether autoTable is a direct function or plugin.
 */
function renderAutoTable(doc: any, options: any) {
  let tableFn: any = autoTable;
  if (typeof tableFn !== 'function') {
    tableFn = (autoTable as any)?.default || (autoTable as any)?.autoTable;
  }
  if (typeof tableFn === 'function') {
    tableFn(doc, options);
  } else if (typeof doc.autoTable === 'function') {
    doc.autoTable(options);
  } else {
    console.error('[PDF] autoTable function could not be resolved');
  }
}

/**
 * Resilient PDF download helper with fallback to Blob URL for iframe sandboxes.
 */
function downloadPdf(doc: any, fileName: string) {
  try {
    doc.save(fileName);
  } catch (err) {
    console.warn('[PDF] Standard doc.save failed, using direct Blob fallback download:', err);
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (fallbackErr) {
      console.error('[PDF] Fallback download failed:', fallbackErr);
    }
  }
}

// Format currency in Indian format
function formatINR(amount: number): string {
  return 'Rs. ' + Math.round(amount).toLocaleString('en-IN');
}

// Convert amount to words (Indian Numbering System)
function amountToWords(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 10) return singleDigits[n];
    if (n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + singleDigits[n % 10] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (hundred > 0) {
      str += singleDigits[hundred] + ' Hundred';
      if (rest > 0) str += ' and ';
    }
    if (rest > 0) {
      str += convertTwoDigits(rest);
    }
    return str;
  }

  let num = rounded;
  let result = '';

  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  const thousands = Math.floor(num / 1000);
  num %= 1000;
  const remaining = num;

  if (crores > 0) {
    result += convertThreeDigits(crores) + ' Crore ';
  }
  if (lakhs > 0) {
    result += convertThreeDigits(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    result += convertThreeDigits(thousands) + ' Thousand ';
  }
  if (remaining > 0) {
    result += convertThreeDigits(remaining) + ' ';
  }

  return 'Rupees ' + result.trim() + ' Only';
}

/**
 * Draws the standard TeqqnoWorld Header & Company Details on the PDF.
 */
function drawInvoiceHeader(doc: any, invoiceNumber: string, dateStr: string, orderRef: string) {
  // Brand header bar (Orange accent)
  doc.setFillColor(255, 122, 0); // #FF7A00
  doc.rect(14, 12, 6, 20, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(11, 11, 13);
  doc.text('TEQQNOWORLD', 24, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('CUSTOM MERCHANDISE & INDUSTRIAL PRINTING SOLUTIONS', 24, 27);
  doc.text('B2B CORPORATE PRINTING FACILITY • ISO 9001:2015 COMPLIANT', 24, 31);

  // Top Right: Tax Invoice Badge
  doc.setFillColor(245, 245, 248);
  doc.setDrawColor(210, 210, 220);
  doc.roundedRect(128, 12, 68, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 122, 0);
  doc.text('TAX INVOICE', 162, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('ORIGINAL FOR RECIPIENT (ITC ELIGIBLE)', 162, 23, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(11, 11, 13);
  doc.text(`Invoice #: ${invoiceNumber}`, 162, 28, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Date: ${dateStr}  |  Order: ${orderRef}`, 162, 33, { align: 'center' });

  // Thin separator rule
  doc.setDrawColor(220, 220, 230);
  doc.line(14, 40, 196, 40);

  // Two Column Entity Box: Supplier Details vs Bill To Details
  // Column 1: Supplier (TeqqnoWorld)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(11, 11, 13);
  doc.text('SUPPLIER / ISSUER DETAILS:', 14, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TeqqnoWorld Private Limited', 14, 51);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text(BUSINESS_CONFIG.address.line1, 14, 55);
  doc.text(BUSINESS_CONFIG.address.line2, 14, 59);
  doc.text(`GSTIN: 36AAACT9810P1Z2  |  State: Telangana (36)`, 14, 63);
  doc.text(`SAC Code: 9989 (Custom Printing & Branding Services)`, 14, 67);
  doc.text(`Contact: ${BUSINESS_CONFIG.contact.phone}  |  Email: ${BUSINESS_CONFIG.contact.email}`, 14, 71);
}

/**
 * 1. Generates and downloads a complete Tax Invoice PDF for an Order.
 */
export function generateOrderTaxInvoicePdf(order: Order): boolean {
  try {
    const doc = createPdfDocument({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const invoiceNumber = `TW-INV-${order.orderNumber}`;
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    drawInvoiceHeader(doc, invoiceNumber, dateStr, order.orderNumber);

    // Column 2: Customer / Billed To
    const startX = 110;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 11, 13);
    doc.text('BILLED & DELIVERED TO:', startX, 46);

    const clientName = order.shippingAddress.fullName || 'Valued Corporate Buyer';
    const company = order.shippingAddress.companyName ? `${order.shippingAddress.companyName}` : '';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(company ? `${company}` : clientName, startX, 51);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    if (company && clientName) {
      doc.text(`Attn: ${clientName}`, startX, 55);
    }
    const street = order.shippingAddress.street || 'Registered Corporate Address';
    const cityStatePin = `${order.shippingAddress.city || 'Metro'}, ${order.shippingAddress.state || 'Telangana'} - ${order.shippingAddress.pincode || '500001'}`;
    doc.text(street.length > 40 ? street.substring(0, 40) + '...' : street, startX, company && clientName ? 59 : 55);
    doc.text(cityStatePin, startX, company && clientName ? 63 : 59);

    const gstin = order.shippingAddress.gstin || 'B2C (Unregistered Enterprise)';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 122, 0);
    doc.text(`GSTIN: ${gstin}`, startX, company && clientName ? 67 : 63);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Phone: ${order.shippingAddress.phone || 'On file'}  |  Email: ${order.shippingAddress.email}`, startX, company && clientName ? 71 : 67);

    // Line items table
    const tableBody = order.items.map((item, idx) => {
      const lineTaxable = item.unitPrice * item.quantity;
      const descLines = [
        item.product.name,
        [
          item.color?.name ? `Color: ${item.color.name}` : null,
          item.size ? `Size: ${item.size}` : null,
          item.printMethod ? `Method: ${item.printMethod}` : null,
          item.printPlacement ? `Placement: ${item.printPlacement}` : null,
        ].filter(Boolean).join(' • '),
      ].filter(Boolean);

      return [
        idx + 1,
        descLines.join('\n'),
        '9989', // SAC for printing services
        item.quantity,
        formatINR(item.unitPrice),
        formatINR(lineTaxable),
        '18%',
        formatINR(Math.round(lineTaxable * 0.18)),
        formatINR(Math.round(lineTaxable * 1.18)),
      ];
    });

    renderAutoTable(doc, {
      startY: 77,
      head: [
        ['#', 'Item Description & Custom Specs', 'SAC', 'Qty', 'Unit Rate', 'Taxable Val', 'GST', 'Tax Amt', 'Total Amount'],
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [14, 15, 20],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 16, halign: 'right' },
        8: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        textColor: [30, 30, 30],
      },
      margin: { left: 14, right: 14 },
    });

    // Final Y coordinate after table
    const finalY = doc.lastAutoTable?.finalY || 140;

    // Summary & Totals Box
    const totalsStartY = finalY + 5;

    // Amount in words box (Left)
    doc.setDrawColor(220, 220, 230);
    doc.setFillColor(250, 250, 253);
    doc.roundedRect(14, totalsStartY, 105, 30, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(11, 11, 13);
    doc.text('TOTAL AMOUNT IN WORDS:', 18, totalsStartY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    const words = amountToWords(order.total);
    doc.text(doc.splitTextToSize(words, 98), 18, totalsStartY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 150, 60);
    doc.text('✓ 100% Eligible for GSTR-2B Input Tax Credit (ITC)', 18, totalsStartY + 25);

    // Totals Calculation (Right)
    const rightBoxX = 124;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    doc.text('Total Taxable Value:', rightBoxX, totalsStartY + 5);
    doc.text(formatINR(order.subtotal), 196, totalsStartY + 5, { align: 'right' });

    // Check if intra-state (Telangana 36) or inter-state (IGST)
    const isTelangana = order.shippingAddress.state?.toLowerCase().includes('telangana');
    if (isTelangana) {
      const halfGst = order.gstAmount / 2;
      doc.text('Central GST (CGST 9%):', rightBoxX, totalsStartY + 10);
      doc.text(formatINR(halfGst), 196, totalsStartY + 10, { align: 'right' });

      doc.text('State GST (SGST 9%):', rightBoxX, totalsStartY + 15);
      doc.text(formatINR(halfGst), 196, totalsStartY + 15, { align: 'right' });
    } else {
      doc.text('Integrated GST (IGST 18%):', rightBoxX, totalsStartY + 10);
      doc.text(formatINR(order.gstAmount), 196, totalsStartY + 10, { align: 'right' });
    }

    doc.text('Logistics / Express Air Freight:', rightBoxX, totalsStartY + 20);
    doc.text(order.shippingFee === 0 ? 'FREE (Promo)' : formatINR(order.shippingFee), 196, totalsStartY + 20, { align: 'right' });

    // Grand Total Bar
    doc.setFillColor(14, 15, 20);
    doc.rect(rightBoxX, totalsStartY + 24, 72, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('GRAND TOTAL (INR):', rightBoxX + 3, totalsStartY + 29.5);
    doc.setTextColor(255, 122, 0);
    doc.text(formatINR(order.total), 193, totalsStartY + 29.5, { align: 'right' });

    // Terms & Declarations
    const termsY = totalsStartY + 38;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(11, 11, 13);
    doc.text('DECLARATION & TERMS:', 14, termsY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text('1. We declare that this invoice shows the actual price of the goods and printing services described and that all particulars are true and correct.', 14, termsY + 4);
    doc.text('2. Classified under SAC 9989 (Other Manufacturing Services: Publishing, Printing and Reproduction Services). Full ITC eligible.', 14, termsY + 8);
    doc.text('3. Custom merchandise manufactured against pre-approved digital artwork. Goods once printed cannot be returned except for manufacturing defects.', 14, termsY + 12);
    doc.text(`4. Jurisdiction: Disputes subject to competent courts in ${BUSINESS_CONFIG.legal.jurisdictionCity}.`, 14, termsY + 16);

    // Digital Signature & Seal Box
    const signBoxX = 135;
    const signBoxY = termsY - 2;
    doc.setDrawColor(200, 200, 210);
    doc.roundedRect(signBoxX, signBoxY, 61, 28, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(11, 11, 13);
    doc.text('For TEQQNOWORLD PVT LTD', signBoxX + 30.5, signBoxY + 5, { align: 'center' });

    // Stylized Digital Seal Stamp
    doc.setDrawColor(255, 122, 0);
    doc.setFillColor(255, 245, 235);
    doc.roundedRect(signBoxX + 8, signBoxY + 8, 45, 12, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 122, 0);
    doc.text('✓ DIGITALLY SIGNED', signBoxX + 30.5, signBoxY + 13, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text('AUTHORISED B2B DISPATCH SIGNATORY', signBoxX + 30.5, signBoxY + 17, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text('Computer Generated • No Physical Signature Required', signBoxX + 30.5, signBoxY + 24, { align: 'center' });

    // Trigger instant direct download
    downloadPdf(doc, `TeqqnoWorld_Tax_Invoice_${order.orderNumber}.pdf`);
    return true;
  } catch (error) {
    console.error('[PDF Generation Error]:', error);
    return false;
  }
}

/**
 * 2. Generates and downloads a Tax Invoice PDF from a CustomerDashboard TaxInvoice item.
 */
export function generateTaxInvoicePdf(invoice: TaxInvoice, userProfile?: UserProfile | null): boolean {
  try {
    const doc = createPdfDocument({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    drawInvoiceHeader(doc, invoice.invoiceNumber, invoice.date, invoice.orderNumber);

    // Customer Info
    const startX = 110;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 11, 13);
    doc.text('BILLED & DELIVERED TO:', startX, 46);

    const clientName = userProfile?.name || 'Valued Corporate Client';
    const company = userProfile?.companyName || 'Corporate Client Enterprise';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(company, startX, 51);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Attn: ${clientName}`, startX, 55);
    doc.text(userProfile?.savedAddresses?.[0]?.street || 'Corporate Office, Cyber Towers, Hitec City', startX, 59);
    doc.text('Hyderabad, Telangana - 500081', startX, 63);

    const gstin = userProfile?.gstin || '36AAACE1234F1Z5 (ITC Registered)';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 122, 0);
    doc.text(`GSTIN: ${gstin}`, startX, 67);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Email: ${userProfile?.email || 'corporate@buyer.com'}  |  Phone: ${userProfile?.mobile || '+91 98765 43210'}`, startX, 71);

    // Single consolidated line item breakdown
    const tableBody = [
      [
        1,
        `Custom Corporate Merchandise Package (Ref Order #${invoice.orderNumber})\nSpecification: Pre-production approved digital proofs, bulk screen & DTF branding.`,
        '9989',
        invoice.itemsCount,
        formatINR(Math.round(invoice.taxableValue / invoice.itemsCount)),
        formatINR(invoice.taxableValue),
        '18%',
        formatINR(invoice.cgst + invoice.sgst + invoice.igst),
        formatINR(invoice.totalAmount),
      ],
    ];

    renderAutoTable(doc, {
      startY: 77,
      head: [
        ['#', 'Item Description & Custom Specs', 'SAC', 'Qty', 'Unit Rate', 'Taxable Val', 'GST', 'Tax Amt', 'Total Amount'],
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [14, 15, 20],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 16, halign: 'right' },
        8: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        textColor: [30, 30, 30],
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = doc.lastAutoTable?.finalY || 120;
    const totalsStartY = finalY + 6;

    // Words Box
    doc.setDrawColor(220, 220, 230);
    doc.setFillColor(250, 250, 253);
    doc.roundedRect(14, totalsStartY, 105, 30, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(11, 11, 13);
    doc.text('TOTAL AMOUNT IN WORDS:', 18, totalsStartY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    const words = amountToWords(invoice.totalAmount);
    doc.text(doc.splitTextToSize(words, 98), 18, totalsStartY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 150, 60);
    doc.text('✓ 100% Eligible for GSTR-2B Input Tax Credit (ITC)', 18, totalsStartY + 25);

    // Totals Box (Right)
    const rightBoxX = 124;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    doc.text('Total Taxable Value:', rightBoxX, totalsStartY + 5);
    doc.text(formatINR(invoice.taxableValue), 196, totalsStartY + 5, { align: 'right' });

    if (invoice.cgst > 0) {
      doc.text('Central GST (CGST 9%):', rightBoxX, totalsStartY + 10);
      doc.text(formatINR(invoice.cgst), 196, totalsStartY + 10, { align: 'right' });

      doc.text('State GST (SGST 9%):', rightBoxX, totalsStartY + 15);
      doc.text(formatINR(invoice.sgst), 196, totalsStartY + 15, { align: 'right' });
    } else {
      doc.text('Integrated GST (IGST 18%):', rightBoxX, totalsStartY + 10);
      doc.text(formatINR(invoice.igst), 196, totalsStartY + 10, { align: 'right' });
    }

    doc.text('Logistics / Freight:', rightBoxX, totalsStartY + 20);
    doc.text('FREE (Promo Included)', 196, totalsStartY + 20, { align: 'right' });

    // Grand Total Bar
    doc.setFillColor(14, 15, 20);
    doc.rect(rightBoxX, totalsStartY + 24, 72, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('GRAND TOTAL (INR):', rightBoxX + 3, totalsStartY + 29.5);
    doc.setTextColor(255, 122, 0);
    doc.text(formatINR(invoice.totalAmount), 193, totalsStartY + 29.5, { align: 'right' });

    // Terms
    const termsY = totalsStartY + 38;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(11, 11, 13);
    doc.text('DECLARATION & TERMS:', 14, termsY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text('1. Invoice issued under SAC 9989 for Custom Industrial Printing & Apparel Merchandising.', 14, termsY + 4);
    doc.text('2. Computer-generated tax invoice with GSTR-1 direct upload compliance.', 14, termsY + 8);
    doc.text(`3. Jurisdiction: Courts of competent jurisdiction in ${BUSINESS_CONFIG.legal.jurisdictionCity}.`, 14, termsY + 12);

    // Signature Box
    const signBoxX = 135;
    const signBoxY = termsY - 2;
    doc.setDrawColor(200, 200, 210);
    doc.roundedRect(signBoxX, signBoxY, 61, 26, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(11, 11, 13);
    doc.text('For TEQQNOWORLD PVT LTD', signBoxX + 30.5, signBoxY + 5, { align: 'center' });

    doc.setDrawColor(255, 122, 0);
    doc.setFillColor(255, 245, 235);
    doc.roundedRect(signBoxX + 8, signBoxY + 8, 45, 10, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 122, 0);
    doc.text('✓ DIGITALLY SIGNED', signBoxX + 30.5, signBoxY + 12.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text('AUTHORISED DISPATCH SIGNATORY', signBoxX + 30.5, signBoxY + 16, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text('Computer Generated • No Physical Signature Required', signBoxX + 30.5, signBoxY + 22, { align: 'center' });

    downloadPdf(doc, invoice.pdfFileName || `TeqqnoWorld_Tax_Invoice_${invoice.invoiceNumber}.pdf`);
    return true;
  } catch (error) {
    console.error('[PDF Generation Error]:', error);
    return false;
  }
}

/**
 * 3. Generates and downloads an official Tax Invoice PDF for an Admin Hub order row.
 */
export function generateAdminOrderInvoicePdf(order: CustomOrderRow, products?: Product[]): boolean {
  try {
    const doc = createPdfDocument({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const displayOrderNum = order.id.startsWith('TQ-') 
      ? order.id 
      : `TQ-${order.id.slice(0, 8).toUpperCase()}`;
    const invoiceNumber = `TW-INV-${displayOrderNum}`;

    const dateStr = order.created_at
      ? new Date(order.created_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-IN');

    drawInvoiceHeader(doc, invoiceNumber, dateStr, displayOrderNum);

    // Customer / Bill To Box
    const startX = 110;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 11, 13);
    doc.text('BILLED & DELIVERED TO:', startX, 46);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(order.company || order.customer_name || 'Corporate Buyer', startX, 51);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    if (order.company && order.customer_name) {
      doc.text(`Attn: ${order.customer_name}`, startX, 55);
    }
    doc.text(`Phone: ${order.phone || 'On Record'}`, startX, order.company && order.customer_name ? 59 : 55);
    doc.text(`Email: ${order.customer_email || 'On Record'}`, startX, order.company && order.customer_name ? 63 : 59);

    // Parse custom notes for GSTIN / Address if recorded
    let parsedGstin = '36AAACE9841P1Z8 (ITC Eligible)';
    let parsedAddress = 'Corporate Delivery Address';
    if (order.custom_notes) {
      const parts = order.custom_notes.split('|');
      for (const p of parts) {
        if (p.includes('GSTIN:')) parsedGstin = p.replace('GSTIN:', '').trim();
        if (p.includes('Address:')) parsedAddress = p.replace('Address:', '').trim();
      }
    }

    doc.text(parsedAddress.length > 40 ? parsedAddress.substring(0, 40) + '...' : parsedAddress, startX, order.company && order.customer_name ? 67 : 63);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 122, 0);
    doc.text(`GSTIN: ${parsedGstin}`, startX, order.company && order.customer_name ? 71 : 67);

    // Product item details
    const matchedProduct = products?.find(p => p.id === order.product_id);
    const productName = matchedProduct?.name || 'Custom Corporate Merchandise';
    const unitPrice = matchedProduct?.basePrice || 250;
    const qty = order.quantity || 1;
    const lineTaxable = unitPrice * qty;
    const gstAmount = Math.round(lineTaxable * 0.18);
    const grandTotal = lineTaxable + gstAmount;

    const tableBody = [
      [
        1,
        `${productName}\nSpecs: ${order.custom_notes || 'Custom bulk order with digital vector proof.'}`,
        '9989',
        qty,
        formatINR(unitPrice),
        formatINR(lineTaxable),
        '18%',
        formatINR(gstAmount),
        formatINR(grandTotal),
      ],
    ];

    renderAutoTable(doc, {
      startY: 77,
      head: [
        ['#', 'Item Description & Custom Specs', 'SAC', 'Qty', 'Unit Rate', 'Taxable Val', 'GST', 'Tax Amt', 'Total Amount'],
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [14, 15, 20],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 16, halign: 'right' },
        8: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        textColor: [30, 30, 30],
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = doc.lastAutoTable?.finalY || 120;
    const totalsStartY = finalY + 6;

    // Words Box
    doc.setDrawColor(220, 220, 230);
    doc.setFillColor(250, 250, 253);
    doc.roundedRect(14, totalsStartY, 105, 30, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(11, 11, 13);
    doc.text('TOTAL AMOUNT IN WORDS:', 18, totalsStartY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(doc.splitTextToSize(amountToWords(grandTotal), 98), 18, totalsStartY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 150, 60);
    doc.text('✓ 100% Eligible for GSTR-2B Input Tax Credit (ITC)', 18, totalsStartY + 25);

    // Totals Box
    const rightBoxX = 124;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    doc.text('Total Taxable Value:', rightBoxX, totalsStartY + 5);
    doc.text(formatINR(lineTaxable), 196, totalsStartY + 5, { align: 'right' });

    doc.text('Integrated GST (IGST 18%):', rightBoxX, totalsStartY + 10);
    doc.text(formatINR(gstAmount), 196, totalsStartY + 10, { align: 'right' });

    doc.text('Logistics & Courier:', rightBoxX, totalsStartY + 16);
    doc.text(order.courier_partner ? `${order.courier_partner} (Free)` : 'Express Freight (Free)', 196, totalsStartY + 16, { align: 'right' });

    // Grand Total Bar
    doc.setFillColor(14, 15, 20);
    doc.rect(rightBoxX, totalsStartY + 22, 72, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('GRAND TOTAL (INR):', rightBoxX + 3, totalsStartY + 27.5);
    doc.setTextColor(255, 122, 0);
    doc.text(formatINR(grandTotal), 193, totalsStartY + 27.5, { align: 'right' });

    // Signature Box
    const termsY = totalsStartY + 35;
    const signBoxX = 135;
    const signBoxY = termsY;
    doc.setDrawColor(200, 200, 210);
    doc.roundedRect(signBoxX, signBoxY, 61, 26, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(11, 11, 13);
    doc.text('For TEQQNOWORLD PVT LTD', signBoxX + 30.5, signBoxY + 5, { align: 'center' });

    doc.setDrawColor(255, 122, 0);
    doc.setFillColor(255, 245, 235);
    doc.roundedRect(signBoxX + 8, signBoxY + 8, 45, 10, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 122, 0);
    doc.text('✓ DIGITALLY SIGNED', signBoxX + 30.5, signBoxY + 12.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text('AUTHORISED DISPATCH SIGNATORY', signBoxX + 30.5, signBoxY + 16, { align: 'center' });

    downloadPdf(doc, `TeqqnoWorld_Tax_Invoice_${displayOrderNum}.pdf`);
    return true;
  } catch (error) {
    console.error('[Admin PDF Generation Error]:', error);
    return false;
  }
}

/**
 * 4. Generates and downloads an authentic, beautifully styled B2B Corporate Catalogue PDF.
 */
export function generateCorporateCataloguePdf(item: {
  id: string;
  title: string;
  category: string;
  pages: number;
  description: string;
  downloadFileName: string;
}): boolean {
  try {
    const doc = createPdfDocument({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Dark luxury cover header
    doc.setFillColor(14, 15, 20);
    doc.rect(0, 0, 210, 65, 'F');

    // Orange Accent Line
    doc.setFillColor(255, 122, 0);
    doc.rect(0, 64, 210, 2, 'F');

    // Cover Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 122, 0);
    doc.text('TEQQNOWORLD ENTERPRISE B2B PROCUREMENT', 14, 18);

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(doc.splitTextToSize(item.title.toUpperCase(), 180), 14, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 190);
    doc.text(`Category: ${item.category}  |  Official 2026 Procurement Guide  |  ${item.pages} Pages Comprehensive Spec`, 14, 52);
    doc.text(`Published By TeqqnoWorld Industrial Printing & Apparel Labs • Hyderabad, India`, 14, 57);

    // Body Overview
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 11, 13);
    doc.text('EXECUTIVE PROCUREMENT SUMMARY', 14, 78);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const descLines = doc.splitTextToSize(item.description, 182);
    doc.text(descLines, 14, 85);

    // Capabilities Matrix Table
    const specsTable = [
      ['Turnaround SLA', '24 to 48 Hours Express Dispatch from Hyderabad Central Facility'],
      ['Quality Tolerance', 'Zero-Variance Pantone PMS Color Matching & Pre-Press Sign-Off'],
      ['Branding Methods', '12-Needle Precision Tajima Embroidery, 8-Color DTF, UV Flatbed, Fiber Laser'],
      ['Volume Discount', 'Tiered Pricing Slabs from 2 units up to 10,000+ units with GST ITC (SAC 9989)'],
      ['Pan-India Logistics', 'Priority Air Express via BlueDart Apex Air with Live Tracking Integration'],
      ['Artwork Proofing', 'Interactive 1:1 Scale Vector Proofs on Web with Real-Time Client Approval'],
    ];

    renderAutoTable(doc, {
      startY: 105,
      head: [['Core Manufacturing Benchmark', 'Factory Engineering Standard']],
      body: specsTable,
      theme: 'striped',
      headStyles: {
        fillColor: [255, 122, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        textColor: [40, 40, 40],
      },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: 122 },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = doc.lastAutoTable?.finalY || 165;

    // Contact & Ordering Instructions Box
    doc.setDrawColor(255, 122, 0);
    doc.setFillColor(254, 248, 240);
    doc.roundedRect(14, finalY + 10, 182, 45, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 11, 13);
    doc.text('CORPORATE PROCUREMENT HOTLINE & SAMPLE REQUESTS', 20, finalY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Official Website: ${BUSINESS_CONFIG.contact.websiteUrl} (Direct 2D Live Mockup Engine)`, 20, finalY + 25);
    doc.text(`B2B Dedicated WhatsApp: ${BUSINESS_CONFIG.contact.whatsapp} (Connect directly with production head)`, 20, finalY + 30);
    doc.text(`Procurement RFQ Email: ${BUSINESS_CONFIG.contact.email}`, 20, finalY + 35);
    doc.text(`Registered Facility: ${BUSINESS_CONFIG.address.full}`, 20, finalY + 40);

    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`© ${new Date().getFullYear()} TeqqnoWorld. SAC 9989 Compliant Industrial Printing Solutions. All Rights Reserved.`, 105, 285, { align: 'center' });

    downloadPdf(doc, item.downloadFileName || `TeqqnoWorld_${item.id}.pdf`);
    return true;
  } catch (error) {
    console.error('[Catalog PDF Generation Error]:', error);
    return false;
  }
}

/**
 * Generates and downloads an Admin Coupon & Offer Usage Analytics Report PDF.
 */
export function generateCouponAnalyticsReportPdf(params: {
  generatedAt: string;
  filterSummary: string;
  kpis: {
    totalCoupons: number;
    activeCoupons: number;
    scheduledCoupons: number;
    expiredCoupons: number;
    totalRedemptions: number;
    totalDiscountGivenInr: number;
    totalShippingSavedInr: number;
    ordersGeneratedCount: number;
    totalRevenueGeneratedInr: number;
  };
  coupons: Array<{
    code: string;
    name: string;
    campaignName?: string;
    offerType: string;
    discountValue: number;
    effectiveStatus?: string;
    status: string;
    usageCount: number;
    totalUsageLimit?: number | null;
    totalDiscountGiven: number;
    totalRevenueGenerated: number;
  }>;
  redemptions: Array<{
    couponCode: string;
    orderNumber?: string;
    orderId: string;
    customerName?: string;
    customerEmail?: string;
    discountInr: number;
    shippingSavedInr: number;
    finalTotalInr: number;
    redeemedAt: string;
  }>;
}): boolean {
  try {
    const doc = createPdfDocument({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Header Banner (TeqqnoWorld Dark Navy + Orange)
    doc.setFillColor(7, 27, 53);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setFillColor(255, 122, 0);
    doc.rect(0, 32, 210, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text('TEQQNO', 14, 15);
    doc.setTextColor(255, 122, 0);
    doc.text('WORLD', 42, 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('COUPON & OFFER PERFORMANCE REPORT', 196, 14, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated: ${new Date(params.generatedAt).toLocaleString('en-IN')}`, 196, 20, { align: 'right' });
    doc.text(`Filters: ${params.filterSummary || 'All Time / All Campaigns'}`, 14, 24);

    // KPI Summary Strip
    const kpiBoxes = [
      { label: 'Total Coupons', val: String(params.kpis.totalCoupons) },
      { label: 'Active / Scheduled', val: `${params.kpis.activeCoupons} / ${params.kpis.scheduledCoupons}` },
      { label: 'Total Redemptions', val: String(params.kpis.totalRedemptions) },
      { label: 'Discount Given', val: `Rs. ${params.kpis.totalDiscountGivenInr.toLocaleString('en-IN')}` },
      { label: 'Orders Revenue', val: `Rs. ${params.kpis.totalRevenueGeneratedInr.toLocaleString('en-IN')}` },
    ];

    const boxW = 35;
    kpiBoxes.forEach((box, idx) => {
      const x = 14 + idx * 36.8;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, 40, boxW, 18, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(box.label.toUpperCase(), x + 3, 46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(7, 27, 53);
      doc.text(box.val, x + 3, 54);
    });

    // Coupon Performance Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(7, 27, 53);
    doc.text('1. Coupon Portfolio Summary', 14, 67);

    renderAutoTable(doc, {
      startY: 70,
      head: [['Code', 'Campaign / Name', 'Offer', 'Status', 'Uses', 'Discount (INR)', 'Revenue (INR)']],
      body: params.coupons.slice(0, 40).map((c) => [
        c.code,
        `${c.name}${c.campaignName ? ` (${c.campaignName})` : ''}`,
        c.offerType === 'percentage'
          ? `${c.discountValue}%`
          : c.offerType === 'fixed'
          ? `Rs. ${c.discountValue}`
          : 'Free Ship',
        String(c.effectiveStatus || c.status).toUpperCase(),
        c.totalUsageLimit ? `${c.usageCount}/${c.totalUsageLimit}` : String(c.usageCount),
        `Rs. ${Math.round(c.totalDiscountGiven || 0).toLocaleString('en-IN')}`,
        `Rs. ${Math.round(c.totalRevenueGenerated || 0).toLocaleString('en-IN')}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [7, 27, 53], textColor: [255, 255, 255], fontSize: 7.5 },
      styles: { fontSize: 7.2, cellPadding: 2.5 },
      margin: { left: 14, right: 14 },
    });

    const nextY = Math.min(240, (doc.lastAutoTable?.finalY || 130) + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(7, 27, 53);
    doc.text('2. Recent Redemptions Ledger', 14, nextY);

    renderAutoTable(doc, {
      startY: nextY + 3,
      head: [['Date', 'Code', 'Order Ref', 'Customer', 'Discount', 'Order Total']],
      body:
        params.redemptions.length > 0
          ? params.redemptions.slice(0, 50).map((r) => [
              new Date(r.redeemedAt).toLocaleDateString('en-IN'),
              r.couponCode,
              r.orderNumber || r.orderId.slice(0, 12),
              r.customerName || r.customerEmail || 'Guest',
              `Rs. ${Math.round((r.discountInr || 0) + (r.shippingSavedInr || 0)).toLocaleString('en-IN')}`,
              `Rs. ${Math.round(r.finalTotalInr || 0).toLocaleString('en-IN')}`,
            ])
          : [['—', 'No redemptions recorded in selected filter window', '—', '—', '—', '—']],
      theme: 'striped',
      headStyles: { fillColor: [255, 122, 0], textColor: [255, 255, 255], fontSize: 7.5 },
      styles: { fontSize: 7.2, cellPadding: 2.5 },
      margin: { left: 14, right: 14 },
    });

    downloadPdf(doc, `TeqqnoWorld_Coupon_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
  } catch (error) {
    console.error('[Coupon Report PDF Error]:', error);
    return false;
  }
}

