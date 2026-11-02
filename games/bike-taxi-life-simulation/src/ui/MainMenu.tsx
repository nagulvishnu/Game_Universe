import { useState } from 'react';
import { useGame } from '../game/store';
import { startAudio } from '../game/audio';
import { LocalSaveRepository } from '../game/persistence';
import { Controls } from './Panels';

const actionClass = 'flex min-h-14 w-full items-center justify-between rounded-xl border px-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300';

export function MainMenu() {
  const hasSave = useGame((s) => s.hasSave);
  const newGame = useGame((s) => s.newGame);
  const cont = useGame((s) => s.continueGame);
  const [view, setView] = useState<'main' | 'controls' | 'about'>('main');
  const [msg, setMsg] = useState('');
  const info = LocalSaveRepository.info();

  return (
    <main className="relative h-full w-full overflow-y-auto bg-[#090d17] text-white selection:bg-amber-300 selection:text-slate-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 -top-56 h-[36rem] w-[36rem] rounded-full bg-orange-500/20 blur-[120px]" />
        <div className="absolute right-[-8rem] top-[-10rem] h-[38rem] w-[38rem] rounded-full bg-indigo-500/20 blur-[130px]" />
        <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-[#101521] to-transparent" />
        <svg className="absolute inset-x-0 bottom-0 h-[48%] w-full opacity-70" viewBox="0 0 1440 410" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="menu-skyline" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#26314a" />
              <stop offset="1" stopColor="#111827" />
            </linearGradient>
            <linearGradient id="menu-road" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#283142" />
              <stop offset="1" stopColor="#11151e" />
            </linearGradient>
          </defs>
          {Array.from({ length: 42 }, (_, i) => {
            const width = 20 + ((i * 17) % 38);
            const height = 72 + ((i * 47) % 220);
            const x = i * 36;
            return <g key={i}>
              <rect x={x} y={310 - height} width={width} height={height} fill="url(#menu-skyline)" />
              {Array.from({ length: Math.floor(height / 24) }, (_, row) => (
                <rect key={row} x={x + 6} y={324 - height + row * 22} width="3" height="5" fill="#ffc978" opacity={0.2 + ((i + row) % 4) * 0.12} />
              ))}
            </g>;
          })}
          <path d="M0 316h1440v94H0z" fill="#10151f" />
          <path d="M0 346h1440" stroke="#647084" strokeWidth="2" opacity=".5" />
          <path d="M0 381h1440" stroke="#e9b64e" strokeWidth="3" strokeDasharray="42 34" opacity=".65" />
          <path d="M690 410 780 316h92l150 94" fill="url(#menu-road)" opacity=".8" />
        </svg>
        <div className="absolute bottom-28 right-[13%] hidden h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_24px_8px_rgba(251,191,36,.25)] lg:block" />
      </div>

      <div className="landing-shell relative mx-auto flex min-h-full max-w-[1440px] flex-col px-5 py-5 sm:px-8 lg:px-14">
        <header className="landing-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-xl shadow-lg shadow-black/20">🏍️</span>
            <div>
              <div className="text-xs font-black tracking-[0.18em] text-white">RIDE TO RICHES</div>
              <div className="mt-0.5 text-[9px] font-semibold tracking-[0.25em] text-slate-400">THE BIKE TAXI LIFE</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-wide text-emerald-200 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />
            A CITY THAT NEVER STANDS STILL
          </div>
        </header>

        <section className="landing-layout grid flex-1 items-center gap-10 py-12 min-[700px]:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] min-[700px]:gap-4 min-[700px]:py-10 xl:gap-16 xl:py-16">
          <div className="relative z-10 max-w-3xl pb-12 md:pb-8">
            <div className="landing-kicker mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-100/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">
              <span>CHENNAI</span><span className="text-amber-200/40">/</span><span>YOUR STORY STARTS HERE</span>
            </div>
            <h1 className="landing-headline max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.06em] sm:text-6xl xl:text-[6.5rem]">
              One bike.
              <br />
              <span className="bg-gradient-to-r from-amber-200 via-orange-300 to-rose-300 bg-clip-text text-transparent">A city to</span>
              <br />
              <span className="text-white">conquer.</span>
            </h1>
            <p className="landing-hero-detail mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Start with a rented room and an old motorcycle. Take on the streets, earn every fare, and build a bike-taxi empire across a living Chennai.
            </p>
            <div className="landing-feature-pills mt-8 flex flex-wrap gap-2">
              {['OPEN-WORLD CITY', 'BUILD YOUR BUSINESS', 'LIVE THE DRIVER LIFE'].map((feature) => (
                <span key={feature} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[9px] font-bold tracking-[0.12em] text-slate-300">
                  {feature}
                </span>
              ))}
            </div>
          </div>

          <section className="landing-panel relative z-10 mx-auto w-full max-w-[430px] rounded-2xl border border-white/[0.13] bg-[#111724]/85 p-5 shadow-[0_28px_90px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-7">
            <div className="landing-panel-heading mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">YOUR NEXT RIDE</div>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">{view === 'main' ? 'Ready when you are.' : view === 'controls' ? 'Take the controls.' : 'Make your own way.'}</h2>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-lg text-amber-200">{view === 'controls' ? '⌨' : view === 'about' ? '↗' : '✦'}</span>
            </div>

            {view === 'main' && (
              <>
                <div className="landing-actions flex flex-col gap-2.5">
                  <button
                    disabled={!hasSave}
                    onClick={() => { startAudio(); if (!cont()) setMsg('Save could not be loaded'); }}
                    className={`${actionClass} border-amber-200/70 bg-gradient-to-r from-amber-300 to-orange-300 font-extrabold text-slate-950 shadow-lg shadow-amber-950/20 hover:brightness-105 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40`}
                  >
                    <span className="flex items-center gap-3"><span className="text-lg">▶</span><span>Continue your journey</span></span>
                    <span className="text-lg">→</span>
                  </button>
                  <button
                    onClick={() => { if (hasSave && !confirm('Start a new game? Your existing save will be overwritten.')) return; startAudio(); newGame(); }}
                    className={`${actionClass} border-white/10 bg-white/[0.055] font-bold text-white hover:border-white/20 hover:bg-white/10`}
                  >
                    <span className="flex items-center gap-3"><span className="text-lg">＋</span><span>Start a new game</span></span>
                    <span className="text-slate-500">→</span>
                  </button>
                  <div className="landing-menu-links grid grid-cols-2 gap-2.5 pt-1">
                    <button onClick={() => setView('controls')} className="min-h-11 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">⌨ &nbsp; Controls</button>
                    <button onClick={() => setView('about')} className="min-h-11 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">ⓘ &nbsp; How to play</button>
                  </div>
                </div>
                <div className="landing-save-status mt-5 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-[10px] leading-5 text-slate-400">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasSave ? 'bg-emerald-300' : 'bg-slate-600'}`} />
                  <span>{hasSave ? `Save ready · ${info.savedAt ? `last played ${new Date(info.savedAt).toLocaleString()}` : 'continue your progress'}` : 'No save yet · start a new journey'}</span>
                </div>
                {msg && <p role="alert" className="mt-2 text-xs text-rose-300">{msg}</p>}
              </>
            )}

            {view === 'controls' && (
              <div className="max-h-[52vh] overflow-y-auto pr-1 text-sm text-slate-300">
                <Controls />
                <button onClick={() => setView('main')} className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">← Back to menu</button>
              </div>
            )}

            {view === 'about' && (
              <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1 text-xs leading-6 text-slate-300">
                <p><b className="text-amber-200">01 / Get on the road</b><br />Open your phone (F), go online in PillionGo, and accept a ride request. Pick up your passenger and get them safely to their destination.</p>
                <p><b className="text-amber-200">02 / Build your future</b><br />Earn fares, look after your needs and bike, then save ₹1,00,000 to start your own company.</p>
                <p><b className="text-amber-200">03 / Grow your fleet</b><br />Register your company, buy bikes, hire riders, and expand across the city. Your progress autosaves.</p>
                <p className="text-slate-400">Fares respond to distance, time, demand, weather, and the hour of the day.</p>
                <button onClick={() => setView('main')} className="mt-1 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">← Back to menu</button>
              </div>
            )}
          </section>
        </section>

        <footer className="landing-footer relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] py-4 text-[9px] font-semibold tracking-[0.13em] text-slate-500">
          <span>THE STREETS ARE YOURS</span>
          <span>RIDE SMART · RISE BIG</span>
        </footer>
      </div>
    </main>
  );
}
