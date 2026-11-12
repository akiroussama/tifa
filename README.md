# TIFA — Association d’Amitié Tuniso-Indienne

Site TIFA en HTML, CSS et JavaScript natifs. Les pages publiques restent consultables sans l’API. Le bureau de publication utilise trois fonctions Vercel et un stockage Blob dédié.

## Voir le site

Depuis `C:\workspace\tifa` :

```powershell
python -m http.server 4175 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:4175/`. Ce serveur ne fournit que les pages et les contenus de référence. Pour tester aussi l’édition et la publication, voir [le guide du bureau](ops/BUREAU-TIFA.md).

## Importer dans Vercel

1. Utiliser le projet Vercel TIFA lié au dépôt `akiroussama/tifa`, preset **Other**, racine du dépôt. Le `vercel.json` définit `npm run build`, la sortie `public` et les fonctions d’édition. Retirer toute surcharge du tableau de bord qui imposerait l’ancienne sortie `.`.
2. Configurer le stockage dédié à TIFA et les quatre variables serveur décrites dans le [guide du bureau](ops/BUREAU-TIFA.md), sans copier les secrets de stockage ou de session ABSFJ.
3. Déployer, puis vérifier les trois pages publiques et `/bureau-publications`, ainsi que la connexion réelle, le fil des rencontres et la version mobile.
4. Compléter le responsable de publication et les coordonnées d’hébergement dans `mentions-legales.html` avec les informations validées par l’association.

La compilation ne copie que les quatre pages et `assets/` dans `public/`. L’API est déployée séparément. `.vercelignore` exclut les fichiers `.env`, notes, scripts de test et résultats locaux.

## Direction visuelle

**D’El Jem à Agra** : un seul diorama réunit l’amphithéâtre d’El Jem, les cours creusées de Matmata et le Taj Mahal. Comme sur ABSFJ, des calques vectoriels répartis en profondeur s’inclinent doucement au mouvement du pointeur. La Tunisie précède l’Inde dans les drapeaux, le titre et la scène dans les quatre langues.

Inspirations : la sobriété luxueuse de Sabyasachi (typographie serif, or sur fond sombre), l’énergie colorée d’Optimist India, les jali moghols et les palais du Rajasthan (arches polylobées, treillis à étoiles à huit branches, palette indigo, safran, souci, or et ivoire).

- Titres en Cormorant Garamond, texte en DM Sans, accents en devanagari (Tiro Devanagari Hindi) et en arabe (Amiri).
- Fonds ivoire recouverts d’un treillis jali ; sections sombres indigo et bordeaux pour l’histoire et le contact.
- Cartes, galerie et fiches en forme d’arches mogholes.
- Réseaux sociaux présents mais discrets : petites icônes monochromes dans l’en-tête, le bloc contact et le pied de page, et une section « Rejoignez la communauté TIFA » en bas de page.

Les ornements (`mandala.svg`, `jali-light.svg`, `jali-dark.svg`, `lotus.svg`) sont générés par `scripts/build_ornaments.py`. `assets/css/diorama.css` compose les cinq dessins SVG et `assets/js/diorama.js` gère leur mouvement. La scène reste lisible sans JavaScript et s’immobilise avec le bouton de pause, hors écran et quand la réduction des mouvements est demandée.

Le logo fourni `Logo_vec.png` est copié à l’identique. Les visuels d’[El Jem](https://whc.unesco.org/fr/list/38/), de [Matmata](https://iris.unirc.it/handle/20.500.12318/20885) et du [Taj Mahal](https://whc.unesco.org/en/list/252/) sont des dessins originaux à partir de références architecturales. Le Taj s’appuie sur la géométrie vectorielle existante de TIFA. La scène est une composition, non un relevé ou un paysage réel.

## Mettre à jour les contenus

- `assets/js/content.js` : rencontres, liens sources, textes originaux, précision des dates et fondateurs.
- `assets/images/` : logo et images copiées des publications réelles.
- `ops/media-provenance.json` : origine et dimensions des médias.
- `ops/CONTENU-ET-SOURCES.md` : faits, limites, pièces attendues et méthode de collecte.
- `constitution.html` : données de l’annonce publiée au JORT.

Pour ajouter une rencontre, suivre la structure d’une fiche dans `content.js`. Préserver les identifiants, les dates de l’événement séparées des dates de publication et le lien source. Une fiche sans photo s’affiche en texte. La galerie est dérivée des mêmes données pour éviter les décalages.

## Langues

Le bouton de langue se trouve en haut de page, à côté de l’icône de contact sur l’accueil. Le volet à drapeaux reprend le sélecteur d’ABSFJ et propose le français, l’anglais, l’arabe et le hindi. Le choix est conservé localement et dans le paramètre `?lang=` des liens entre pages. L’arabe est affiché de droite à gauche ; les citations originales et les références restent dans leur langue et leur sens de lecture.

Le français reste la source dans les pages HTML et `assets/js/content.js`. Pour chaque mise à jour, lancer `python -X utf8 scripts/i18n_inventory.py` afin de lister les textes à reporter dans `assets/js/i18n/{en,ar,hi}.js`. Traduire les six champs publics de toute nouvelle fiche sous son identifiant ; ses dates techniques, URLs, médias et extraits originaux restent communs aux quatre langues. Le contrôle `python -X utf8 scripts/validate_i18n.py` détecte les textes manquants et les variables oubliées.

## État du contenu

Version enrichie : seize fiches documentées, dont douze issues du rapport d’activités TIFA 2024–2026 ; deux publications Facebook avec neuf photographies ; deux comptes rendus de l’ambassade, dont la fiche Diwali complétée par le rapport ; cinq fondateurs publiés au JORT. Les quatre rencontres les plus récentes apparaissent d’abord ; le bouton d’archives donne accès aux seize fiches et les filtres affichent toutes les rencontres de leur catégorie.

Le rapport apporte notamment un protocole d’entente sur le commerce, la culture et la jeunesse, une visite à FIPA-Tunisia, des rencontres autour du leadership féminin, du yoga et de la culture, et l’assemblée générale de juin 2026. Les dates restent au mois lorsqu’aucune source ne donne le jour. Les publications de TIFA sur LinkedIn et les comptes rendus de l’ambassade précisent six dates. La page des sources détaille la divergence sur le dîner (16 mai 2025 selon l’ambassade, 17 mai selon LinkedIn TIFA, juin selon le rapport) ; une seule fiche est conservée. Le document original reste local, et seuls les passages d’activités sont restitués sur `constitution.html#rapport-activites`.

La composition actuelle du bureau, les autres membres, les statuts complets et l’exhaustivité des archives Facebook restent à établir.

Le nom `Constitution d’une Association` du document reçu désigne une annonce au JORT ; ce n’est pas un exemplaire des statuts complets. Les fichiers PDF reçus restent locaux, car les pages comportent aussi des annonces sans rapport avec TIFA.

## Contrôles

```powershell
node --check assets/js/content.js
node --check assets/js/main.js
node --check assets/js/diorama.js
npm test
npm run build
python scripts/validate_site.py
python -X utf8 scripts/validate_i18n.py
```

La vérification visuelle se fait dans le navigateur sur bureau et mobile. Les dialogues natifs assurent le parcours clavier ; les filtres ont un état accessible. Les pétales et étincelles du hero disposent d’une pause réelle, respectent la préférence de réduction des mouvements et s’arrêtent dans les onglets masqués et hors écran.

Pas de synchronisation Facebook planifiée dans cette version. Pas de déploiement lancé depuis cette session.
