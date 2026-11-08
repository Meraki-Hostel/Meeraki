/**
 * Original illustrated hostel courtyard at golden hour. Pure SVG so the login
 * page never depends on a remote image.
 */
export function CampusScene({ className }: { className?: string }) {
  const windows = (x0: number, y0: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number, lit: number[] = []) =>
    Array.from({ length: cols * rows }).map((_, i) => {
      const c = i % cols; const r = Math.floor(i / cols);
      return <rect key={`${x0}-${i}`} x={x0 + c * (w + gx)} y={y0 + r * (h + gy)} width={w} height={h} rx={1.5} fill={lit.includes(i) ? '#f6d6a4' : '#7b5c4f'} opacity={lit.includes(i) ? 0.95 : 0.55} />;
    });
  return (
    <svg viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3dcc2" /><stop offset="0.55" stopColor="#f6e6d2" /><stop offset="1" stopColor="#efd9c0" /></linearGradient>
        <radialGradient id="sun" cx="0.32" cy="0.3" r="0.55"><stop offset="0" stopColor="#fff2da" stopOpacity="0.95" /><stop offset="1" stopColor="#fff2da" stopOpacity="0" /></radialGradient>
        <linearGradient id="bldA" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#e9d6c0" /><stop offset="1" stopColor="#d9bfa4" /></linearGradient>
        <linearGradient id="bldB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d79b84" /><stop offset="1" stopColor="#c4826d" /></linearGradient>
        <linearGradient id="path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e8d3bb" /><stop offset="1" stopColor="#cfb294" /></linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stopColor="#3b2622" stopOpacity="0" /><stop offset="1" stopColor="#3b2622" stopOpacity="0.28" /></linearGradient>
      </defs>
      <rect width="800" height="900" fill="url(#sky)" />
      <rect width="800" height="900" fill="url(#sun)" />
      {/* distant block */}
      <rect x="40" y="430" width="230" height="200" fill="#e4cfb8" />
      {windows(62, 455, 5, 3, 26, 30, 16, 26, [3, 7])}
      {/* main tall block */}
      <rect x="360" y="120" width="300" height="560" fill="url(#bldA)" />
      <rect x="360" y="120" width="80" height="560" fill="url(#bldB)" />
      {windows(460, 160, 4, 9, 30, 38, 18, 18, [5, 13, 22, 30])}
      {windows(374, 170, 1, 9, 52, 34, 0, 22)}
      <rect x="352" y="112" width="316" height="12" fill="#c9ab8e" />
      {/* side block */}
      <rect x="250" y="320" width="130" height="360" fill="#ead9c6" />
      {windows(266, 345, 2, 7, 38, 30, 16, 18, [4, 9])}
      {/* canopy & entrance */}
      <rect x="300" y="600" width="380" height="18" fill="#cdb193" />
      <rect x="430" y="618" width="160" height="82" fill="#6b4b3f" opacity="0.75" />
      <rect x="440" y="626" width="40" height="74" fill="#f2cf98" opacity="0.65" />
      <rect x="490" y="626" width="40" height="74" fill="#f2cf98" opacity="0.5" />
      <rect x="540" y="626" width="40" height="74" fill="#f2cf98" opacity="0.65" />
      {/* ground */}
      <path d="M0 690 H800 V900 H0z" fill="#dcc4a7" />
      <path d="M330 690 L520 690 L760 900 L120 900z" fill="url(#path)" />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${360 - i * 52} ${720 + i * 40} H${500 + i * 60}`} stroke="#c7a988" strokeWidth="1.5" opacity="0.6" />)}
      {/* planters */}
      {[[250, 700], [600, 700], [190, 760], [660, 760]].map(([x, y], i) => (
        <g key={i}><rect x={x} y={y} width="60" height="40" fill="#bfa58a" /><ellipse cx={x! + 30} cy={y! - 4} rx="38" ry="26" fill="#6f7a4f" /><ellipse cx={x! + 22} cy={y! - 14} rx="20" ry="16" fill="#86915e" /></g>
      ))}
      {/* trees */}
      <g opacity="0.95">
        <rect x="120" y="420" width="10" height="280" fill="#6b4b3f" />
        <circle cx="125" cy="400" r="70" fill="#7b8652" /><circle cx="90" cy="440" r="48" fill="#8e9a62" /><circle cx="165" cy="445" r="44" fill="#6a7446" />
        <rect x="720" y="380" width="10" height="320" fill="#6b4b3f" />
        <circle cx="725" cy="360" r="78" fill="#6f7a4a" /><circle cx="690" cy="410" r="50" fill="#8a965e" />
      </g>
      {/* lamp posts */}
      {[300, 640].map((x) => <g key={x}><rect x={x} y="610" width="4" height="100" fill="#4a3530" /><circle cx={x + 2} cy="606" r="7" fill="#f8dca8" /></g>)}
      {/* people */}
      {[[452, 760, '#3f5784'], [486, 772, '#5a4540'], [212, 712, '#8c5850'], [560, 735, '#7d6b63']].map(([x, y, c], i) => (
        <g key={i}><circle cx={x as number} cy={(y as number) - 34} r="7" fill="#5a4540" /><rect x={(x as number) - 7} y={(y as number) - 26} width="14" height="28" rx="5" fill={c as string} /><rect x={(x as number) - 6} y={(y as number) + 2} width="5" height="20" fill="#3b2622" /><rect x={(x as number) + 1} y={(y as number) + 2} width="5" height="20" fill="#3b2622" /></g>
      ))}
      {/* foreground leaves */}
      <g fill="#6f7a4a" opacity="0.9">
        <ellipse cx="30" cy="120" rx="70" ry="26" transform="rotate(-25 30 120)" />
        <ellipse cx="80" cy="60" rx="60" ry="20" transform="rotate(-40 80 60)" fill="#86915e" />
        <ellipse cx="770" cy="90" rx="80" ry="24" transform="rotate(25 770 90)" />
      </g>
      <rect width="800" height="900" fill="url(#fade)" />
    </svg>
  );
}
