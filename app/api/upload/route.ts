import { NextRequest, NextResponse } from "next/server";
import { parseExcel, buildColumnMapping, mergeMapping } from "@/lib/utils/parseExcel";
import {
  validateAllRows,
  validateColumnMapping,
} from "@/lib/services/validation";
import { MAX_FILE_SIZE_MB, PREVIEW_ROW_COUNT } from "@/lib/constants";

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

    // Validate file type
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Only .xlsx files are accepted" },
        { status: 400 }
      );
    }

    // Validate file size
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

    // Column mapping validation
    const mappingValidation = validateColumnMapping(mapping);
    const mappingValid = mappingValidation.valid;

    // Row validation (only if mapping is complete)
    const { validRows, invalidRows, validCount, invalidCount } = mappingValid
      ? validateAllRows(parsed.rows, mapping)
      : { validRows: [], invalidRows: [], validCount: 0, invalidCount: 0 };

    const previewRows = validRows.slice(0, PREVIEW_ROW_COUNT);

    return NextResponse.json({
      sheetNames: parsed.sheetNames,
      headers: parsed.headers,
      suggestedMapping,
      mapping,
      mappingValid,
      mappingErrors: mappingValidation.errors,
      rows: parsed.rows,
      validRows,
      invalidRows: invalidRows.map((r) => ({
        rowIndex: r.rowIndex,
        errors: r.errors,
        warnings: r.warnings,
      })),
      previewRows,
      totalRows: parsed.totalRows,
      validCount,
      invalidCount,
      fileSize: size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
