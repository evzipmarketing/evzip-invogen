# EVZIP Bulk Invoice Generator — Project Implementation Steps

Based on the PRD, here is a phased implementation plan.

**Target stack**: Progressive Web App (PWA) + Next.js, deployed via **GitHub** + **Render** (recommended) or Vercel.

---

## Deployment: Vercel vs Render (Free Tier)

| Constraint | Vercel (Free) | Render (Free) |
|------------|---------------|---------------|
| **Request timeout** | 10 seconds | **No hard limit** — long requests (2–10 min) work |
| **Request body size** | 4.5 MB | **Larger** — normal server, no strict limit |
| **Persistent disk** | None | Ephemeral (per-request `/tmp` OK) |
| **Puppeteer** | Heavy, cold starts | **Full Node.js** — Puppeteer works |
| **Auto-deploy** | ✅ GitHub | ✅ GitHub |
| **HTTPS** | ✅ | ✅ |
| **Spin down** | N/A (serverless) | 15 min idle → ~1 min cold start |
| **Monthly hours** | Unlimited* | 750 hours/month |

**Recommendation**: Use **Render** for this app. Vercel’s 10s timeout and 4.5 MB limit conflict with the PRD (500 rows in ~2 min, Excel up to 25 MB). Render’s free tier supports long-running requests and Puppeteer without those limits.

---

## Architecture Overview: PWA + Render (Recommended)

| Aspect | Choice | Notes |
|--------|--------|-------|
| **Framework** | Next.js or Express | Both work on Render |
| **Hosting** | **Render** | Free web service, GitHub auto-deploy |
| **PWA** | manifest + service worker | Installable, offline shell |
| **PDF** | **Puppeteer** | Full HTML→PDF, no serverless hacks |
| **File storage** | In-memory + `/tmp` during request | Parse → PDF → ZIP → stream response |
| **Request size** | Up to ~25 MB | No 4.5 MB cap |
| **Execution time** | 2–10 min for 500–2000 rows | No timeout |

---

## Phase 1: Project Setup & Foundation

### Step 1.1: Initialize Project
- [ ] Create Node.js project with `package.json`
- [ ] **Framework**: Next.js (works on both Render and Vercel) or Express
- [ ] Set up folder structure:
  ```
  /app (or /pages)
    /api          # API routes
    /page.tsx     # Main app
  /components
  /lib
    /services
    /utils
  /public
    /icons        # PWA icons
    EVZIP_logo.svg  # from assets/logo/ — copy for web serving
    manifest.json
  ```
- [ ] Add `.gitignore` for `node_modules`, `.env`, `.vercel`, `uploads`, `output`

### Step 1.2: Install Dependencies
- [ ] **Framework**: Next.js
- [ ] **Excel**: `xlsx` (SheetJS)
- [ ] **PDF**: `puppeteer` (Render) — full HTML→PDF, no constraints
- [ ] **ZIP**: `archiver`
- [ ] **Validation**: `zod` or `joi`
- [ ] **PWA**: `next-pwa` or manual service worker + manifest

### Step 1.3: Environment & Config
- [ ] Create `.env.example` with:
  - `MAX_FILE_SIZE_MB` (default 25)
  - `UPLOAD_TTL_MINUTES` (30–60)
- [ ] Add `render.yaml` for Render (optional Blueprint) or rely on auto-detect

---

## Phase 2: Backend Core — Upload & Excel Parsing

### Step 2.1: Upload Endpoint
- [ ] Create `app/api/upload/route.ts` (Next.js App Router) or `pages/api/upload.ts`
- [ ] Accept `.xlsx` only; reject other formats
- [ ] Enforce max file size (10–25 MB configurable)
- [ ] **Render**: Process in-memory; use `/tmp` for PDF generation during request
- [ ] Return: `{ fileId, sheetNames, rows }` or parse immediately and return data

