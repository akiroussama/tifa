"""List the French strings to translate, without changing original source quotations."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parents[1]
PAGES = ('index.html', 'constitution.html', 'mentions-legales.html')
SKIP = {'script', 'style', 'svg', 'noscript', 'template'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
FIXED = {'TIFA', 'Facebook', 'Instagram', 'LinkedIn', 'Tunisian Indian Friendship Association',
         'TIFA · Tunisia India Friendship', 'JORT N° 118', '2024R02522APSF1'}
DYNAMIC = (
    'Votre langue', 'Choisir une langue', 'Changer de langue', 'Fermer',
    'Voir la source · {source} ↗', 'Photographies de la rencontre', 'Agrandir : {title}',
    'À propos de cette fiche et de sa source', 'Cette fiche adapte le contenu de la source.',
    'Texte original (anglais)', 'Lire : {title}', 'Découvrir la rencontre ↗',
    'Découvrir : {title}', 'Réduire la liste ↑', 'Voir toutes les rencontres ({total}) ↓',
    'Rencontres affichées : {count}', 'Rencontres affichées : {count} sur {total}',
    'Animation réduite', 'Reprendre l’animation', 'Pause de l’animation',
    'Texte publié en français', 'Date mise à jour par le bureau de TIFA.', 'Photo {count}',
)


def normal(value):
    return re.sub(r'\s+', ' ', value).strip()


class Texts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.values = {}

    def add(self, value):
        value = normal(value)
        if (any(char.isalpha() for char in value) and value not in FIXED
                and not value.startswith(('@', 'https://'))
                and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value)):
            self.values[value] = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        skipped = (bool(self.stack and self.stack[-1][1]) or tag in SKIP
                   or (tag != 'html' and 'lang' in attrs))
        if tag not in VOID:
            self.stack.append((tag, skipped))
        if skipped:
            return
        for attr in ('alt', 'aria-label', 'title'):
            if attrs.get(attr):
                self.add(attrs[attr])
        if tag == 'meta' and (attrs.get('name') == 'description' or attrs.get('property') in {'og:title', 'og:description'}):
            self.add(attrs['content'])

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if not self.stack or not self.stack[-1][1]:
            self.add(data)


def inventory():
    result = {}
    seen = set()
    for name in PAGES:
        parser = Texts()
        parser.feed((ROOT / name).read_text(encoding='utf-8'))
        result[name] = [value for value in parser.values if value not in seen]
        seen.update(result[name])
    data = (ROOT / 'assets/js/content.js').read_text(encoding='utf-8')
    content = json.loads(data[data.index('{'):data.rindex('}') + 1])
    shared = [*DYNAMIC]
    for event in content['events']:
        shared.extend((event['categoryLabel'], event['sourceLabel']))
        shared.extend(source['sourceLabel'] for source in event.get('additionalSources', ()))
    for founder in content['founders']:
        shared.extend((founder['role'], founder['profession']))
    result['dynamic'] = list(dict.fromkeys(value for value in shared if value not in seen))
    return result


if __name__ == '__main__':
    print(json.dumps(inventory(), ensure_ascii=False, indent=2))
