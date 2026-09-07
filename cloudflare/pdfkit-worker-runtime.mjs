import {
  PDFDocument,
  registerStdFonts,
} from '../node_modules/pdfkit/js/pdfkit.browser.mjs';
import Helvetica from '../node_modules/pdfkit/js/standard-fonts/Helvetica.mjs';
import HelveticaBold from '../node_modules/pdfkit/js/standard-fonts/HelveticaBold.mjs';

// PDFKit 0.20.x deliberately exposes a Node-specific ESM build under the
// `node` export condition. Cloudflare Workers can advertise Node compatibility
// for unrelated application dependencies, so importing bare `pdfkit` from a
// Worker may select that filesystem-oriented build. Keep the invoice renderer
// platform-neutral by aliasing only Worker bundles to this browser-safe runtime.
//
// Browser/worker builds do not self-register standard-font metrics. The
// LegendMural invoice renderer currently uses Helvetica and Helvetica-Bold only,
// so register exactly those approved fonts and leave the Node/Netlify runtime
// untouched for rollback compatibility.
registerStdFonts(Helvetica, HelveticaBold);

export { PDFDocument };
export default PDFDocument;
