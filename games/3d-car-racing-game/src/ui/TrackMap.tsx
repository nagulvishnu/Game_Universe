import { useEffect, useRef } from "react";
import type { TrackDef } from "../game/data";
import { buildTrackData } from "../game/trackMath";

const cache = new Map<string, { x: number; z: number }[]>();

export function trackOutline(def: TrackDef) {
  let o = cache.get(def.id);
  if (!o) {
    const t = buildTrackData(def);
    o = [];
    for (let i = 0; i < t.n; i += 4) o.push({ x: t.pts[i].x, z: t.pts[i].z });
    cache.set(def.id, o);
  }
  return o;
}

export function trackLengthKm(def: TrackDef) {
  return buildTrackData(def).length / 1000;
}

export default function TrackMap({ def, color = "#22d3ee", size = 160 }: { def: TrackDef; color?: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const pts = trackOutline(def);
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    pts.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
    const W = c.width;
    const pad = 18;
    const sc = Math.min((W - pad * 2) / (maxX - minX), (W - pad * 2) / (maxZ - minZ));
    const ox = W / 2 - ((minX + maxX) / 2) * sc;
    const oy = W / 2 - ((minZ + maxZ) / 2) * sc;
    g.clearRect(0, 0, W, W);
    g.lineJoin = "round";
    g.lineCap = "round";
    const path = () => {
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.x * sc + ox, p.z * sc + oy) : g.moveTo(p.x * sc + ox, p.z * sc + oy)));
      g.closePath();
    };
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = 12;
    path();
    g.stroke();
    g.shadowColor = color;
    g.shadowBlur = 12;
    g.strokeStyle = color;
    g.lineWidth = 5;
    path();
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(pts[0].x * sc + ox, pts[0].z * sc + oy, 5, 0, Math.PI * 2);
    g.fill();
  }, [def, color]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} />;
}
