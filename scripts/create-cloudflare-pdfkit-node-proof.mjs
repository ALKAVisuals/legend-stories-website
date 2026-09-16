import { buildPdfKitProbeSnapshot } from '../tests/fixtures/cloudflare-pdfkit-probe-worker.mjs';
import {
  renderV3InvoicePdf,
  V3_INVOICE_PDF_RENDERER_VERSION,
} from '../server/invoices/v3-invoice-pdf.mjs';

const artifact = await renderV3InvoicePdf({ snapshot: buildPdfKitProbeSnapshot() });
const pdfHeader = Buffer.from(artifact.bytes).subarray(0, 8).toString('ascii');

process.stdout.write(`${JSON.stringify({
  rendererVersion: artifact.rendererVersion,
  expectedRendererVersion: V3_INVOICE_PDF_RENDERER_VERSION,
  filename: artifact.filename,
  byteLength: artifact.byteLength,
  sha256: artifact.sha256,
  pdfHeader,
})}\n`);