### Step 2.2: Excel Parsing Service
- [ ] Use `xlsx` to read workbook
- [ ] Read first sheet by default; support sheet selection
- [ ] Auto-detect headers from first row
- [ ] Return raw rows + detected column names
- [ ] Handle encoding and empty cells

### Step 2.3: Column Mapping
- [ ] Define default expected columns:
  - `invoice_no`, `invoice_date`, `customer_name`
  - `pickup_address`, `drop_address`
  - `net_fare`, `CGST`, `SGST`, `total_fare`
- [ ] Build mapping: `{ excelHeader → standardField }`
- [ ] Support custom mapping when headers differ (V1 Should Have)

---

## Phase 3: Validation & Preview

### Step 3.1: Validation Service
- [ ] Validate required columns exist (mapped or default)
- [ ] Per-row validation:
  - Missing required fields → fail row
  - Invalid dates → fail row
  - Non-numeric in `net_fare`, `CGST`, `SGST`, `total_fare` → fail row
  - Total mismatch (fare + GST vs total) → warning only (configurable)
- [ ] Return: `{ validRows, invalidRows, warnings }`

### Step 3.2: Preview API
- [ ] Create GET/POST `/api/preview` (or use upload response)
- [ ] Return:
  - Detected/mapped columns
  - First 20–50 rows for preview table
  - Total row count
  - Validation summary (errors, warnings)
- [ ] Support optional column mapping in request

---

## Phase 4: Invoice Template & PDF Generation

### Step 4.1: Invoice HTML Template
- [ ] Create EJS/Handlebars template with:
  - **Design reference**: `assets/EVZIP_INV_EZ25112001.pdf`
  - **Header**: EVZIP logo — use `assets/logo/EVZIP_logo.svg` (copy to `public/` for serving, or inline SVG in template for PDF)
  - **Bill From**: EVZIP Mobility Private Limited, Plot 8B, Godavari Gardens, Generals Road, Yapral, Secunderabad, Telangana–500087, GSTIN: 36AAHCE7709C1ZQ
  - **Invoice meta**: invoice_no, invoice_date
  - **Customer details**: customer_name
  - **Ride details**: pickup_address, drop_address
  - **Charges**: net_fare, CGST, SGST, total_fare
  - **Footer**: EVZIP Mobility Pvt. Ltd. | ISO 9001:2015 Certified | Startup India Recognised | www.evzip.in
- [ ] A4 page size, print-ready CSS
- [ ] Toggle: include/exclude GST block (V1 Should Have)

### Step 4.2: PDF Generation Service
- [ ] Use **Puppeteer** — full HTML→PDF, works on Render (no timeout)
- [ ] One PDF per valid row
- [ ] Filename format: `EVZIP_INV_<invoice_no>_<invoice_date>.pdf`
- [ ] Sanitize filenames: remove special chars, spaces → underscores, truncate
- [ ] Collision handling: append `_1`, `_2` if duplicate
- [ ] Write PDFs to `/tmp` during request; stream into ZIP

### Step 4.3: Batch Processing
- [ ] For 500+ invoices: process in batches (e.g., 100 at a time) within single request
- [ ] Expose progress: `x / y invoices generated` via Server-Sent Events (SSE) or chunked transfer
- [ ] Render: no 10s/60s limit — full 2–10 min run supported

---

## Phase 5: ZIP Packaging & Download

### Step 5.1: ZIP Service
- [ ] Use `archiver` to create ZIP
- [ ] Add all generated PDFs to ZIP (from `/tmp` or in-memory)
- [ ] Add `failed_rows.csv` if any rows failed (row index, invoice_no, reason, key fields)
- [ ] ZIP name: `EVZIP_Invoices_<YYYY-MM-DD>_<batchId>.zip`
- [ ] Stream ZIP directly to response (no persistent storage needed)

### Step 5.2: Download Endpoint
- [ ] POST `/api/generate` — accepts Excel/rows, returns ZIP stream in same response
- [ ] Set headers: `Content-Disposition: attachment; filename="EVZIP_Invoices_..."`
- [ ] Stream ZIP to response body

