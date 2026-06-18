import { useNetworkStore } from '../store/networkStore';

const TOOL_HINTS: Record<string, string> = {
  select: 'Cliquez pour sélectionner · glissez un nœud pour le déplacer',
  rectselect: 'Glissez pour sélectionner une zone · Suppr pour tout supprimer · glissez la sélection pour la déplacer',
  pan: 'Glissez pour déplacer la vue · molette pour zoomer',
  junction: 'Cliquez sur le plan pour ajouter un nœud de demande',
  reservoir: 'Cliquez pour ajouter une bâche à eau / source (charge fixe)',
  tank: 'Cliquez pour ajouter un réservoir de stockage (niveau variable)',
  pipe: 'Nœud de départ → sommets → nœud d’arrivée · clic droit : poser un coude / annuler (Échap)',
  pump: 'Cliquez le nœud amont puis le nœud aval de la pompe',
  valve: 'Cliquez le nœud amont puis le nœud aval de la vanne',
  profile: 'Cliquez les nœuds dans l’ordre pour tracer le profil en long',
};

export default function StatusBar() {
  const tool = useNetworkStore((s) => s.tool);
  const network = useNetworkStore((s) => s.network);
  const simStatus = useNetworkStore((s) => s.simStatus);
  const simError = useNetworkStore((s) => s.simError);
  const results = useNetworkStore((s) => s.results);

  const nNodes = Object.keys(network.nodes).length;
  const nLinks = Object.keys(network.links).length;

  let statusText = 'Prêt';
  let statusClass = 'ok';
  if (simStatus === 'running') {
    statusText = 'Simulation en cours…';
    statusClass = 'busy';
  } else if (simStatus === 'error') {
    statusText = 'Erreur : ' + (simError ?? 'inconnue').split('\n')[0];
    statusClass = 'err';
  } else if (simStatus === 'done') {
    statusText = results?.warnings.length
      ? `Calcul terminé — ${results.warnings.length} avertissement(s)`
      : 'Calcul terminé avec succès';
    statusClass = results?.warnings.length ? 'warn' : 'ok';
  }

  return (
    <footer className="status-bar">
      <span className="status-hint">{TOOL_HINTS[tool]}</span>
      <span className="status-spacer" />
      <span className="status-count">
        {nNodes} nœuds · {nLinks} liens
      </span>
      <span className={`status-state ${statusClass}`}>{statusText}</span>
    </footer>
  );
}
