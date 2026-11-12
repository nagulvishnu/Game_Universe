import type { ReactNode } from "react";
import type { Color, PType } from "./rules";

interface Side { fill: string; grad?: string[]; stroke: string; detail: string }
export interface PieceStyle { id: string; name: string; blurb: string; w: Side; b: Side; sw: number; css?: string; gem?: [string, string]; tex?: boolean }

export const PIECE_STYLES: PieceStyle[] = [
  { id: "staunton", name: "Classic Staunton", blurb: "Ivory and ebony turned wood.", sw: 1.3,
    w: { fill: "#f6efdc", grad: ["#fffdf4", "#e8dcc0", "#bfae86"], stroke: "#3a2a1a", detail: "#5a4630" },
    b: { fill: "#222", grad: ["#6a6663", "#2a2826", "#0c0b0a"], stroke: "#000", detail: "#d8cdb8" }, css: "drop-shadow(0 2px 1.5px rgba(0,0,0,.45))" },
  { id: "royal", name: "Royal Gold", blurb: "Gilded and bronze regalia.", sw: 1.4,
    w: { fill: "#e9c04a", grad: ["#fff0a6", "#e0b43a", "#8a6206"], stroke: "#4f3803", detail: "#4f3803" },
    b: { fill: "#222", grad: ["#52525e", "#1d1d26", "#08080c"], stroke: "#d9ac2c", detail: "#f1cf6a" }, css: "drop-shadow(0 2px 2px rgba(0,0,0,.5))" },
  { id: "minimal", name: "Minimal Modern", blurb: "Flat, crisp and unmistakable.", sw: 1.5,
    w: { fill: "#fafafa", stroke: "#2c2c2c", detail: "#2c2c2c" },
    b: { fill: "#2b2b2b", stroke: "#0c0c0c", detail: "#f2f2f2" } },
  { id: "neon", name: "Neon Crystal", blurb: "Glass pieces with glowing edges.", sw: 1.7,
    w: { fill: "rgba(0,229,255,.22)", grad: ["rgba(190,255,255,.55)", "rgba(0,229,255,.25)"], stroke: "#35f0ff", detail: "#d8ffff" },
    b: { fill: "rgba(255,61,242,.22)", grad: ["rgba(255,190,250,.5)", "rgba(255,61,242,.28)"], stroke: "#ff5df5", detail: "#ffd8fc" }, css: "drop-shadow(0 0 3px currentColor)" },
  { id: "fantasy", name: "Fantasy Kingdom", blurb: "Jewelled sets of two rival realms.", sw: 1.3, gem: ["#ffd84a", "#ff5a7a"],
    w: { fill: "#bff0dd", grad: ["#f9fff2", "#9fe3c8", "#3c9b86"], stroke: "#14463c", detail: "#14463c" },
    b: { fill: "#7a3fb0", grad: ["#c78bff", "#7b3cb5", "#35105a"], stroke: "#1e0836", detail: "#f0d8ff" }, css: "drop-shadow(0 2px 2px rgba(0,0,0,.5))" },
  { id: "stone", name: "Ancient Stone", blurb: "Weathered carved granite.", sw: 1.3, tex: true,
    w: { fill: "#d9d5cb", grad: ["#efece4", "#c4bfb2", "#8f897b"], stroke: "#3d3a33", detail: "#4a463e" },
    b: { fill: "#55524d", grad: ["#7a7771", "#4b4843", "#201e1b"], stroke: "#0f0e0c", detail: "#cfc9bb" }, css: "drop-shadow(0 2px 2px rgba(0,0,0,.5))" },
];
export const pieceStyleById = (id: string) => PIECE_STYLES.find((s) => s.id === id) ?? PIECE_STYLES[0];

const BASE = <path d="M10 33.5h25a1.5 1.5 0 0 1 1.5 1.5v2.5h-28V35a1.5 1.5 0 0 1 1.5-1.5z" />;

