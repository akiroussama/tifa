"""Require a complete translation of the current pages, activities and image descriptions."""
import json
import re
import subprocess

from i18n_inventory import ROOT, inventory


def load_catalogues():
    script = """
global.window = {};
require('./assets/js/content.js');
for (const lang of ['en', 'ar', 'hi']) require(`./assets/js/i18n/${lang}.js`);
console.log(JSON.stringify([window.TIFA_CONTENT.events, window.TIFA_MESSAGES]));
"""
    return json.loads(subprocess.check_output(['node', '-e', script], cwd=ROOT, encoding='utf-8'))


def placeholders(text):
    return sorted(re.findall(r'\{\w+\}', text))


events, catalogues = load_catalogues()
source_keys = {value for section in inventory().values() for value in section}
source_events = {event['id']: event for event in events}
fields = {'title', 'summary', 'body', 'dateNote', 'dateLabel', 'imageAlts'}
errors = []
for lang in ('en', 'ar', 'hi'):
    catalogue = catalogues[lang]
    messages = catalogue['text']
    for key in sorted(source_keys - messages.keys()):
        errors.append(f'{lang}: missing page string {key!r}')
    for key in sorted(messages.keys() - source_keys):
        errors.append(f'{lang}: unused page string {key!r}')
    for key in source_keys & messages.keys():
        value = messages[key]
        if not isinstance(value, str) or not value.strip() or placeholders(key) != placeholders(value):
            errors.append(f'{lang}: invalid string or placeholders for {key!r}')
    localized_events = catalogue['events']
    if localized_events.keys() != source_events.keys():
        errors.append(f'{lang}: event IDs do not match the archive')
    for event_id, localized in localized_events.items():
        if localized.keys() != fields:
            errors.append(f'{lang}/{event_id}: use only the six translatable event fields')
            continue
        if any(not isinstance(localized[key], str) or not localized[key].strip() for key in fields - {'imageAlts'}):
            errors.append(f'{lang}/{event_id}: incomplete event text')
        alts = localized['imageAlts']
        if not isinstance(alts, list) or len(alts) != len(source_events.get(event_id, {}).get('images', ())) or any(
            not isinstance(alt, str) or not alt.strip() for alt in alts
        ):
            errors.append(f'{lang}/{event_id}: image descriptions do not match the photos')

if errors:
    raise SystemExit('\n'.join(errors))
print(f'OK: French + 3 translations, {len(source_keys)} interface strings, {len(events)} events and their image descriptions per language.')
