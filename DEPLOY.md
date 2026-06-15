# Déploiement de HydroNet (GitHub + Render)

L'application est **100 % statique** (le calcul EPANET tourne dans le navigateur).
Aucun serveur n'est nécessaire : on publie le dossier `dist` généré par `npm run build`.

À chaque `git push` sur GitHub, **Render redéploie automatiquement**.

---

## Étape 1 — Mettre le code sur GitHub

Le dépôt git local et le premier commit sont **déjà faits**. Il reste à créer le
dépôt distant et à pousser le code.

1. Va sur https://github.com/new
2. Donne un nom au dépôt, par ex. **`hydronet`**.
3. Laisse-le **vide** (ne coche ni README, ni .gitignore, ni licence).
4. Clique **Create repository**.
5. GitHub affiche une URL du type `https://github.com/TON_PSEUDO/hydronet.git`.
   Copie-la, puis exécute dans le dossier du projet :

```bash
git remote add origin https://github.com/TON_PSEUDO/hydronet.git
git branch -M main
git push -u origin main
```

> GitHub demandera tes identifiants. Utilise un **jeton d'accès personnel**
> (Settings → Developer settings → Personal access tokens) comme mot de passe
> si la connexion par mot de passe classique est refusée.

---

## Étape 2 — Déployer sur Render

### Option A — Blueprint (automatique via `render.yaml`)

1. Va sur https://dashboard.render.com → **New** → **Blueprint**.
2. Connecte ton compte GitHub et sélectionne le dépôt `hydronet`.
3. Render lit le fichier `render.yaml` et propose le service **hydronet**.
4. Clique **Apply**. Le build démarre.

### Option B — Site statique manuel (le plus fiable)

1. Dashboard Render → **New** → **Static Site**.
2. Sélectionne le dépôt GitHub `hydronet`.
3. Renseigne :
   - **Build Command** : `npm install && npm run build`
   - **Publish Directory** : `dist`
4. Clique **Create Static Site**.

Au bout de 1–2 minutes, Render fournit une URL publique du type
`https://hydronet.onrender.com` — c'est le lien à partager à tes amis.

---

## Mettre à jour l'application plus tard

Après chaque modification :

```bash
git add -A
git commit -m "Description de la modification"
git push
```

Render détecte le push et redéploie tout seul.

---

## Vérifier le build en local avant de publier

```bash
npm run build      # génère dist/
npm run preview    # sert dist/ sur http://localhost:4173 pour tester
```
