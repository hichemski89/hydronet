import { useNetworkStore } from '../store/networkStore';
import {
  PIPE_MATERIALS,
  getMaterial,
  getDiameter,
  getSize,
  minBendRadiusMeters,
} from '../data/pipeCatalog';

const ANGLE_PRESETS: { label: string; angles: number[] }[] = [
  { label: '90°', angles: [90] },
  { label: '45° / 90°', angles: [45, 90] },
  { label: '22,5° / 45° / 90°', angles: [22.5, 45, 90] },
  { label: 'Multiples de 11,25°', angles: [11.25, 22.5, 33.75, 45, 56.25, 67.5, 78.75, 90] },
];

export default function PipeDefaultsBar() {
  const tool = useNetworkStore((s) => s.tool);
  const dp = useNetworkStore((s) => s.defaultPipe);
  const setDefaultPipe = useNetworkStore((s) => s.setDefaultPipe);
  const angleSnap = useNetworkStore((s) => s.angleSnap);
  const setAngleSnap = useNetworkStore((s) => s.setAngleSnap);
  const snapAngles = useNetworkStore((s) => s.snapAngles);
  const setSnapAngles = useNetworkStore((s) => s.setSnapAngles);

  if (tool !== 'pipe') return null;

  const presetIdx = ANGLE_PRESETS.findIndex((p) => p.angles.join(',') === snapAngles.join(','));

  const mat = getMaterial(dp.material);
  const dia = mat ? getDiameter(mat, dp.dn) : undefined;
  const size = mat ? getSize(mat, dp.dn, dp.pn) : undefined;
  const minR = minBendRadiusMeters(dp.material, dp.dn);

  const onDn = (dn: number) => {
    if (!mat) return;
    const d = getDiameter(mat, dn);
    const pn = d?.sizes.some((s) => s.pn === dp.pn) ? dp.pn : (d?.sizes[Math.floor((d.sizes.length - 1) / 2)]?.pn ?? dp.pn);
    setDefaultPipe({ dn, pn });
  };

  return (
    <div className="pipe-defaults-bar">
      <span className="pdb-title">Tube à dessiner :</span>
      <select value={dp.material} onChange={(e) => setDefaultPipe({ material: e.target.value })}>
        {PIPE_MATERIALS.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <label>
        DN
        <select value={dp.dn} onChange={(e) => onDn(Number(e.target.value))}>
          {mat?.diameters.map((d) => (
            <option key={d.dn} value={d.dn}>{d.dn}</option>
          ))}
        </select>
      </label>
      <label>
        PN
        <select value={dp.pn} onChange={(e) => setDefaultPipe({ pn: Number(e.target.value) })}>
          {dia?.sizes.map((s) => (
            <option key={s.pn} value={s.pn}>{s.pn}</option>
          ))}
        </select>
      </label>
      <span className="pdb-info">
        Ø int. <strong>{size ? size.innerDiameter : '—'} mm</strong>
        {minR != null && <> · rayon mini <strong>{minR.toFixed(2)} m</strong></>}
      </span>
      <label className="pdb-snap" title="Contraindre l'angle des tronçons aux angles de coudes standards">
        <input type="checkbox" checked={angleSnap} onChange={(e) => setAngleSnap(e.target.checked)} />
        Angles normalisés
      </label>
      {angleSnap && (
        <select
          value={presetIdx >= 0 ? presetIdx : 2}
          onChange={(e) => setSnapAngles(ANGLE_PRESETS[Number(e.target.value)].angles)}
        >
          {ANGLE_PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
