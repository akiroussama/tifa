"""Check deployable HTML links and the source-to-media inventory without dependencies."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
errors = []

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.refs = []
        self.h1 = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'h1':
            self.h1 += 1
        if 'id' in a:
            if a['id'] in self.ids:
                errors.append(f'Duplicate HTML id: {a["id"]}')
            self.ids.add(a['id'])
        for attr in ('src', 'href'):
            if a.get(attr):
                self.refs.append(a[attr])
        if tag == 'img' and 'alt' not in a:
            errors.append('Image is missing an alt attribute')

pages = {}
for path in ROOT.glob('*.html'):
    page = Page()
    page.feed(path.read_text(encoding='utf-8'))
    pages[path.name] = page
    if page.h1 != 1:
        errors.append(f'{path.name}: expected one h1, found {page.h1}')

for name, page in pages.items():
    for ref in page.refs:
        u = urlsplit(ref)
        if u.scheme or u.netloc:
            continue
        file = unquote(u.path).lstrip('/')
        target = ROOT / file if file else ROOT / name
        if not target.exists():
            errors.append(f'{name}: missing target {ref}')
        if u.fragment and target.name in pages and u.fragment not in pages[target.name].ids:
            errors.append(f'{name}: missing anchor {ref}')

data_js = "global.window={}; require('./assets/js/content.js'); console.log(JSON.stringify(window.TIFA_CONTENT))"
data = json.loads(subprocess.check_output(['node', '-e', data_js], cwd=ROOT, text=True, encoding='utf-8'))
event_ids = [event['id'] for event in data['events']]
if len(event_ids) != len(set(event_ids)):
    errors.append('Duplicate event IDs')
photos = []
for event in data['events']:
    if not event['source'].startswith('https://'):
        errors.append(f'{event["id"]}: source URL missing')
    if len(event['images']) != len(event['imageAlts']):
        errors.append(f'{event["id"]}: mismatched images/captions')
    for identifier in event['images']:
        file = f'assets/images/facebook-{identifier}.jpg'
        photos.append(file)
        if not (ROOT / file).exists():
            errors.append(f'Missing event photo: {file}')

inventory = json.loads((ROOT / 'ops/media-provenance.json').read_text(encoding='utf-8'))
documented = {record['file'] for record in inventory}
for photo in photos:
    if photo not in documented:
        errors.append(f'Photo missing provenance: {photo}')
if data['coverage']['complete']:
    errors.append('Coverage must remain partial until archives are fully verified')

if errors:
    raise SystemExit('\n'.join(errors))
print(f'OK: {len(pages)} pages, {len(event_ids)} sourced events, {len(photos)} photos, {len(data["founders"])} founders; local links and media provenance verified.')
