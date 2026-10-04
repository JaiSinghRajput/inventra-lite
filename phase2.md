# Inventra-Lite: Phase 2 Comprehensive Improvement Plan & Roadmap

> **Document Type**: Architecture & Feature Evolution Plan  
> **Target Version**: Inventra-Lite v2.0  
> **Status**: Proposed / Pending Approval  
> **Constraint**: Planning document only — No production code modified during plan creation.

---

## Executive Summary & Gap Analysis

Inventra-Lite v1.0 has established a robust, transactional foundation:
- Multi-tenant data isolation with PostgreSQL and Drizzle ORM.
- Concurrency-safe financial transactions (`FOR UPDATE` row-level locks, server-side idempotency keys, immutable double-entry style ledger trails).
- Responsive POS interface featuring a mobile 3-step checkout wizard and a desktop split-pane layout.
- Direct inventory adjustments and stock-in delivery workflows with custom search and instant product creation.
- Centralized Sonner toast notification system and strict TypeScript compliance.

However, to scale from an agile store-counter prototype into a commercial-grade, multi-counter retail and wholesale operating system, critical operational and compliance capabilities are needed. This document defines the **Phase 2 Improvement Roadmap**, organized into 7 strategic pillars.

---

## Pillar 1: Billing, Taxation & Regulatory Compliance (GST)

### 1.1 Item-Level GST & HSN/SAC Support
- **Current State**: Store-wide flat tax rate applied uniformly across all bill items.
- **Problem**: Modern retail environments (especially in India) require diverse GST tax slabs (0%, 5%, 12%, 18%, 28%) and HSN/SAC codes per product category.
- **Phase 2 Solution**:
  - Add `hsnCode`, `gstRate` (numeric enum: 0, 5, 12, 18, 28), and `taxInclusive` flag to the `products` table.
  - Automatic calculation of **CGST** and **SGST** for intra-state sales, and **IGST** for inter-state sales.
  - Tax-inclusive vs. Tax-exclusive pricing toggle (retailers prefer shelf price inclusive of GST; wholesalers prefer tax-exclusive with GST added at checkout).
  - Detailed GST tax breakdown on the bill receipt (Taxable Amount, CGST %, CGST Amt, SGST %, SGST Amt).

### 1.2 Quotations / Proforma Estimates to Invoicing
- **Current State**: Billing directly creates a finalized financial invoice and immediately deducts stock.
- **Problem**: Retail and service businesses frequently create draft quotations or estimates for customer negotiation before finalizing.
- **Phase 2 Solution**:
  - Introduce `quotes` table with status (`draft`, `sent`, `accepted`, `converted`, `expired`).
  - Allow saving current POS cart as a **Quotation / Estimate** without depleting inventory.
  - 1-click **Convert to Bill** button that imports the quote directly into the POS checkout flow.

### 1.3 Partial Returns & Item-Level Exchanges
- **Current State**: Only entire bill cancellation is supported (`cancelBillFn`), which reverses all items and all payments.
- **Problem**: Customers often want to return or exchange a single damaged or unwanted item out of a multi-item purchase.
- **Phase 2 Solution**:
  - Introduce `creditNotes` and `billReturns` tables.
  - Support partial returns: specify returned item, quantity, restock condition (return to inventory vs. scrap/damaged), and refund method (Cash, UPI, or Store Credit / Khata adjustment).

---

## Pillar 2: Hardware, Thermal Printing & Digital Channels

### 2.1 ESC/POS Thermal Receipt Printing
- **Current State**: Relies on browser standard `window.print()` rendering standard webpage layouts.
- **Problem**: Standard browser print triggers page-break issues, wide margins, and does not suit 58mm (2-inch) or 80mm (3-inch) thermal receipt printers commonly used in POS counters.
- **Phase 2 Solution**:
  - Add dedicated print stylesheets (`@media print`) and monospace ESC/POS formatted receipt layouts for 58mm and 80mm paper widths.
  - Include store header, GSTIN, FSSAI number (if grocery/food), bill number, date/time, itemized table, total savings, and custom return policy footer.
  - Web Bluetooth / Web USB direct printing support for tethered thermal printers (avoiding the browser print preview dialog for sub-second printing).

