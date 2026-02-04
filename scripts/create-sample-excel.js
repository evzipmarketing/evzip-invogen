/**
 * Creates a sample Excel file for testing the invoice generator.
 * Run: node scripts/create-sample-excel.js
 */

const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const sampleData = [
  {
    invoice_no: "EZ25112001",
    invoice_date: "2025-01-15",
    customer_name: "Jayasree Chevendra",
    pickup_address: "Plot 8B, Godavari Gardens, Yapral",
    drop_address: "HITEC City, Madhapur, Hyderabad",
    net_fare: 250,
    CGST: 22.5,
    SGST: 22.5,
    total_fare: 295,
  },
  {
    invoice_no: "EZ25112002",
    invoice_date: "2025-01-16",
    customer_name: "Rahul Sharma",
    pickup_address: "Banjara Hills, Hyderabad",
    drop_address: "Gachibowli, Hyderabad",
    net_fare: 180,
    CGST: 16.2,
    SGST: 16.2,
    total_fare: 212.4,
  },
  {
    invoice_no: "EZ25112003",
    invoice_date: "2025-01-17",
    customer_name: "Priya Patel",
    pickup_address: "Secunderabad Railway Station",
    drop_address: "Shamshabad Airport",
    net_fare: 450,
    CGST: 40.5,
    SGST: 40.5,
    total_fare: 531,
  },
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(sampleData);
XLSX.utils.book_append_sheet(wb, ws, "Invoices");

const outDir = path.join(process.cwd(), "assets");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "sample-invoices.xlsx");
XLSX.writeFile(wb, outPath);

console.log("Created:", outPath);
