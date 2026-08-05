# LegendMural shipping market rollout

## Active market

### Netherlands

- Checkout: active
- Shipping: €4.95
- Free shipping: from €69 after discounts
- Customs: no
- Tracking: optional according to the selected carrier service

## Priority pilot market

### United States

- Checkout visibility: shown as `United States — launching soon`
- Checkout payment: disabled until a real tracked shipping rate is approved
- Customs: yes
- Tracking: required
- Free shipping: disabled until unit economics are validated
- Google Places: may switch to US-only suggestions after the market is activated

The United States must not be enabled by changing only the browser dropdown. Activation requires one shared browser/server policy change in `js/commerce/shipping.mjs` after the following inputs are approved:

1. packed weight for the 30 cm product;
2. packed weight for the 45 cm product;
3. packaging length, width and height;
4. maximum number of stickers per package;
5. tracked carrier and service level;
6. DAP or DDP customs treatment;
7. customer-facing shipping price;
8. whether a free-shipping threshold is commercially viable.

## Planned EU markets

Belgium, Germany and France are registered as planned markets but remain hidden until tracked rates are approved. Additional EU countries should be added using the same central policy rather than hard-coded checkout options.

## Safety contract

- Browser and server use the same shipping policy.
- Disabled markets cannot create an order quote or payment session.
- Checkout countries are generated from the central policy.
- No country is enabled without a finite shipping rate.
- Import-cost messaging is required for non-EU markets.
