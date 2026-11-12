import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { game } from '../game/game';
import {
  bus,
  derive,
  idbGet,
  QUALITY_PRESETS,
  shadowStats,
  shadowXpNeed,
  useGame,
  questDef,
  type SaveData,
} from '../game/store';
import {
  GATE_INFO,
  GUILDS,
  ITEMS,
  MISSIONS,
  RANKS,
  RARITY_COLOR,
  SHADOWS,
  SHADOW_CODEX,
  SHADOW_RANK_COLORS,
  SLOT_NAMES,
  STAT_DESC,
  STAT_KEYS,
  STAT_NAMES,
  hunterRank,
  xpNeeded,
  type ItemDef,
  type Slot,
} from '../game/data';
import { continueGame } from './Menu';
import { normalizeSave, parseSaveFile, serializeSave } from '../game/save';

const keyName = (c: string) =>
  (c || '')
    .replace('Key', '')
    .replace('Digit', '')
    .replace('Control', 'Ctrl')
    .replace('Left', '')
    .replace('Escape', 'Esc');
const rc = (r: string) => RARITY_COLOR[r as keyof typeof RARITY_COLOR];
const hex = (n?: number) => (n === undefined ? '#56627a' : '#' + (n >>> 0).toString(16).padStart(6, '0'));

/* ---------------------------------------------------------------- icons */
const PANEL_GLYPH: Record<string, string> = {
  status:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5l3.2 2M12 3v2M12 19v2M3 12h2M19 12h2',
  inventory: 'M4 8h16v12H4V8Zm3-4h10l3 4H4l3-4ZM9 12h6',
  shadows: 'M12 3a4 4 0 0 1 4 4v1l-2 1v2l2 1v3l-2 1-2-2-2 2-2-1v-3l2-1V8L8 8V7a4 4 0 0 1 4-4Z',
  quests: 'M6 4h12v16l-6-3-6 3V4Zm3 5h6M9 12h4',
  map: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6Zm5-2v14m6-12v14',
  shop: 'M4 9h16l-1.5 11h-13L4 9Zm4 0a4 4 0 0 1 8 0',
  guild: 'M4 21V9l8-5 8 5v12h-5v-6H9v6H4Z',
};
const PanelIcon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PANEL_GLYPH[name] || PANEL_GLYPH.status} />
  </svg>
);

function ItemArt({ it, className }: { it: ItemDef; className?: string }) {
  const rar = rc(it.rarity);
  const id = 'ia' + it.id;
  const steel = `url(#${id}-steel)`;
  const gold = `url(#${id}-gold)`;
  const body = (() => {
    if (it.kind === 'consumable')
      return (
        <g>
          <path d="M27 13h10v6l5 9v18c0 2-2 4-4 4H26c-2 0-4-2-4-4V28l5-9V13Z" fill={steel} stroke="#b5e6ff" strokeOpacity=".5" />
          <path d="M24 32c0 5 2 8 8 8s8-3 8-8v10c0 2-2 4-4 4H28c-2 0-4-2-4-4V32Z" fill={rar} fillOpacity=".7" />
          <rect x="26" y="10" width="12" height="4" rx="1" fill={gold} />
          <circle cx="32" cy="38" r="3" fill="#fff" fillOpacity=".7" />
        </g>
      );
    if (it.kind === 'key')
      return (
        <g>
          <circle cx="23" cy="25" r="9" fill="none" stroke={rar} strokeWidth="4" />
          <path d="M30 31l17 17M41 42l4-4M36 37l4-4" stroke={gold} strokeWidth="5" strokeLinecap="round" />
          <circle cx="23" cy="25" r="3" fill={rar} />
        </g>
      );
    if (it.kind === 'material' || it.id === 'essence')
      return (
        <g>
          <path d="M32 7l12 12-8 32-8-32 4-12Z" fill={rar} fillOpacity=".45" stroke={rar} strokeWidth="1.4" />
          <path d="M32 7l4 12-4 32-4-32 4-12Z" fill="#fff" fillOpacity=".35" />
          <path d="M20 22l-6 10 12 18-6-28ZM44 22l6 10-12 18 6-28Z" fill={rar} fillOpacity=".24" />
        </g>
      );
    if (it.slot === 'weapon' || it.wtype) {
      const big = it.wtype === 'greatsword';
      return (
        <g transform={it.wtype === 'dagger' ? 'rotate(36 32 32)' : undefined}>
          <path
            d={big ? 'M27 6h10l-1 34h-8L27 6Z' : it.wtype === 'sword' ? 'M29 8h6l-1 30h-4L29 8Z' : 'M30 14h4l-1 22h-2l-1-22Z'}
            fill={steel}
            stroke="#dff2ff"
            strokeOpacity=".5"
          />
          <path d={big ? 'M32 8v30' : 'M32 10v28'} stroke={rar} strokeWidth="1.6" opacity=".95" />
          <path d={big ? 'M31 42l1 5 1-5' : 'M31.5 38l.5 4 .5-4'} fill={rar} />
          <rect x={big ? 20 : 26} y={big ? 42 : 38} width={big ? 24 : 12} height="4" rx="1" fill={gold} />
          <rect x="30" y={big ? 45 : 41} width="4" height={big ? 12 : 10} rx="1.5" fill="#241a14" stroke="#a88a5a" strokeOpacity=".5" />
          <circle cx="32" cy={big ? 59 : 52} r={big ? 3 : 2.2} fill={rar} />
          {it.look === 'fang' && <path d="M27 20l-3 4 3 4M37 20l3 4-3 4" stroke="#7dff7a" strokeWidth="1.4" fill="none" />}
          {it.look === 'killer' && <path d="M25 18l-3 3M39 34l3 3" stroke="#ff3348" strokeWidth="2" />}
        </g>
      );
    }
    if (it.slot === 'armor' || it.slot === 'helmet' || it.slot === 'gloves' || it.slot === 'boots') {
      if (it.slot === 'helmet')
        return (
          <g>
            <path d="M18 32c0-12 28-12 28 0v10l-7 3-2-8h-10l-2 8-7-3V32Z" fill={steel} stroke="#b5e6ff" strokeOpacity=".4" />
            <path d="M24 32h16" stroke={rar} strokeWidth="2.5" />
            <path d="M32 15v-5" stroke={gold} strokeWidth="3" strokeLinecap="round" />
            <path d="M26 48l6 4 6-4" stroke={rar} strokeWidth="1.4" fill="none" />
          </g>
        );
      if (it.slot === 'gloves')
        return (
          <g>
            <path d="M22 24l5-4 2 5 2-6 2 6 3-5 3 4-2 16-8 7-8-7-2-9 3-2Z" fill={steel} stroke="#b5e6ff" strokeOpacity=".4" />
            <path d="M23 36h16" stroke={rar} strokeWidth="2" />
            <rect x="19" y="44" width="20" height="5" rx="2" fill={gold} />
          </g>
        );
      if (it.slot === 'boots')
        return (
          <g>
            <path d="M23 12h9v24l11 6v8H20V26l3-4V12Z" fill={steel} stroke="#b5e6ff" strokeOpacity=".4" />
            <path d="M20 46h23" stroke={rar} strokeWidth="2.5" />
            <path d="M25 26h8M25 32h8" stroke="#0a1020" strokeWidth="2" opacity=".6" />
          </g>
        );
      return (
        <g>
          <path d="M20 20l7-6 5 4 5-4 7 6-3 26-9 8-9-8-3-26Z" fill={steel} stroke="#b5e6ff" strokeOpacity=".45" />
          <path d="M32 18v34M22 30l20-8M22 38l20-8" stroke="#0a1020" strokeOpacity=".35" strokeWidth="1.5" />
          <path d="M32 26l5 5-5 5-5-5 5-5Z" fill={rar} />
          <path d="M14 24l6-6v18l-6 4V24ZM50 24l-6-6v18l6 4V24Z" fill={steel} stroke="#b5e6ff" strokeOpacity=".3" />
        </g>
      );
    }
    if (it.slot === 'accessory')
      return (
        <g>
          <path d="M18 14c8 8 20 8 28 0" stroke={gold} strokeWidth="2.4" fill="none" />
          <path d="M32 26l9 9-9 17-9-17 9-9Z" fill={rar} fillOpacity=".55" stroke={rar} strokeWidth="1.5" />
          <path d="M32 30l4 5-4 9-4-9 4-5Z" fill="#fff" fillOpacity=".5" />
        </g>
      );
    return (
      <g>
        <path d="M18 26l14-12 14 12-4 20H22l-4-20Z" fill={steel} stroke="#b5e6ff" strokeOpacity=".4" />
        <circle cx="32" cy="34" r="7" fill={rar} fillOpacity=".6" />
      </g>
    );
  })();
  return (
    <svg viewBox="0 0 64 64" className={'item-art ' + (className || '')} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6f4ff" />
          <stop offset="0.35" stopColor="#93a8c4" />
          <stop offset="0.7" stopColor="#5a6880" />
          <stop offset="1" stopColor="#c8d8ea" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe6a8" />
          <stop offset="1" stopColor="#a8762a" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor={rar} stopOpacity=".33" />
          <stop offset="1" stopColor={rar} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={`url(#${id}-glow)`} />
      {body}
    </svg>
  );
}

