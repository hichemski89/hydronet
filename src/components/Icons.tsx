// Jeu d'icônes SVG (24×24) — symboles d'ingénierie hydraulique et actions.
// Toutes héritent de la couleur via `currentColor`.

import { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 22, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ---------- Outils ---------- */

export const SelectIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3l0 15 3.8-3.7 2.3 5 2.4-1-2.3-4.9 5.3-.2z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PanIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v18M3 12h18" />
    <path d="M12 3l-2.4 2.6M12 3l2.4 2.6M12 21l-2.4-2.6M12 21l2.4 2.6M3 12l2.6-2.4M3 12l2.6 2.4M21 12l-2.6-2.4M21 12l-2.6 2.4" />
  </Svg>
);

export const JunctionIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
    <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const ReservoirIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="6" width="16" height="13" rx="1.2" />
    <path d="M5.5 11c1.6-1.6 3.4-1.6 5 0s3.4 1.6 5 0M5.5 14.5c1.6-1.6 3.4-1.6 5 0s3.4 1.6 5 0" strokeWidth="1.3" />
  </Svg>
);

export const TankIcon = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6.5" rx="6" ry="2" />
    <path d="M6 6.5v11c0 1.1 2.7 2 6 2s6-.9 6-2v-11" />
    <path d="M6 13.5c1.6 1 4 1 6 .3s4.4-.7 6 .3" strokeWidth="1.3" />
  </Svg>
);

export const PipeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12h3M19 12h3" />
    <rect x="5" y="9" width="14" height="6" rx="1" />
    <path d="M9 9v6M14 9v6" strokeWidth="1.2" />
  </Svg>
);

export const PumpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="11" r="6.5" />
    <path d="M10 8l5 3-5 3z" fill="currentColor" stroke="none" />
    <path d="M12 17.5V21M9 21h6" />
  </Svg>
);

export const ValveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12h3M19 12h3" />
    <path d="M5 8l7 4-7 4zM19 8l-7 4 7 4z" />
    <path d="M12 12V6M9.5 6h5" />
  </Svg>
);

export const ProfileIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4v16h16" />
    <path d="M4 16l4-5 3.5 3L16 7l4 4" />
  </Svg>
);

/* ---------- Actions ---------- */

export const NewIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 11v6M9 14h6" />
  </Svg>
);

export const OpenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);

export const SaveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M8 3v5h7V3" />
    <rect x="8" y="13" width="8" height="6" rx="0.5" />
  </Svg>
);

export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a4 4 0 0 1 4 4v1" />
  </Svg>
);

export const RedoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12H9a4 4 0 0 0-4 4v1" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" strokeWidth="1.2" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4.5l13 7.5-13 7.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PdfIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 17v-3.5h1.2a1 1 0 0 1 0 2H8.5M13 17v-3.5h1.6M13 15.3h1.3" strokeWidth="1.2" />
  </Svg>
);

export const ExportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v12M8 11l4 4 4-4" />
    <path d="M5 19h14" />
  </Svg>
);
