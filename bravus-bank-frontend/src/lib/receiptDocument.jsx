import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import ReceiptPaper, { receiptStatusIcon } from '../components/ReceiptPaper';
import receiptCss from '../components/receipt.css?raw';
import { buildReceiptModel, RECEIPT_COLORS as colors, RECEIPT_LOGO } from './receiptModel';

const iconSvg = (kind) => renderToStaticMarkup(React.createElement(receiptStatusIcon(kind), {
  size: 88, strokeWidth: 1.8, color: kind === 'error' ? '#b42318' : kind === 'pending' ? '#996200' : colors.blue,
}));
export { iconSvg };

async function iconPng(kind) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(kind))}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 132;
  canvas.height = 132;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar o comprovante.');
  context.drawImage(image, 0, 0, 132, 132);
  return canvas.toDataURL('image/png');
}

let logoPromise;
async function loadAssets(kind) {
  if (!logoPromise) {
    logoPromise = fetch(RECEIPT_LOGO, { credentials: 'omit', signal: AbortSignal.timeout(12000) })
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar a marca do comprovante.');
        return new Uint8Array(await response.arrayBuffer());
      }).catch((error) => { logoPromise = null; throw error; });
  }
  const [logo, icon] = await Promise.all([logoPromise, iconPng(kind)]);
  return { logo, icon };
}

// One presentation model feeds the screen, exported HTML and both PDF actions.
// Long fields wrap and continue onto another page; no transaction data is dropped.
export function createReceiptPdf(model, { logo, icon }, fileId) {
  const width = 426;
  const height = 960;
  const margin = 23;
  const available = width - margin * 2;
  const pdf = new jsPDF({ unit: 'pt', format: [width, height], putOnlyUsedFonts: true, compress: true });
  pdf.setProperties({ title: model.title, author: 'Vantyx Bank', subject: model.identifier, creator: 'Vantyx Bank' });
  pdf.setCreationDate(new Date(model.dateIso || '2000-01-01T00:00:00Z'));
  if (fileId) pdf.setFileId(fileId);
  let y = 0;
  const header = () => {
    pdf.setFillColor(colors.navy);
    pdf.rect(0, 0, width, 70, 'F');
    const info = pdf.getImageProperties(logo);
    pdf.addImage(logo, 'PNG', margin, 12, 170, 170 * info.height / info.width);
    y = 94;
  };
  header();
  const ensureRoom = (size) => {
    if (y + size > height - 36) { pdf.addPage([width, height]); header(); }
  };
  const text = (value, { size = 14, bold = false, color = colors.ink, align = 'left', space = 0 } = {}) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(String(value), available);
    for (const line of lines) {
      ensureRoom(size * 1.5);
      pdf.setTextColor(color);
      pdf.text(line, align === 'center' ? width / 2 : margin, y + size, { align });
      y += size * 1.5;
    }
    y += space;
  };
  const rule = () => { ensureRoom(10); pdf.setDrawColor(colors.border); pdf.setLineWidth(.6); pdf.line(margin, y, width - margin, y); y += 24; };
  const row = (label, value, size = 12) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    const left = pdf.splitTextToSize(label, available * .32);
    const right = pdf.splitTextToSize(String(value), available * .63);
    const count = Math.max(left.length, right.length);
    // Keep normal rows together, but split very long fields instead of truncating.
    if (count * size * 1.5 < height - 160) ensureRoom(count * size * 1.5 + 6);
    for (let i = 0; i < count; i += 1) {
      ensureRoom(size * 1.5);
      pdf.setTextColor(colors.ink);
      if (left[i]) pdf.text(left[i], margin, y + size);
      if (right[i]) pdf.text(right[i], width - margin, y + size, { align: 'right' });
      y += size * 1.5;
    }
    y += 6;
  };
  text(model.title, { size: 20, bold: true, space: 22 });
  pdf.addImage(icon, 'PNG', width / 2 - 22, y, 44, 44);
  y += 69;
  text(model.label, { size: 16, align: 'center', space: 8 });
  // Fit large balances without changing the recorded minor-unit amount.
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(42);
  const amountSize = Math.max(15, Math.min(42, 42 * available / pdf.getTextWidth(model.amount)));
  text(model.amount, { size: amountSize, bold: true, align: 'center', space: 4 });
  text(`${model.date} (Brasília)`, { size: 13, color: colors.muted, align: 'center', space: 20 });
  for (const party of model.parties) {
    ensureRoom(138);
    rule();
    text(party.title, { size: 12, color: colors.muted, space: 8 });
    text(party.name, { size: 18, bold: true, space: 9 });
    row(party.documentLabel, party.document, 14);
    text(party.account, { size: 14, space: 15 });
  }
  rule();
  row('Identificador', model.identifier, 12);
  y += 12;
  rule();
  text('DETALHES DA OPERAÇÃO', { size: 11, color: colors.muted, space: 5 });
  for (const [label, value] of model.details) row(label, value, 9);
  y += 10;
  text(model.note, { size: 11, color: colors.muted, align: 'center' });
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(colors.muted);
    pdf.text(`${page} / ${pages}`, width - margin, height - 16, { align: 'right' });
  }
  return pdf.output('blob');
}

export async function buildReceiptDocument(receipt, assets) {
  const model = buildReceiptModel(receipt);
  const resolvedAssets = assets || await loadAssets(model.kind);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(model)));
  const fileId = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  const body = renderToStaticMarkup(<ReceiptPaper model={model} />);
  return {
    filename: model.filename,
    title: model.title,
    html: `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprovante Vantyx</title><style>body{margin:0;background:#fff}.vantyx-receipt{max-width:426px;margin:auto}${receiptCss}</style>${body}</html>`,
    pdf: createReceiptPdf(model, resolvedAssets, fileId),
    text: `${model.title}\n${model.label}\n${model.amount}\nIdentificador: ${model.identifier}`,
  };
}