### 2.2 Dynamic UPI QR Codes on Bill & Screen
- **Current State**: Cashier selects "UPI" and manually inputs reference numbers or confirms payment verbally.
- **Problem**: Cashiers lose time checking manual UPI apps, and customers struggle to scan generic store QR codes and manually type the exact amount.
- **Phase 2 Solution**:
  - Generate dynamic UPI QR codes (`upi://pay?pa=store@upi&pn=StoreName&am=Amount&tn=BillNumber`) on both the POS desktop screen and the printed receipt.
  - Customers scan the QR code using Google Pay, PhonePe, Paytm, or BHIM; the exact bill amount is pre-filled automatically.

### 2.3 1-Click WhatsApp Invoicing
- **Current State**: Customers receive no automatic digital copy unless printed.
- **Problem**: Paper receipts are expensive, environmentally wasteful, and customers frequently lose them.
- **Phase 2 Solution**:
  - Add a **Share via WhatsApp** button on the POS completion screen and bill details page.
  - Automatically formats a polite WhatsApp message with customer name, store name, item count, grand total, and a secure public bill view URL (`/receipt/:idempotencyKey`).

---

## Pillar 3: Advanced Inventory & Supply Chain Management

### 3.1 Batch Tracking & Expiry Dates (FEFO)
- **Current State**: Single consolidated `stockQuantity` per product.
- **Problem**: FMCG, dairy, pharmaceuticals, and packaged goods require tracking batch numbers and expiration dates to prevent selling expired stock.
- **Phase 2 Solution**:
  - Add `product_batches` table: `id`, `productId`, `batchNumber`, `manufacturingDate`, `expiryDate`, `quantity`, `purchasePrice`.
  - First-Expiry-First-Out (FEFO) automatic stock deduction on checkout.
  - Expiry alert dashboard warning staff about items expiring within 30, 60, or 90 days.

### 3.2 Barcode Sticker Generator & Label Printing
- **Current State**: Products have SKU and barcode fields, but there is no utility to generate barcode labels.
- **Problem**: Store owners must purchase external label software to print price tags and barcodes for loose items.
- **Phase 2 Solution**:
  - Integrated Barcode Sticker Studio: Select products and print standard barcode sheets (e.g., 24, 40, or 65 labels per A4 sheet) or 50x25mm single-roll thermal labels.
  - Includes Product Name, MRP, Selling Price, SKU, and Code128 / EAN-13 barcode graphic.

### 3.3 Multi-Unit Packaging & Conversions
- **Current State**: Each product has a single unit (e.g. `unit`, `pcs`, `kg`).
- **Problem**: Wholesalers and retailers buy in bulk (e.g., Box of 24, Sack of 50kg) but sell in smaller units (pieces, loose kg).
- **Phase 2 Solution**:
  - Add `unit_conversions` table (e.g., 1 Box = 24 Pieces, 1 Carton = 12 Boxes).
  - Ability to stock-in as "Boxes" and sell either as "Boxes" or "Pieces" with automated fractional inventory deduction.

### 3.4 Supplier Payables & Purchase Ledgers
- **Current State**: Stock-in records delivery amounts, but there is no tracking of whether the store has paid the supplier.
- **Problem**: Store owners cannot track how much money they owe to different vendors/distributors.
- **Phase 2 Solution**:
  - Introduce Supplier Khata / Payables Ledger mirroring the customer ledger:
    - Purchase Invoice (+ Payable balance)
    - Supplier Payment Voucher (- Payable balance via Bank/Cash/Cheque)
    - Balance overview and overdue payment alerts.

---

## Pillar 4: POS Ergonomics, Cashier Workflow & Offline Capabilities

### 4.1 De-monolithing `pos.tsx`
- **Current State**: `src/app/routes/_auth/pos.tsx` contains ~3,000 lines of code in a single file combining state, mobile steps, desktop dual panels, modals, and hotkeys.
- **Problem**: High maintenance friction, slow IDE hot-reload, and high regression risk.
- **Phase 2 Solution**:
  - Split `pos.tsx` into modular components under `src/features/billing/components/`:
    - `PosCatalogGrid.tsx`: Product browsing, category pills, search bar, stock badges.
    - `PosCartDesktop.tsx` & `PosCartMobileWizard.tsx`: Cart line items, discounts, charges.
    - `PosCustomerSelector.tsx`: Quick customer search & modal.
    - `PosPaymentDialog.tsx`: Multi-tender payment inputs & quick cash buttons.
    - `PosCheckoutSuccessModal.tsx`: Print, WhatsApp, and new bill actions.

### 4.2 Park / Hold Multi-Cart Capability
- **Current State**: If a customer leaves the counter to pick up an extra item, the cashier must either clear the cart or make everyone in queue wait.
- **Problem**: Counter bottlenecks during peak store hours.
- **Phase 2 Solution**:
  - "Hold Cart" feature allowing up to 5 concurrent parked carts in browser session storage / local state.
  - Switch between active carts with a single tap.

