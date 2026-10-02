# TIFA — Association d’Amitié Tuniso-Indienne

Site statique créé pour TIFA. HTML, CSS et JavaScript natifs, sans installation, framework, service de collecte ni compilation.

## Voir le site

Depuis `C:\workspace\tifa` :

```powershell
python -m http.server 4175 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:4175/`. Un serveur HTTP est nécessaire pour charger le module 3D ; l’ouverture directe du fichier conserve l’illustration de repli.

## Importer dans Vercel

Le déploiement est pris en charge par Oussama.

1. Importer le dépôt `akiroussama/tifa` dans le compte Vercel souhaité.
2. Choisir le preset **Other**, racine du dépôt.
3. Laisser les commandes d’installation et de compilation vides et utiliser la racine comme dossier de sortie (`.`).
4. Déployer, puis contrôler les trois pages, les neuf photos, le logo, les filtres, les fiches et la version mobile.
5. Compléter le responsable de publication et les coordonnées de l’hébergement dans `mentions-legales.html`, puis renseigner les URL absolues de partage/canonical quand le domaine final est connu.

`vercel.json` configure les en-têtes. `.vercelignore` exclut les notes de travail et les scripts de l’artefact livré.

## Direction visuelle

**L’Inde en partage. La Tunisie au cœur.** : ouverture panoramique autour du Taj Mahal en vraie 3D, ciel safran, marbre blanc, grès rose et vert profond. Titres contemporains sans serif, pavillons des quatre objectifs, rencontres en lignes photographiques, chapitre historique rose, registre des fondateurs et galerie à arches. La composition et les composants ont été reconstruits pour TIFA.

Le logo fourni `Logo_vec.png` est copié à l’identique. Le Taj Mahal est une interprétation architecturale procédurale en Three.js : géométrie, perspective, ombres, minarets, jardins et reflet du bassin. Il ne constitue ni une photographie d’événement ni un relevé patrimonial exact. Aucun portrait ni événement d’ABSFJ n’est repris.

La dépendance Three.js 0.186.1 et sa licence MIT sont conservées localement dans `assets/vendor/`, à partir du paquet officiel npm. Aucun CDN ni étape de compilation ne sont nécessaires. `assets/js/taj-scene.js` gère le rendu ; `assets/images/taj-fallback.svg` assure le repli sans WebGL ou sans JavaScript.

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
node --check assets/js/taj-scene.js
python scripts/validate_site.py
```

La vérification visuelle se fait dans le navigateur sur bureau et mobile. Les dialogues natifs assurent le parcours clavier ; les filtres ont un état accessible. La scène 3D dispose d’une pause réelle, respecte la préférence de réduction des mouvements et s’arrête dans les onglets masqués et hors écran. Le DPR et la fréquence sont limités pour maîtriser la charge graphique.

Pas de synchronisation Facebook planifiée dans cette version. Pas de déploiement lancé depuis cette session.
