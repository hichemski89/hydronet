# HydroNet — Modélisation des réseaux d'eau

Application web de modélisation hydraulique des réseaux de distribution d'eau,
pensée comme une alternative moderne à EPANET : interface repensée et rapports
de qualité professionnelle.

Le moteur de calcul est **EPANET lui-même** (via `epanet-js`, portage WebAssembly
officiel) : les résultats hydrauliques sont **identiques à EPANET**. Tout l'effort
porte sur l'expérience utilisateur et la restitution.

## Fonctionnalités (v1)

- **Éditeur de réseau visuel** : pan/zoom, ajout et déplacement des nœuds de
  demande, réservoirs, châteaux d'eau, conduites, pompes et vannes. Tracé des
  conduites avec sommets intermédiaires.
- **Édition des propriétés** : panneau dédié pour chaque type d'élément
  (cote, demande, longueur, diamètre, rugosité, courbe de pompe, type de vanne…).
- **Simulation hydraulique** : régime permanent ou simulation sur la durée
  (24 h et plus), avec courbes de modulation de la demande.
- **Visualisation des résultats** : coloration de la carte par pression /
  charge / débit / vitesse, flèches de sens d'écoulement, légende dynamique,
  curseur temporel animé, graphiques d'évolution par élément.
- **Rapports PDF** : synthèse du réseau, plan, tableaux de résultats aux nœuds
  et conduites, avertissements — mise en page soignée.
- **Interopérabilité EPANET** : export au format `.inp`.

## Stack technique

| Élément | Technologie |
|---|---|
| Front | React 19 + TypeScript + Vite |
| État | Zustand |
| Moteur hydraulique | `epanet-js` (EPANET WASM) |
| Graphiques | Recharts |
| Rapports PDF | jsPDF + jspdf-autotable |

## Démarrage

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # build de production
```

## Architecture du code

```
src/
  types/network.ts        Modèle de données (nœuds, liens, options, résultats)
  store/networkStore.ts   État global + actions d'édition (Zustand)
  engine/
    inpBuilder.ts         Modèle → fichier EPANET .inp
    epanetRunner.ts       Exécution de la simulation via epanet-js
  components/
    NetworkCanvas.tsx     Éditeur SVG (pan/zoom, dessin, sélection)
    Toolbar.tsx           Barre supérieure (simulation, export, options)
    ToolPalette.tsx       Outils de dessin
    PropertiesPanel.tsx   Édition des propriétés de l'élément sélectionné
    ResultsPanel.tsx      Valeurs et graphiques temporels
    MapLegend.tsx         Légende et choix des métriques affichées
    TimeBar.tsx           Curseur temporel
    StatusBar.tsx         Barre d'état
  report/reportGenerator.ts  Génération du rapport PDF
  utils/                  Échelles de couleurs, formatage, capture du plan…
```

## Pistes d'évolution

- Import de fichiers `.inp` EPANET existants.
- Fond de carte géographique (coordonnées réelles).
- Module qualité de l'eau (âge, chlore, traçage de source).
- Bibliothèque de courbes de pompes et de matériaux (rugosités normalisées).
- Sauvegarde / chargement des projets (fichier ou cloud).
- Contrôles et règles de pilotage (marche/arrêt des pompes selon niveaux).
