# Bureau TIFA

Le bureau reprend l’interface ABSFJ pour Si Jamel. Il s’ouvrira à `/bureau-publications` sur le domaine TIFA lorsque le projet aura été configuré et déployé. ABSFJ utilise un mot de passe partagé, sans champ identifiant. Le bureau TIFA utilise le même parcours de connexion, avec sa propre session de 30 jours.

1. Se connecter, puis choisir **Ajouter une publication** ou **Modifier**.
2. Saisir un titre et un texte. Choisir un thème. Date, lieu et photos restent facultatifs. Les dates existantes au mois ou à la période sont conservées tant qu’une date précise n’est pas saisie.
3. Choisir et ordonner les photos. La première sert de couverture. **Voir l’aperçu**, puis **Publier** après relecture.
4. **Retirer du site** masque la fiche et ses photos dans la galerie. La fiche reste restaurable depuis **Retirées**. Les fichiers photo publics et les archives documentaires ne sont pas effacés.

Le bureau part des 16 fiches et des 9 photos de TIFA. Les changements s’appliquent par identifiant, sans remplacer les sources d’origine. Les textes déjà traduits restent dans les quatre langues lorsque leurs champs ne changent pas ; un nouveau texte ou un texte modifié s’affiche en français jusqu’à traduction. L’archive versionnée reste accessible si le service de publication est indisponible ; pendant cette indisponibilité, elle peut inclure une fiche de référence normalement retirée.

## Activation sur Vercel

Dans le projet **TIFA** uniquement, configurer les variables d’environnement de production avec les valeurs protégées. Une configuration Preview distincte, si souhaitée, doit employer des données et des clés de test.

| Nom serveur | Valeur attendue |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Connexion à un store Vercel Blob public dédié à TIFA. Les médias sont publics ; l’état du bureau est chiffré avant stockage. |
| `PUBLICATIONS_ADMIN_PASSWORD_HASH` | Vérificateur scrypt du mot de passe actuel du bureau ABSFJ. Copier le vérificateur via un canal de configuration autorisé, ou produire un nouveau vérificateur à partir du même mot de passe dans un environnement de confiance si le secret ABSFJ n’est pas exportable. Format `scrypt:<sel hex 32 caractères>:<sortie hex 128 caractères>`, N=16384, r=8, p=1, sortie 64 octets. |
| `PUBLICATIONS_SESSION_SECRET` | Secret aléatoire TIFA distinct, au moins 32 caractères. Un changement invalide les sessions TIFA. |
| `PUBLICATIONS_STORAGE_SECRET` | Secret aléatoire TIFA distinct, au moins 32 caractères. Le conserver et le sauvegarder dans le gestionnaire de secrets ; une rotation exige une migration des publications chiffrées. |

Ne transmettre ni le mot de passe ni son vérificateur dans Git, une URL ou la messagerie. Ne pas copier le jeton de stockage, les clés de session ou le cookie d’ABSFJ. Si Jamel utilise le même mot de passe après configuration, mais se connecte séparément sur chaque domaine. Les deux espaces ne partagent aucune publication.

Sur la production, contrôler que le commit servi est le bon, que le bureau présente le formulaire, que la lecture administrative sans session renvoie `401` et que la connexion de Si Jamel fonctionne. Ne pas injecter de fiche factice sur le site en production.

## Essai isolé

Depuis la racine de TIFA :

```powershell
npm ci
npm test
npm run build
node scripts/serve-bureau-test.mjs
```

Ouvrir `http://localhost:4176/bureau-publications`. Mot de passe **de test uniquement** : `tifa-qa-local-only`. Le stockage est en mémoire, le serveur est limité à la boucle locale et les données de test disparaissent au redémarrage. Aucun appel à Vercel Blob n’est effectué par ce banc d’essai.

Le dépôt ne contient aucun secret réel. Ce test valide le parcours avec un mot de passe factice, pas la configuration Vercel ni le mot de passe actuel de Si Jamel.
