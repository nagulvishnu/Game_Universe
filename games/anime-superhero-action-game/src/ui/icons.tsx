import { HeroId } from "../data";

export function AbilityIcon({ id, color = "#fff", size = 44 }: { id: string; color?: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode;
  switch (id) {
    case "fireball":
      body = (<><circle cx="30" cy="20" r="9" fill={color} fillOpacity=".35" {...p} /><path {...p} d="M22 27 L8 41 M26 29 L14 43 M18 22 L5 30" /><circle cx="30" cy="20" r="3.5" fill={color} /></>);
      break;
    case "burst":
      body = (<><path {...p} d="M6 24 L40 8 M6 24 L42 24 M6 24 L40 40" /><path {...p} fill={color} fillOpacity=".25" d="M10 24 Q30 6 42 24 Q30 42 10 24Z" /></>);
      break;
    case "meteor":
      body = (<><circle cx="32" cy="32" r="8" fill={color} fillOpacity=".4" {...p} /><path {...p} d="M26 26 L8 8 M30 22 L18 6 M22 30 L6 18" /><path {...p} d="M8 44 L40 44" opacity=".6" /></>);
      break;
    case "dash":
      body = (<><path {...p} d="M8 12 L20 24 L8 36 M20 12 L32 24 L20 36" /><path {...p} d="M30 8 L44 24 L30 40" fill={color} fillOpacity=".3" /></>);
      break;
    case "sun":
      body = (<><circle cx="24" cy="24" r="9" fill={color} fillOpacity=".5" {...p} />{Array.from({ length: 10 }).map((_, i) => { const a = (i / 10) * Math.PI * 2; return <path key={i} {...p} d={`M${24 + Math.cos(a) * 14} ${24 + Math.sin(a) * 14} L${24 + Math.cos(a) * 21} ${24 + Math.sin(a) * 21}`} />; })}</>);
      break;
    case "blast":
      body = (<><circle cx="26" cy="24" r="9" fill={color} fillOpacity=".4" {...p} /><circle cx="26" cy="24" r="14" {...p} opacity=".5" /><path {...p} d="M4 24 L14 24 M6 18 L12 20 M6 30 L12 28" /></>);
      break;
    case "beam":
      body = (<><path {...p} d="M4 24 L44 24" strokeWidth="7" opacity=".35" /><path {...p} d="M4 24 L44 24" strokeWidth="3" /><circle cx="8" cy="24" r="6" fill={color} fillOpacity=".5" {...p} /><path {...p} d="M30 14 L40 24 L30 34" opacity=".6" /></>);
      break;
    case "summon":
      body = (<>{[[24, 10], [12, 32], [36, 32]].map(([x, y], i) => (<g key={i}><circle cx={x} cy={y} r="4.5" fill={color} fillOpacity=".5" {...p} /><path {...p} d={`M${x - 6} ${y + 14} Q${x} ${y + 6} ${x + 6} ${y + 14}`} /></g>))}</>);
      break;
    case "step":
      body = (<><path {...p} d="M6 36 L18 24 L6 12" opacity=".4" /><path {...p} d="M16 36 L28 24 L16 12" opacity=".7" /><path {...p} d="M26 38 L40 24 L26 10" fill={color} fillOpacity=".3" /></>);
      break;
    case "extract":
      body = (<><path {...p} d="M24 42 C10 38 12 24 24 24 C36 24 36 12 24 8" /><path {...p} d="M18 14 L24 7 L30 14" /><circle cx="24" cy="38" r="4" fill={color} fillOpacity=".5" {...p} /></>);
      break;
    case "army":
      body = (<>{[[10, 30], [24, 22], [38, 30], [17, 38], [31, 38]].map(([x, y], i) => (<g key={i}><circle cx={x} cy={y - 8} r="3.4" fill={color} fillOpacity=".5" {...p} /><path {...p} d={`M${x} ${y - 4} L${x} ${y + 4} M${x - 4} ${y - 1} L${x + 4} ${y - 1}`} /></g>))}<path {...p} d="M4 12 Q24 0 44 12" /></>);
      break;
    default:
      body = <circle cx="24" cy="24" r="10" {...p} />;
  }
  return (<svg width={size} height={size} viewBox="0 0 48 48" style={{ filter: `drop-shadow(0 0 4px ${color})` }}><g fill="none">{body}</g></svg>);
}

export function Portrait({ hero, size = 96 }: { hero: HeroId; size?: number }) {
  const k = hero === "kairo";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id={`bg${hero}`} cx="50%" cy="40%" r="75%">
          <stop offset="0" stopColor={k ? "#ff9a3a" : "#7a4dff"} />
          <stop offset="1" stopColor={k ? "#4a1008" : "#0d0720"} />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg${hero})`} />
      {k ? (
        <g>
          <path d="M50 8 L56 26 L68 4 L70 28 L86 14 L80 38 L18 38 L14 14 L30 28 L32 4 L44 26Z" fill="#ff7a1a" stroke="#1a0a05" strokeWidth="2" />
          <path d="M50 4 L55 24 L62 10 L60 30 L40 30 L38 10 L45 24Z" fill="#ffd23f" />
          <ellipse cx="50" cy="56" rx="26" ry="30" fill="#f4cfa8" stroke="#1a0a05" strokeWidth="2" />
          <path d="M24 44 Q50 20 76 44 L76 38 Q50 14 24 38Z" fill="#ff7a1a" stroke="#1a0a05" strokeWidth="2" />
          <rect x="24" y="38" width="52" height="5" fill="#d01818" />
          <ellipse cx="39" cy="56" rx="6.5" ry="8.5" fill="#fff" stroke="#1a0a05" strokeWidth="1.5" /><ellipse cx="61" cy="56" rx="6.5" ry="8.5" fill="#fff" stroke="#1a0a05" strokeWidth="1.5" />
          <circle cx="40" cy="57" r="4.8" fill="#ff9a10" /><circle cx="60" cy="57" r="4.8" fill="#ff9a10" /><circle cx="40" cy="57" r="2.2" fill="#2a1000" /><circle cx="60" cy="57" r="2.2" fill="#2a1000" />
          <circle cx="42" cy="54.5" r="1.4" fill="#fff" /><circle cx="62" cy="54.5" r="1.4" fill="#fff" />
          <path d="M30 48 L45 51 M70 48 L55 51" stroke="#6a2a08" strokeWidth="3" strokeLinecap="round" />
          <path d="M42 74 Q50 80 58 74" stroke="#7a3a20" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M20 84 Q50 100 80 84 L84 100 L16 100Z" fill="#ff6a1a" />
        </g>
      ) : (
        <g>
          <path d="M14 30 Q14 4 50 4 Q86 4 86 30 L90 70 L76 54 L24 54 L10 70Z" fill="#0e0d16" stroke="#050308" strokeWidth="2" />
          <ellipse cx="50" cy="56" rx="25" ry="29" fill="#e9d4c6" stroke="#050308" strokeWidth="2" />
          <path d="M24 46 Q50 12 76 46 L70 30 Q50 8 30 30Z" fill="#0e0d16" stroke="#050308" strokeWidth="2" />
          <path d="M44 14 L52 44 L58 16 L62 46 L68 22 L64 48" fill="#8a5cff" opacity=".85" />
          <path d="M30 40 L48 56 L36 58Z M70 40 L56 54 L66 58Z" fill="#0e0d16" />
          <ellipse cx="39" cy="57" rx="6" ry="7.5" fill="#fff" stroke="#050308" strokeWidth="1.5" /><ellipse cx="61" cy="57" rx="6" ry="7.5" fill="#fff" stroke="#050308" strokeWidth="1.5" />
          <circle cx="40" cy="58" r="4.6" fill="#3fd0ff" /><circle cx="60" cy="58" r="4.6" fill="#3fd0ff" /><circle cx="40" cy="58" r="2" fill="#001018" /><circle cx="60" cy="58" r="2" fill="#001018" />
          <circle cx="41.5" cy="55.8" r="1.3" fill="#fff" /><circle cx="61.5" cy="55.8" r="1.3" fill="#fff" />
          <path d="M30 51 L46 53 M70 51 L54 53" stroke="#0e0d16" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M44 76 L56 76" stroke="#6a4a58" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M18 90 Q50 100 82 90 L86 100 L14 100Z" fill="#15131f" /><path d="M42 88 L50 100 L58 88" fill="#8a5cff" />
        </g>
      )}
    </svg>
  );
}
