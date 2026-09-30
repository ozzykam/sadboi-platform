// Existing checkout/fulfillment/email suites exercise order behavior. Review a
// quote before their order requests, preserving it across operation retries.
// Shipping-specific tests use the raw request helper to test the quote boundary.
export function withCheckoutQuotes(request) {
  const quotes = new Map();
  return async (url, init = {}) => {
    if (url !== "/api/store/orders" || init.method !== "POST") return request(url, init);
    const body = JSON.parse(init.body);
    if (!body.quoteId && body.input && body.operationId) {
      if (!quotes.has(body.operationId)) {
        const response = await request("/api/store/quote", { ...init, body: JSON.stringify(body.input) });
        if (response.ok) quotes.set(body.operationId, (await response.json()).id);
      }
      body.quoteId = quotes.get(body.operationId) ?? "0".repeat(64);
    }
    return request(url, { ...init, body: JSON.stringify(body) });
  };
}
