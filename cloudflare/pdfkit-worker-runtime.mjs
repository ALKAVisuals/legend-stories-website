import PDFKitStandalone from '../node_modules/pdfkit/js/pdfkit.standalone.js';

// PDFKit 0.20.x exposes a Node ESM build under the `node` export condition and
// an ES-module browser build as the default export. The browser ESM build still
// evaluates its PDF/A ICC profile path at module load with
// `new URL('./data/sRGB_IEC61966_2_1.icc', import.meta.url)`. After Wrangler
// bundles that build for workerd, the generated import.meta.url is not a valid
// URL base and the Worker crashes before its fetch handler can start.
//
// PDFKit also publishes this browserified standalone build as a supported
// browser distribution. It embeds/transforms browser assets during PDFKit's own
// build instead of asking the consuming Worker bundle to resolve the PDF/A ICC
// URL. LegendMural does not request a PDF/A subset, so keep the shared invoice
// renderer unchanged and isolate this compatibility choice to Cloudflare only.
const standaloneModule = PDFKitStandalone?.default ?? PDFKitStandalone;
const PDFDocument = standaloneModule?.PDFDocument ?? standaloneModule;

if (typeof PDFDocument !== 'function') {
  throw new TypeError('PDFKit standalone build did not expose a PDFDocument constructor.');
}

export { PDFDocument };
export default PDFDocument;
