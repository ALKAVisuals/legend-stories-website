# LegendMural launch-readiness progress tracker

Updated: 26 August 2026

This document is the detailed progress companion to `docs/CURRENT_PRODUCTION_STATUS_20260826.md`.

It exists so a future chat can see, in one place, both the **original Production/launch-readiness worklist** and the newer **paid-order email track** without confusing repository completion with real Production proof.

The percentages below are planning estimates, not release gates. A task can be 100% complete in the repository and still require separate Production validation.

---

## 1. How to read the percentages

- **100%** = the stated task itself is complete and verified for its stated scope.
- **75–99%** = implementation is essentially complete, but one or more validation/approval points remain.
- **25–74%** = meaningful work/evidence exists, but the task is still materially open.
- **1–24%** = only setup/preliminary work exists.
- **0%** = not started in the required scope.

Do not use a percentage to override the payment/security/release gates in `docs/CURRENT_PRODUCTION_STATUS_20260826.md`.

### Critical preview/payment interpretation

GitHub Pages is static/visual only. It cannot provide the real Netlify Functions + PayPal Live + Neon + Resend backend chain.

Therefore this Pages/static-harness message is expected behavior:

`Order ready. Secure online payment is not enabled on this deployment yet.`

Do **not** treat that message as a payment defect. Pages can validate frontend checkout behavior, but actual payment, capture, webhook, Neon `paid`, PayPal funds and order-email delivery must later be proven on the approved Netlify Production release.

For the exact next-chat starting state also read `docs/NEXT_CHAT_START_20260826.md` on this documentation branch / PR #143 until it is merged.

---

## 2. Original Production / launch-readiness track

This is the worklist that was active before paid-order email became the immediate priority.

| Work item | Status | Planning completion | Evidence / what remains |
| --- | --- | ---: | --- |
| Analyse mobile checkout failure | ✅ Repository investigation complete | **100%** | Failure modes and critical address dependency were isolated enough to redesign the checkout path. |
| Remove Google Places from the critical checkout path | ✅ Complete in repository | **100%** | PR #137 merged; manual address entry is authoritative and checkout no longer waits for Places validation. |
| Stabilise Safari/iPhone checkout inputs | ✅ Complete in repository | **100%** | 16px mobile control hardening retained. |
| Add iPhone/WebKit checkout regression coverage | ✅ Complete | **100%** | Regression workflow/tests exist and have passed on later PRs. |
| Remove `VALIDATING ADDRESS...` dependency from current repository checkout | ✅ Complete in repository | **100%** | Current checkout proceeds after local validation; no Google Places wait remains. |
| Refresh safe GitHub Pages checkout preview | ✅ Complete | **100%** | Pages preview refreshed after checkout simplification; Pages remains visual/static only. |
| Validate checkout path safely in GitHub Pages | 🟡 Mostly complete | **80%** | Static fallback correctly proved local validation reached order processing; real payment is intentionally unavailable on Pages. One screenshot showed legacy cached helper text, so fresh frontend/device proof remains preferable. |
| Fresh/private real iPhone Safari checkout validation | ⏳ Open | **25%** | Related WebKit/Pages evidence exists, but the final fresh/private physical-device validation is still outstanding. |
| Explain or definitively exclude unexpected/random product-page navigation | ⏳ Open blocker | **40%** | Repository regression harness does not reproduce it, but the original Production trigger has not been conclusively explained. Do not mark fixed yet. |
| Confirm exact Netlify Production runtime currently served | 🟡 Needs fresh reconfirmation | **60%** | Earlier investigation supported `c1345f22489bf9f8259c55e6432ef4c247c0153` as the last positively supportable runtime, but the exact current deploy must be re-proven before release work. |
| Determine deliberate release scope between Production and current repository | ⏳ Open | **30%** | The production-to-main gap is understood as significant; the exact version/change set to publish still needs an explicit release decision. |
| Premium success page / truthful paid state | ✅ Complete in repository | **100%** | Server-authoritative paid presentation exists; Production end-to-end entry into it still awaits a controlled Live order. |
| Premium cancelled-payment experience | ✅ Complete in repository | **100%** | Cart retention and no false paid state are covered in repository work. |
| Production-build validation for post-checkout pages | ✅ Complete | **100%** | Repository quality/build checks are green. |
| Netlify contact-form implementation | ✅ Complete in repository | **100%** | Netlify Forms integration exists; actual Production submission remains a separate validation task below. |
| Official website contact identity `info@legendmural.com` | ✅ Complete in source | **100%** | Visible/source identity is correct; mailbox receiving is separately unproven. |
| About Us premium narrative rebuild | ⏳ Deferred | **0%** | Current section remains rejected; redesign intentionally postponed until core selling flow is reliable. |
| Add official YouTube + Facebook links | ⏳ Deferred | **0%** | Supplied URLs are preserved in the handoff; no implementation yet. |
| Owner visual approval of the complete intended frontend release | ⏳ Open | **25%** | Individual preview elements were reviewed, but the final release bundle still needs explicit visual approval. |
| Publish explicitly approved release to Netlify Production | ⏳ Not started for current release | **0%** | Do not deploy all of `main` blindly; release scope and approval come first. |
| Production checkout smoke test after approved deploy | ⏳ Not started | **0%** | Must be done only after the approved version is actually published. |
| Production Netlify Forms submission test | ⏳ Not started | **0%** | One real safe Production submission is still required. |
| Controlled real PayPal Live order | ⏳ Not started | **0%** | Must wait until checkout/release blockers and paid-order email integration are ready. |
| Verify `capture-paypal-order` on the controlled Live order | ⏳ Waiting on Live order | **0%** | Required evidence after payment. |
| Verify `PAYMENT.CAPTURE.COMPLETED` webhook + HTTP 200 | ⏳ Waiting on Live order | **0%** | Required evidence after payment. |
| Verify Neon authoritative order becomes `paid` | ⏳ Waiting on Live order | **0%** | Required evidence after payment. |
| Verify `/api/order-status` returns `paid` | ⏳ Waiting on Live order | **0%** | Required evidence after payment. |
| Verify money is actually visible in PayPal business account | ⏳ Waiting on Live order | **0%** | Required financial truth check. |
| Verify exactly one merchant paid-order email | ⏳ Waiting on email integration + Live order | **0%** | Must prove correct recipient/content and no duplicate delivery. |
| Verify exactly one customer paid-order confirmation | ⏳ Waiting on email integration + Live order | **0%** | Must prove correct content and no duplicate delivery. |
| Validate withdrawal flow using a real valid paid order | ⏳ Later | **0%** | Do not weaken order verification for fake test data. |
| Close formal Production go/no-go checklist | ⏳ Final gate | **0%** | Only after all required runtime evidence exists. |

