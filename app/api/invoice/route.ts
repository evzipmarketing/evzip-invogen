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

    const CGST_RATE = 0.025;
    const SGST_RATE = 0.025;
    const TOTAL_RATE = CGST_RATE + SGST_RATE; // 5%

    const hasNet =
      body.net_fare !== null &&
      body.net_fare !== undefined &&
      String(body.net_fare).trim() !== "";
    const hasTotal =
      body.total_fare !== null &&
      body.total_fare !== undefined &&
      String(body.total_fare).trim() !== "";

    let net_fare = pickNumber(body.net_fare, 0);
    let total_fare = pickNumber(body.total_fare, 0);

    // If net_fare is present, always compute taxes + total.
    // Else if total_fare is present, back-calculate net and taxes.
    if (hasNet) {
      const CGST = Math.round(net_fare * CGST_RATE * 100) / 100;
      const SGST = Math.round(net_fare * SGST_RATE * 100) / 100;
      total_fare = Math.round((net_fare + CGST + SGST) * 100) / 100;

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
      if (!pdf) {
        return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
      }
      const filename = pdf.filename || `EVZIP_INV_${invoice_no}.pdf`;

      return new Response(new Uint8Array(pdf.buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (hasTotal) {
      net_fare = Math.round((total_fare / (1 + TOTAL_RATE)) * 100) / 100;
      const CGST = Math.round(net_fare * CGST_RATE * 100) / 100;
      const SGST = Math.round(net_fare * SGST_RATE * 100) / 100;

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
      if (!pdf) {
        return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
      }
      const filename = pdf.filename || `EVZIP_INV_${invoice_no}.pdf`;

      return new Response(new Uint8Array(pdf.buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const netFallback = pickNumber(body.net_fare, 0);
    const cgstFallback = pickNumber(body.CGST, Math.round(netFallback * CGST_RATE * 100) / 100);
    const sgstFallback = pickNumber(body.SGST, Math.round(netFallback * SGST_RATE * 100) / 100);
    const computedTotalFallback = netFallback + cgstFallback + sgstFallback;
    const totalFallback = pickNumber(body.total_fare, computedTotalFallback);

    const row = {
      invoice_no,
      invoice_date,
      customer_name,
      customer_id: pickString(body.customer_id, "").trim(),
      place_of_supply,
      category_of_services,
      service_description,
      qty,
      net_fare: netFallback,
      CGST: cgstFallback,
      SGST: sgstFallback,
      total_fare: totalFallback,
      total_payable: pickNumber(body.total_payable, totalFallback),
      ...issuer,
    };

    const [pdf] = await generateInvoicePdfs([row]);
    if (!pdf) {
      return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
    const filename = pdf.filename || `EVZIP_INV_${invoice_no}.pdf`;

    return new Response(new Uint8Array(pdf.buffer), {
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

