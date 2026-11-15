import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfDocumentInput = {
  title: "Quotation" | "Invoice";
  number: string;
  company: { name: string; lines: string[]; logoPng?: Uint8Array };
  customer: { name: string; lines: string[] };
  meta: [string, string][];
  currency: string;
  items: { description: string; quantity: number; unitPrice: string; lineTotal: string }[];
  totals: [string, string][];
  /** Extra paragraphs: terms, notes, payment instructions. */
  notes: { heading: string; text: string }[];
  /** Printed under the number when set, e.g. "DRAFT" or "VOID". */
  stamp?: string;
};

const NAVY = rgb(0.031, 0.055, 0.396);
const GREY = rgb(0.34, 0.36, 0.49);
const MARGIN = 48;

/** Replaces characters the standard PDF fonts cannot draw, so a stray symbol never breaks a document. */
export const safe = (text: string) => text.replace(/[^\x20-\x7E -ÿ]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else { if (line) lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

export const formatAmount = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A clean A4 quotation or invoice. Amounts are printed exactly as stored in the database. */
export async function buildDocumentPdf(input: PdfDocumentInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = input.company.logoPng ? await pdf.embedPng(input.company.logoPng).catch(() => null) : null;
  pdf.setTitle(`${input.title} ${input.number}`);
  pdf.setProducer("SUPER SMART SPORTS business platform");

  let page: PDFPage = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  const text = (value: string, x: number, size = 10, font = regular, color = rgb(0.1, 0.1, 0.2)) =>
    page.drawText(safe(value), { x, y, size, font, color });
  const right = (value: string, xRight: number, size = 10, font = regular) =>
    text(value, xRight - font.widthOfTextAtSize(safe(value), size), size, font);
  const newPage = () => { page = pdf.addPage([595.28, 841.89]); y = height - MARGIN; };
  const ensure = (needed: number) => { if (y - needed < MARGIN + 30) newPage(); };

  // Header
  if (logo) page.drawImage(logo, { x: MARGIN, y: y - 46, width: 46, height: 46 });
  const nameX = logo ? MARGIN + 58 : MARGIN;
  text(input.company.name, nameX, 15, bold, NAVY);
  y -= 16;
  for (const line of input.company.lines) { text(line, nameX, 9, regular, GREY); y -= 12; }
  const headerBottom = Math.min(y, height - MARGIN - 52);
  y = height - MARGIN;
  right(input.title.toUpperCase(), width - MARGIN, 20, bold);
  y -= 22;
  right(input.number, width - MARGIN, 11, bold);
  if (input.stamp) { y -= 15; right(input.stamp, width - MARGIN, 10, bold); }
  y = headerBottom - 22;

  // Customer and details
  text("Bill to", MARGIN, 9, bold, GREY);
  const detailsX = width / 2 + 20;
  let yRight = y;
  y -= 14; text(input.customer.name, MARGIN, 11, bold);
  for (const line of input.customer.lines) { y -= 13; text(line, MARGIN, 9.5); }
  const left = y;
  y = yRight;
  for (const [label, value] of input.meta) { text(label, detailsX, 9, regular, GREY); right(value, width - MARGIN, 9.5, bold); y -= 14; }
  y = Math.min(left, y) - 24;

  // Items
  const cols = { desc: MARGIN, qty: 340, price: 430, total: width - MARGIN };
  page.drawRectangle({ x: MARGIN - 4, y: y - 6, width: width - 2 * MARGIN + 8, height: 22, color: NAVY });
  const white = rgb(1, 1, 1);
  page.drawText("Description", { x: cols.desc, y: y, size: 9.5, font: bold, color: white });
  page.drawText("Qty", { x: cols.qty, y, size: 9.5, font: bold, color: white });
  page.drawText(`Unit price (${input.currency})`, { x: cols.price - 12, y, size: 9.5, font: bold, color: white });
  const totalLabel = `Total (${input.currency})`;
  page.drawText(totalLabel, { x: cols.total - bold.widthOfTextAtSize(totalLabel, 9.5), y, size: 9.5, font: bold, color: white });
  y -= 24;

  for (const item of input.items) {
    const lines = wrap(item.description, regular, 9.5, cols.qty - cols.desc - 12);
    ensure(lines.length * 12 + 10);
    const top = y;
    lines.forEach((line, i) => { y = top - i * 12; text(line, cols.desc, 9.5); });
    y = top;
    text(String(item.quantity), cols.qty, 9.5);
    text(formatAmount(item.unitPrice), cols.price + 20, 9.5);
    right(formatAmount(item.lineTotal), cols.total, 9.5);
    y = top - lines.length * 12 - 6;
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: width - MARGIN, y: y + 6 }, thickness: 0.4, color: rgb(0.85, 0.86, 0.9) });
  }

  // Totals
  ensure(input.totals.length * 16 + 30);
  y -= 10;
  for (const [label, value] of input.totals) {
    const strong = label === "Total" || label === "Balance due";
    text(label, 380, strong ? 11 : 9.5, strong ? bold : regular, strong ? NAVY : rgb(0.1, 0.1, 0.2));
    right(`${input.currency} ${formatAmount(value)}`, width - MARGIN, strong ? 11 : 9.5, strong ? bold : regular);
    y -= strong ? 18 : 15;
  }

  // Notes
  for (const note of input.notes.filter((n) => n.text.trim())) {
    const lines = wrap(note.text, regular, 9, width - 2 * MARGIN);
    ensure(lines.length * 11 + 30);
    y -= 14; text(note.heading, MARGIN, 9.5, bold, GREY);
    for (const line of lines) { y -= 11.5; text(line, MARGIN, 9); }
  }

  return pdf.save();
}