### Original launch track planning estimate

The original Production/launch-readiness track is approximately **60–65% complete**.

This does **not** mean the remaining work is low-risk. Most remaining items are high-value Production proof and release gates.

---

## 3. Paid-order email track added as an intermediate priority

This track was inserted because a technically successful paid order must also produce reliable operational/customer confirmation without duplicate email.

| Work item | Status | Planning completion | Evidence / what remains |
| --- | --- | ---: | --- |
| Analyse authoritative paid-order data and email architecture | ✅ Complete | **100%** | Neon = order truth, PayPal = payment proof, Netlify = orchestration, Resend = delivery. |
| Durable Neon notification schema/store code | ✅ Complete in repository | **100%** | PR #140 merged; unique `order_reference + notification_type` and claim/delivery state implemented. |
| Merchant paid-order email template | ✅ Complete in repository | **100%** | Includes fulfilment-oriented order/customer/shipping/product/totals data. |
| Customer paid-order confirmation template | ✅ Complete in repository | **100%** | Includes order summary and PayPal Order ID. |
| `ORDER_EMAILS_ENABLED` kill switch | ✅ Complete | **100%** | Safe activation control exists. |
| Enforce `paid + live` before delivery | ✅ Complete | **100%** | Tested guard boundary. |
| Resend per-order/per-type idempotency | ✅ Complete | **100%** | Deterministic provider idempotency key exists. |
| Correct euro item values vs cent order totals | ✅ Complete + regression tested | **100%** | Prevents €45.00 from rendering as €0.45. |
| Escape customer/order data in HTML email | ✅ Complete | **100%** | Covered by tests. |
| Merge guarded email layer to `main` | ✅ Complete | **100%** | PR #141 merged; runtime-code baseline `370c873c3fec88abea6b0fd1ec4d2983e1491ea0`. |
| Post-merge quality/accessibility checks for PR #141 runtime | ✅ Complete | **100%** | Exact runtime baseline later received green Quality + Accessibility results. |
| Wire paid-order notification reconciliation into PayPal capture path | ⏳ Not started | **0%** | First requires read-only integration analysis to select the safest boundary. |
| Wire same reconciliation into PayPal webhook path | ⏳ Not started | **0%** | Must share durable idempotent logic with capture. |
| Prove capture + webhook cannot duplicate merchant/customer mail | ⏳ Not started | **0%** | Required integration tests before merge. |
| Ensure email failure remains non-fatal to payment truth in runtime integration | ⏳ Not started | **0%** | Architecture requires this; runtime wiring tests still needed. |
| Execute Neon migrations 009/010 in Production | ⏳ Not started | **0%** | Must be separate, controlled Production step. |
| Verify/set `ORDER_NOTIFICATION_TO` in Production | ⏳ Not started | **0%** | Recipient must not be hard-coded. |
| Verify Production `RESEND_FROM` / `RESEND_REPLY_TO` / sending domain | ⏳ Not started for paid-order flow | **0%** | Do not expose secret values in chat. |
| Activate `ORDER_EMAILS_ENABLED=true` at controlled point | ⏳ Not started | **0%** | Keep disabled until approved activation/release point. |
| Real merchant + customer paid-order email end-to-end proof | ⏳ Not started | **0%** | Must happen with the single controlled Live order. |

