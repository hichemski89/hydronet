import { ComponentType } from 'react';
import { Tool, useNetworkStore } from '../store/networkStore';
import {
  SelectIcon,
  PanIcon,
  JunctionIcon,
  ReservoirIcon,
  TankIcon,
  PipeIcon,
  PumpIcon,
  ValveIcon,
  ProfileIcon,
} from './Icons';

interface ToolDef {
  id: Tool;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  group: number;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Sélection / Déplacement', Icon: SelectIcon, group: 0 },
  { id: 'pan', label: 'Déplacer la vue', Icon: PanIcon, group: 0 },
  { id: 'junction', label: 'Nœud de demande', Icon: JunctionIcon, group: 1 },
  { id: 'reservoir', label: 'Réservoir / Source', Icon: ReservoirIcon, group: 1 },
  { id: 'tank', label: 'Château d’eau', Icon: TankIcon, group: 1 },
  { id: 'pipe', label: 'Conduite', Icon: PipeIcon, group: 2 },
  { id: 'pump', label: 'Pompe', Icon: PumpIcon, group: 2 },
  { id: 'valve', label: 'Vanne', Icon: ValveIcon, group: 2 },
  { id: 'profile', label: 'Profil en long', Icon: ProfileIcon, group: 3 },
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
        const { Icon } = t;
        return (
          <div key={t.id}>
            {sep && <div className="tool-sep" />}
            <button
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              <Icon size={22} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
