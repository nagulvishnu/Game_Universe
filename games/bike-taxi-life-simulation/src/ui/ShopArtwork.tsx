import type { BikeModel } from '../game/types';

const FOOD_ART: Record<string, { icon: string; tone: string; accent: string; label: string }> = {
  water: { icon: '💧', tone: 'from-sky-400/25 via-cyan-300/10 to-slate-950', accent: '#7dd3fc', label: 'COLD & REFRESHING' },
  juice: { icon: '🍋', tone: 'from-lime-400/25 via-yellow-300/10 to-slate-950', accent: '#bef264', label: 'FRESHLY SQUEEZED' },
  tea: { icon: '☕', tone: 'from-amber-500/25 via-orange-300/10 to-slate-950', accent: '#fbbf24', label: 'KADAI FAVOURITE' },
  snack: { icon: '🍌', tone: 'from-yellow-400/25 via-orange-300/10 to-slate-950', accent: '#fde047', label: 'QUICK BITE' },
  breakfast: { icon: '🍽️', tone: 'from-orange-400/25 via-amber-300/10 to-slate-950', accent: '#fdba74', label: 'BREAKFAST SPECIAL' },
  lunch: { icon: '🍛', tone: 'from-rose-400/25 via-orange-300/10 to-slate-950', accent: '#fb923c', label: 'HOMESTYLE MEALS' },
  dinner: { icon: '🫓', tone: 'from-orange-400/25 via-rose-300/10 to-slate-950', accent: '#fb923c', label: 'HOT OFF THE TAWA' },
  biryani: { icon: '🍲', tone: 'from-amber-400/25 via-rose-300/10 to-slate-950', accent: '#fbbf24', label: 'DUM COOKED' },
  feast: { icon: '🍱', tone: 'from-fuchsia-400/25 via-amber-300/10 to-slate-950', accent: '#e879f9', label: 'CHEF’S SPECIAL' },
};

export function FoodArtwork({ id, name }: { id: string; name: string }) {
  const art = FOOD_ART[id] ?? FOOD_ART.snack;
  return (
    <div role="img" aria-label={`${name} illustration`} className={`relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br ${art.tone}`}>
      <div className="absolute -left-7 -top-10 h-24 w-24 rounded-full blur-2xl" style={{ backgroundColor: `${art.accent}20` }} />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/25 to-transparent" />
      <span className="relative -rotate-6 select-none text-6xl drop-shadow-[0_8px_12px_rgba(0,0,0,.4)] transition duration-300 group-hover:rotate-0 group-hover:scale-110" aria-hidden="true">{art.icon}</span>
      <span className="absolute bottom-2 left-3 text-[8px] font-black tracking-[0.18em]" style={{ color: art.accent }}>{art.label}</span>
      <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: art.accent, boxShadow: `0 0 12px ${art.accent}` }} />
    </div>
  );
}

export function BikeArtwork({ model }: { model: BikeModel }) {
  const color = model.color;
  return (
    <div role="img" aria-label={`${model.name} motorcycle illustration`} className="relative overflow-hidden bg-[radial-gradient(ellipse_at_52%_75%,rgba(255,255,255,.1),transparent_58%),linear-gradient(145deg,#26354a,#111724_70%)]">
      <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-slate-300">{model.category}</span>
      <svg viewBox="0 0 360 170" className="h-36 w-full drop-shadow-[0_12px_14px_rgba(0,0,0,.5)]" role="presentation">
        <defs>
          <linearGradient id={`tank-${model.id}`} x1="0" x2="1" y1="0" y2="1">
            <stop stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity=".55" />
          </linearGradient>
          <linearGradient id={`metal-${model.id}`} x1="0" x2="1">
            <stop stopColor="#64748b" />
            <stop offset=".5" stopColor="#e2e8f0" />
            <stop offset="1" stopColor="#475569" />
          </linearGradient>
        </defs>
        <ellipse cx="180" cy="145" rx="125" ry="8" fill="#020617" opacity=".55" />
        <g fill="#0b1018" stroke="#94a3b8" strokeWidth="4">
          <circle cx="92" cy="116" r="37" />
          <circle cx="92" cy="116" r="24" fill="none" stroke="#64748b" strokeWidth="2" />
          <circle cx="270" cy="116" r="37" />
          <circle cx="270" cy="116" r="24" fill="none" stroke="#64748b" strokeWidth="2" />
        </g>
        <g stroke={`url(#metal-${model.id})`} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M92 116 144 72 187 116 122 116 144 72 214 73 270 116 239 56" strokeWidth="7" />
          <path d="m239 56 24-11m-32 6 29 1m-47 20 24-17" strokeWidth="5" />
          <path d="m135 69-11-7m0 0 21-4m-21 4-6-4" strokeWidth="4" />
          <path d="m205 119 35 0 18 5" strokeWidth="6" />
          <path d="m219 123 26 6 19-4" strokeWidth="4" />
        </g>
        <path d="M137 69q18-19 48-13l30 14-13 25q-23 13-53 3l-19-13z" fill={`url(#tank-${model.id})`} stroke="#fff" strokeOpacity=".22" strokeWidth="2" />
        <path d="M162 54q15-9 37-3l19 11-2 7-45-5z" fill="#111827" stroke="#94a3b8" strokeOpacity=".5" strokeWidth="2" />
        <path d="m118 114 17-28 16 31zm74-1 27-26 16 30z" fill={color} opacity=".82" />
        <path d="m229 67 15 38" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
        <path d="M242 48q10-6 19 1" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M67 105 53 99m201 10 22-4" stroke="#fef3c7" strokeWidth="6" strokeLinecap="round" />
        <path d="M178 97h18v23h-26z" fill="#64748b" stroke="#cbd5e1" strokeWidth="2" />
        <path d="m150 126 36 0" stroke="#f8fafc" strokeOpacity=".6" strokeWidth="3" />
      </svg>
      <div className="absolute bottom-2 right-3 text-[8px] font-bold tracking-[0.14em] text-slate-400">READY FOR THE ROAD</div>
    </div>
  );
}
