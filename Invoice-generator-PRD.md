# PRD: EVZIP Bulk Invoice PDF Generator Web App

## 1. Overview
A web app that takes EVZIP rides data from an Excel file and generates bulk invoices as **individual PDF files**, then bundles them into a single downloadable **ZIP**. Built for fast, error-tolerant bulk processing with a consistent EVZIP invoice layout.

## 2. Goals
- Generate **one PDF invoice per ride row** from an Excel sheet.
- Automatically name invoice PDFs using invoice number mentioned in excel sheet.
- Allow users to download all invoices as a **single ZIP**.
- Provide a professional, consistent invoice layout with EVZIP branding.

## 3. Non-Goals
- Accounting system features (ledger, GST filing, reconciliation).
- Payment collection or online payment integration.
- Multi-user roles/permissions in V1.
- Automatic emailing invoices in V1 (planned for V2).

## 4. Target Users
- EVZIP finance/accounts team
- Operations/admin staff generating invoices for customers and partners

## 5. Key Use Cases
1. User uploads an Excel sheet for a date range.
2. User previews rows and confirms data mapping.
3. User generates invoices.
4. App generates **individual PDFs + one ZIP download**.
5. App provides a clear failure report for rows that couldn’t be processed.

## 6. Success Metrics
- 95%+ invoice generation success rate for correctly formatted files.
- Runtime targets:
  - Up to 500 rides: under ~2 minutes on a standard laptop
  - Up to 2000 rides: under ~10 minutes (hardware dependent)
- Minimal manual intervention (only mapping when headers differ).
- Near-zero filename collisions.

## 7. Assumptions
- Excel data follows a predictable structure.
- Each ride has a unique identifier used as `invoice_no` or `ride_id`.
- A standard EVZIP invoice template exists and is acceptable for V1.
- GST is required depending on EVZIP invoicing rules.

---

## 8. Scope

### 8.1 V1 Must Have
- Upload Excel (`.xlsx`)
- Validate required columns and value formats
- Preview data (first 20–50 rows)
- Generate PDFs (1 per row)
- Download ZIP bundle
- Invoice template with EVZIP branding
- Error report for failed rows (with reason)

### 8.2 V1 Should Have
- Column mapping UI (if column headers differ)
- Toggle: include/exclude GST block
- Multiple templates (B2B, B2C, subscription, rentals)

---

## 9. User Stories
- As an accounts user, I want to upload Excel and confirm the data is recognized, so I don’t generate wrong invoices.
- As an admin, I want one invoice per ride as a PDF, so I can share invoices individually.
- As a user, I want one ZIP download, so I can download everything in one click.
- As a user, I want failed rows reported clearly, so I can fix Excel and rerun.
- As an admin, I want consistent EVZIP branding on all invoices.

---

## 10. Functional Requirements

### 10.1 Upload & Data Intake
- Accept `.xlsx` files only (V1).
- Configurable max file size (default 10–25 MB).
- Read first sheet by default (should have: allow sheet selection).
- Auto-detect headers from first row.

### 10.2 Validation
**Required columns (default expectation):**
- `invoice_no`
- `invoice_date`
- `customer_name`
- `pickup_address`
- `drop_address`
- `net_fare`
- `CGST`
- `SGST`
- `total_fare`

**Validation rules:**
- Missing required fields → row fails
- Invalid dates → row fails
- Non-numeric fields in `fare`, `total_amount` → row fails
- Total mismatch (fare + gst vs total) → warning (not blocking) unless configured

### 10.3 Preview
- Show detected columns
- Show preview table (first 20–50 rows)
- Show total row count
- Show warnings/errors summary before generation

### 10.4 Invoice Template + PDF Generation
- Use a single HTML/CSS invoice template (V1).
- For each row, render:
  - EVZIP header (logo, address, contact)
  - Invoice number and invoice date
  - Customer details
  - Ride details (pickup, drop, date/time)
  - Charges breakdown (fare, GST block if enabled, total)
  - Footer notes/terms

