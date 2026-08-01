import { runOrderStoreConformance } from '../server/orders/store-conformance.mjs';
import { createReferenceOrderStore } from '../tests/support/reference-order-store.mjs';

try {
  const report = await runOrderStoreConformance(createReferenceOrderStore);
  console.log(
    `Order store conformance validation passed with ${report.checkCount} atomic and idempotent contract checks.`,
  );
  for (const check of report.checks) {
    console.log(`- ${check}`);
  }
} catch (error) {
  console.error('Order store conformance validation failed:');
  console.error(`- ${error.code || error.name}: ${error.message}`);
  if (error.details && Object.keys(error.details).length) {
    console.error(`- details: ${JSON.stringify(error.details)}`);
  }
  process.exit(1);
}