---

## Phase 6: Error Handling & Reporting

### Step 6.1: Per-Row Error Handling
- [ ] On row failure: log reason, continue with other rows
- [ ] Collect failed rows: `{ rowIndex, invoice_no, reason, fields }`
- [ ] Generate `failed_rows.csv` and include in ZIP

### Step 6.2: Result Summary
- [ ] Return to UI:
  - `successCount`
  - `failCount`
  - `downloadUrl` or `batchId` for ZIP
  - List of failed rows (optional)

---

## Phase 7: Frontend (Single-Page Flow)

### Step 7.1: Page Structure
- [ ] Single-page app: Upload → Preview → Generate → Download
- [ ] Use HTML + Bootstrap (or React in V2)
- [ ] Responsive layout for accounts/admin use

### Step 7.2: Upload Section
- [ ] File input: accept `.xlsx`
- [ ] Show file name, size after selection
- [ ] Sheet selector dropdown (V1 Should Have)
- [ ] Upload button → call `/api/upload`

### Step 7.3: Preview Section
- [ ] Table: first 20–50 rows
- [ ] Column mapping dropdowns (if headers differ)
- [ ] Toggle: GST on/off
- [ ] Total row count, validation summary (errors/warnings)
- [ ] Generate button

### Step 7.4: Generate & Download Section
- [ ] Progress indicator: `x / y invoices generated`
- [ ] Result summary: success count, fail count
- [ ] Download ZIP button
- [ ] Optional: show failed rows list

---

## Phase 7.5: Progressive Web App (PWA)

### Step 7.5.1: Web App Manifest
- [ ] Create `public/manifest.json`:
  - `name`, `short_name`: "EVZIP Invoice Generator"
  - `description`: "Bulk invoice PDF generator for EVZIP rides"
  - `start_url`: `/`
  - `display`: `standalone` or `minimal-ui`
  - `theme_color`, `background_color`
  - `icons`: 192x192, 512x512 (and optional 144, 384)
- [ ] Add `<link rel="manifest">` in HTML head
- [ ] Add meta tags: `theme-color`, `apple-mobile-web-app-capable`

### Step 7.5.2: Service Worker
- [ ] Use `next-pwa` (with `workbox`) or custom service worker
- [ ] Cache static assets (JS, CSS, icons) for offline shell
- [ ] Cache-first for app shell; network-first for API calls
- [ ] Register service worker in app entry

### Step 7.5.3: Installability
- [ ] Add install prompt (optional "Add to Home Screen" button)
- [ ] Ensure HTTPS (Vercel provides this)
- [ ] Test install on Android (Chrome) and iOS (Safari Add to Home Screen)

### Step 7.5.4: PWA Icons
- [ ] Create favicon and app icons (192x192, 512x512)
- [ ] Place in `public/icons/` or `public/`

---

## Phase 8: Security & Data Handling

### Step 8.1: Temp File Management
- [ ] **Render**: Ephemeral `/tmp` — use during request for PDF generation, then stream ZIP
- [ ] No persistent storage; process upload → parse → PDF → ZIP → response in one flow
- [ ] Auto-cleanup: `/tmp` cleared when request ends

### Step 8.2: Security
- [ ] Avoid logging PII in plain text
- [ ] Basic password protection for shared/internal deployment (V1 Should Have)
- [ ] Validate file type and size server-side

---

## Phase 9: Testing & QA

### Step 9.1: Unit Tests
- [ ] Validation logic
- [ ] Filename sanitization
- [ ] Column mapping

### Step 9.2: Integration Tests
- [ ] Valid Excel (10 rows) → 10 PDFs + ZIP
- [ ] Missing required column → blocking error
- [ ] Mixed valid/invalid rows → valid PDFs + failed_rows.csv
- [ ] Special characters in names → sanitized filenames

### Step 9.3: Performance Tests
- [ ] 500 rows → completes in ~2 min
- [ ] 2000 rows → completes in ~10 min (hardware dependent)

