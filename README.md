# TIFA — Association d’Amitié Tuniso-Indienne

Site statique créé pour TIFA. HTML, CSS et JavaScript natifs, sans installation, framework, service de collecte ni compilation.

## Voir le site

Depuis `C:\workspace\tifa` :

```powershell
python -m http.server 4175 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:4175/`. `index.html` peut aussi être ouvert directement dans un navigateur.

## Importer dans Vercel

Le déploiement est pris en charge par Oussama.

1. Importer le dépôt `akiroussama/tifa` dans le compte Vercel souhaité.
2. Choisir le preset **Other**, racine du dépôt.
3. Laisser les commandes d’installation et de compilation vides et utiliser la racine comme dossier de sortie (`.`).
4. Déployer, puis contrôler les trois pages, les neuf photos, le logo, les filtres, les fiches et la version mobile.
5. Compléter le responsable de publication et les coordonnées de l’hébergement dans `mentions-legales.html`, puis renseigner les URL absolues de partage/canonical quand le domaine final est connu.

`vercel.json` configure les en-têtes. `.vercelignore` exclut les notes de travail et les scripts de l’artefact livré.

## Direction visuelle

**Horizons partagés** : bleu nuit, cuivre clair et ivoire ; typographie éditoriale ; globe tracé en SVG avec lien entre Tunis et New Delhi ; grands espaces ; quatre objectifs ; rencontres en images ; histoire ; bureau fondateur ; galerie ; contact.

Le logo fourni `Logo_vec.png` est copié à l’identique. Le globe est une illustration géométrique créée en code ; il n’est pas une photographie d’événement. Aucun portrait ni événement d’ABSFJ n’est repris.

## Mettre à jour les contenus

- `assets/js/content.js` : rencontres, liens sources, textes originaux, dates et fondateurs.
- `assets/images/` : logo et images copiées des publications réelles.
- `ops/media-provenance.json` : origine et dimensions des médias.
- `ops/CONTENU-ET-SOURCES.md` : faits, limites, pièces attendues et méthode de collecte.
- `constitution.html` : données de l’annonce publiée au JORT.

Pour ajouter une rencontre, suivre la structure d’une fiche dans `content.js`. Préserver les identifiants, les dates de l’événement séparées des dates de publication et le lien source. Une fiche sans photo s’affiche en texte. La galerie est dérivée des mêmes données pour éviter les décalages.

## État du contenu

Première version : quatre fiches sourcées, dont deux publications Facebook TIFA avec neuf photographies ; deux comptes rendus de l’ambassade en texte ; cinq fondateurs publiés au JORT. La composition actuelle du bureau, les autres membres, les statuts complets et l’exhaustivité des archives Facebook restent à établir.

Le nom `Constitution d’une Association` du document reçu désigne une annonce au JORT ; ce n’est pas un exemplaire des statuts complets. Les fichiers PDF reçus restent locaux, car les pages comportent aussi des annonces sans rapport avec TIFA.

## Contrôles

```powershell
node --check assets/js/content.js
node --check assets/js/main.js
python scripts/validate_site.py
```

La vérification visuelle se fait dans le navigateur sur bureau et mobile. Les dialogues natifs assurent le parcours clavier ; les filtres ont un état accessible ; la préférence de réduction des mouvements est respectée. Le bouton de pause et la suspension dans les onglets masqués contrôlent l’animation du globe.

Pas de synchronisation Facebook planifiée dans cette version. Pas de déploiement lancé depuis cette session.
