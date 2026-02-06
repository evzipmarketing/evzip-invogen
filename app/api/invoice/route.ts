import { NextRequest } from "next/server";
import { generateInvoicePdfs } from "@/lib/services/pdfGenerator";
import { pickNumber, pickString } from "@/lib/utils/format";
import { ISSUERS, type InvoiceIssuerKey } from "@/lib/issuers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const issuerKey = pickString(body.issuer_key, "telangana") as InvoiceIssuerKey;
    const issuer = ISSUERS[issuerKey] ?? ISSUERS.telangana;

    const invoice_no = pickString(body.invoice_no, "").trim();
    const invoice_date = pickString(body.invoice_date, "").trim();
    const customer_name = pickString(body.customer_name, "").trim();
    const place_of_supply = pickString(body.place_of_supply, "Telangana").trim();
    const category_of_services = pickString(
      body.category_of_services,
      "Passenger Transport Services"
    ).trim();
    const service_description = pickString(body.service_description, "").trim();

    if (!invoice_no || !invoice_date || !customer_name || !service_description) {
      return Response.json(
        {
          error:
            "Missing required fields: invoice_no, invoice_date, customer_name, service_description",
        },
        { status: 400 }
      );
    }

    const qty = pickString(body.qty, "1").trim();

    const net_fare = pickNumber(body.net_fare, 0);
    const CGST = pickNumber(body.CGST, Math.round(net_fare * 0.025 * 100) / 100);
    const SGST = pickNumber(body.SGST, Math.round(net_fare * 0.025 * 100) / 100);
    const computedTotal = net_fare + CGST + SGST;
    const total_fare = pickNumber(body.total_fare, computedTotal);

    const row = {
      invoice_no,
      invoice_date,
      customer_name,
      customer_id: pickString(body.customer_id, "").trim(),
      place_of_supply,
      category_of_services,
      service_description,
      qty,
      net_fare,
      CGST,
      SGST,
      total_fare,
      total_payable: pickNumber(body.total_payable, total_fare),
      ...issuer,
    };

    const [pdf] = await generateInvoicePdfs([row]);
    const filename = pdf?.filename || `EVZIP_INV_${invoice_no}.pdf`;

    return new Response(pdf.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invoice generation failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

