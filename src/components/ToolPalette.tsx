import { Tool, useNetworkStore } from '../store/networkStore';

interface ToolDef {
  id: Tool;
  label: string;
  icon: string;
  group: number;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Sélection / Déplacement', icon: '⬚', group: 0 },
  { id: 'pan', label: 'Déplacer la vue', icon: '✋', group: 0 },
  { id: 'junction', label: 'Nœud de demande', icon: '●', group: 1 },
  { id: 'reservoir', label: 'Réservoir / Source', icon: '▭', group: 1 },
  { id: 'tank', label: 'Château d’eau', icon: '◻', group: 1 },
  { id: 'pipe', label: 'Conduite', icon: '╱', group: 2 },
  { id: 'pump', label: 'Pompe', icon: 'Ⓟ', group: 2 },
  { id: 'valve', label: 'Vanne', icon: '◈', group: 2 },
  { id: 'profile', label: 'Profil en long', icon: '⛰', group: 3 },
];

export default function ToolPalette() {
  const tool = useNetworkStore((s) => s.tool);
  const setTool = useNetworkStore((s) => s.setTool);

  let lastGroup = 0;
  return (
    <div className="tool-palette">
      {TOOLS.map((t) => {
        const sep = t.group !== lastGroup;
        lastGroup = t.group;
        return (
          <div key={t.id}>
            {sep && <div className="tool-sep" />}
            <button
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              <span className="tool-icon">{t.icon}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
