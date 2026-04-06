"use client";

import { useState, useRef, useEffect } from "react";

type UploadResponse = {
  sheetNames: string[];
  headers: string[];
  suggestedMapping: Record<string, string>;
  mapping: Record<string, string>;
  mappingValid: boolean;
  mappingErrors: string[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  invalidRows: { rowIndex: number; errors: string[]; warnings: string[] }[];
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"bulk" | "single">("bulk");

  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<File | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [mappingOverride, setMappingOverride] = useState<Record<string, string>>({});
  const [bulkIssuerKey, setBulkIssuerKey] = useState<"telangana" | "andhra_pradesh">("telangana");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [singleForm, setSingleForm] = useState({
    invoice_date: "",
    invoice_no: "",
    place_of_supply: "Telangana",
    customer_name: "",
    customer_id: "",
    issuer_key: "telangana" as "telangana" | "andhra_pradesh",
    category_of_services: "Passenger Transport Services",
    service_description: "Transport Service using electric vehicle",
    qty: "1",
    net_fare: "",
    CGST: "",
    SGST: "",
    total_fare: "",
    total_payable: "",
  });
  const [singleTouched, setSingleTouched] = useState({
    CGST: false,
    SGST: false,
    total_fare: false,
    total_payable: false,
  });
  const [singleGenerating, setSingleGenerating] = useState(false);

  // Native DOM listener - React's onChange may not fire in embedded browsers (e.g. Cursor Simple Browser)
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handler = () => {
      const f = input.files?.[0] ?? null;
      fileRef.current = f;
      setFile(f);
      setUploadData(null);
      setMappingOverride({});
      setError(null);
      if (!f) setSheetIndex(0);
    };
    input.addEventListener("change", handler);
    return () => input.removeEventListener("change", handler);
  }, []);

  const handleUpload = async () => {
    const f = fileRef.current ?? file;
    if (!f) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("sheetIndex", String(sheetIndex));
      if (Object.keys(mappingOverride).length > 0) {
        formData.append("mapping", JSON.stringify(mappingOverride));
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details?.join(", ") || "Upload failed");
      }
      setUploadData(data);
      if (data?.mapping && typeof data.mapping === "object") {
        setMappingOverride(data.mapping);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const f = fileRef.current ?? file;
    if (!f) return;
    setGenerating(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("sheetIndex", String(sheetIndex));
      formData.append("issuer_key", bulkIssuerKey);
      if (Object.keys(mappingOverride).length > 0) {
        formData.append("mapping", JSON.stringify(mappingOverride));
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="?([^";\n]+)"?/);
      const filename = filenameMatch?.[1] ?? `EVZIP_Invoices_${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const recalcSingle = (next: typeof singleForm) => {
    const net = Number(String(next.net_fare ?? "").replace(/,/g, "").trim());
    const netOk = Number.isFinite(net) ? net : 0;
    const cgstDefault = Math.round(netOk * 0.025 * 100) / 100; // 2.5%
    const sgstDefault = Math.round(netOk * 0.025 * 100) / 100; // 2.5%

    const cgst = singleTouched.CGST
      ? next.CGST
      : (netOk ? String(cgstDefault) : "");
    const sgst = singleTouched.SGST
      ? next.SGST
      : (netOk ? String(sgstDefault) : "");

    const cgstNum = Number(String(cgst ?? "").replace(/,/g, "").trim());
    const sgstNum = Number(String(sgst ?? "").replace(/,/g, "").trim());
    const computedTotal = (Number.isFinite(netOk) ? netOk : 0) + (Number.isFinite(cgstNum) ? cgstNum : 0) + (Number.isFinite(sgstNum) ? sgstNum : 0);

    // If net_fare is present, compute total_fare automatically (unless user touched it).
    // If net_fare is empty but total_fare is present, back-calc net + taxes (unless user touched those fields).
    const total = Number(String(next.total_fare ?? "").replace(/,/g, "").trim());
    const totalOk = Number.isFinite(total) ? total : 0;

    let totalFare = singleTouched.total_fare ? next.total_fare : (netOk ? String(Math.round(computedTotal * 100) / 100) : "");

    if (!netOk && totalOk) {
      const inferredNet = Math.round((totalOk / 1.05) * 100) / 100;
      const inferredCgst = Math.round(inferredNet * 0.025 * 100) / 100;
      const inferredSgst = Math.round(inferredNet * 0.025 * 100) / 100;

      const nextNetFare = String(inferredNet);
      const nextCgst = singleTouched.CGST ? cgst : String(inferredCgst);
      const nextSgst = singleTouched.SGST ? sgst : String(inferredSgst);
      totalFare = singleTouched.total_fare ? next.total_fare : String(totalOk);

      const totalPayable = singleTouched.total_payable ? next.total_payable : totalFare;
      return {
        ...next,
        net_fare: nextNetFare,
        CGST: nextCgst,
        SGST: nextSgst,
        total_fare: totalFare,
        total_payable: totalPayable,
      };
    }

    const totalPayable = singleTouched.total_payable ? next.total_payable : totalFare;

    return { ...next, CGST: cgst, SGST: sgst, total_fare: totalFare, total_payable: totalPayable };
  };

  const handleCreateInvoice = async () => {
    setSingleGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...singleForm,
          net_fare: Number(String(singleForm.net_fare ?? "").replace(/,/g, "").trim()),
          CGST: Number(String(singleForm.CGST ?? "").replace(/,/g, "").trim()),
          SGST: Number(String(singleForm.SGST ?? "").replace(/,/g, "").trim()),
          total_fare: Number(String(singleForm.total_fare ?? "").replace(/,/g, "").trim()),
          total_payable: Number(String(singleForm.total_payable ?? "").replace(/,/g, "").trim()),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invoice generation failed");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename=\"?([^\";\n]+)\"?/);
      const filename =
        filenameMatch?.[1] ?? `EVZIP_INV_${singleForm.invoice_no || "invoice"}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice generation failed");
    } finally {
      setSingleGenerating(false);
    }
  };

  const columns = uploadData?.previewRows?.[0]
    ? Object.keys(uploadData.previewRows[0])
    : [];

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center gap-4 border-b border-gray-200 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/EVZIP_logo.svg"
            alt="EVZIP"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              EVZIP - Invogen
            </h1>
            <p className="text-sm text-gray-600">
              Generate bulk invoice PDFs from Excel files
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("bulk")}
            className={`rounded px-4 py-2 text-sm font-medium ${
              activeTab === "bulk"
                ? "bg-[#151438] text-white"
                : "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Bulk generator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`rounded px-4 py-2 text-sm font-medium ${
              activeTab === "single"
                ? "bg-[#151438] text-white"
                : "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Invoice creator
          </button>
        </div>

        {activeTab === "bulk" && (
          <>
        {/* Step 1: Upload */}
        <section className="mb-8 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            1. Upload Excel
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <div
                className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-[#151438] hover:bg-gray-100"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const f = e.dataTransfer.files?.[0];
                  if (f && (f.name.endsWith(".xlsx") || f.type.includes("spreadsheet"))) {
                    fileRef.current = f;
                    setFile(f);
                    setUploadData(null);
                    setMappingOverride({});
                    setError(null);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    fileRef.current = f;
                    setFile(f);
                    setUploadData(null);
                    setMappingOverride({});
                    setError(null);
                    if (!f) setSheetIndex(0);
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-[#151438] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:hover:bg-[#1e1d4a]"
                />
              {file ? (
                <p className="mt-1 text-xs text-green-600">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB) — ready to upload
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Select an .xlsx file or drag & drop here
                </p>
              )}
              </div>
            </div>
            {uploadData && uploadData.sheetNames.length > 1 && (
              <div className="w-48">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Sheet
                </label>
                <select
                  value={sheetIndex}
                  onChange={(e) => {
                    setSheetIndex(Number(e.target.value));
                    setUploadData(null);
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {uploadData.sheetNames.map((name, i) => (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-amber-600">
                  Re-upload after changing sheet
                </p>
              </div>
            )}
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className={`rounded px-6 py-2 font-medium text-white transition-colors ${
                file && !loading
                  ? "cursor-pointer bg-[#151438] hover:bg-[#1e1d4a]"
                  : "cursor-not-allowed bg-gray-400 opacity-90"
              }`}
            >
              {loading ? "Processing..." : "Upload & Preview"}
            </button>
          </div>
        </section>

        {/* Step 2: Preview */}
        {uploadData && (
          <section className="mb-8 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              2. Preview & Validate
            </h2>

            {!uploadData.mappingValid && (
              <div className="mb-5 rounded border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">
                  Column mapping required
                </div>
                <div className="mt-1 text-xs text-amber-900">
                  We couldn’t auto-detect all required columns. Select the right
                  Excel column for each required field, then click “Re-validate”.
                </div>
                <div className="mt-2 text-xs text-amber-800">
                  Missing: {uploadData.mappingErrors.join(", ")}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    "invoice_no",
                    "invoice_date",
                    "customer_name",
                    "customer_id",
                    "pickup_address",
                    "drop_address",
                    "net_fare",
                    "total_fare",
                  ].map((field) => (
                    <div key={field}>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        {field}
                      </label>
                      <select
                        value={mappingOverride[field] || ""}
                        onChange={(e) =>
                          setMappingOverride((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">-- Select column --</option>
                        {uploadData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      {uploadData.suggestedMapping?.[field] &&
                        !mappingOverride[field] && (
                          <div className="mt-1 text-[11px] text-gray-600">
                            Suggested:{" "}
                            <button
                              type="button"
                              className="underline"
                              onClick={() =>
                                setMappingOverride((prev) => ({
                                  ...prev,
                                  [field]: uploadData.suggestedMapping[field],
                                }))
                              }
                            >
                              {uploadData.suggestedMapping[field]}
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="rounded bg-[#151438] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e1d4a] disabled:opacity-50"
                  >
                    {loading ? "Checking..." : "Re-validate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMappingOverride(uploadData.suggestedMapping || {});
                    }}
                    className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    Use suggestions
                  </button>
                </div>
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <span className="rounded bg-gray-100 px-3 py-1">
                Total rows: <strong>{uploadData.totalRows}</strong>
              </span>
              <span className="rounded bg-green-100 px-3 py-1 text-green-800">
                Valid: <strong>{uploadData.validCount}</strong>
              </span>
              {uploadData.invalidCount > 0 && (
                <span className="rounded bg-amber-100 px-3 py-1 text-amber-800">
                  Invalid: <strong>{uploadData.invalidCount}</strong>
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#151438] text-white">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="border-b border-gray-200 px-4 py-2 text-left font-medium"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadData.previewRows.slice(0, 20).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="max-w-[200px] truncate px-4 py-2"
                          title={String(row[col] ?? "")}
                        >
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {uploadData.previewRows.length > 20 && (
              <p className="mt-2 text-xs text-gray-500">
                Showing first 20 of {uploadData.previewRows.length} valid rows
              </p>
            )}

            {uploadData.invalidRows.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-amber-700">
                  {uploadData.invalidCount} failed rows (click to expand)
                </summary>
                <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs">
                  {uploadData.invalidRows.map((r, i) => (
                    <li key={i} className="py-1">
                      Row {r.rowIndex}: {r.errors.join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* Step 3: Generate */}
        {uploadData && uploadData.mappingValid && uploadData.validCount > 0 && (
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              3. Generate Invoices
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Generate {uploadData.validCount} PDF invoice(s) and download as
              ZIP. {uploadData.invalidCount > 0 && "Failed rows will be included in failed_rows.csv."}
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Invoice issued by
              </label>
              <select
                value={bulkIssuerKey}
                onChange={(e) =>
                  setBulkIssuerKey(e.target.value as "telangana" | "andhra_pradesh")
                }
                className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="telangana">Telangana</option>
                <option value="andhra_pradesh">Andhra Pradesh</option>
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded bg-[#6ec6ae] px-6 py-3 font-medium text-gray-900 hover:bg-[#5db89d] disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate & Download ZIP"}
            </button>
          </section>
        )}
          </>
        )}

        {activeTab === "single" && (
          <section className="mb-8 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Invoice creator
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Invoice Date
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={
                      singleForm.invoice_date.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""
                    }
                    onChange={(e) =>
                      setSingleForm((p) => ({ ...p, invoice_date: e.target.value }))
                    }
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={
                      singleForm.invoice_date.match(/^\d{4}-\d{2}-\d{2}/)
                        ? ""
                        : singleForm.invoice_date
                    }
                    onChange={(e) =>
                      setSingleForm((p) => ({ ...p, invoice_date: e.target.value }))
                    }
                    placeholder="Or type: 01-11-2025"
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Pick a date or type manually (DD-MM-YYYY)
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Invoice No
                </label>
                <input
                  value={singleForm.invoice_no}
                  onChange={(e) =>
                    setSingleForm((p) => ({ ...p, invoice_no: e.target.value }))
                  }
                  placeholder="EZ25112001"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Place of supply
                </label>
                <input
                  value={singleForm.place_of_supply}
                  onChange={(e) =>
                    setSingleForm((p) => ({ ...p, place_of_supply: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Customer name
                </label>
                <input
                  value={singleForm.customer_name}
                  onChange={(e) =>
                    setSingleForm((p) => ({ ...p, customer_name: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Customer ID (optional)
                </label>
                <input
                  value={singleForm.customer_id}
                  onChange={(e) =>
                    setSingleForm((p) => ({ ...p, customer_id: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Invoice issued by
                </label>
                <select
                  value={singleForm.issuer_key}
                  onChange={(e) =>
                    setSingleForm((p) => ({
                      ...p,
                      issuer_key: e.target.value as any,
                    }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="telangana">Telangana</option>
                  <option value="andhra_pradesh">Andhra Pradesh</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description (Service)
                </label>
                <input
                  value={singleForm.service_description}
                  onChange={(e) =>
                    setSingleForm((p) => ({ ...p, service_description: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Qty
                </label>
                <input
                  value={singleForm.qty}
                  onChange={(e) =>
                    setSingleForm((p) => ({ ...p, qty: e.target.value }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Amount
                </label>
                <input
                  value={singleForm.net_fare}
                  onChange={(e) => {
                    const next = { ...singleForm, net_fare: e.target.value };
                    setSingleForm(recalcSingle(next));
                  }}
                  inputMode="decimal"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  CGST (2.5%)
                </label>
                <input
                  value={singleForm.CGST}
                  onChange={(e) => {
                    setSingleTouched((t) => ({ ...t, CGST: true }));
                    const next = { ...singleForm, CGST: e.target.value };
                    setSingleForm(recalcSingle(next));
                  }}
                  inputMode="decimal"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  SGST (2.5%)
                </label>
                <input
                  value={singleForm.SGST}
                  onChange={(e) => {
                    setSingleTouched((t) => ({ ...t, SGST: true }));
                    const next = { ...singleForm, SGST: e.target.value };
                    setSingleForm(recalcSingle(next));
                  }}
                  inputMode="decimal"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Total
                </label>
                <input
                  value={singleForm.total_fare}
                  onChange={(e) => {
                    setSingleTouched((t) => ({ ...t, total_fare: true }));
                    const next = { ...singleForm, total_fare: e.target.value };
                    setSingleForm(recalcSingle(next));
                  }}
                  inputMode="decimal"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Total Amount Payable
                </label>
                <input
                  value={singleForm.total_payable}
                  onChange={(e) => {
                    setSingleTouched((t) => ({ ...t, total_payable: true }));
                    setSingleForm((p) => ({ ...p, total_payable: e.target.value }));
                  }}
                  inputMode="decimal"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSingleTouched({ CGST: false, SGST: false, total_fare: false, total_payable: false });
                  setSingleForm((p) => recalcSingle(p));
                }}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Recalculate
              </button>
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={singleGenerating}
                className="rounded bg-[#151438] px-6 py-2 text-sm font-medium text-white hover:bg-[#1e1d4a] disabled:opacity-50"
              >
                {singleGenerating ? "Generating..." : "Generate & Download PDF"}
              </button>
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-600">
          <p>EVZIP MOBILITY PRIVATE LIMITED | ISO 9001:2015 Certified | Startup India Recognised</p>
          <p className="mt-2">
            Developed by{" "}
            <a
              href="https://www.ardnepu.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#151438] underline hover:text-[#1e1d4a]"
            >
              ardnepu
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