---

## Phase 10: GitHub & Deployment

### Step 10.1: GitHub Setup
- [ ] Initialize git: `git init`
- [ ] Create `.gitignore` (node_modules, .env, .vercel, uploads, output)
- [ ] Create GitHub repo (e.g. `evzip-invoice-generator`)
- [ ] Push code: `git add .`, `git commit`, `git push origin main`

---

### Option A: Render (Recommended — Free, No Timeout)

### Step 10.2a: Render Setup
- [ ] Sign in to [render.com](https://render.com) with GitHub
- [ ] New → **Web Service** → connect GitHub repo
- [ ] Configure:
  - **Instance type**: **Free**
  - Build command: `npm install && npm run build` (or `npx prisma generate` if used)
  - Start command: `npm start` or `node server.js`
  - Root directory: `.`
- [ ] Add environment variables in Render dashboard (from `.env.example`)
- [ ] Deploy

### Step 10.3a: Render Notes
- [ ] **Puppeteer on Render**: Add buildpack or ensure Chromium dependencies; may need `puppeteer` with `executablePath` or `@sparticuz/chromium` for Render's Linux env
- [ ] **No request timeout** — 2–10 min runs supported
- [ ] Spin down after 15 min idle; first request after idle may take ~1 min (cold start)
- [ ] 750 free hours/month

### Step 10.4a: Auto-Deploy
- [ ] Render auto-deploys on push to `main`
- [ ] Custom domain: add in Render dashboard (free)

---

### Option B: Vercel (Alternative — Has Constraints)

### Step 10.2b: Vercel Setup
- [ ] Sign in to [vercel.com](https://vercel.com) with GitHub
- [ ] Import project → select repo → deploy
- [ ] **Limitations**: 10s timeout (hobby), 4.5 MB request body — requires client-side batching and smaller uploads

### Step 10.5: Documentation
- [ ] README: setup, run, usage, deploy instructions (Render + Vercel)
- [ ] Sample Excel structure and expected headers
- [ ] PWA install instructions for users

### Other Free Options (if Render doesn't fit)
| Platform | Free tier | Notes |
|----------|-----------|-------|
| **Fly.io** | $5 credit/month (recurring) | Full VMs, no timeout; requires card |
| **Railway** | $5 trial, then ~$1/mo min | Good for Node + Puppeteer; pay-as-you-go |
| **Koyeb** | Free tier | Check current limits |

---

## Implementation Order Summary

| Order | Phase | Key Deliverable |
|-------|-------|-----------------|
| 1 | Setup | Next.js project, deps, config |
| 2 | Upload & Parse | Excel upload, parsing, column mapping |
| 3 | Validation & Preview | Validation service, preview API |
| 4 | Template & PDF | Invoice template, PDF generation (serverless-compatible) |
| 5 | ZIP & Download | Archiver ZIP, download endpoint |
| 6 | Error Handling | failed_rows.csv, result summary |
| 7 | Frontend | Single-page UI (upload, preview, generate, download) |
| 7.5 | PWA | manifest.json, service worker, icons, installable |
| 8 | Security | Temp cleanup, optional auth |
| 9 | Testing | Unit, integration, performance |
| 10 | Deploy | GitHub repo, Render (recommended) or Vercel, auto-deploy |

---

## Dependencies to Resolve (from PRD §16)

Before or during implementation:
- [x] Final invoice layout (logo: `assets/logo/EVZIP_logo.svg` ✓)
- [x] Sample invoice PDF (`assets/EVZIP_INV_EZ25112001.pdf` ✓)
- [ ] Sample Excel file with confirmed headers
- [ ] GST rules confirmation (always included per Open Questions)
- [ ] Invoice numbering: provided in Excel ✓

---

## Success Criteria (from PRD §6)

- 95%+ success rate for correctly formatted files
- 500 rides: &lt; ~2 min
- 2000 rides: &lt; ~10 min
- Minimal manual intervention
- Near-zero filename collisions
