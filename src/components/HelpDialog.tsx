import { useEffect } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { PRODUCT, APP_VERSION } from '../legal/eula';

/** Documentation intégrée du logiciel. */
export default function HelpDialog() {
  const open = useNetworkStore((s) => s.helpOpen);
  const setOpen = useNetworkStore((s) => s.setHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Documentation — {PRODUCT}</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="modal-body help-body">
          <p className="help-intro">
            {PRODUCT} permet de modéliser, simuler et analyser les réseaux d’eau sous pression
            (distribution, AEP). Voici l’essentiel pour démarrer.
          </p>

          <h4>1. Interface</h4>
          <ul>
            <li><b>Barre du haut</b> : Fichier, Édition, Données, Simulation, Export.</li>
            <li><b>Palette d’outils</b> (à gauche) : sélection, déplacement, et éléments à dessiner.</li>
            <li><b>Plan</b> (au centre) : zone de dessin du réseau.</li>
            <li><b>Panneau de droite</b> : propriétés de l’élément sélectionné et résultats.</li>
          </ul>

          <h4>2. Dessiner le réseau</h4>
          <ul>
            <li>Choisis un outil dans la palette : <b>nœud de demande</b>, <b>bâche à eau / source</b>,
              <b> réservoir</b>, <b>conduite</b>, <b>pompe</b>, <b>vanne</b>.</li>
            <li><b>Conduite</b> : clique le nœud de départ, des sommets éventuels, puis le nœud d’arrivée.
              Avant de tracer, choisis le <b>matériau, DN et PN</b> dans la barre « Tube à dessiner ».</li>
            <li><b>Courbure (rayon)</b> : coché = angles arrondis ; décoché = coins vifs (sans rayon).</li>
            <li><b>Angles normalisés</b> : accroche le tracé sur des angles de coude du commerce.</li>
            <li><b>Échap</b> annule le tracé en cours et revient à l’outil Sélection.</li>
            <li>Clic droit sur un sommet pendant le tracé : annuler le dernier sommet / le tracé.</li>
          </ul>

          <h4>3. Propriétés des éléments</h4>
          <ul>
            <li>Sélectionne un élément pour éditer ses propriétés (cote, demande, diamètre, longueur,
              consigne de vanne, courbe de pompe…).</li>
            <li><b>Sélection par filtre</b> (Édition) : sélectionne en masse selon un critère
              (vitesse, pression, diamètre…) ou tout sélectionner.</li>
          </ul>

          <h4>4. Fond de plan (DXF)</h4>
          <ul>
            <li><b>Fond de plan</b> : importe un DXF, gère les calques, et règle l’échelle pour dessiner
              aux longueurs réelles.</li>
          </ul>

          <h4>5. Courbes & modulations</h4>
          <ul>
            <li><b>Courbes</b> : caractéristique de pompe, rendement, volume, perte de charge.</li>
            <li><b>Modulations</b> : coefficients horaires appliqués à la demande (ou à la vitesse de
              pompe) sur 24 h.</li>
          </ul>

          <h4>6. Paramètres de simulation</h4>
          <ul>
            <li><b>Paramètres</b> : unités, formule de perte de charge (Hazen-Williams, Darcy-Weisbach,
              Chézy-Manning), durée et pas de temps, options hydrauliques, et <b>critères de
              conformité</b> (pression min/max, vitesse min/max).</li>
          </ul>

          <h4>7. Lancer la simulation</h4>
          <ul>
            <li>Clique <b>Lancer la simulation</b>. Les résultats colorent le réseau et s’affichent dans
              le panneau de droite et la barre de temps (pour les simulations sur durée).</li>
          </ul>

          <h4>8. Légende & couleurs</h4>
          <ul>
            <li><b>Valeurs</b> : couleurs selon une grandeur (pression, vitesse, débit…). Les
              <b> intervalles fixes</b> (seuils absolus personnalisables) évitent les interprétations
              trompeuses.</li>
            <li><b>Conformité</b> : vert = conforme, rouge/orange = problème (pression insuffisante ou
              excessive ; vitesse trop faible = stagnation, trop élevée = érosion), avec le nombre
              d’éléments par état.</li>
            <li>La légende est repliable (chevron) ; les seuils se modifient dans Paramètres ▸
              Conformité.</li>
          </ul>

          <h4>9. Exporter</h4>
          <ul>
            <li><b>Rapport PDF</b> : note de calcul avec plan, résultats et conformité.</li>
            <li><b>EPANET (.inp)</b> : compatible EPANET.</li>
            <li><b>AutoCAD (.dxf)</b> : plan coté avec légende, choix de l’échelle de tracé.</li>
          </ul>

          <h4>10. Fichiers</h4>
          <ul>
            <li><b>Fichier</b> : Nouveau, Ouvrir, Enregistrer / Enregistrer sous (choix du dossier),
              projets récents.</li>
            <li>Le projet est sauvegardé au format <b>.hydronet</b>.</li>
          </ul>

          <h4>11. Licence</h4>
          <ul>
            <li>{PRODUCT} requiert une <b>clé de licence</b> (liée au poste) saisie au 1er lancement.
              Voir <i>Aide ▸ À propos / Licence</i>.</li>
          </ul>

          <p className="help-foot">Version {APP_VERSION} · besoin d’aide ? hichemnar6@gmail.com</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={() => setOpen(false)}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