function ShadowArt({ kind, color, size = 64 }: { kind: string; color: string; size?: number }) {
  const id = 'sa' + kind + color.replace('#', '');
  return (
    <svg viewBox="0 0 64 64" style={{ width: size, height: size }} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241238" />
          <stop offset="0.55" stopColor="#0c0716" />
          <stop offset="1" stopColor="#05030a" />
        </linearGradient>
        <radialGradient id={`${id}-g`}>
          <stop offset="0" stopColor={color} stopOpacity=".5" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="18" ry="5" fill={`url(#${id}-g)`} />
      <path d="M14 58c0-10 5-16 10-19l-3-6 4-15 7-5 7 5 4 15-3 6c5 3 10 9 10 19H14Z" fill={`url(#${id}-b)`} stroke={color} strokeOpacity=".35" />
      <path d="M30 17l2 4 2-4-2-6-2 6Z" fill={color} />
      {kind === 'igris' && (
        <>
          <path d="M20 24l-6-8 2-3 8 6M44 24l6-8-2-3-8 6" fill="#0c0716" stroke={color} strokeOpacity=".7" />
          <path d="M22 20l10-7 10 7-2 8H24l-2-8Z" fill="#160b22" stroke={color} strokeOpacity=".6" />
          <path d="M43 58l6-28 3 1-4 27h-5Z" fill="#1a0b12" stroke={color} strokeOpacity=".6" />
          <path d="M20 44l24-2" stroke={color} strokeOpacity=".4" />
        </>
      )}
      {kind === 'knight' && (
        <>
          <path d="M22 18l10-6 10 6v10H22V18Z" fill="#120a1e" stroke={color} strokeOpacity=".6" />
          <path d="M22 24h20" stroke={color} strokeWidth="2" />
          <path d="M12 32l8-4v22l-8 4V32Z" fill="#120a1e" stroke={color} strokeOpacity=".5" />
        </>
      )}
      {kind === 'goblin' && (
        <>
          <path d="M22 12l-10-2 6 9M42 12l10-2-6 9" fill="#0c0716" stroke={color} strokeOpacity=".6" />
          <path d="M26 18h12" stroke={color} strokeWidth="2" />
          <path d="M48 46l6-18 3 2-4 18" fill="#120a1e" stroke={color} strokeOpacity=".5" />
        </>
      )}
      {kind === 'lizard' && (
        <>
          <path d="M32 8l3 10-6 4M20 16l8 4M44 16l-8 4" stroke={color} strokeOpacity=".6" fill="none" />
          <path d="M14 54c8 4 28 4 36 0" stroke={color} strokeOpacity=".35" fill="none" />
        </>
      )}
      {kind === 'serpent' && (
        <>
          <path d="M18 56c6-10 22-8 28-16s-2-16-10-14-10 12-2 14 14-4 14-10" stroke={color} strokeOpacity=".55" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M32 8l4 8-4 4-4-4 4-8Z" fill={`url(#${id}-b)`} stroke={color} strokeOpacity=".6" />
        </>
      )}
      <circle cx="27" cy="22" r="1.7" fill={color} />
      <circle cx="37" cy="22" r="1.7" fill={color} />
      <path d="M24 47l8 6 8-6" stroke={color} strokeOpacity=".35" fill="none" />
    </svg>
  );
}

function HunterPreview({ accent, glowing }: { accent: string; glowing: boolean }) {
  const aura = glowing ? '#a86bff' : '#56b4ff';
  return (
    <div className="hunter-preview" aria-hidden="true">
      <svg viewBox="0 0 300 360">
        <defs>
          <linearGradient id="hp-armor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={accent} />
            <stop offset="0.55" stopColor="#111420" />
            <stop offset="1" stopColor="#05070d" />
          </linearGradient>
          <linearGradient id="hp-cloak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a0c2c" />
            <stop offset="1" stopColor="#05030a" />
          </linearGradient>
          <radialGradient id="hp-glow">
            <stop offset="0" stopColor={aura} stopOpacity=".38" />
            <stop offset="1" stopColor={aura} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hp-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0d2b4" />
            <stop offset="1" stopColor="#b98d72" />
          </linearGradient>
        </defs>
        <circle cx="150" cy="160" r="132" fill="url(#hp-glow)" />
        <g stroke={aura} strokeOpacity=".3" fill="none">
          <ellipse cx="150" cy="168" rx="118" ry="34" strokeDasharray="3 8" />
          <ellipse cx="150" cy="168" rx="92" ry="26" strokeDasharray="1 6" />
          <circle cx="150" cy="160" r="112" strokeOpacity=".12" />
        </g>
        <path d="M86 336c-8-78 12-116 26-136l76-2c16 22 34 60 26 138Z" fill="#04060c" opacity=".9" />
        <path d="M96 206c-16 42-14 94-8 130h36l-8-122Z" fill="url(#hp-cloak)" />
        <path d="M204 206c16 42 14 94 8 130h-36l8-122Z" fill="url(#hp-cloak)" />
        <path d="M112 332l4-80 20 2-6 78Z" fill="#0a0b12" />
        <path d="M188 332l-4-80-20 2 6 78Z" fill="#0a0b12" />
        <path d="M110 316h30l-2 16h-30ZM160 316h30l2 16h-30Z" fill="#05070d" stroke={aura} strokeOpacity=".25" />
        <path d="M102 176l12-38 36-16 36 16 12 38-10 54-38 18-38-18-10-54Z" fill="url(#hp-armor)" stroke="#b5e6ff" strokeOpacity=".22" />
        <path d="M150 142v84M118 188l64-22M118 214l64-22" stroke="#000" strokeOpacity=".5" strokeWidth="3" />
        <path d="M150 176l13 13-13 15-13-15 13-13Z" fill={aura} opacity=".9" />
        <path d="M102 176l-14-26 18-10 16 16-20 24ZM198 176l14-26-18-10-16 16 20 24Z" fill="url(#hp-armor)" stroke={aura} strokeOpacity=".5" />
        <path d="M86 148l-8 12 8 12 8-12-8-12ZM214 148l-8 12 8 12 8-12-8-12Z" fill={aura} opacity=".6" />
        <path d="M84 170l-8 44 16 6 8-38ZM216 170l8 44-16 6-8-38Z" fill="url(#hp-armor)" stroke="#b5e6ff" strokeOpacity=".2" />
        <path d="M78 216l-4 24 12 4 4-24ZM222 216l4 24-12 4-4-24Z" fill="#0a0b12" />
        <path d="M150 86l-22 12 4 14 18 12 18-12 4-14-22-12Z" fill="url(#hp-armor)" />
        <path d="M146 105h8l-1 20-3 4-3-4-1-20Z" fill="#0a0b12" opacity=".7" />
        <path d="M128 92c0-22 10-38 22-38s22 16 22 38l-10 20h-24l-10-20Z" fill="url(#hp-skin)" />
        <path d="M124 82c4-22 14-34 26-34s22 12 26 34c-10-8-18-12-26-12s-16 4-26 12Z" fill="#08070c" />
        <path d="M134 82l10-8 6 4-8 10ZM166 82l-10-8-6 4 8 10Z" fill="#08070c" />
        <path d="M128 66l-8 6 4 10M172 66l8 6-4 10" stroke="#08070c" strokeWidth="5" strokeLinecap="round" />
        <path d="M134 100h10M156 100h10" stroke={glowing ? aura : '#1a1712'} strokeWidth="2.6" strokeLinecap="round" />
        {glowing && <path d="M134 100h10M156 100h10" stroke={aura} strokeWidth="5" opacity=".25" strokeLinecap="round" />}
        <path d="M150 104v8l-3 3M142 120h16" stroke="#8a5a48" strokeWidth="1.5" fill="none" />
        <path d="M104 168l-26 44 8 8 24-32M196 168l26 44-8 8-24-32" fill="url(#hp-armor)" stroke="#b5e6ff" strokeOpacity=".16" />
        <path d="M86 214l-8 10 4 6 10-8ZM214 214l8 10-4 6-10-8Z" fill="#0a0b12" />
        <g transform="rotate(-28 78 232)">
          <path d="M78 202l4 8-2 38h-4l-2-38 4-8Z" fill="#d8ecff" stroke={aura} strokeOpacity=".5" />
          <path d="M76 248h8v4h-8Z" fill="#a8762a" />
        </g>
        <g transform="rotate(28 222 232)">
          <path d="M222 202l4 8-2 38h-4l-2-38 4-8Z" fill="#d8ecff" stroke={aura} strokeOpacity=".5" />
          <path d="M220 248h8v4h-8Z" fill="#a8762a" />
        </g>
        <g stroke={aura} strokeOpacity=".5" fill="none">
          <path d="M52 290c14 6 28 8 42 8M206 298c14 0 28-2 42-8" strokeDasharray="2 7" />
          <path d="M46 154l-10 6M254 154l10 6" strokeDasharray="2 5" />
        </g>
      </svg>
      <div className="hp-scan" />
    </div>
  );
}

