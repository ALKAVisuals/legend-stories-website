from pathlib import Path
import hashlib
import json
import re

ROOT = Path('.')
TEMPLATE = ROOT / 'templates/product-page.html'
STATIC_PAGES = [
    ROOT / 'about.html',
    ROOT / 'index.html',
    ROOT / 'shop.html',
    ROOT / 'combat-legends.html',
    ROOT / 'music-legends.html',
    ROOT / 'sport-legends.html',
    ROOT / 'wisdom-legends.html',
]

CHECKOUT_FIELDS = [
    ('checkout-firstname', 'First name *', 'given-name', 'input'),
    ('checkout-lastname', 'Last name *', 'family-name', 'input'),
    ('checkout-email', 'Email *', 'email', 'input'),
    ('checkout-street', 'Street + number *', 'street-address', 'input'),
    ('checkout-zip', 'Postal code *', 'postal-code', 'input'),
    ('checkout-city', 'City *', 'address-level2', 'input'),
    ('checkout-country', 'Country *', 'country', 'select'),
]

def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact match, found {count}')
    return source.replace(old, new, 1)

def add_label_for(source, control_id, label_text, tag):
    pattern = re.compile(
        rf'(<label\b)(?![^>]*\bfor=)([^>]*)>(\s*{re.escape(label_text)}\s*)</label>'
        rf'(\s*<{tag}\b[^>]*\bid="{re.escape(control_id)}"[^>]*>)',
        re.IGNORECASE,
    )
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise SystemExit(f'{control_id}: expected 1 directly associated unbound label, found {len(matches)}')
    return pattern.sub(
        rf'\1\2 for="{control_id}">\3</label>\4',
        source,
        count=1,
    )

def bind_nearest_label(source, control_id, label_text):
    control_pattern = re.compile(
        rf'<(?:input|select|textarea)\b[^>]*\bid="{re.escape(control_id)}"[^>]*>',
        re.IGNORECASE,
    )
    controls = list(control_pattern.finditer(source))
    if len(controls) != 1:
        raise SystemExit(f'{control_id}: expected 1 control, found {len(controls)}')
    control = controls[0]

    label_pattern = re.compile(
        rf'(<label\b)(?![^>]*\bfor=)([^>]*)>(\s*{re.escape(label_text)}\s*)</label>',
        re.IGNORECASE,
    )
    candidates = [label for label in label_pattern.finditer(source) if label.end() < control.start()]
    if not candidates:
        raise SystemExit(f'{control_id}: no preceding unbound label found')
    label = max(candidates, key=lambda match: match.end())
    distance = control.start() - label.end()
    if distance > 1000:
        raise SystemExit(f'{control_id}: nearest label is too far from its control ({distance} characters)')

    replacement = f'<label{label.group(2)} for="{control_id}">{label.group(3)}</label>'
    return source[:label.start()] + replacement + source[label.end():]

def set_attribute(source, tag, control_id, attribute, value):
    pattern = re.compile(
        rf'<{tag}\b[^>]*\bid="{re.escape(control_id)}"[^>]*>',
        re.IGNORECASE,
    )
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise SystemExit(f'{control_id}: expected 1 <{tag}> tag, found {len(matches)}')
    old = matches[0].group(0)
    cleaned = re.sub(
        rf'\s+{re.escape(attribute)}=(?:"[^"]*"|\'[^\']*\'|[^\s>]+)',
        '',
        old,
        flags=re.IGNORECASE,
    )
    if cleaned.endswith('/>'):
        new = cleaned[:-2].rstrip() + f' {attribute}="{value}" />'
    else:
        new = cleaned[:-1].rstrip() + f' {attribute}="{value}">'
    return source[:matches[0].start()] + new + source[matches[0].end():]

def label_footer_logo(source, label):
    pattern = re.compile(
        r'<a(?P<attrs>[^>]*\bhref="index\.html"[^>]*\bclass="[^"]*\blogo-wrap\b[^"]*"[^>]*)>'
        r'(?=\s*<img[^>]*\blm-logo-transparant\.png[^>]*\balt="")',
        re.IGNORECASE,
    )
    changed = 0

    def replace(match):
        nonlocal changed
        attrs = match.group('attrs')
        if re.search(r'\baria-label=', attrs, re.IGNORECASE):
            return match.group(0)
        changed += 1
        return f'<a{attrs} aria-label="Legend Stories Home">'

    updated = pattern.sub(replace, source)
    if changed != 1:
        raise SystemExit(f'{label}: expected 1 unnamed footer logo link, changed {changed}')
    return updated

def migrate_checkout_markup(source, label):
    for control_id, label_text, autocomplete, tag in CHECKOUT_FIELDS:
        source = add_label_for(source, control_id, label_text, tag)
        source = set_attribute(source, tag, control_id, 'autocomplete', autocomplete)
    source = label_footer_logo(source, label)
    return source

