import { useEffect, useRef } from 'react';
import { game } from '../game/game';
import { bus, questDef, useGame, useHud } from '../game/store';
import { xpNeeded, hunterRank, RANKS, SHADOW_RANK_COLORS } from '../game/data';
import { isTouch } from './Touch';

const keyName = (c: string) =>
  (c || '')
    .replace('Key', '')
    .replace('Digit', '')
    .replace('Left', '')
    .replace('Control', 'Ctrl')
    .replace('Escape', 'Esc');

const GLYPH: Record<string, string> = {
  dash: 'M4 12h11M10 6l6 6-6 6',
  special: 'M4 19C10 17 17 11 20 4c-1 9-6 14-16 15Z',
  x: 'M5 5l14 14M19 5 5 19',
  z: 'M5 19c0-4 3-7 7-7s7 3 7 7M9 7a3 3 0 1 1 6 0',
  v: 'M4 17l4-9 4 5 4-5 4 9H4Z',
  r: 'M6 8h10l-3-3m5 11H8l3 3',
  summon: 'M12 3a4 4 0 0 1 4 4v1l-2 1v2l2 1v3l-2 1-2-2-2 2-2-1v-3l2-1V8L8 8V7a4 4 0 0 1 4-4Z',
};
const Glyph = ({ name }: { name: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={GLYPH[name] || GLYPH.dash} />
  </svg>
);
const Portrait = () => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="M16 3l3.4 5.6 6.1-1.5-2.2 7.6 4.2 4-5.7 1.5L18 27l-2-4.6L14 27l-3.8-6.8L4.5 18.7l4.2-4-2.2-7.6 6.1 1.5L16 3Z"
      fill="rgba(86,180,255,.16)"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <path d="M12 14h8M16 11v10" stroke="currentColor" strokeWidth="1.1" opacity=".8" />
  </svg>
);
const Skull = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="skull">
    <path d="M12 3a7 7 0 0 0-7 7v3l2 2v4h10v-4l2-2v-3a7 7 0 0 0-7-7Z" />
    <path d="M9 13h.01M15 13h.01M10 18v3M14 18v3" strokeLinecap="round" />
  </svg>
);

const Bar = ({ v, max, cls, label }: { v: number; max: number; cls: string; label?: string }) => (
  <div className={'bar ' + cls} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemax={max}>
    <i style={{ width: Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100)) + '%' }} />
    <b>{label ?? `${Math.round(v)} / ${max}`}</b>
  </div>
);
const BarRow = ({ label, v, max, cls, title }: { label: string; v: number; max: number; cls: string; title?: string }) => (
  <div className={'hud-bar-row' + (cls === 'xp' ? ' xp-row' : '')}>
    <span className="hud-bar-label" title={title}>
      {label}
    </span>
    <Bar v={v} max={max} cls={cls} />
  </div>
);

const SKILL_DEFS: [string, string, string, boolean, number, string][] = [
  ['dash', 'Shadow Dash', 'Q', false, 2.6, 'dash'],
  ['special', 'Violent Slash', 'F', false, 4.5, 'special'],
  ['x', 'Dagger Rush', 'X', false, 6, 'x'],
  ['z', "Ruler's Authority", 'Z', false, 9, 'z'],
  ['v', "Monarch's Domain", 'V', false, 24, 'v'],
  ['r', 'Shadow Exchange', 'R', false, 3, 'r'],
];

