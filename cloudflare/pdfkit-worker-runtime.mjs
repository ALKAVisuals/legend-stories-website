import {
  PDFDocument,
  registerStdFonts,
} from '../node_modules/pdfkit/js/pdfkit.browser.mjs';
import Helvetica from '../node_modules/pdfkit/js/standard-fonts/Helvetica.mjs';
import HelveticaBold from '../node_modules/pdfkit/js/standard-fonts/HelveticaBold.mjs';

// PDFKit 0.20.x exposes a Node-specific ESM build under the `node` export
// condition, while its browser ESM build is the right runtime shape for a
// Worker. Keep the shared invoice renderer platform-neutral by aliasing bare
// `pdfkit` to this adapter only in Cloudflare bundles.
//
// The browser build computes a PDF/A ICC profile URL at module load with
// `new URL('./data/sRGB_IEC61966_2_1.icc', import.meta.url)`. LegendMural does
// not request a PDF/A subset, but workerd still evaluates that expression at
// startup. The Cloudflare Wrangler config therefore supplies a stable synthetic
// import.meta.url during bundling. If PDF/A is ever enabled, its ICC asset must
// be wired explicitly rather than relying on this compatibility boundary.
//
// Browser/worker builds do not self-register standard-font metrics. The
// approved LegendMural invoice renderer uses Helvetica and Helvetica-Bold only.
registerStdFonts(Helvetica, HelveticaBold);

export { PDFDocument };
export default PDFDocument;