template = TEMPLATE.read_text(encoding='utf-8')
template = migrate_checkout_markup(template, str(TEMPLATE))
TEMPLATE.write_text(template, encoding='utf-8')

for page in STATIC_PAGES:
    source = page.read_text(encoding='utf-8')
    if 'id="checkout-firstname"' not in source:
        raise SystemExit(f'{page}: shared checkout surface not found')
    source = migrate_checkout_markup(source, str(page))
    page.write_text(source, encoding='utf-8')

discount_pages = []
for page in STATIC_PAGES:
    source = page.read_text(encoding='utf-8')
    if 'id="checkout-discount"' not in source:
        continue
    source = bind_nearest_label(source, 'checkout-discount', 'Discount code')
    page.write_text(source, encoding='utf-8')
    discount_pages.append(page.name)
if len(discount_pages) != 6:
    raise SystemExit(f'Expected 6 checkout discount fields, found {len(discount_pages)}: {discount_pages}')

index_path = ROOT / 'index.html'
index = index_path.read_text(encoding='utf-8')
index = bind_nearest_label(index, 'cart-discount', 'Discount code')
index = set_attribute(index, 'input', 'email', 'autocomplete', 'email')
index = replace_once(
    index,
    '<a href="music-truth-seeker.html" class="block">',
    '<a href="music-truth-seeker.html" class="block" aria-label="View The Truth Seeker product">',
    'Homepage featured product link',
)

testimonial_pattern = re.compile(
    r'<button class="testimonial-dot ([^"]*)" data-index="([0-3])"></button>'
)
testimonial_matches = list(testimonial_pattern.finditer(index))
if len(testimonial_matches) != 4:
    raise SystemExit(f'Expected 4 testimonial controls, found {len(testimonial_matches)}')

def testimonial_control(match):
    classes, index_value = match.groups()
    number = int(index_value) + 1
    pressed = 'true' if index_value == '0' else 'false'
    return (
        f'<button type="button" class="testimonial-dot {classes}" data-index="{index_value}" '
        f'aria-label="Show testimonial {number}" aria-pressed="{pressed}"></button>'
    )

index = testimonial_pattern.sub(testimonial_control, index)

old_upsell = (
    '<div class="flex items-center gap-2 p-2 rounded-lg bg-surface-light/30 hover:bg-surface-light/50 transition-colors cursor-pointer" '
    'onclick="window.legendApp.addProduct(\'The Grind Cycle\', 49.95, \'🥊\')">'
    '<div class="w-8 h-8 rounded bg-surface flex items-center justify-center text-sm">🥊</div>'
    '<div class="flex-1 min-w-0"><p class="text-[11px] font-medium text-text-primary truncate">The Grind Cycle</p>'
    '<p class="text-[10px] text-mint">€49,95</p></div><span class="text-[10px] text-mint">+ Add</span></div>'
)
new_upsell = (
    '<button type="button" class="add-to-cart-btn w-full text-left flex items-center gap-2 p-2 rounded-lg '
    'bg-surface-light/30 hover:bg-surface-light/50 transition-colors cursor-pointer" '
    'data-page="combat-grind-cycle.html" data-name="The Grind Cycle" data-price="49.95" data-emoji="🥊">'
    '<span class="w-8 h-8 rounded bg-surface flex items-center justify-center text-sm">🥊</span>'
    '<span class="flex-1 min-w-0"><span class="block text-[11px] font-medium text-text-primary truncate">The Grind Cycle</span>'
    '<span class="block text-[10px] text-mint">€49,95</span></span><span class="text-[10px] text-mint">+ Add</span></button>'
)
index = replace_once(index, old_upsell, new_upsell, 'Homepage cart upsell')
index_path.write_text(index, encoding='utf-8')

app_path = ROOT / 'js/app.js'
app = app_path.read_text(encoding='utf-8')
old_dot_state = (
    "        dot.classList.toggle('bg-mint', i === index);\n"
    "        dot.classList.toggle('bg-surface-border', i !== index);"
)
new_dot_state = (
    "        dot.classList.toggle('bg-mint', i === index);\n"
    "        dot.classList.toggle('bg-surface-border', i !== index);\n"
    "        dot.setAttribute('aria-pressed', i === index ? 'true' : 'false');"
)
app = replace_once(app, old_dot_state, new_dot_state, 'Testimonial pressed state')
app_path.write_text(app, encoding='utf-8')

template_hash = hashlib.sha256(template.encode('utf-8')).hexdigest()
presentation_paths = sorted((ROOT / 'data/products').glob('2026-batch-*-presentation.json'))
if len(presentation_paths) != 6:
    raise SystemExit(f'Expected 6 presentation manifests, found {len(presentation_paths)}')
for path in presentation_paths:
    data = json.loads(path.read_text(encoding='utf-8'))
    if 'template' not in data or 'sha256' not in data['template']:
        raise SystemExit(f'{path}: template hash field is missing')
    data['template']['sha256'] = template_hash
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

print('Updated the shared template, 7 static pages, 6 presentation manifests and app runtime.')
