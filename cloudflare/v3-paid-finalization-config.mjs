// This is the single Cloudflare boundary for approved Profile-1 business/legal configuration.
// It deliberately returns null until invoice numbering, seller identity and tax treatment
// have been explicitly approved. With Profile-1 order creation enabled while this remains
// null, checkout fails closed before creating a new Profile-1 order.
export function resolveCloudflareV3PaidFinalizationConfig() {
  return null;
}