### 4.3 Cash Drawer & Daily Register Shift Management
- **Current State**: Cash transactions are logged, but there is no register shift reconciliation.
- **Problem**: Inability to identify cashier theft, cash discrepancies, or register imbalances.
- **Phase 2 Solution**:
  - **Open Shift**: Cashier enters opening cash float (e.g. ₹2,000 in drawer).
  - **Petty Cash Operations**: "Cash-In" / "Cash-Out" for store expenses (e.g. tea, cleaning supplies).
  - **Close Shift (Z-Report)**: Cashier counts physical cash; system compares counted cash vs. system-expected cash (Opening Float + Cash Sales - Cash Out) and records the variance.

### 4.4 Offline-First POS Resilience (PWA + IndexedDB)
- **Current State**: POS queries require live server connection; temporary internet hiccups block billing.
- **Problem**: Retail stores cannot afford billing downtime during internet outages.
- **Phase 2 Solution**:
  - Cache product catalog locally in IndexedDB.
  - Queue completed bills in an offline Outbox when network is disconnected.
  - Background sync pushes queued bills to server as soon as connectivity resumes, leveraging server-side idempotency keys to guarantee zero duplicates.

---

## Pillar 5: Customer Khata, Credit & Loyalty Engine

### 5.1 Standalone Khata Settlement & Payment Vouchers
- **Current State**: Payments can only be recorded against specific bill invoices (`recordSubsequentPaymentFn`).
- **Problem**: Regular customers often deposit lump sums (e.g. ₹5,000 cash) to settle their overall Khata account balance rather than paying against a specific bill.
- **Phase 2 Solution**:
  - Add a **"Record Khata Settlement"** button directly on the Customer Details page (`/customers/$id`).
  - Automatically allocates the payment to the oldest outstanding bills (FIFO) and reduces the customer's total `receivableBalance`.
  - Generates a downloadable / WhatsApp-shareable Payment Receipt.

### 5.2 Customer Credit Limits & Aging Reminders
- **Current State**: Customers can accumulate unbounded debt without limit.
- **Problem**: Retailers face bad-debt risk if cashiers keep extending credit to delinquent customers.
- **Phase 2 Solution**:
  - Add `creditLimit` field to customer accounts.
  - POS warning/blocking if a new credit bill would cause the customer to exceed their credit limit.
  - WhatsApp statement generator: "Dear [Name], your current outstanding balance with [Store] is ₹[Amount]. Please click here to view your statement."

### 5.3 Loyalty Points & Store Credits
- **Phase 2 Solution**:
  - Configurable points engine: e.g., 1 point earned per ₹100 spent.
  - Points redeemable at checkout as a discount (1 point = ₹1).
  - Encourages repeat visits and customer retention.

---

## Pillar 6: Financial Analytics, Profit Margins & Accounting Exports

### 6.1 True Net Profit & Margin Analysis (P&L)
- **Current State**: Analytics show Gross Sales, Collected Cash, and Outstanding Dues.
- **Problem**: Store owners cannot see their actual gross profit margin or net earnings.
- **Phase 2 Solution**:
  - Calculate **COGS (Cost of Goods Sold)** based on purchase cost at the time of sale.
  - Display **Gross Profit** (`Gross Sales - COGS`) and **Profit Margin %**.
  - Track store overhead expenses (Rent, Electricity, Salaries, Miscellaneous) to derive accurate **Net Profit**.

### 6.2 Dead Stock & Inventory Aging Reports
- **Problem**: Working capital is often trapped in unsold inventory that sits on shelves for months.
- **Phase 2 Solution**:
  - Categorize inventory by sales velocity: Fast-moving, Slow-moving, and Dead stock (>90 days without a sale).
  - Highlight dead inventory with discount recommendations to liquidate stock.

### 6.3 Accounting Software Exports (Tally / Excel / CSV)
- **Problem**: Accountants spend hours manually re-entering sales data into Tally or Excel.
- **Phase 2 Solution**:
  - 1-click export of Sales Register, Purchase Register, and Customer Ledger to Excel (.xlsx) and CSV.
  - Standard Tally XML format export for automated Tally ERP / Tally Prime voucher import.

---

## Pillar 7: Architecture, Security & Role-Based Access Control

