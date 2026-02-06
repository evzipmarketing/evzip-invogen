import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { parseExcel, buildColumnMapping, mergeMapping } from "@/lib/utils/parseExcel";
import {
  validateAllRows,
  validateColumnMapping,
} from "@/lib/services/validation";
import { generateInvoicePdfs } from "@/lib/services/pdfGenerator";
import { createZipStream } from "@/lib/services/zipService";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";
import { ISSUERS } from "@/lib/issuers";

export const dynamic = "force-dynamic";

const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Only .xlsx files are accepted" },
        { status: 400 }
      );
    }

    const size = file.size;
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE_MB} MB limit` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sheetIndex = parseInt(
      (formData.get("sheetIndex") as string) || "0",
      10
    );

    const parsed = parseExcel(buffer, sheetIndex);
    const suggestedMapping = buildColumnMapping(parsed.headers);
    const overrideRaw = (formData.get("mapping") as string) || "";
    const override = overrideRaw ? (JSON.parse(overrideRaw) as Record<string, unknown>) : undefined;
    const mapping = mergeMapping(suggestedMapping, override);

    const mappingValidation = validateColumnMapping(mapping);
    if (!mappingValidation.valid) {
      return NextResponse.json(
        {
          error: "Missing required columns",
          details: mappingValidation.errors,
        },
        { status: 400 }
      );
    }

    const { validRows, invalidRows } = validateAllRows(parsed.rows, mapping);

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows to process", invalidCount: invalidRows.length },
        { status: 400 }
      );
    }

    const issuerKey = (formData.get("issuer_key") as string) || "telangana";
    const issuer =
      issuerKey === "andhra_pradesh"
        ? ISSUERS.andhra_pradesh
        : ISSUERS.telangana;

    const rowsWithIssuer = validRows.map((row) => ({ ...row, ...issuer }));

    const pdfs = await generateInvoicePdfs(rowsWithIssuer);

    const batchId = Date.now().toString(36);
    const dateStr = new Date().toISOString().slice(0, 10);
    const zipFilename = `EVZIP_Invoices_${dateStr}_${batchId}.zip`;

    const zipStream = createZipStream(pdfs, invalidRows);

    // Convert Node.js stream to Web ReadableStream
    const webStream = Readable.toWeb(zipStream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
