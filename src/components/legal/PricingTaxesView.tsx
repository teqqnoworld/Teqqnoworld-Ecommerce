import React from 'react';
import { LegalLayout, MerchantPlaceholderNotice } from './LegalLayout';
import { BUSINESS_DETAILS } from '../../data/legalData';
import { BUSINESS_CONFIG } from '../../config/business';
import { Percent, FileText, CheckCircle2, Calculator, ShieldCheck } from 'lucide-react';

interface LegalViewProps {
  onNavigate: (route: string) => void;
}

export const PricingTaxesView: React.FC<LegalViewProps> = ({ onNavigate }) => {
  const toc = [
    { id: 'pricing-structure', title: '1. Transparent Pricing Structure' },
    { id: 'volume-tier-slabs', title: '2. Volume-Tiered Bulk Pricing' },
    { id: 'gst-classification', title: '3. GST Classification & SAC Codes' },
    { id: 'b2b-itc-credit', title: '4. B2B Input Tax Credit (ITC) Claims' },
    { id: 'tax-breakdown-rules', title: '5. CGST, SGST & IGST Distribution' },
    { id: 'quotations-rfqs', title: '6. Enterprise Custom Quotations (RFQ)' },
    { id: 'tax-support', title: '7. Accounts & Invoicing Helpdesk' },
  ];

  return (
    <LegalLayout
      currentRoute="/pricing-and-taxes"
      title="Pricing, Taxes and GST Information"
      description="Clear guidance on base prices, volume tiered bulk discounts, SAC 9989 classification, 18% GST itemization, and B2B Input Tax Credit (ITC) documentation."
      lastUpdated="October 25, 2026"
      tableOfContents={toc}
      onNavigate={onNavigate}
    >
      <div className="space-y-8 text-slate-700">
        
        {/* Merchant Review Box */}
        <MerchantPlaceholderNotice
          title="GST & Tax Registration Details"
          items={[
            `Official Company GSTIN: ${BUSINESS_DETAILS.gstinPlaceholder}`,
            `State of Registration: ${BUSINESS_CONFIG.legal.gstState} (State Code ${BUSINESS_CONFIG.legal.gstStateCode})`,
            `Principal Place of Business (GST): ${BUSINESS_CONFIG.legal.gstPrincipalPlaceOfBusiness}`,
            `Confirm e-invoicing compliance eligibility (for turnover > statutory limits)`,
          ]}
        />

        {/* 1. Pricing Structure */}
        <section id="pricing-structure">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
            1. Transparent Pricing Structure
          </h2>
          <p className="mb-3">
            TeqqnoWorld operates a factory-direct pricing model for corporate merchandise. Our catalog displays wholesale pricing with zero hidden prepress or plate-making surcharges:
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-3 text-xs sm:text-sm">
            <li>
              <strong>Base Catalog Prices:</strong> Catalog product prices are quoted in Indian National Rupees (INR) and are listed <em>exclusive of applicable Goods and Services Tax (GST)</em>, unless explicitly marked as tax-inclusive.
            </li>
            <li>
              <strong>All-Inclusive Customization:</strong> Standard catalog base pricing includes single-placement primary branding (e.g. standard left chest embroidery or DTF logo print on apparel, or single-position laser marking on drinkware). Additional print placements (e.g., sleeve prints, back neck nape prints) are priced transparently in our customizer studio.
            </li>
            <li>
              <strong>Itemized Checkout Summary:</strong> Before you authorize payment, your cart details: (1) Merchandise Subtotal, (2) Applicable Volume Discount, (3) Courier Logistics, and (4) Exact 18% GST.
            </li>
          </ul>
        </section>

        {/* 2. Volume Tiers */}
        <section id="volume-tier-slabs">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
            2. Volume-Tiered Bulk Pricing
          </h2>
          <p className="mb-3">
            We reward corporate batch orders with automatic factory volume discounts. Discounts are computed dynamically right on each product page and cart:
          </p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-100 font-bold text-slate-900">
                <tr>
                  <th className="p-3">Order Quantity Slab</th>
                  <th className="p-3">Discount Range</th>
                  <th className="p-3">Ideal For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Sample / Pilot (2 to 24 units)</td>
                  <td className="p-3">Base Wholesale Rate</td>
                  <td className="p-3">Initial sample evaluation & executive fitting</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Tier 1: Team Batch (25 to 49 units)</td>
                  <td className="p-3 text-[#FF7A00] font-bold">10% to 15% Volume Rebate</td>
                  <td className="p-3">Department hackathons, offsites & startup teams</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Tier 2: Division Scale (50 to 99 units)</td>
                  <td className="p-3 text-[#FF7A00] font-bold">18% to 25% Volume Rebate</td>
                  <td className="p-3">Quarterly onboarding kits & corporate gifting</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Tier 3: Enterprise Scale (100 to 499 units)</td>
                  <td className="p-3 text-[#FF7A00] font-bold">28% to 35% Factory Rebate</td>
                  <td className="p-3">Annual general meetings & tech conferences</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Tier 4: Enterprise Mass (500+ units)</td>
                  <td className="p-3 text-[#FF7A00] font-bold">Up to 40% Custom Quote</td>
                  <td className="p-3">Custom spun yarn, custom pantone dip dyes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. GST Classification */}
        <section id="gst-classification">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
            3. GST Classification & Service Accounting Codes (SAC)
          </h2>
          <p className="mb-3">
            In accordance with notification issued under the Central Goods and Services Tax Act, 2017:
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 mb-3">
            <p className="font-semibold text-slate-900">Primary SAC Code: 9989</p>
            <p className="text-slate-600">
              Covers <em>&ldquo;Other manufacturing services; publishing, printing and reproduction services&rdquo;</em> applicable to customized corporate apparel, promotional gift items, branded stationery, and packaging printing.
            </p>
            <p className="text-slate-600">
              <strong>Applicable Tax Rate:</strong> 18% GST (Standard composite supply rate for corporate print customization services).
            </p>
          </div>
        </section>

        {/* 4. B2B ITC Credit */}
        <section id="b2b-itc-credit">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
            4. B2B Input Tax Credit (ITC) Documentation
          </h2>
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 text-xs text-emerald-950 mb-3 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>100% Eligible for Business Expense & ITC Offset</span>
            </div>
            <p className="leading-relaxed">
              Every B2B order receives an authentic, digitally authenticated Tax Invoice displaying your company name, full billing address, and 15-digit GSTIN. Our accounts team uploads all taxable invoices to the GST Portal in our monthly GSTR-1 filings, ensuring the credit populates seamlessly in your <strong>GSTR-2B statement</strong> for 18% Input Tax Credit offset.
            </p>
          </div>
          <p className="text-xs text-slate-600">
            <strong>Buyer Duty:</strong> Please verify that the 15-digit GSTIN submitted during checkout is active and exactly matches your entity’s legal registration name on the GST Common Portal.
          </p>
        </section>

        {/* 5. CGST/SGST vs IGST */}
        <section id="tax-breakdown-rules">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
            5. Intra-State vs. Inter-State Tax Distribution
          </h2>
          <p className="mb-2">Tax is computed according to the Place of Supply rules under the Integrated Goods and Services Tax Act, 2017:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 mb-3">
            <li>
              <strong>Intra-State Deliveries (Within Telangana — State Code 36):</strong> Charged as <strong>9% CGST + 9% SGST</strong>.
            </li>
            <li>
              <strong>Inter-State Deliveries (All Other Indian States & UTs):</strong> Charged as <strong>18% IGST</strong>.
            </li>
          </ul>
        </section>

        {/* 6. RFQs */}
        <section id="quotations-rfqs">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
            6. Enterprise Custom Quotations (RFQ) & Price Validity
          </h2>
          <p className="mb-3">
            For specialized procurement requests involving custom PMS fabric weaving, custom mold tooling, or multi-location dispatches:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 mb-3">
            <li>Our corporate sales desk issues an official written Request For Quotation (RFQ) proforma.</li>
            <li>Quoted prices remain valid for thirty (30) calendar days from issuance date.</li>
            <li>Payment terms, delivery milestones, and volume-tiered rate freezes are documented on the accepted purchase schedule.</li>
          </ul>
        </section>

        {/* 7. Support */}
        <section id="tax-support">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
            7. Accounts & Tax Invoicing Helpdesk
          </h2>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <p>
              <strong>Accounts & Billing Inquiries:</strong>{' '}
              <a href={BUSINESS_CONFIG.contact.secondaryMailtoLink} className="text-[#FF7A00] underline">{BUSINESS_CONFIG.contact.secondaryEmail}</a>
              {' / '}
              <a href={`mailto:${BUSINESS_DETAILS.supportEmail}`} className="text-[#FF7A00] underline">{BUSINESS_DETAILS.supportEmail}</a>
            </p>
            <p><strong>Tax Invoice Corrections:</strong> Provide Order Number and revised GSTIN within 7 days of invoice generation.</p>
            <p><strong>Desk Hours:</strong> {BUSINESS_DETAILS.supportHours}</p>
          </div>
        </section>

      </div>
    </LegalLayout>
  );
};
