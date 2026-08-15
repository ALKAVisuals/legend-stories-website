#!/usr/bin/env bash
set -euo pipefail

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch origin main

set +e
git merge --no-commit --no-ff origin/main
merge_status=$?
set -e

conflicts="$(git diff --name-only --diff-filter=U)"
expected="$(printf '%s\n' 'scripts/validate-checkout-persistence.mjs' 'scripts/validate-stripe-checkout.mjs' | sort)"
actual="$(printf '%s\n' "$conflicts" | sed '/^$/d' | sort)"
if [[ "$actual" != "$expected" ]]; then
  echo "Unexpected merge conflict set:"
  printf '%s\n' "$conflicts"
  exit 1
fi

git rm scripts/validate-stripe-checkout.mjs
git checkout --theirs scripts/validate-checkout-persistence.mjs

python - <<'PY'
from pathlib import Path

path = Path('scripts/validate-checkout-persistence.mjs')
text = path.read_text(encoding='utf-8')
replacements = {
    "const variantId = index % 2 === 0 ? 'statement-50x50' : 'compact-50x30';":
        "const variantId = index % 2 === 0 ? 'statement-45' : 'compact-30';",
    "if (JSON.stringify(variantIds) !== JSON.stringify(['compact-50x30', 'statement-50x50'])) {\n    errors.push(`${product.page}: pending order did not preserve both selected sizes.`);\n  }":
        "if (JSON.stringify(variantIds) !== JSON.stringify(['compact-30', 'statement-45'])) {\n    errors.push(`${product.page}: pending order did not preserve both canonical 30/45 cm sizes.`);\n  }\n  const sizeCms = storedOrder?.items.map((item) => item.sizeCm).sort((a, b) => a - b);\n  if (JSON.stringify(sizeCms) !== JSON.stringify([30, 45])) {\n    errors.push(`${product.page}: pending order did not persist exact 30/45 cm production sizes.`);\n  }",
    "items: [{ page: catalog[0].page, variantId: 'statement-50x50', quantity: 1 }]":
        "items: [{ page: catalog[0].page, variantId: 'statement-45', quantity: 1 }]",
    "with authoritative production-box records, NL delivery data, explicit PayPal identity and fail-closed storage.":
        "with canonical 30/45 cm production records, NL delivery data, explicit PayPal identity and fail-closed storage.",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Expected validator fragment not found: {old!r}')
    text = text.replace(old, new)

marker = "    const storedItem = storedOrder.items[0];\n"
addition = (
    "    const storedItem = storedOrder.items[0];\n"
    "    if (storedItem.productId !== product.productId) {\n"
    "      errors.push(`${product.page}: stored order lost canonical product identity.`);\n"
    "    }\n"
)
if marker not in text:
    raise SystemExit('Stored-item marker not found.')
text = text.replace(marker, addition, 1)
path.write_text(text, encoding='utf-8')
PY

git add scripts/validate-checkout-persistence.mjs

if git diff --name-only --diff-filter=U | grep -q .; then
  echo "Unresolved merge conflicts remain:"
  git diff --name-only --diff-filter=U
  exit 1
fi

grep -q "productId: item.productId" server/orders/checkout-persistence.mjs

if [[ "$merge_status" -eq 0 ]]; then
  echo "Merge reported no conflicts; validated resolution still applies."
fi
