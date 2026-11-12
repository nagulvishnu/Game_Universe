import { useEffect, useRef, type ReactNode } from "react";
import { audio } from "../game/audio";
import { Showcase, type ShowPose } from "../game/showcase";
import { FIGHTERS } from "../game/data";

export function Btn({ children, onClick, small, on, sound = "ui_select" }: { children: ReactNode; onClick: () => void; small?: boolean; on?: boolean; sound?: string }) {
  return (
    <button className={`btn ${small ? "btn-sm" : ""} ${on ? "on" : ""}`} onMouseEnter={() => audio.play("ui_move", 0.6)} onClick={() => { audio.play(sound); onClick(); }}>
      {children}
    </button>
  );
}

export function ShowCanvas({ chars, pose = "idle", forms = false, camZ, camY, lookY, fov, spacing, yaw, orbit = true, className = "" }: {
  chars: number[]; pose?: ShowPose; forms?: boolean; camZ?: number; camY?: number; lookY?: number; fov?: number; spacing?: number; yaw?: number[]; orbit?: boolean; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sc = useRef<Showcase | null>(null);
  const key = chars.join(",") + (forms ? "f" : "");
  useEffect(() => {
    const s = new Showcase(ref.current!, { chars, pose, forms, camZ, camY, lookY, fov, spacing, yaw, orbit });
    sc.current = s;
    return () => { s.dispose(); sc.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!sc.current) return;
    sc.current.opts.forms = forms;
    sc.current.setChars(chars);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { sc.current?.setPose(pose); }, [pose]);
  return <canvas ref={ref} className={`block w-full h-full ${className}`} style={{ touchAction: "none" }} />;
}

export function StatBar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold tracking-widest">
      <span className="w-24 text-white/70 uppercase">{label}</span>
      <div className="h-2 flex-1 bg-white/10 skew-x-[-20deg]"><div className="h-full transition-all duration-500" style={{ width: `${v * 10}%`, background: color, boxShadow: `0 0 10px ${color}` }} /></div>
    </div>
  );
}

export const elIcon: Record<string, string> = { fire: "🔥", lightning: "⚡", dark: "🌀", ice: "❄️" };
export const fighterColor = (i: number) => FIGHTERS[i].color;