**PDF requirements:**
- A4 page size
- Print-ready
- Consistent spacing and alignment


### 10.5 ZIP Packaging
- Bundle all generated PDFs into one ZIP:
  - `EVZIP_Invoices_<YYYY-MM-DD>_<batchId>.zip`
- Provide ZIP download to the browser.

### 10.6 Error Handling
- If a row fails, continue processing other rows.
- Include a `failed_rows.csv` in the ZIP with:
  - row index
  - invoice_no/ride_id
  - failure reason
  - key fields (optional) for debugging
- UI must show:
  - success count
  - fail count
  - link to download ZIP

---

## 11. Invoice Naming Rules
Default filename format:
- `EVZIP_INV_<invoice_no>.pdf`


Sanitization:
- Remove special characters
- Replace spaces with underscores
- Truncate long filenames to safe length

Collision handling:
- If filename already exists, append `_1`, `_2`, etc.

---

## 12. UX Requirements
Single-page flow:
1. Upload
2. Preview + mapping + settings
3. Generate
4. Download ZIP + error report

UI elements:
- Upload control
- Sheet selector (should have)
- Column mapping dropdowns (should have)
- Toggle GST on/off
- Generate button
- Progress indicator: `x / y invoices generated`
- Result summary with download button

---

## 13. Performance Requirements
- Must support at least 500 rows per run.
- Should support 2000 rows per run (hardware dependent).
- Prefer streaming ZIP download (optional); otherwise generate then download.
- download in batches if total no of invoices are more than 500 
---

## 14. Security & Data Handling
- Uploaded Excel and generated PDFs stored temporarily.
- Auto-delete files after download or after TTL (30–60 minutes).
- Avoid logging PII in plain text.
- If deployed on a shared/internal server: add basic password protection (should have).

---

## 15. Recommended Implementation (V1)
- Backend: Node.js + Express
- Excel parsing: `xlsx`
- Templating: `ejs` or `handlebars`
- PDF: `puppeteer` (HTML-to-PDF)
- ZIP: `archiver`
- Frontend: HTML + Bootstrap (or React in V2)

---

## 16. Dependencies
- Final invoice layout requirements (logo, address, footer notes, GSTIN)
- Sample Excel file and confirmed headers
- GST rules (always/conditional)
- Invoice numbering approach (provided in Excel vs app-generated)

---

## 17. Edge Cases
- Duplicate invoice numbers → apply collision suffix
- Missing total → compute if possible (fare + gst) else fail
- Very long names → wrap in invoice, truncate in filename
- Empty required columns → fail row, continue batch

---

## 18. QA / Acceptance Tests
- Valid Excel (10 rows) → 10 PDFs + ZIP download
- Missing required column → clear blocking error before generation
- Mixed valid/invalid rows → valid PDFs generated + failed_rows.csv included
- Special characters in names → sanitized filenames
- Large Excel (500+ rows) → completes without crash, shows progress

---

## 19. Future Roadmap (V2+)
- Email invoices automatically (SMTP/Outlook)
- Batch history and rerun failed-only
- Multiple templates by invoice type
- Auto invoice numbering rules with prefixes
- Login + permissions + audit trail

---

## 20. Open Questions
- One invoice per ride (default) or consolidated monthly per customer?
one invoice per ride
- Is GST always included or conditional?
yes it should be included
- Will `invoice_no` be present in Excel, or should app generate it?
yes, present in excel
- What exact EVZIP “Bill From” details should appear (address, GSTIN, contact)?
EVZIP Mobility Private Limited, Plot 8B, Godavari Gardens, Generals Road,Yapral, Secunderabad, Telangana–500087, GSTIN: 36AAHCE7709C1ZQ
- Should the invoice footer include ISO 9001:2015 certification line?
yes footer should have below content:
EVZIP Mobility Pvt. Ltd. | ISO 9001:2015 Certified | Startup India Recognised
www.evzip.in