### Paid-order email planning estimate

Paid-order email is approximately **60–65% complete** overall.

The repository foundation is largely complete; the remaining work is runtime integration, Production configuration/migrations and real delivery proof.

---

## 4. Overall LegendMural technical readiness

Approximate technical launch readiness: **~75%**.

For planning, it is useful to distinguish two dimensions:

| Dimension | Approximate state | Meaning |
| --- | ---: | --- |
| Repository/code readiness | **~85–90%** | Most core checkout/payment/post-checkout/email building blocks now exist in code with tests. |
| Production/end-to-end proof | **~55–60%** | The approved Production release, real PayPal transaction, webhook/Neon truth, emails and final device/runtime proof remain incomplete. |
| Combined technical launch readiness | **~75%** | Planning estimate only; not a release approval. |

LegendMural remains **not fully selling-ready** until the controlled Live transaction and all mandatory truth checks succeed.

---

## 5. Remaining critical path

Unless priorities explicitly change, finish in this order:

1. Read-only analysis of the safest shared paid-order notification integration point.
2. Build capture + webhook notification integration on a new branch with duplicate/failure tests.
3. Merge only after green CI.
4. Execute Production Neon notification migrations 009/010 as a separate controlled step.
5. Verify Production Resend/merchant recipient configuration while keeping emails disabled until approved activation.
6. Reconfirm exact Netlify Production runtime and define the precise release scope.
7. Complete fresh/private iPhone Safari checkout validation and keep random product navigation open until sufficient evidence exists.
8. Obtain explicit visual/release approval.
9. Publish only the approved version to Netlify Production.
10. Run safe Production smoke checks, including checkout and Netlify Forms.
11. Controlled activation of paid-order emails.
12. Perform exactly one controlled PayPal Live order.
13. Verify capture, webhook, Neon `paid`, `/api/order-status`, PayPal funds and exactly one of each intended email.
14. Use that real order later for withdrawal validation.
15. Close the formal go/no-go checklist only after all required runtime evidence exists.

---

## 6. Deferred work that must not disappear

These are intentionally deferred, not cancelled:

- About Us premium narrative rebuild;
- official YouTube/Facebook links;
- broader contact/mailbox validation;
- withdrawal end-to-end validation after a real order;
- unrelated dashboard work in `ALKAVisuals/legendmural-dashboard`.

Known official social URLs are preserved in `docs/CURRENT_PRODUCTION_STATUS_20260826.md`.

---

## 7. Current GitHub handoff nuance

PR #143 is documentation-only. On its current exact head at this update, all three GitHub Actions checks are green:

- `Quality gate` — success;
- `Static accessibility inventory` — success;
- `iPhone WebKit checkout regression` — success.

Earlier runs of the existing WebKit regression had failed while waiting for the seeded cart counter to become `1`, before the actual checkout/payment-fallback assertions were reached. That historical harness instability remains relevant context, but it no longer blocks PR #143 on its current head.

A separate experiment branch / PR #144 exists only to harden diagnostics/seeding for that WebKit test:

`test/webkit-cart-seeding-hardening-20260826`

Its current net change is limited to `tests/browser/mobile-checkout-webkit.mjs`. The hardening approach uses Playwright `storageState`, explicit seeded-storage checks and additional browser/request diagnostics, but PR #144's own current iPhone WebKit regression check is red. Therefore PR #144 must not be merged as a prerequisite for PR #143 and must not be treated as proven hardening yet.

PR #144 is not Production code and must not be treated as the fix for the original mobile Production symptom.

See `docs/NEXT_CHAT_START_20260826.md` for the exact current branch/PR distinction and next-chat starting order.

---

## 8. Instruction for a future chat

A future LegendMural production chat should read **all current handoff material available for this state** before making repository changes:

1. `docs/CURRENT_PRODUCTION_STATUS_20260826.md` — architecture, security boundaries, decisions and next implementation sequence.
2. `docs/LAUNCH_READINESS_PROGRESS_20260826.md` — detailed worklist, percentages and remaining launch path.
3. `docs/NEXT_CHAT_START_20260826.md` — environment distinction, current open PR/test-branch nuance and exact next starting action.

If PR #143 has not yet been merged, documents 2 and 3 live on its branch and should be read there.

If the documents ever appear to conflict, prefer verified current repository/runtime evidence and update the documentation before proceeding with risky Production work.