/* ---------------------------------------------------------------- shell */
function Shell({
  title,
  children,
  w = 980,
  onClose,
  code = 'SECURE',
}: {
  title: string;
  children: ReactNode;
  w?: number;
  onClose?: () => void;
  code?: string;
}) {
  const st = useGame();
  const close =
    onClose ||
    (() => {
      st.setPanel('none');
      if (st.screen === 'playing') bus.emit('requestLock');
    });
  return (
    <div
      className="sys-backdrop"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="sys-window"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${w}px, 96vw)` }}
      >
        <header className="sys-window-head">
          <div>
            <div className="sys-eyebrow">[ SYSTEM ] · {code}</div>
            <div className="sys-window-title">{title}</div>
          </div>
          <button
            className="sys-btn sm sys-close"
            aria-label={`Close ${title}`}
            onClick={() => {
              bus.emit('sfx', 'ui');
              close();
            }}
          >
            ✕ Close
          </button>
        </header>
        <div className="sys-window-body scroll" style={{ minHeight: 0 }}>
          {children}
        </div>
        <footer className="sys-window-foot">
          <span>SUNG JIN-WOO // SHADOW MONARCH</span>
          <span>ESC TO CLOSE</span>
        </footer>
      </div>
    </div>
  );
}
const Tabs = ({ tabs, cur, set }: { tabs: [string, string][]; cur: string; set: (t: string) => void }) => (
  <div className="sys-tabs">
    {tabs.map(([k, l]) => (
      <button key={k} className={'sys-tab' + (cur === k ? ' on' : '')} onClick={() => set(k)}>
        {l}
      </button>
    ))}
  </div>
);

export function Panels() {
  const p = useGame((s) => s.panel);
  switch (p) {
    case 'status':
      return <Status />;
    case 'inventory':
      return <Inventory />;
    case 'shadows':
      return <Shadows />;
    case 'quests':
      return <Quests />;
    case 'map':
      return <MapP />;
    case 'association':
      return <Assoc />;
    case 'shop':
      return <Shop />;
    case 'accept':
      return <Accept />;
    case 'settings':
      return <Settings />;
    case 'controls':
      return <Controls />;
    case 'credits':
      return <Credits />;
    case 'load':
      return <Load />;
    case 'scores':
      return <Scores />;
    default:
      return null;
  }
}
function PanelNav() {
  const st = useGame();
  return (
    <div className="panel-nav" role="tablist" aria-label="System panels">
      {(
        [
          ['status', 'Status', 'status'],
          ['inventory', 'Inventory', 'inventory'],
          ['shadows', 'Shadow Army', 'shadows'],
          ['quests', 'Quests', 'quests'],
          ['map', 'Map', 'map'],
        ] as const
      ).map(([k, l, ic]) => (
        <button
          key={k}
          role="tab"
          aria-selected={st.panel === k}
          className={st.panel === k ? 'on' : ''}
          onClick={() => {
            bus.emit('sfx', 'ui');
            st.setPanel(k);
          }}
        >
          <PanelIcon name={ic} />
          {l}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- status */
function Status() {
  const s = useGame();
  const sv = s.save;
  const d = derive(sv);
  const rank = hunterRank(sv.level);
  const armor = sv.equip.armor ? ITEMS[sv.equip.armor] : null;
  const accent = hex(armor?.color ?? (sv.flags.necro ? 0x14141c : 0x3d4558));
  return (
    <Shell title="Status Window" code="HUNTER PROFILE">
      <PanelNav />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <div>
          <HunterPreview accent={accent} glowing={!!sv.flags.necro} />
          <div className="flex justify-between items-start mt-2">
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '0.08em' }}>
                SUNG JIN-WOO
              </div>
              <div style={{ color: 'var(--sys2)', fontSize: 11, letterSpacing: '0.1em' }}>
                {sv.flags.necro ? 'NECROMANCER' : sv.flags.awakened ? 'THE PLAYER' : 'HUNTER'} · {rank}-RANK
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="sys-eyebrow">LEVEL</div>
              <div className="txt-glow" style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 900, lineHeight: 1 }}>
                {sv.level}
              </div>
            </div>
          </div>
          <div className="bar xp my-2" style={{ height: 15 }}>
            <i style={{ width: (sv.xp / xpNeeded(sv.level)) * 100 + '%' }} />
            <b>
              XP {sv.xp} / {xpNeeded(sv.level)}
            </b>
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
            <span className="sys-eyebrow">TITLE</span>
            <select value={sv.title} onChange={(e) => s.setTitle(e.target.value)} style={{ flex: 1 }}>
              {sv.titles.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="chip gold">◇ {sv.gold.toLocaleString()} GOLD</span>
            <span className="chip violet">✦ {sv.inv.essence || 0} ESSENCE</span>
            <span className="chip green">☠ {sv.kills} SLAIN</span>
          </div>
        </div>
        <div className="panel-section">
          <div className="panel-section-title">Attributes</div>
          <div className="flex justify-between items-center mb-2">
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Unallocated points</span>
            <span className="chip gold" style={{ fontSize: 12, padding: '3px 10px' }}>
              {sv.points}
            </span>
          </div>
          {STAT_KEYS.map((k) => {
            const bonus = d.st[k] - sv.stats[k];
            return (
              <div key={k} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid rgba(120,190,255,.08)' }}>
                <div style={{ width: 96, fontSize: 12, fontWeight: 600 }}>{STAT_NAMES[k]}</div>
                <div style={{ width: 64, fontFamily: 'var(--font-mono)', fontSize: 16, color: '#fff' }}>
                  {sv.stats[k]}
                  {bonus > 0 && <span style={{ fontSize: 10, color: 'var(--green)' }}> +{bonus}</span>}
                </div>
                <button
                  className="sys-btn sm"
                  disabled={sv.points < 1}
                  aria-label={`Increase ${STAT_NAMES[k]}`}
                  onClick={() => {
                    s.allocate(k);
                    bus.emit('sfx', 'ui');
                    game.derived = derive(useGame.getState().save);
                    game.refreshModel();
                  }}
                >
                  +
                </button>
                <div style={{ fontSize: 9.5, color: 'var(--faint)', lineHeight: 1.35 }}>{STAT_DESC[k]}</div>
              </div>
            );
          })}
          <div className="mt-2" style={{ fontSize: 10, color: 'var(--faint)' }}>
            Equipment bonuses are included. Allocate points to reshape your build.
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="panel-section">
            <div className="panel-section-title">Combat Analysis</div>
            {(
              [
                ['Attack', d.atk.toFixed(0)],
                ['Defense', d.def.toFixed(0)],
                ['Max HP', d.maxHp],
                ['Max MP', d.maxMp],
                ['Move speed', '+' + ((d.spd - 1) * 100).toFixed(0) + '%'],
                ['Attack speed', '+' + ((d.atkSpd - 1) * 100).toFixed(0) + '%'],
                ['Crit chance', (d.crit * 100).toFixed(1) + '%'],
                ['Skill power', '+' + ((d.skillMul - 1) * 100).toFixed(0) + '%'],
                ['Extraction', '+' + (d.extractBonus * 100).toFixed(0) + '%'],
                ['Lock-on', d.lockRange.toFixed(0) + ' m'],
              ] as [string, string | number][]
            ).map(([a, b]) => (
              <div key={a} className="stat-line">
                <span>{a}</span>
                <b>{b}</b>
              </div>
            ))}
          </div>
          <div className="panel-section">
            <div className="panel-section-title">Skill Matrix</div>
            {[
              ['Shadow Dash', sv.flags.awakened, 'Blink with invulnerability'],
              ['Dagger Rush', sv.flags.awakened, 'Flurry of strikes while dashing'],
              ['Violent Slash', sv.flags.venomDone, 'Crescent wave projectile'],
              ["Ruler's Authority", sv.flags.necro, 'Telekinetic lift and slam'],
              ["Monarch's Domain", sv.flags.necro, 'Empowers shadows, slows enemies'],
              ['Shadow Exchange', sv.flags.necro, 'Swap places with a shadow'],
              ['Shadow Extraction', sv.flags.necro, 'Raise defeated foes'],
              ['Monarch Transformation', false, 'Later story arc'],
            ].map(([n, u, t]) => (
              <div key={n as string} style={{ fontSize: 10.5, opacity: u ? 1 : 0.42, padding: '2px 0' }}>
                <b style={{ color: u ? 'var(--sys2)' : 'var(--faint)' }}>
                  {u ? '◆' : '◇'} {n as string}
                </b>{' '}
                <span style={{ color: 'var(--muted)' }}>— {t as string}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------------------------------------------------------- inventory */
function statLine(it: ItemDef) {
  const o: string[] = [];
  const f = (k: keyof ItemDef, l: string, pct = false) => {
    const v = it[k] as number | undefined;
    if (v) o.push(`${l} ${v > 0 ? '+' : ''}${pct ? Math.round(v * 100) + '%' : v}`);
  };
  f('atk', 'ATK');
  f('def', 'DEF');
  f('hp', 'HP');
  f('mp', 'MP');
  f('str', 'STR');
  f('agi', 'AGI');
  f('vit', 'VIT');
  f('int', 'INT');
  f('per', 'PER');
  f('crit', 'CRIT', true);
  f('spd', 'SPD', true);
  f('atkSpd', 'ATK SPD', true);
  if (it.heal) o.push('Heal ' + it.heal);
  if (it.mana) o.push('Mana ' + it.mana);
  return o.join(' · ');
}
function Inventory() {
  const s = useGame();
  const sv = s.save;
  const [sel, setSel] = useState<string | null>(null);
  const it = sel ? ITEMS[sel] : null;
  const eqCur = it?.slot ? ITEMS[sv.equip[it.slot] || ''] : null;
  const diff = (k: keyof ItemDef) => ((it?.[k] as number) || 0) - ((eqCur?.[k] as number) || 0);
  const equipped = (id: string) => Object.values(sv.equip).includes(id);
  const inv = Object.entries(sv.inv).filter(([id]) => ITEMS[id]);
  return (
    <Shell title="Inventory & Equipment" code="HUNTER LOADOUT">
      <PanelNav />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <div className="flex flex-col gap-3">
          <div className="panel-section">
            <div className="panel-section-title">Equipped</div>
            <div className="equip-grid">
              {(Object.keys(SLOT_NAMES) as Slot[]).map((sl) => {
                const id = sv.equip[sl];
                const e = id ? ITEMS[id] : null;
                return (
                  <div
                    key={sl}
                    className={'equip-slot' + (e ? ' rarity-border rarity-' + e.rarity : '')}
                    style={e ? ({ ['--rar' as string]: rc(e.rarity), borderColor: rc(e.rarity) + '66' } as CSSProperties) : undefined}
                    onClick={() => e && setSel(id!)}
                    title={e ? e.name : 'Empty slot'}
                  >
                    <div className="es-icon">{e ? <ItemArt it={e} /> : <span style={{ color: 'var(--faint)', fontSize: 14 }}>—</span>}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="es-slot">{SLOT_NAMES[sl]}</div>
                      <div className="es-name" style={{ color: e ? rc(e.rarity) : 'var(--faint)' }}>
                        {e ? e.name : 'Empty'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap" style={{ fontSize: 11 }}>
            <span className="chip gold">◇ {sv.gold.toLocaleString()} G</span>
            <span className="chip violet">✦ {sv.inv.essence || 0} ESSENCE</span>
            <span className="chip blue">{inv.length} ITEM TYPES</span>
          </div>
          <div className="panel-section">
            <div className="panel-section-title">Quick Actions</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              Select any item to inspect its artwork, rarity, affixes and stat comparison. Equipment updates Jin-Woo&apos;s
              combat model immediately.
            </div>
          </div>
        </div>
        <div className="panel-section">
          <div className="panel-section-title">Inventory</div>
          <div className="item-grid">
            {inv.map(([id, n]) => {
              const e = ITEMS[id];
              return (
                <button
                  key={id}
                  className={'item-cell rarity-' + e.rarity + (sel === id ? ' sel' : '')}
                  style={{ ['--rar' as string]: rc(e.rarity) } as CSSProperties}
                  onClick={() => setSel(id)}
                  title={`${e.name} ×${n}`}
                  aria-label={`${e.name}, quantity ${n}`}
                >
                  <ItemArt it={e} />
                  <span className="qty">×{n}</span>
                  {equipped(id) && <span className="eq-mark">E</span>}
                </button>
              );
            })}
            {!inv.length && <div style={{ color: 'var(--faint)', fontSize: 11 }}>Inventory empty.</div>}
          </div>
          {it && (
            <div className="mt-2" style={{ fontSize: 10, color: 'var(--faint)' }}>
              Click an item again in the detail panel to equip, use or sell it.
            </div>
          )}
        </div>
        <div
          className="item-detail"
          style={{ ['--rar' as string]: it ? rc(it.rarity) : '#4aa8ff' } as CSSProperties}
        >
          {it ? (
            <>
              <div className="item-art-large">
                <ItemArt it={it} />
              </div>
              <div className="text-center">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: rc(it.rarity) }}>
                  {it.name}
                </div>
                <div className="sys-eyebrow" style={{ color: rc(it.rarity), marginTop: 2 }}>
                  {it.rarity} · {it.slot ? SLOT_NAMES[it.slot] : it.kind}
                  {it.wtype ? ' · ' + it.wtype : ''}
                </div>
              </div>
              <p style={{ fontSize: 11.5, margin: '8px 0 6px', color: '#c6d9ec', lineHeight: 1.55 }}>{it.desc}</p>
              <div className="flex flex-wrap gap-1">
                {statLine(it)
                  .split(' · ')
                  .filter(Boolean)
                  .map((x) => (
                    <span key={x} className="chip blue">
                      {x}
                    </span>
                  ))}
              </div>
              {it.special && (
                <div className="mt-2" style={{ color: 'var(--gold)', fontSize: 11, display: 'flex', gap: 5 }}>
                  <span>★</span>
                  <span>{it.special}</span>
                </div>
              )}
              {it.slot && eqCur && eqCur.id !== it.id && (
                <div className="compare-row">
                  <span className="chip" style={{ borderColor: 'var(--line)' }}>
                    VS {eqCur.name}
                  </span>
                  {(['atk', 'def', 'hp', 'mp', 'crit', 'spd'] as (keyof ItemDef)[]).map((k) => {
                    const v = diff(k);
                    if (!v) return null;
                    const pct = k === 'crit' || k === 'spd';
                    return (
                      <span key={k} className="chip" style={{ color: v > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {k.toUpperCase()} {v > 0 ? '+' : ''}
                        {pct ? Math.round(v * 100) + '%' : v}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {it.kind === 'equip' && (
                  <button
                    className="sys-btn"
                    disabled={equipped(it.id)}
                    onClick={() => {
                      s.equip(it.id);
                      game.derived = derive(useGame.getState().save);
                    }}
                  >
                    {equipped(it.id) ? 'Equipped' : 'Equip'}
                  </button>
                )}
                {(it.kind === 'consumable' || it.kind === 'key') && (
                  <button className="sys-btn pur" onClick={() => bus.emit('useItem', it.id)}>
                    Use
                  </button>
                )}
                {it.kind !== 'key' && it.id !== 'essence' && (
                  <button className="sys-btn" onClick={() => s.sell(it.id)}>
                    Sell ({Math.floor(it.price * 0.4)}G)
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--faint)', fontSize: 11.5, lineHeight: 1.7 }}>
              <div className="panel-section-title">Item Analysis</div>
              Select an item to inspect its artwork, rarity, affixes, special effects and stat comparison. Equipped gear
              is reflected on the player model.
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ---------------------------------------------------------------- shadows */
function Shadows() {
  const s = useGame();
  const sv = s.save;
  useGame((x) => x.listVer);
  const [q, setQ] = useState('');
  const [rf, setRf] = useState('all');
  const [sel, setSel] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState('army');
  const budget = s.settings.army;
  const list = sv.shadows
    .filter((r) => (rf === 'all' || String(r.rank) === rf) && r.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.rank - a.rank || b.level - a.level);
  const PS = 40;
  const r = sv.shadows.find((x) => x.id === sel);
  const active = sv.shadows.filter((x) => x.state === 'summoned').length;
  const nec = !!sv.flags.necro;
  const sum = (ids: string[]) => {
    if (!nec) {
      s.notify({ title: 'LOCKED', text: 'Complete the Job Change Quest.' });
      return;
    }
    bus.emit('summon', ids.slice(0, budget));
  };
  return (
    <Shell title="Shadow Army" w={1040} code="MONARCH COMMAND">
      <PanelNav />
      <Tabs
        tabs={[
          ['army', `Army (${sv.shadows.length})`],
          ['codex', 'Codex'],
        ]}
        cur={tab}
        set={setTab}
      />
      {tab === 'codex' ? (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
          {[
            ...Object.values(SHADOWS).map((d) => ({
              name: d.name,
              role: d.title,
              arc: sv.shadows.some((x) => x.key === d.key) ? 'Owned' : 'Extractable',
              desc: d.desc,
              key: d.key,
            })),
            ...SHADOW_CODEX.map((c) => ({ ...c, key: 'serpent' })),
          ].map((c) => (
            <div key={c.name} className={'shadow-codex' + (c.arc.startsWith('Locked') ? ' locked' : '')}>
              <div className="flex gap-2 items-start">
                <div className="shadow-portrait" style={{ ['--rank-col' as string]: c.arc.startsWith('Locked') ? '#5a6880' : '#a86bff' } as CSSProperties}>
                  <ShadowArt kind={c.key} color={c.arc.startsWith('Locked') ? '#5a6880' : '#a86bff'} size={30} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 12.5 }}>{c.name}</b>
                  <div style={{ color: 'var(--sys2)', fontSize: 10 }}>{c.role}</div>
                  <div style={{ fontSize: 9.5, color: c.arc.startsWith('Locked') ? 'var(--red)' : 'var(--green)' }}>{c.arc}</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 5, lineHeight: 1.45 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="panel-section">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="Search name..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
              <select value={rf} onChange={(e) => { setRf(e.target.value); setPage(0); }}>
                <option value="all">All ranks</option>
                {RANKS.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="chip violet">
                ACTIVE {active}/{budget}
              </span>
              <span className="chip">STORED {sv.shadows.length - active}</span>
              <span className="chip blue">ESSENCE {sv.inv.essence || 0}</span>
            </div>
            <div className="flex gap-1 flex-wrap mt-2">
              {[1, 2, 3].map((n) => (
                <button key={n} className="sys-btn sm pur" onClick={() => sum(sv.shadows.filter((x) => x.squad === n).map((x) => x.id))}>
                  Summon Squad {n}
                </button>
              ))}
              <button className="sys-btn sm pur" onClick={() => sum(sv.shadows.filter((x) => x.favorite).map((x) => x.id))}>
                Favorites
              </button>
              <button
                className="sys-btn sm pur"
                onClick={() => sum(sv.shadows.slice().sort((a, b) => b.rank - a.rank).map((x) => x.id))}
              >
                Summon All
              </button>
              <button className="sys-btn sm" onClick={() => bus.emit('dismiss', undefined)}>
                Dismiss All
              </button>
              <span style={{ width: 10 }} />
              {['follow', 'attack', 'defend', 'hold', 'regroup'].map((c, i) => (
                <button key={c} className="sys-btn sm" disabled={!nec} onClick={() => bus.emit('command', c)}>
                  {i + 1} {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            <div>
              <div className="scroll" style={{ maxHeight: '46vh' }}>
                {list.slice(page * PS, page * PS + PS).map((x) => (
                  <div
                    key={x.id}
                    className={'shadow-row' + (sel === x.id ? ' sel' : '')}
                    onClick={() => setSel(x.id)}
                    style={{ ['--rank-col' as string]: SHADOW_RANK_COLORS[x.rank] || '#a86bff' } as CSSProperties}
                  >
                    <div className="shadow-portrait">
                      <ShadowArt kind={SHADOWS[x.key]?.model || 'serpent'} color={SHADOW_RANK_COLORS[x.rank] || '#a86bff'} size={30} />
                      <span className="rank-tag">{RANKS[x.rank]?.[0] || '?'}</span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <b style={{ fontSize: 11.5, color: '#e9f4ff' }}>
                          {x.favorite ? '★ ' : ''}
                          {x.name}
                        </b>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: SHADOW_RANK_COLORS[x.rank] }}>
                          {RANKS[x.rank]}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--faint)' }}>
                        LV {x.level} {x.squad ? `· SQUAD ${x.squad}` : ''}{' '}
                        {x.state === 'summoned' && <span style={{ color: 'var(--green)' }}>· ACTIVE</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {!list.length && (
                  <div style={{ color: 'var(--faint)', padding: 8, fontSize: 11.5 }}>
                    {sv.shadows.length ? 'No matches.' : 'No shadows yet. Defeat enemies after the Job Change Quest and press E to Extract.'}
                  </div>
                )}
              </div>
              {list.length > PS && (
                <div className="flex gap-2 items-center mt-1">
                  <button className="sys-btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Prev
                  </button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    {page + 1}/{Math.ceil(list.length / PS)}
                  </span>
                  <button className="sys-btn sm" disabled={(page + 1) * PS >= list.length} onClick={() => setPage(page + 1)}>
                    Next
                  </button>
                </div>
              )}
            </div>
            <div className="panel-section">
              {r ? (
                (() => {
                  const d = SHADOWS[r.key];
                  const st = shadowStats(r);
                  const evo = d.evo[r.evo];
                  const col = SHADOW_RANK_COLORS[r.rank] || '#a86bff';
                  return (
                    <>
                      <div className="shadow-hero">
                        <div className="shadow-portrait" style={{ ['--rank-col' as string]: col } as CSSProperties}>
                          <ShadowArt kind={d.model} color={col} size={66} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: col }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--sys2)' }}>{d.title}</div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            <span className="chip" style={{ color: col, borderColor: col + '66' }}>
                              {RANKS[r.rank].toUpperCase()}
                            </span>
                            <span className="chip">LV {r.level}</span>
                            <span className="chip">{r.state.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bar xp my-2">
                        <i style={{ width: (r.xp / shadowXpNeed(r.level)) * 100 + '%' }} />
                        <b>
                          XP {Math.round(r.xp)} / {shadowXpNeed(r.level)}
                        </b>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3" style={{ fontSize: 11 }}>
                        {[
                          ['HP', st.hp],
                          ['ATK', st.atk],
                          ['DEF', st.def],
                          ['SPD', st.speed.toFixed(1)],
                          ['KILLS', r.kills],
                          ['EVOLUTION', r.evo],
                        ].map(([a, b]) => (
                          <div key={a} className="stat-line">
                            <span>{a}</span>
                            <b>{b}</b>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '6px 0', lineHeight: 1.5 }}>{d.desc}</p>
                      {d.abilities.map((a) => (
                        <div key={a.name} style={{ fontSize: 10, opacity: r.level >= a.lvl ? 1 : 0.4, padding: '1px 0' }}>
                          <b style={{ color: r.level >= a.lvl ? 'var(--pur2)' : 'var(--faint)' }}>
                            {r.level >= a.lvl ? '◆' : '◇'} {a.name}
                          </b>{' '}
                          <span style={{ color: 'var(--muted)' }}>
                            (Lv {a.lvl}) — {a.desc}
                          </span>
                        </div>
                      ))}
                      <div className="flex gap-1 flex-wrap mt-2">
                        <button
                          className="sys-btn sm pur"
                          disabled={!nec}
                          onClick={() => bus.emit(r.state === 'summoned' ? 'dismiss' : 'summon', [r.id])}
                        >
                          {r.state === 'summoned' ? 'Dismiss' : 'Summon'}
                        </button>
                        <button className="sys-btn sm" onClick={() => s.patchShadow(r.id, { favorite: !r.favorite })}>
                          {r.favorite ? '★ Unfavorite' : '☆ Favorite'}
                        </button>
                        {[0, 1, 2, 3].map((n) => (
                          <button
                            key={n}
                            className={'sys-btn sm ' + (r.squad === n ? 'pur' : '')}
                            onClick={() => s.patchShadow(r.id, { squad: n })}
                          >
                            {n ? 'S' + n : 'No squad'}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1 flex-wrap mt-1">
                        <button className="sys-btn sm" onClick={() => s.upgradeShadow(r.id)}>
                          Upgrade (1 Essence)
                        </button>
                        <button className="sys-btn sm" disabled={!evo || r.level < evo.level} onClick={() => s.evolveShadow(r.id)}>
                          {evo ? `Evolve → ${RANKS[r.rank + 1]} (Lv ${evo.level}, ${evo.cost} E)` : 'Max evolution'}
                        </button>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div style={{ color: 'var(--faint)', fontSize: 11.5, lineHeight: 1.7 }}>
                  <div className="panel-section-title">Shadow Record</div>
                  Select a shadow to inspect stats, abilities, evolution, squads and deployment commands.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------------- quests */
function Quests() {
  const s = useGame();
  const sv = s.save;
  const [tab, setTab] = useState('active');
  const ids = Object.keys(sv.quests).filter((k) =>
    tab === 'active' ? sv.quests[k].state === 'active' : sv.quests[k].state === 'done'
  );
  const kindClass = (k: string) =>
    k === 'main' || k === 'dungeon' ? 'main' : k === 'daily' || k === 'emergency' ? 'daily' : k === 'shadow' ? 'system' : 'side';
  return (
    <Shell title="Quest Log" code="SYSTEM DIRECTIVES">
      <PanelNav />
      {sv.quests.q_daily?.state === 'active' && (
        <div className="panel-section mb-2" style={{ borderColor: 'rgba(255,74,90,.3)', background: 'rgba(50,6,14,.3)' }}>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <div className="sys-eyebrow" style={{ color: 'var(--red)' }}>
                [ SYSTEM ] · DAILY DIRECTIVE
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                Daily Quest time remaining
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="chip red" style={{ fontSize: 13, padding: '4px 12px' }}>
                {Math.floor(sv.dailyLeft / 60)}:{String(sv.dailyLeft % 60).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)', maxWidth: 190 }}>
                Failure triggers the Penalty Zone.
              </span>
            </div>
          </div>
        </div>
      )}
      <Tabs
        tabs={[
          ['active', 'Active'],
          ['done', 'Completed'],
        ]}
        cur={tab}
        set={setTab}
      />
      {ids.map((id) => {
        const q = questDef(id);
        if (!q) return null;
        const qs = sv.quests[id];
        const kc = kindClass(q.kind);
        return (
          <div key={id} className={'quest-card ' + kc}>
            <div className="flex justify-between gap-3 flex-wrap">
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="chip" style={{ color: 'var(--qc, var(--sys))', borderColor: 'var(--qc, var(--sys))' }}>
                    {q.system ? '[SYSTEM] ' : ''}
                    {q.kind}
                  </span>
                  {qs.state === 'done' && <span className="chip green">COMPLETE</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                  {q.title}
                </div>
              </div>
              {qs.state === 'active' && (
                <button
                  className={'sys-btn sm ' + (sv.tracked === id ? 'pur' : '')}
                  onClick={() => useGame.setState((x) => ({ save: { ...x.save, tracked: id } }))}
                >
                  {sv.tracked === id ? 'Tracked' : 'Track'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', margin: '2px 0 6px', lineHeight: 1.5 }}>{q.desc}</div>
            {q.objs.map((o, i) => (
              <div key={i} className="my-1">
                <div className="flex justify-between" style={{ fontSize: 11 }}>
                  <span style={{ color: qs.prog[i] >= o.need ? 'var(--green)' : '#cfe0f0' }}>
                    {qs.prog[i] >= o.need ? '◆' : '◇'} {o.t}
                  </span>
                  <b style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500 }}>
                    {Math.min(qs.prog[i], o.need)}/{o.need}
                  </b>
                </div>
                <div className="bar xp" style={{ height: 5, marginTop: 2 }}>
                  <i style={{ width: Math.min(100, (qs.prog[i] / o.need) * 100) + '%' }} />
                </div>
              </div>
            ))}
            <div className="reward-row">
              <span className="chip gold">+{q.reward.xp} XP</span>
              <span className="chip gold">+{q.reward.gold} G</span>
              {q.reward.points ? <span className="chip blue">+{q.reward.points} STAT PTS</span> : null}
              {q.reward.essence ? <span className="chip violet">+{q.reward.essence} ESSENCE</span> : null}
              {q.reward.items?.map((i) => (
                <span key={i} className="chip">{ITEMS[i].name}</span>
              ))}
              {q.reward.title ? <span className="chip green">TITLE · {q.reward.title}</span> : null}
            </div>
          </div>
        );
      })}
      {!ids.length && <div style={{ color: 'var(--faint)', fontSize: 12 }}>No quests here.</div>}
    </Shell>
  );
}

/* ---------------------------------------------------------------- map */
function MapP() {
  const sv = useGame((s) => s.save);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c || !game.zone) return;
    const g = c.getContext('2d')!;
    const z = game.zone;
    let x0 = 1e9,
      x1 = -1e9,
      z0 = 1e9,
      z1 = -1e9;
    z.rects.forEach((r) => {
      x0 = Math.min(x0, r.x0);
      x1 = Math.max(x1, r.x1);
      z0 = Math.min(z0, r.z0);
      z1 = Math.max(z1, r.z1);
    });
    const W = c.width;
    const sc = Math.min((W - 44) / (x1 - x0), (W - 44) / (z1 - z0));
    const tx = (x: number) => 22 + (x - x0) * sc,
      tz = (zz: number) => 22 + (zz - z0) * sc;
    const bg = g.createRadialGradient(W / 2, W / 2, 20, W / 2, W / 2, W * 0.7);
    bg.addColorStop(0, '#071634');
    bg.addColorStop(1, '#02060f');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(86,180,255,0.08)';
    g.lineWidth = 1;
    for (let i = 22; i < W; i += 26) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, W);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
    g.fillStyle = 'rgba(24,62,120,0.65)';
    z.rects.forEach((r) => g.fillRect(tx(r.x0), tz(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc));
    g.fillStyle = 'rgba(40,86,150,0.75)';
    z.roads.forEach((r) => g.fillRect(tx(r.x0), tz(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc));
    g.strokeStyle = 'rgba(86,180,255,0.35)';
    z.roads.forEach((r) => g.strokeRect(tx(r.x0), tz(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc));
    g.fillStyle = '#050c1c';
    g.strokeStyle = 'rgba(86,180,255,0.18)';
    z.boxes.forEach((b) => {
      const x = tx(b.x - b.hw),
        y = tz(b.z - b.hd),
        w = b.hw * 2 * sc,
        h = b.hd * 2 * sc;
      g.fillRect(x, y, w, h);
      g.strokeRect(x, y, w, h);
    });
    g.font = '600 10px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    z.labels.forEach((l) => {
      const x = tx(l.x),
        y = tz(l.z);
      g.fillStyle = 'rgba(2,8,20,0.8)';
      const w = g.measureText(l.text).width + 10;
      g.fillRect(x - w / 2, y - 15, w, 13);
      g.fillStyle = l.color || '#9ad8ff';
      g.fillText(l.text, x, y - 5);
      g.beginPath();
      g.arc(x, y + 2, 2.4, 0, 6.3);
      g.fill();
    });
    game.gates.forEach((gt) => {
      const x = tx(gt.x),
        y = tz(gt.z);
      g.strokeStyle = 'rgba(168,107,255,.9)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 8, 0, 6.3);
      g.stroke();
      g.fillStyle = '#b26bff';
      g.beginPath();
      g.arc(x, y, 3.4, 0, 6.3);
      g.fill();
      g.font = '600 9px "Segoe UI", sans-serif';
      g.fillStyle = '#dcc0ff';
      g.fillText(gt.name, x, y - 12);
    });
    const P = game.P;
    g.fillStyle = '#ffd24a';
    g.beginPath();
    g.arc(tx(P.pos.x), tz(P.pos.z), 5, 0, 6.3);
    g.fill();
    g.strokeStyle = 'rgba(255,210,74,.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(tx(P.pos.x), tz(P.pos.z), 11, 0, 6.3);
    g.stroke();
    g.font = '700 9px "Segoe UI", sans-serif';
    g.fillStyle = '#fff';
    g.fillText('YOU', tx(P.pos.x), tz(P.pos.z) - 14);
    g.font = '700 10px "Segoe UI", sans-serif';
    g.fillStyle = 'rgba(181,230,255,.8)';
    g.textAlign = 'left';
    g.fillText('N', 12, 20);
    g.strokeStyle = 'rgba(181,230,255,.5)';
    g.beginPath();
    g.moveTo(15, 24);
    g.lineTo(15, 36);
    g.stroke();
  }, []);
  const stat = (k: string) =>
    k === 'double' ? sv.flags.doubleDone : k === 'venom' ? sv.flags.venomDone : k === 'job' ? sv.flags.jobDone : false;
  return (
    <Shell title={`World Map — ${game.zone?.name || ''}`} w={1040} code="GATE NETWORK">
      <PanelNav />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <div>
          <canvas ref={cv} width={560} height={560} className="map-canvas" aria-label="World map" />
          <div className="map-legend">
            <span>
              <i style={{ background: 'var(--sys)' }} /> Zone
            </span>
            <span>
              <i style={{ background: 'var(--gold)' }} /> Player
            </span>
            <span>
              <i style={{ background: 'var(--pur)' }} /> Gate
            </span>
            <span>
              <i style={{ background: '#ff6a6a' }} /> Hostile
            </span>
          </div>
        </div>
        <div>
          <div className="panel-section mb-2">
            <div className="panel-section-title">Current Zone</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>{game.zone?.name || '—'}</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>
              Walkable sectors mapped. Gate markers synchronise with the live field.
            </div>
          </div>
          <div className="sys-eyebrow" style={{ marginBottom: 4 }}>
            GATE REGISTRY
          </div>
          <div className="scroll" style={{ maxHeight: '34vh' }}>
            {Object.entries(GATE_INFO).map(([k, gi]) => (
              <div key={k} className="panel-section mb-1" style={{ padding: '6px 9px' }}>
                <div className="flex justify-between gap-2 items-center">
                  <b style={{ fontSize: 11, color: '#' + gi.color.toString(16).padStart(6, '0') }}>
                    [{gi.rank}] {gi.name}
                  </b>
                  {stat(k) ? <span className="chip green">CLEARED</span> : <span className="chip">OPEN</span>}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>
                  Threat: {gi.threat} · Boss: {gi.boss}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>
                  Monsters: {gi.monsters} · Reward: {gi.reward}
                </div>
              </div>
            ))}
          </div>
          <div className="sys-eyebrow mt-2" style={{ marginBottom: 2 }}>
            UNSURVEYED TERRITORIES
          </div>
          {[
            'Red Gate (frozen forest, Baruka)',
            'Demon Castle (Esil Radiru)',
            'Jeju Island Raid (Ant King Beru)',
            'Monarch War (Antares)',
          ].map((a) => (
            <div key={a} style={{ fontSize: 10, color: 'var(--faint)', opacity: 0.7, padding: '1px 0' }}>
              ◇ {a} — locked
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ---------------------------------------------------------------- association / shop */
function Assoc() {
  const s = useGame();
  const sv = s.save;
  const tab = s.shopTab === 'missions' || s.shopTab === 'records' || s.shopTab === 'guilds' ? s.shopTab : 'missions';
  const set = (t: string) => useGame.setState({ shopTab: t });
  return (
    <Shell title="Hunter Association" code="SEOUL BRANCH">
      <Tabs
        tabs={[
          ['missions', 'Mission Board'],
          ['records', 'Hunter Records'],
          ['guilds', 'Guild Records'],
        ]}
        cur={tab}
        set={set}
      />
      {tab === 'missions' && (
        <div>
          {MISSIONS.map((m) => {
            const qs = sv.quests[m.id];
            return (
              <div key={m.id} className="quest-card side">
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700 }}>{m.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{m.desc}</div>
                    <div className="reward-row">
                      <span className="chip gold">+{m.reward.xp} XP</span>
                      <span className="chip gold">+{m.reward.gold} G</span>
                      {m.reward.essence ? <span className="chip violet">+{m.reward.essence} ESSENCE</span> : null}
                    </div>
                    {qs?.state === 'active' && (
                      <div style={{ fontSize: 9.5, color: 'var(--green)', marginTop: 3 }}>
                        PROGRESS {qs.prog[0]}/{m.objs[0].need}
                      </div>
                    )}
                  </div>
                  <button
                    className="sys-btn sm"
                    disabled={qs?.state === 'active'}
                    onClick={() => s.startQuest(m.id)}
                  >
                    {qs?.state === 'active' ? 'Active' : qs?.state === 'done' ? 'Repeat' : 'Accept'}
                  </button>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 6 }}>
            Kill monsters in Seoul gate breaks and raid gates to progress missions. Rewards are collected automatically.
          </div>
        </div>
      )}
      {tab === 'records' && (
        <div className="panel-section">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>SUNG JIN-WOO</div>
          <div style={{ fontSize: 11.5 }}>
            License rank:{' '}
            <b style={{ color: 'var(--gold)' }}>
              {sv.chapter >= 3 ? hunterRank(sv.level) + '-Rank (re-evaluated)' : 'E-Rank'}
            </b>{' '}
            · Level {sv.level}
          </div>
          <div style={{ fontSize: 11.5 }}>
            Monsters slain: {sv.kills} · Dungeons cleared:{' '}
            {['doubleDone', 'venomDone', 'jobDone'].filter((k) => sv.flags[k]).length} · Shadows: {sv.shadows.length}
          </div>
          <div style={{ color: 'var(--sys2)', marginTop: 6, fontSize: 11 }}>
            The Association has no record of a Double Dungeon survivor.. other than you.
          </div>
        </div>
      )}
      {tab === 'guilds' &&
        GUILDS.map((gr) => (
          <div key={gr.name} className="panel-section mb-2">
            <b style={{ color: gr.color, fontFamily: 'var(--font-display)', fontSize: 14 }}>{gr.name}</b>{' '}
            <span style={{ color: 'var(--sys2)', fontSize: 10 }}>Leader: {gr.leader}</span>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{gr.desc}</div>
            {gr.name === 'Ahjin Guild' && (
              <div style={{ color: 'var(--red)', fontSize: 10 }}>Locked: canonical guild; founded in a later story arc.</div>
            )}
          </div>
        ))}
    </Shell>
  );
}
function Shop() {
  const s = useGame();
  const sv = s.save;
  const tab = s.shopTab === 'sell' ? 'sell' : 'buy';
  const set = (t: string) => useGame.setState({ shopTab: t });
  return (
    <Shell title="Hunter Gear Shop" code="SUPPLY DEPOT">
      <div className="flex justify-between items-center mb-2">
        <div className="sys-eyebrow">AUTHORIZED HUNTER SUPPLIES</div>
        <span className="chip gold">◇ {sv.gold.toLocaleString()} GOLD</span>
      </div>
      <Tabs
        tabs={[
          ['buy', 'Buy'],
          ['sell', 'Sell'],
        ]}
        cur={tab}
        set={set}
      />
      {tab === 'buy'
        ? Object.values(ITEMS)
            .filter((i) => i.shop)
            .map((i) => (
              <div key={i.id} className={'slot rarity-' + i.rarity + ' flex justify-between items-center p-2 my-1'} style={{ ['--rar' as string]: rc(i.rarity) } as CSSProperties}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 38, height: 38 }}>
                    <ItemArt it={i} />
                  </div>
                  <div>
                    <b style={{ color: rc(i.rarity), fontSize: 12 }}>{i.name}</b>
                    <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>{statLine(i)}</div>
                  </div>
                </div>
                <button className="sys-btn sm" disabled={sv.gold < i.price} onClick={() => s.buy(i.id)}>
                  {i.price} G
                </button>
              </div>
            ))
        : Object.entries(sv.inv).map(([id, n]) => {
            const i = ITEMS[id];
            if (!i || i.kind === 'key' || id === 'essence') return null;
            return (
              <div key={id} className={'slot rarity-' + i.rarity + ' flex justify-between items-center p-2 my-1'} style={{ ['--rar' as string]: rc(i.rarity) } as CSSProperties}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 34, height: 34 }}>
                    <ItemArt it={i} />
                  </div>
                  <div>
                    <b style={{ color: rc(i.rarity), fontSize: 12 }}>{i.name}</b> <span style={{ fontSize: 9.5 }}>×{n}</span>
                  </div>
                </div>
                <button className="sys-btn sm" onClick={() => s.sell(id)}>
                  Sell {Math.floor(i.price * 0.4)} G
                </button>
              </div>
            );
          })}
    </Shell>
  );
}
function Accept() {
  return (
    <div className="sys-backdrop" style={{ zIndex: 80, background: 'rgba(0,0,10,.75)' }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="sys-panel p-8 text-center" style={{ width: 'min(560px,94vw)', animation: 'sysIn .5s' }}>
        <div className="sys-eyebrow">[ SYSTEM ]</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 700,
            margin: '14px 0',
            lineHeight: 1.4,
          }}
        >
          You have fulfilled the requirements to become a Player.
          <br />
          Do you accept?
        </div>
        <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 12 }}>(There is no other choice.)</div>
        <button className="sys-btn pur" style={{ fontSize: 18, padding: '10px 36px' }} onClick={() => bus.emit('acceptSystem')}>
          Accept
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- settings / controls / misc */
function Settings() {
  const s = useGame();
  const st = s.settings;
  const set = (p: Partial<typeof st>) => {
    s.setSettings(p);
    bus.emit('applySettings');
  };
  const R = (
    label: string,
    k: keyof typeof st,
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string = (v) => String(v)
  ) => (
    <div key={k as string} className="slider-row">
      <div className="sl-head">
        <span>{label}</span>
        <b>{fmt(st[k] as number)}</b>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={st[k] as number}
        onChange={(e) => set({ [k]: parseFloat(e.target.value) } as any)}
      />
    </div>
  );
  return (
    <Shell
      title="Settings"
      code="SYSTEM CONFIG"
      onClose={() => {
        s.setPanel('none');
      }}
    >
      <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))' }}>
        <div className="panel-section">
          <div className="panel-section-title">Audio</div>
          {R('Master volume', 'master', 0, 1, 0.05, (v) => Math.round(v * 100) + '%')}
          {R('Music', 'music', 0, 1, 0.05, (v) => Math.round(v * 100) + '%')}
          {R('Effects', 'sfx', 0, 1, 0.05, (v) => Math.round(v * 100) + '%')}
          {R('Ambience', 'amb', 0, 1, 0.05, (v) => Math.round(v * 100) + '%')}
        </div>
        <div className="panel-section">
          <div className="panel-section-title">Graphics Preset</div>
          <div className="preset-grid">
            {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
              <button
                key={q}
                className={'preset' + (st.quality === q ? ' on' : '')}
                onClick={() => set({ quality: q, ...(QUALITY_PRESETS[q] as any) })}
              >
                <b>{q}</b>
                <span>
                  {q === 'low'
                    ? 'Performance'
                    : q === 'medium'
                      ? 'Balanced'
                      : q === 'high'
                        ? 'Cinematic'
                        : 'Maximum'}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2">
            {R('Resolution scale', 'resScale', 0.5, 1.5, 0.05, (v) => Math.round(v * 100) + '%')}
            {R('Shadow quality', 'shadowQ', 0, 3, 1, (v) => ['Off', 'Low', 'Medium', 'High'][v])}
            {R('Draw distance', 'draw', 60, 400, 10, (v) => v + 'm')}
            {R('Particle quality', 'particles', 0.2, 1.5, 0.1, (v) => Math.round(v * 100) + '%')}
            {R('NPC density (applies on zone load)', 'npcDensity', 0, 40, 1)}
            {R('Active shadow army budget', 'army', 4, 100, 2)}
            <label className="toggle-row">
              <span>Cinematic post-processing (grade / vignette / scanlines)</span>
              <input type="checkbox" checked={st.post} onChange={(e) => set({ post: e.target.checked })} />
            </label>
            <label className="toggle-row">
              <span>Reduced motion (disables shake, banners and menu motion)</span>
              <input type="checkbox" checked={st.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} />
            </label>
          </div>
        </div>
        <div className="panel-section">
          <div className="panel-section-title">Controls & Interface</div>
          {R('Camera sensitivity', 'sens', 0.3, 3, 0.1, (v) => v.toFixed(1) + 'x')}
          {R('UI scale', 'uiScale', 0.7, 1.4, 0.05, (v) => Math.round(v * 100) + '%')}
          <div className="mt-2" style={{ fontSize: 10, color: 'var(--faint)', lineHeight: 1.6 }}>
            Quality presets adjust resolution, shadows, draw distance, particles and army budget together. Settings are
            saved locally and survive reloads.
          </div>
        </div>
      </div>
    </Shell>
  );
}
function Controls() {
  const s = useGame();
  const keys = s.settings.keys;
  const [re, setRe] = useState<string | null>(null);
  useEffect(() => {
    if (!re) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      s.setSettings({ keys: { ...useGame.getState().settings.keys, [re]: e.code } });
      setRe(null);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [re, s]);
  const L: Record<string, string> = {
    forward: 'Move forward',
    back: 'Move back',
    left: 'Move left',
    right: 'Move right',
    jump: 'Jump',
    sprint: 'Sprint',
    dodge: 'Dodge',
    interact: 'Interact / Kneel / Extract',
    dash: 'Shadow Dash',
    exchange: 'Shadow Exchange',
    special: 'Violent Slash',
    skillZ: "Ruler's Authority",
    skillX: 'Dagger Rush',
    summon: 'Summon / cycle command',
    domain: "Monarch's Domain",
    transform: 'Monarch Transformation (locked)',
    status: 'Status',
    inventory: 'Inventory',
    map: 'Map',
    quests: 'Quests',
    pause: 'Pause',
  };
  return (
    <Shell title="Controls" code="INPUT MATRIX" onClose={() => s.setPanel('none')}>
      <div className="panel-section mb-2" style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        <b style={{ color: 'var(--sys2)' }}>MOUSE</b> look (click to capture) · Left click attack (hold: charged heavy) ·
        Right click / wheel lock-on / switch target · Y release lock · 1–5 shadow commands · Shift+C dismiss army · Arrow
        keys camera · Touch on-screen controls.
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))' }}>
        {Object.keys(L).map((a) => (
          <div key={a} className="flex justify-between items-center slot p-1">
            <span style={{ fontSize: 11 }}>{L[a]}</span>
            <button className={'sys-btn sm ' + (re === a ? 'pur' : '')} onClick={() => setRe(a)}>
              {re === a ? 'press key...' : keyName(keys[a])}
            </button>
          </div>
        ))}
      </div>
      <button
        className="sys-btn mt-3"
        onClick={() => {
          import('../game/store').then((m) => s.setSettings({ keys: { ...m.DEFAULT_KEYS } }));
        }}
      >
        Reset to defaults
      </button>
    </Shell>
  );
}
function Credits() {
  return (
    <Shell title="Credits" w={640} code="ARCHIVE" onClose={() => useGame.getState().setPanel('none')}>
      <div style={{ lineHeight: 1.8, fontSize: 12.5, color: '#c6d9ec' }}>
        <p>
          <b style={{ color: 'var(--sys2)' }}>SOLO LEVELING: THE SHADOW MONARCH</b> is an unofficial, non-commercial fan
          project inspired by <i>Solo Leveling</i> by Chugong, DUBU (Redice Studio) and the anime by A-1 Pictures.
        </p>
        <p>
          All 3D models, textures, UI and audio in this build are original procedural assets generated in code (Three.js,
          Web Audio). No copyrighted art or audio is included.
        </p>
        <p>Built with React, TypeScript, Vite, Three.js, Zustand and IndexedDB.</p>
        <p style={{ color: 'var(--sys2)' }}>
          Playable vertical slice. Later arcs (Red Gate, Demon Castle, Jeju Island, Monarch War) and shadows Iron, Tank,
          Tusk, Beru, Kaisel, Greed and Bellion are planned but not yet implemented.
        </p>
      </div>
    </Shell>
  );
}
function Load() {
  const [slots, setSlots] = useState<[string, SaveData | null][]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    Promise.all(['auto', 'manual'].map(async (k) => [k, await idbGet<SaveData>(k)] as [string, SaveData | null])).then(
      (entries) =>
        setSlots(entries.map(([key, save]) => [key, save ? normalizeSave(save).save : null] as [string, SaveData | null]))
    );
  }, []);
  const exportSave = () => {
    const blob = new Blob([serializeSave(useGame.getState().snapshot())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solo-leveling-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Save exported.');
  };
  const importSave = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseSaveFile(await file.text());
      if (!window.confirm('Load this imported save? Current unsaved progress will be replaced.')) return;
      useGame.getState().load(parsed.save);
      setMessage(
        parsed.recovered
          ? `Imported with recovery notes: ${parsed.warnings.slice(0, 3).join(' ')}`
          : 'Save imported successfully.'
      );
      setTimeout(() => bus.emit('requestLock'), 50);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The save file could not be read.');
    }
  };
  return (
    <Shell title="Load Game" w={600} code="SAVE ARCHIVE" onClose={() => useGame.getState().setPanel('none')}>
      {slots.map(([k, d]) => (
        <div key={k} className="panel-section mb-2 flex justify-between items-center gap-3">
          <div>
            <div className="sys-eyebrow">{k === 'auto' ? 'AUTOSAVE' : 'MANUAL SAVE'}</div>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 14 }}>{k === 'auto' ? 'Council Checkpoint' : 'Hunter Record'}</b>
            {d ? (
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                LV {d.level} · CHAPTER {d.chapter} · {d.shadows.length} SHADOWS · {new Date(d.savedAt).toLocaleString()}
              </div>
            ) : (
              <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>Empty</div>
            )}
          </div>
          {d && (
            <button
              className="sys-btn pur"
              onClick={() => {
                useGame.getState().load(d);
                setTimeout(() => bus.emit('requestLock'), 50);
              }}
            >
              Load
            </button>
          )}
        </div>
      ))}
      {message && (
        <div className="panel-section mb-2" role="status" style={{ fontSize: 11, color: 'var(--sys2)' }}>
          {message}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button className="sys-btn" onClick={() => continueGame()}>
          Continue latest
        </button>
        <button className="sys-btn" onClick={exportSave}>
          Export current save
        </button>
        <button className="sys-btn" onClick={() => fileRef.current?.click()}>
          Import save file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void importSave(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </Shell>
  );
}
function Scores() {
  const sc = useGame((s) => s.scores);
  return (
    <Shell title="High Scores" w={600} code="RECORD BOARD" onClose={() => useGame.getState().setPanel('none')}>
      {sc.map((s, i) => (
        <div key={i} className="score-row">
          <span>
            <b style={{ color: i === 0 ? 'var(--gold)' : 'var(--sys2)' }}>{i + 1}.</b> {s.name}{' '}
            <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>
              LV {s.level} · {s.note} · {s.date}
            </span>
          </span>
          <b>{s.score.toLocaleString()}</b>
        </div>
      ))}
      {!sc.length && (
        <div style={{ color: 'var(--faint)', fontSize: 11.5 }}>
          No scores yet. Score is earned from kills, quests and extractions; it is logged when you die, retire or complete
          a milestone.
        </div>
      )}
    </Shell>
  );
}