const SHAPES: Record<PType, ReactNode> = {
  p: <><circle cx="22.5" cy="13" r="5.2" /><path d="M17.5 22h10c0 4 2.2 7 4.2 10.5H13.3c2-3.5 4.2-6.5 4.2-10.5z" /><path d="M15 20h15a1.7 1.7 0 0 1 0 3.4H15a1.7 1.7 0 0 1 0-3.4z" />{BASE}</>,
  r: <><path d="M11 9h4.5v3h3.5V9h7v3h3.5V9H34v8H11z" /><path d="M14.5 17h16l-1 4v9h-14v-9z" /><path d="M13 30h19l1.5 3.5h-22z" />{BASE}</>,
  n: <><path d="M13 33.5C13 27 16 24 19.5 20.5 17 20.5 14.5 22 12.5 25L10 23c1-3.5 4-8.5 8.5-11L18 7.5l4 2.5c9.500 1 13 10 12 23.500z" />{BASE}</>,
  b: <><circle cx="22.5" cy="7" r="2.3" /><path d="M22.500 9.500c5 3.500 7 7.500 7 11 0 2.500-2 4-3.500 5H19c-1.500-1-3.500-2.500-3.500-5 0-3.500 2-7.500 7-11z" /><path d="M16.500 25.500h12V28h-12z" /><path d="M18 28h9l3.500 5.500h-16z" />{BASE}</>,
  q: <><path d="M9.500 13l4 15 3.500-11.500 3 11.500 2.500-14 2.500 14 3-11.500 3.500 11.500 4-15-2.500 18.500h-21z" /><circle cx="9.500" cy="12" r="2.200" /><circle cx="17" cy="15" r="2.200" /><circle cx="22.500" cy="12" r="2.200" /><circle cx="28" cy="15" r="2.200" /><circle cx="35.500" cy="12" r="2.200" />{BASE}</>,
  k: <><path d="M21 2.500h3v3h3v3h-3V12h-3V8.500h-3v-3h3z" /><path d="M22.500 13C14 11 8.500 19 12 27l2 6.500h17L33 27c3.500-8-2-16-10.500-14z" />{BASE}</>,
};
const DETAILS: Record<PType, ReactNode> = {
  p: null,
  r: <path d="M14.500 17h16M15.500 21h14" fill="none" />,
  n: <><circle cx="19.500" cy="14.200" r="1.100" stroke="none" fill="currentColor" /><circle cx="11.600" cy="23.300" r=".8" stroke="none" fill="currentColor" /><path d="M24 12c5 3 7 10 7 19" fill="none" /></>,
  b: <path d="M22.500 12.800v5.500M19.800 15.500h5.400" fill="none" />,
  q: <path d="M13 31h19" fill="none" />,
  k: <path d="M15 24h15" fill="none" />,
};

export function PieceSvg({ type, color, styleId }: { type: PType; color: Color; styleId: string }) {
  const st = pieceStyleById(styleId); const side = st[color];
  const fill = side.grad ? `url(#pg-${st.id}-${color})` : side.fill;
  return (
    <svg viewBox="0 0 45 45" className="ci-piece-svg" style={{ filter: st.css, color: side.stroke }} aria-hidden>
      <g fill={fill} stroke={side.stroke} strokeWidth={st.sw} strokeLinejoin="round" strokeLinecap="round" filter={st.tex ? "url(#ci-stone)" : undefined}>{SHAPES[type]}</g>
      <g color={side.detail} stroke={side.detail} strokeWidth="1.1" strokeLinecap="round">{DETAILS[type]}</g>
      {st.gem && type !== "p" && <circle cx="22.5" cy="29.300" r="1.600" fill={st.gem[color === "w" ? 0 : 1]} stroke={side.stroke} strokeWidth=".6" />}
      {st.gem && type === "p" && <circle cx="22.5" cy="13" r="1.500" fill={st.gem[color === "w" ? 0 : 1]} stroke={side.stroke} strokeWidth=".6" />}
    </svg>
  );
}

/** Shared gradient/filter definitions — render once near the app root. */
export function PieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        {PIECE_STYLES.flatMap((st) => (["w", "b"] as const).map((c) => {
          const g = st[c].grad; if (!g) return null;
          return (
            <linearGradient key={`${st.id}${c}`} id={`pg-${st.id}-${c}`} x1="0" y1="0" x2="0.4" y2="1">
              {g.map((col, i) => <stop key={i} offset={`${(i / (g.length - 1)) * 100}%`} stopColor={col} />)}
            </linearGradient>
          );
        }))}
        <filter id="ci-stone" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 .35  0 0 0 0 .33  0 0 0 0 .3  0 0 0 .55 0" result="g" />
          <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
          <feBlend in="gi" in2="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
    </svg>
  );
}
