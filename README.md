# EVZIP Invoice Generator

Bulk invoice PDF generator for EVZIP rides. Upload an Excel file and generate individual PDF invoices bundled in a ZIP.

## Features

- Upload `.xlsx` files (up to 25 MB)
- Auto-detect columns and validate data
- Preview rows before generation
- Generate one PDF per valid row
- Download all invoices as a single ZIP
- Failed rows reported in `failed_rows.csv` (included in ZIP)

## Required Excel Columns

| Column       | Description    |
|-------------|----------------|
| invoice_no  | Invoice number |
| invoice_date| Date (YYYY-MM-DD or DD/MM/YYYY) |
| customer_name | Customer name |
| pickup_address | Pickup location |
| drop_address | Drop location |
| net_fare    | Base fare (₹) |
| CGST        | CGST amount (₹) |
| SGST        | SGST amount (₹) |
| total_fare  | Total amount (₹) |

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Create Sample Excel

```bash
node scripts/create-sample-excel.js
```

Creates `assets/sample-invoices.xlsx` with 3 sample rows.

## Deploy Online

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step instructions to deploy on Render, Railway, or other platforms so your team can use the app from anywhere.

## Project Structure

```
app/
  api/
    upload/   # Parse Excel, validate, return preview
    generate/ # Generate PDFs, ZIP, stream download
  page.tsx    # Single-page UI
lib/
  services/   # validation, pdfGenerator, zipService
  utils/      # parseExcel, template, filename
  templates/  # invoice.html
public/
  EVZIP_logo.svg
  manifest.json  # PWA
```