export function Hud() {
  const h = useHud();
  const sv = useGame((s) => s.save);
  const f = sv.flags;
  const keys = useGame((s) => s.settings.keys);
  const score = useGame((s) => s.runScore);
  const reduced = useGame((s) => s.settings.reducedMotion);
  const mini = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    game.miniCanvas = mini.current;
    return () => {
      game.miniCanvas = null;
    };
  }, []);
  const tracked =
    sv.tracked && sv.quests[sv.tracked]?.state === 'active'
      ? sv.tracked
      : Object.keys(sv.quests).find((k) => sv.quests[k].state === 'active');
  const q = tracked ? questDef(tracked) : null;
  const qs = tracked ? sv.quests[tracked] : null;
  const skills = SKILL_DEFS.map(([id, name, , , cd, glyph]) => ({
    id,
    name,
    cd,
    glyph,
    key: id === 'dash' ? keys.dash : id === 'special' ? keys.special : id === 'x' ? keys.skillX : id === 'z' ? keys.skillZ : id === 'v' ? keys.domain : keys.exchange,
    unlocked:
      id === 'dash' || id === 'x'
        ? !!f.awakened
        : id === 'special'
          ? !!f.venomDone
          : !!f.necro,
  }));
  const owned = sv.shadows.length;
  const ult = f.necro ? Math.max(0, Math.min(1, 1 - (h.cds.v || 0) / 24)) : h.maxMp ? Math.min(1, h.mp / h.maxMp) : 0;
  const rank = hunterRank(sv.level);
  const low = h.hp < h.maxHp * 0.3;
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* player card */}
      <section className="hud-card hud-player" aria-label="Player status">
        <div className="hud-portrait">
          <Portrait />
        </div>
        <div className="hud-eyebrow">
          <span>
            {f.necro ? 'SHADOW MONARCH' : f.awakened ? 'THE PLAYER' : 'HUNTER'} · RANK <b>{rank}</b>
          </span>
          {f.necro ? <span className="chip violet">AWAKENED</span> : f.awakened ? <span className="chip blue">SYSTEM</span> : null}
        </div>
        <div className="hud-name">
          <span>SUNG JIN-WOO</span>
          <span className="hud-lv">LV {sv.level}</span>
        </div>
        <div className="hud-title">{sv.title}</div>
        <div className="hud-bars">
          <BarRow label="HP" v={h.hp} max={h.maxHp} cls="hp" title="Health" />
          <BarRow label="MP" v={h.mp} max={h.maxMp} cls="mp" title="Mana" />
          <BarRow label="XP" v={sv.xp} max={xpNeeded(sv.level)} cls="xp" title="Experience" />
        </div>
        {sv.points > 0 && (
          <div className="hud-points">
            ◆ {sv.points} STAT POINTS — {keyName(keys.status)}
          </div>
        )}
        <div className="hud-currency">
          <span className="gold">◇ {sv.gold.toLocaleString()} G</span>
          <span className="ess">✦ {sv.inv.essence || 0} ESSENCE</span>
        </div>
      </section>

      {/* minimap */}
      <div className="hud-minimap">
        <div className="minimap-wrap">
          <canvas ref={mini} width={150} height={150} style={{ width: '100%', height: '100%' }} aria-label="Minimap" />
          <div className="minimap-tick" />
          <div className="minimap-n">N</div>
        </div>
        <div className="minimap-zone">{h.zone}</div>
      </div>

      {/* quest tracker */}
      {q && qs && (
        <section className="hud-card hud-quest" aria-label="Tracked quest">
          <div className="q-kind">
            {q.system ? '[SYSTEM] ' : ''}
            {q.kind}
          </div>
          <div className="q-title">{q.title}</div>
          {q.objs.map((o, i) => (
            <div key={i} className={'q-obj' + (qs.prog[i] >= o.need ? ' done' : '')}>
              <i>{qs.prog[i] >= o.need ? '◆' : '◇'}</i>
              <span>{o.t}</span>
              <b>
                {Math.min(qs.prog[i], o.need)}/{o.need}
              </b>
            </div>
          ))}
        </section>
      )}

      {/* boss / target / timer */}
      <div className="hud-topcenter">
        {h.boss && (
          <div className="w-full">
            <div className="boss-head">
              <span className="boss-name">
                <Skull />
                {h.boss.name.toUpperCase()}
              </span>
              <span className="boss-phase-pips" aria-label={`Phase ${h.boss.phase}`}>
                {[1, 2, 3].map((p) => (
                  <i key={p} className={p <= h.boss!.phase ? 'on' : ''} />
                ))}
              </span>
            </div>
            <div className="boss-wrap">
              <div className="bar bossbar" style={{ height: 13 }}>
                <i style={{ width: Math.max(0, (h.boss.hp / h.boss.max) * 100) + '%' }} />
                <b>
                  {h.boss.hp} / {h.boss.max}
                </b>
              </div>
            </div>
          </div>
        )}
        {h.target && !h.boss && (
          <div className="target-wrap">
            <div className="target-head">
              <span>{h.target.name}</span>
              <span>[{h.target.rank}]</span>
            </div>
            <div className="bar bossbar">
              <i style={{ width: Math.max(0, (h.target.hp / h.target.max) * 100) + '%' }} />
            </div>
          </div>
        )}
        {h.timer && (
          <div
            className="timer-chip"
            style={{ color: h.timer.startsWith('SURVIVE') || h.timer.includes('Next') ? 'var(--gold)' : undefined }}
          >
            {h.timer}
          </div>
        )}
        {h.combo > 2 && (
          <div className={`combo${reduced ? '' : ''}`}>
            <small>COMBO</small> ×{h.combo}
          </div>
        )}
      </div>

      {/* interaction prompt */}
      {h.prompt && (
        <div className="hud-prompt">
          {h.prompt.includes('[E]') && <span className="kbd">{keyName(keys.interact)}</span>}
          <span>{h.prompt.replace('[E]', '').replace(/^\s*/, '')}</span>
        </div>
      )}

      {/* ultimate + skills */}
      {!isTouch && (
        <div className="hud-skills">
          <div className="ultimate-row">
            <span className="ult-label">{f.necro ? "MONARCH'S DOMAIN" : 'AWAKENING'}</span>
            <div className="bar ultimate">
              <i style={{ width: ult * 100 + '%' }} />
            </div>
            <span className="ult-label">{Math.round(ult * 100)}%</span>
          </div>
          <div className="skill-row">
            {skills.map(({ id, name, cd, glyph, key, unlocked }) => {
              const c = h.cds[id] || 0;
              return (
                <div
                  key={id}
                  className={'skill' + (unlocked ? (c > 0 ? '' : ' ready') : ' locked')}
                  title={`${name} ${unlocked ? '' : '(locked)'}${c > 0 ? ` — ${c.toFixed(1)}s` : ''}`}
                >
                  <span className="sk-key">{keyName(key)}</span>
                  <Glyph name={glyph} />
                  <span className="sk-name">{unlocked ? name : 'LOCKED'}</span>
                  {c > 0 && (
                    <>
                      <span
                        className="sk-cd"
                        style={{ clipPath: `inset(${Math.max(0, 100 - (c / cd) * 100)}% 0 0 0)` }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'grid',
                          placeItems: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          color: '#fff',
                          textShadow: '0 0 8px #000',
                        }}
                      >
                        {c.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
            <div className={'skill' + (f.necro ? ' ready' : ' locked')} title="Summon Shadow Army">
              <span className="sk-key">{keyName(keys.summon)}</span>
              <Glyph name="summon" />
              <span className="sk-name">{f.necro ? 'SHADOWS' : 'LOCKED'}</span>
            </div>
          </div>
        </div>
      )}

      {/* bottom left army */}
      <section
        className="hud-card hud-bottom-left"
        style={{ opacity: f.necro ? 1 : 0.55 }}
        aria-label="Shadow army"
      >
        <div className="hud-army-title">
          <span>SHADOW ARMY</span>
          <span className="dot" style={{ color: f.necro ? 'var(--pur)' : 'var(--faint)' }} />
        </div>
        {f.necro ? (
          <>
            <div className="hud-army-stats">
              <span>
                ACTIVE <b>{h.army}</b>
              </span>
              <span>
                STORED <b>{Math.max(0, owned - h.army)}</b>
              </span>
              <span>
                CMD <b style={{ color: 'var(--pur2)' }}>{h.cmd.toUpperCase()}</b>
              </span>
            </div>
            <div className="hud-cmd">◈ {h.cmd}</div>
          </>
        ) : (
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>
            Unlocks after the Job Change Quest
          </div>
        )}
      </section>
      <section className="hud-card hud-bottom-right" aria-label="Weapon and score">
        <div className="hud-weapon-label">Equipped weapon</div>
        <div className="hud-weapon-name">{h.weapon}</div>
        <div className="hud-score">
          <span>
            SCORE <b style={{ color: '#fff' }}>{score.toLocaleString()}</b>
          </span>
          <span className="gold">◇ {sv.gold.toLocaleString()}</span>
          <span className="ess">✦ {sv.inv.essence || 0}</span>
        </div>
      </section>

      {h.kneel > 0.2 && <div className="hud-kneel">KNEELING...</div>}
      {low && <div className="hud-alert-low" aria-hidden="true" />}
      {h.locked && <div className="hud-lock">LOCK-ON</div>}
      {isTouch && (
        <section className="hud-card" style={{ left: 8, bottom: 8, padding: '6px 8px', width: 196 }}>
          <div className="hud-army-stats">
            <span>
              ◇ {sv.gold.toLocaleString()} G
            </span>
            <span>
              ✦ {sv.inv.essence || 0}
            </span>
            <span>
              SCORE <b>{score.toLocaleString()}</b>
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

export function Overlays() {
  const notifs = useGame((s) => s.notifs);
  const keys = useGame((s) => s.settings.keys);
  const d = useGame((s) => s.dialog);
  const cine = useGame((s) => s.cine);
  const ar = useGame((s) => s.arise);
  const b = useGame((s) => s.banner);
  const screen = useGame((s) => s.screen);
  const panel = useGame((s) => s.panel);
  const ariseRank = ar?.rank ? RANKS.indexOf(ar.rank) : -1;
  const ariseColor = ariseRank >= 0 ? SHADOW_RANK_COLORS[ariseRank] : '#ffd24a';
  return (
    <>
      <div className="notif-stack" aria-live="polite" aria-atomic="false">
        {notifs.map((n) => {
          const color =
            n.kind === 'levelup'
              ? '#ffd24a'
              : n.kind === 'quest'
                ? '#7affb0'
                : n.kind === 'item'
                  ? '#d4a0ff'
                  : '#56b4ff';
          return (
            <div key={n.id} className="notif" style={{ ['--n-col' as string]: color }}>
              <div className="notif-title">[{n.title}]</div>
              {n.text && <div className="notif-text">{n.text}</div>}
            </div>
          );
        })}
      </div>
      {b && (
        <div
          className="fixed left-0 right-0 text-center pointer-events-none"
          style={{ top: '24%', zIndex: 30 }}
          key={b.t}
        >
          <div
            className="banner"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(24px,5vw,56px)',
              fontWeight: 900,
              color: b.color || '#b5e6ff',
              textShadow: `0 0 34px ${b.color || '#56b4ff'}`,
              letterSpacing: '0.28em',
            }}
          >
            {b.text}
          </div>
          {b.sub && (
            <div
              className="banner"
              style={{
                fontSize: 'clamp(12px,1.8vw,20px)',
                color: '#e8f4ff',
                letterSpacing: '0.12em',
                marginTop: 6,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {b.sub}
            </div>
          )}
        </div>
      )}
      {cine?.bars && (
        <>
          <div className="fixed left-0 right-0 top-0 bg-black pointer-events-none" style={{ height: '11vh', zIndex: 35 }} />
          <div
            className="fixed left-0 right-0 bottom-0 bg-black pointer-events-none"
            style={{ height: '11vh', zIndex: 35 }}
          />
          <button className="sys-btn sm fixed" style={{ top: '12vh', right: 14, zIndex: 40 }} onClick={() => bus.emit('skipCine')}>
            SKIP (Enter)
          </button>
        </>
      )}
      {cine?.text && cine.speaker === 'SYSTEM' && (
        <div
          className="fixed left-0 right-0 flex justify-center pointer-events-none"
          style={{ top: '38%', zIndex: 36 }}
        >
          <div className="sys-panel px-8 py-5 text-center" style={{ maxWidth: 700, animation: 'sysIn .4s' }}>
            <div className="sys-eyebrow" style={{ marginBottom: 6 }}>
              [ SYSTEM ]
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                whiteSpace: 'pre-line',
                letterSpacing: '0.04em',
              }}
            >
              {cine.text}
            </div>
          </div>
        </div>
      )}
      {cine?.text && cine.speaker !== 'SYSTEM' && (
        <div
          className="fixed left-0 right-0 text-center pointer-events-none"
          style={{ bottom: cine.bars ? '13vh' : 170, zIndex: 36 }}
        >
          <div
            className="inline-block px-5 py-2"
            style={{
              background: 'rgba(0,0,0,.62)',
              borderLeft: '2px solid var(--sys)',
              maxWidth: '80vw',
              fontSize: 'clamp(14px,2vw,22px)',
            }}
          >
            {cine.speaker && (
              <b
                style={{
                  color: cine.speaker === 'TIP' || cine.speaker === 'Objective' ? '#b5e6ff' : '#ffd24a',
                  marginRight: 10,
                }}
              >
                {cine.speaker}:
              </b>
            )}
            {cine.text}
          </div>
        </div>
      )}
      {d && (
        <div
          className="fixed left-0 right-0 flex justify-center"
          style={{ bottom: 20, zIndex: 45 }}
          onClick={() => !d.choices && bus.emit('dialogAdvance')}
        >
          <div
            className="sys-panel p-4"
            style={{ width: 'min(780px, 94vw)', borderColor: d.color || 'var(--sys)' }}
          >
            <div className="sys-title" style={{ fontSize: 12, color: d.color }}>
              {d.name}
            </div>
            <div style={{ fontSize: 'clamp(15px,2vw,20px)', minHeight: 48, margin: '6px 0' }}>{d.lines[d.idx]}</div>
            {d.choices && d.idx === d.lines.length - 1 ? (
              <div className="flex gap-2 flex-wrap">
                {d.choices.map((c) => (
                  <button
                    key={c.id}
                    className="sys-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      bus.emit('dialogChoice', c.id);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--faint)',
                  textAlign: 'right',
                  letterSpacing: '0.1em',
                }}
              >
                CLICK OR PRESS [{keyName(keys.interact)}] TO CONTINUE ({d.idx + 1}/{d.lines.length})
              </div>
            )}
          </div>
        </div>
      )}
      {ar && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{
            zIndex: 55,
            background:
              ar.stage === 1
                ? 'radial-gradient(circle, rgba(60,0,140,.55), rgba(0,0,0,.78))'
                : 'radial-gradient(circle, rgba(40,0,100,.32), rgba(0,0,0,.42))',
          }}
        >
          {ar.stage === 1 && (
            <div className="arise-txt" style={{ fontSize: 'clamp(60px,16vw,200px)', fontWeight: 900, letterSpacing: '0.2em' }}>
              ARISE
            </div>
          )}
          {ar.stage === 2 && (
            <div style={{ animation: 'fadeUp .8s', textAlign: 'center' }}>
              <div className="sys-title" style={{ fontSize: 'clamp(16px,3vw,32px)', color: '#d4a0ff' }}>
                SHADOW EXTRACTION COMPLETE
              </div>
              <div className="title-big" style={{ fontSize: 'clamp(30px,7vw,84px)' }}>
                {ar.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(14px,2.4vw,26px)',
                  letterSpacing: '0.4em',
                  color: ariseColor,
                }}
              >
                RANK: {ar.rank?.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}
      {screen === 'paused' && panel === 'none' && <Pause keys={keys} />}
      {screen === 'dead' && <Dead />}
      {screen === 'ending' && <Ending />}
    </>
  );
}

function ActionIcon({ kind }: { kind: string }) {
  const d: Record<string, string> = {
    resume: 'M8 5l11 7-11 7V5Z',
    save: 'M5 4h11l3 3v13H5V4Zm3 0v6h8V4M8 20v-6h8v6',
    load: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3',
    status: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5l3 2',
    inventory: 'M4 8h16v12H4V8Zm3-4h10l3 4H4l3-4ZM9 12h6',
    shadows: 'M12 3a4 4 0 0 1 4 4v1l-2 1v2l2 1v3l-2 1-2-2-2 2-2-1v-3l2-1V8L8 8V7a4 4 0 0 1 4-4Z',
    quests: 'M6 4h12v16l-6-3-6 3V4Z',
    map: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6Zm5-2v14m6-12v14',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4',
    controls: 'M3 7h18v10H3V7Zm3 5h.01M9 12h.01M15 12h6M6 15h12',
    retire: 'M12 3l9 4-9 4-9-4 9-4Zm-6 8v5c0 2 3 4 6 4s6-2 6-4v-5',
    menu: 'M4 12h16M4 6h16M4 18h16',
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d[kind] || d.resume} />
    </svg>
  );
}

function Pause({ keys }: { keys: Record<string, string> }) {
  const st = useGame();
  const zone = useHud((s) => s.zone);
  const sv = st.save;
  const resume = () => {
    st.setScreen('playing');
    bus.emit('requestLock');
  };
  const row = (kind: string, label: string, fn: () => void, cls = '') => (
    <button className={'pause-action ' + cls} onClick={fn} key={label}>
      <ActionIcon kind={kind} />
      <span>{label}</span>
    </button>
  );
  return (
    <div className="screen-center">
      <div className="sys-window pause-window" role="dialog" aria-modal="true" aria-label="Paused">
        <div className="pause-head">
          <div>
            <div className="sys-eyebrow">[ SYSTEM ] · GAME SUSPENDED</div>
            <div className="sys-window-title">Paused</div>
          </div>
          <div className="chip blue" style={{ letterSpacing: '0.18em' }}>
            {zone || 'SEOUL'}
          </div>
        </div>
        <div className="pause-summary">
          <span>
            SUNG JIN-WOO · <b>LV {sv.level}</b>
          </span>
          <span>
            RANK <b>{hunterRank(sv.level)}</b>
          </span>
          <span>
            GOLD <b style={{ color: 'var(--gold)' }}>{sv.gold}</b>
          </span>
          <span>
            SHADOWS <b style={{ color: 'var(--pur2)' }}>{sv.shadows.length}</b>
          </span>
        </div>
        <div className="pause-grid">
          {row('resume', `Resume (${keyName(keys.pause)})`, resume, 'primary')}
          {row('save', 'Save Game', () => bus.emit('saveNow'))}
          {row('load', 'Load Game', () => st.setPanel('load'))}
          {row('status', 'Status Window', () => st.setPanel('status'))}
          {row('inventory', 'Inventory & Gear', () => st.setPanel('inventory'))}
          {row('shadows', 'Shadow Army', () => st.setPanel('shadows'))}
          {row('quests', 'Quest Log', () => st.setPanel('quests'))}
          {row('map', 'World Map', () => st.setPanel('map'))}
          {row('settings', 'Settings', () => st.setPanel('settings'))}
          {row('controls', 'Controls', () => st.setPanel('controls'))}
          {row('retire', 'Retire Run — Log Score', () => st.submitScore('Retired'), 'danger')}
          {row(
            'menu',
            'Save & Main Menu',
            () => {
              if (st.save.chapter >= 1) st.persist('auto');
              st.setScreen('menu');
              st.setPanel('none');
            }
          )}
        </div>
        <div className="pause-foot">Autosaves every 40s in Seoul. Dungeon progress resumes at the gate in Seoul.</div>
      </div>
    </div>
  );
}

function Dead() {
  const st = useGame();
  const info = st.deathInfo;
  const sc = st.scores;
  return (
    <div className="screen-center" style={{ background: 'radial-gradient(circle, rgba(80,0,10,.58), rgba(0,0,0,.94))' }}>
      <div className="text-center" style={{ width: 'min(640px,94vw)' }}>
        <div className="death-title">YOU DIED</div>
        <div className="death-sub">{info?.cause}</div>
        <div style={{ fontSize: 20, margin: '12px 0 4px' }}>
          RUN SCORE <b style={{ color: 'var(--gold)' }}>{(info?.score ?? 0).toLocaleString()}</b> · LV {st.save.level}
        </div>
        <div className="flex gap-3 justify-center mt-3">
          <button className="sys-btn pur" style={{ fontSize: 17, padding: '12px 30px' }} onClick={() => bus.emit('retry')}>
            Retry (R)
          </button>
          <button className="sys-btn" onClick={() => st.setScreen('menu')}>
            Main Menu
          </button>
        </div>
        <div className="sys-panel p-3 mt-5 mx-auto text-left" style={{ width: 380 }}>
          <div className="sys-eyebrow" style={{ marginBottom: 4 }}>
            HIGH SCORES
          </div>
          {sc.slice(0, 5).map((s, i) => (
            <div key={i} className="score-row">
              <span>
                {i + 1}. {s.note}
              </span>
              <b>{s.score.toLocaleString()}</b>
            </div>
          ))}
          {!sc.length && <div style={{ fontSize: 11, color: 'var(--faint)' }}>No scores yet.</div>}
        </div>
      </div>
    </div>
  );
}

function Ending() {
  const st = useGame();
  const sv = st.save;
  const sc = st.scores[0];
  return (
    <div
      className="screen-center"
      style={{ background: 'radial-gradient(circle, rgba(50,10,120,.62), rgba(0,0,10,.96))' }}
    >
      <div className="sys-window p-0 text-center" style={{ width: 'min(680px,94vw)' }}>
        <div className="p-5">
          <div className="sys-eyebrow">[ SYSTEM ] · MILESTONE COMPLETE</div>
          <div className="title-big" style={{ fontSize: 'clamp(24px,5vw,46px)', marginTop: 4 }}>
            THE NECROMANCER AWAKENS
          </div>
          <p style={{ color: '#cfe6ff', margin: '12px 0', lineHeight: 1.65, fontSize: 14 }}>
            You survived the Double Dungeon, awakened the System, slew Kasaka, defeated Igris the Red Knight and extracted
            your first shadow. Story Arcs 06–10 (Red Gate, Demon Castle, Jeju Island, Monarch War) are{' '}
            <b>not yet in this build</b>; the Shadow Army, raid gates and city remain open to explore.
          </p>
          <div style={{ fontSize: 16 }}>
            LEVEL <b>{sv.level}</b> · SHADOWS <b>{sv.shadows.length}</b> · SCORE{' '}
            <b style={{ color: 'var(--gold)' }}>{(sc?.score ?? 0).toLocaleString()}</b>
          </div>
          <button
            className="sys-btn pur mt-4"
            style={{ fontSize: 15 }}
            onClick={() => {
              st.setScreen('playing');
              bus.emit('requestLock');
            }}
          >
            Continue — Free Roam & Raid Gates
          </button>
        </div>
      </div>
    </div>
  );
}
