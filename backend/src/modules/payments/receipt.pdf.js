import PDFDocument from "pdfkit";

// A one-page payment receipt, generated on demand from the database (nothing is
// stored, so it always matches the ledger). It is a payment receipt, not a tax
// invoice: GST invoicing depends on the business and is not issued here.
const rupees = (n) => `Rs. ${Number(n).toLocaleString("en-IN")}`;
const METHOD = { upi: "UPI", cash: "Cash", bank_transfer: "Bank transfer / Net banking", card: "Card" };

export function renderReceiptPdf(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Receipt ${r.receiptNo}` } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text("Payment receipt");
    doc.moveDown(0.3).fontSize(10).font("Helvetica").fillColor("#555")
      .text(r.issuer.name).text(`${r.property.name}, ${r.property.address}`);
    if (r.issuer.gstin) doc.text(`GSTIN: ${r.issuer.gstin}`);
    doc.fillColor("#000").moveDown(1.2);

    const row = (label, value) => {
      const y = doc.y;
      doc.font("Helvetica").fontSize(11).fillColor("#555").text(label, 50, y, { width: 170 });
      doc.font("Helvetica-Bold").fillColor("#000").text(String(value), 220, y, { width: 325 });
      doc.moveDown(0.5);
    };
    row("Receipt number", r.receiptNo);
    row("Date paid", r.payment.paidOn);
    row("Received from", `${r.student.name} (${r.student.studentCode})`);
    row("Room", r.roomLabel);
    row("For", `${r.charge.description || r.charge.kind} (${r.charge.period})`);
    row("Method", METHOD[r.payment.method] ?? r.payment.method);
    row("Reference", r.payment.reference);
    row("Recorded by", r.payment.recordedBy);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(16).text(`Amount received: ${rupees(r.payment.amount)}`, 50);

    if (r.refunds.length) {
      doc.moveDown(1).font("Helvetica-Bold").fontSize(12).text("Refunds against this payment");
      for (const f of r.refunds) {
        doc.font("Helvetica").fontSize(10).text(`${f.refundNo} · ${f.date.slice(0, 10)} · ${rupees(f.amount)} · ${f.status} · ${f.reason}`);
      }
    }
    if (r.payment.status === "simulated") {
      doc.moveDown(1).font("Helvetica-Bold").fontSize(11).fillColor("#b42318")
        .text("SIMULATED PAYMENT (development only): no money was received.");
      doc.fillColor("#000");
    }
    doc.moveDown(2).font("Helvetica").fontSize(9).fillColor("#777")
      .text("This is a computer-generated payment receipt and does not need a signature. It is not a tax invoice.");
    doc.end();
  });
}