### 7.1 Granular Role-Based Access Control (RBAC)
- **Current State**: Basic `OWNER` vs `STAFF` roles.
- **Problem**: Store owners do not want junior cashiers seeing store purchase costs, net profit margins, or deleting customers.
- **Phase 2 Solution**:
  - Granular permissions:
    - `Cashier`: Can only access POS, search items, and create bills. Cannot see purchase costs or profit reports.
    - `Store Manager`: Can adjust stock, receive purchases, view inventory, manage customers.
    - `Accountant`: Can view financial reports, ledgers, and export tax summaries.
    - `Owner / Admin`: Full administrative access.

### 7.2 Database Indexing & High-Volume Optimization
- **Phase 2 Solution**:
  - Add composite index on `bills (tenant_id, status, created_at)` for high-speed date-range report generation.
  - Add composite index on `stock_movements (tenant_id, product_id, created_at)` for rapid ledger history rendering.
  - Paginated cursor loaders for customer and bill lists once tenant volume exceeds 10,000 records.

---

## Phased Implementation Roadmap & Priorities

| Priority | Feature / Module | Complexity | Impact |
| :--- | :--- | :---: | :---: |
| **P0 (Immediate)** | **Component Refactor**: Split monolithic `pos.tsx` into modular components | Medium | High (Maintainability & Dev Speed) |
| **P0 (Immediate)** | **Customer Khata Settlement**: Direct lump-sum payment on Customer Detail page | Low | High (Cash Flow & User Request) |
| **P0 (Immediate)** | **ESC/POS Thermal Printing**: Dedicated 58mm / 80mm receipt templates | Low | High (Everyday Store Operation) |
| **P1 (Core)** | **GST & Tax Engine**: Product-level GST %, HSN codes, and tax breakdown | Medium | High (Statutory Compliance) |
| **P1 (Core)** | **WhatsApp Invoicing & UPI QR**: Dynamic QR on receipts + WhatsApp bill link | Low | High (Customer Delight & Speed) |
| **P1 (Core)** | **Supplier Payables Ledger**: Vendor credit & payment tracking on Purchases | Medium | High (Financial Visibility) |
| **P2 (Advanced)** | **Register Shift Management**: Cash drawer float open/close and Z-Report | Medium | Medium (Cashier Accountability) |
| **P2 (Advanced)** | **Barcode Label Generator**: Thermal sticker printing studio | Low | Medium (Store Workflow) |
| **P2 (Advanced)** | **P&L & Margin Analytics**: COGS, Net Profit, and Expense tracking | Medium | High (Business Intelligence) |
| **P3 (Scale)** | **Batch & Expiry Tracking (FEFO)**: Multi-batch stock management | High | High (Specialized Retailers) |
| **P3 (Scale)** | **Offline-First PWA Sync**: IndexedDB catalog caching and outbox sync | High | High (Zero-Downtime Guarantee) |
| **P3 (Scale)** | **Granular RBAC**: Manager, Cashier, Accountant permission scopes | Medium | Medium (Enterprise Readiness) |

---

## Summary of Proposed Database Schema Changes (Phase 2)

```sql
-- 1. Product Enhancements
ALTER TABLE products ADD COLUMN hsn_code VARCHAR(10);
ALTER TABLE products ADD COLUMN gst_rate NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN is_tax_inclusive BOOLEAN DEFAULT TRUE;

-- 2. Customer Credit Control
ALTER TABLE customers ADD COLUMN credit_limit BIGINT DEFAULT 0;

-- 3. Supplier Payables
ALTER TABLE suppliers ADD COLUMN payable_balance BIGINT DEFAULT 0;

CREATE TABLE supplier_ledger_entries (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
  supplier_id VARCHAR(36) NOT NULL REFERENCES suppliers(id),
  entry_type VARCHAR(20) NOT NULL, -- 'purchase_bill', 'payment_made', 'adjustment'
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  purchase_id VARCHAR(36),
  reference_note VARCHAR(255),
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Register Shift Management
CREATE TABLE register_shifts (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
  user_id VARCHAR(36) NOT NULL REFERENCES user(id),
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  opening_float BIGINT NOT NULL DEFAULT 0,
  expected_cash BIGINT,
  actual_cash BIGINT,
  variance BIGINT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' -- 'open', 'closed'
);

-- 5. Product Batches (Optional / FMCG)
CREATE TABLE product_batches (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
  product_id VARCHAR(36) NOT NULL REFERENCES products(id),
  batch_number VARCHAR(50) NOT NULL,
  expiry_date DATE,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  purchase_price BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

*This document serves as the roadmap for Phase 2 implementation. Features can be prioritized and scheduled based on user feedback.*
