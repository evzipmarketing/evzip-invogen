export type InvoiceIssuerKey = "telangana" | "andhra_pradesh";

export const ISSUERS: Record<
  InvoiceIssuerKey,
  {
    issuer_company: string;
    issuer_address_line1: string;
    issuer_address_line2: string;
    issuer_gstin: string;
  }
> = {
  telangana: {
    issuer_company: "EVZIP MOBILITY PRIVATE LIMITED",
    issuer_address_line1: "Plot 8/B, Godavari Gardens, Generals Road,",
    issuer_address_line2: "Yapral, Secunderabad, Telangana, India-500087",
    issuer_gstin: "36AAHCE7709C1ZQ",
  },
  andhra_pradesh: {
    issuer_company: "EVZIP MOBILITY PRIVATE LIMITED",
    issuer_address_line1: "Ground Floor, H.No.6-29-20/4, Opp.Chennai Shopping Mall,",
    issuer_address_line2: "Lodge Center, Guntur, Andhra Pradesh, India -522002",
    issuer_gstin: "37AAHCE7709C1ZO",
  },
};
