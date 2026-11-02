import { useEffect, useMemo, useRef } from "react";
import { blockCenter, districtAt, DISTRICTS, roadCenter, type BlipKind, type HudState } from "../game/data";

const WORLD = 500;
const HALF = WORLD / 2;

const BLIP_STYLE: Record<BlipKind, { color: string; size: number }> = {
  mission: { color: "#c8ff3d", size: 5.5 },
  enemy: { color: "#ff3d4d", size: 3 },
  police: { color: "#3d9bff", size: 3 },
  vehicle: { color: "#8d9aa3", size: 1.6 },
  pickup: { color: "#42ffab", size: 2 },
  player: { color: "#ffffff", size: 4 },
  garage: { color: "#ffb03d", size: 3.6 },
  hospital: { color: "#2ad9ff", size: 3.6 },
};

function rgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function Minimap({ hud, size = 196, full = false }: { hud: HudState | null; size?: number; full?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const blockMap = useMemo(() => {
    const list: { x: number; z: number; district: string; color: string }[] = [];
    for (let bx = 0; bx < 9; bx++) {
      for (let bz = 0; bz < 9; bz++) {
        const x = blockCenter(bx);
        const z = blockCenter(bz);
        const id = districtAt(x, z);
        const d = DISTRICTS.find((e) => e.id === id)!;
        list.push({ x, z, district: id, color: d.color });
      }
    }
    return list;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = size;
    const scale = s / WORLD;
    const X = (x: number) => (x + HALF) * scale;
    const Y = (z: number) => (z + HALF) * scale;

    ctx.clearRect(0, 0, s, s);
    // water
    ctx.fillStyle = "#061720";
    ctx.fillRect(0, 0, s, s);
    // city island
    ctx.fillStyle = "#141a1e";
    const pad = 3 * scale;
    ctx.fillRect(X(-247) - 0, Y(-247) - 0, 494 * scale, 494 * scale);
    void pad;

    // blocks
    for (const b of blockMap) {
      const w = 38 * scale;
      ctx.fillStyle = rgba(b.color, full ? 0.28 : 0.2);
      ctx.fillRect(X(b.x) - w / 2, Y(b.z) - w / 2, w, w);
      ctx.strokeStyle = rgba("#ffffff", 0.025);
      ctx.lineWidth = 1;
      ctx.strokeRect(X(b.x) - w / 2, Y(b.z) - w / 2, w, w);
    }

    // road network
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = Math.max(2, 13 * scale);
    for (let k = 0; k < 10; k++) {
      const c = roadCenter(k);
      ctx.beginPath();
      ctx.moveTo(X(-234), Y(c));
      ctx.lineTo(X(234), Y(c));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X(c), Y(-234));
      ctx.lineTo(X(c), Y(234));
      ctx.stroke();
    }

    // district ring markers
    for (const d of DISTRICTS) {
      ctx.beginPath();
      ctx.arc(X(d.center[0]), Y(d.center[1]), (full ? 9 : 5) * scale * 18, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(d.color, 0.22);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // district labels
    if (full) {
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "center";
      for (const d of DISTRICTS) {
        ctx.fillStyle = rgba(d.color, 0.9);
        ctx.fillText(d.short.toUpperCase(), X(d.center[0]), Y(d.center[1]) - 14);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.fillText(`DANGER ${d.danger}/5`, X(d.center[0]), Y(d.center[1]) + 2);
        ctx.font = "600 11px Inter, sans-serif";
      }
    }

    if (hud) {
      // route line
      const mission = hud.blips.find((b) => b.kind === "mission");
      if (mission) {
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(X(hud.x), Y(hud.z));
        ctx.lineTo(X(mission.x), Y(mission.z));
        ctx.strokeStyle = "rgba(200,255,61,0.55)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // blips
      for (const b of hud.blips) {
        if (b.kind === "player") continue;
        const style = BLIP_STYLE[b.kind] ?? BLIP_STYLE.vehicle;
        const px = X(b.x);
        const py = Y(b.z);
        if (b.kind === "mission") {
          const pulse = 1 + Math.sin(Date.now() / 320) * 0.25;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = style.color;
          ctx.shadowColor = style.color;
          ctx.shadowBlur = 10;
          ctx.fillRect((-style.size * pulse) / 2, (-style.size * pulse) / 2, style.size * pulse, style.size * pulse);
          ctx.restore();
          continue;
        }
        if (b.kind === "garage" || b.kind === "hospital") {
          ctx.fillStyle = style.color;
          ctx.fillRect(px - style.size / 2, py - style.size / 2, style.size, style.size);
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(px - style.size / 2, py - style.size / 2, style.size, style.size);
          continue;
        }
        ctx.beginPath();
        ctx.arc(px, py, style.size, 0, Math.PI * 2);
        ctx.fillStyle = style.color;
        ctx.fill();
        if (b.kind === "enemy" || b.kind === "police") {
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // player arrow
      const px = X(hud.x);
      const py = Y(hud.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - hud.heading);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // north marker
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("N", s - 12, 16);

    // vignette
    const grad = ctx.createRadialGradient(s / 2, s / 2, s * 0.25, s / 2, s / 2, s * 0.72);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  }, [hud, size, full, blockMap]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%" }}
      className={full ? "block" : "block rounded-full"}
      aria-label="City minimap"
    />
  );
}
