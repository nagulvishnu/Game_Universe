/**
 * SHADOWSTRIKE — High-Detail 2D Weapon Renderer.
 *
 * Renders distinct, multi-layered 2D fantasy weapons for combat and UI showcases:
 * - Proper blades, handles, grips, guards, collars and pommels
 * - Layered materials (darkened base, primary metal, highlights, runic inlays, edge glints)
 * - Distinct silhouettes for all shapes (Katana, Sabre, Greatsword, Dagger, Spear,
 *   Glaive, Scythe, Axe, Hammer, Chain, Energy, Gauntlet, Claws)
 * - Weapon-specific signature features (e.g. Titan Zweihander parrying hooks,
 *   Inferno Greatsword molten fissures, Soulreaper skull socket, Gravebreaker runes).
 */

import type Phaser from 'phaser';
import type { WeaponDef, WeaponShape } from '../../data/weapons';

export interface Point {
  x: number;
  y: number;
}

type G = Phaser.GameObjects.Graphics;

// Color utility functions
export function shadeColor(color: number, k: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * k)));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * k)));
  return (r << 16) | (g << 8) | b;
}

export function blendColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

const pExt = (p: Point, angle: number, dist: number): Point => ({
  x: p.x + Math.cos(angle) * dist,
  y: p.y + Math.sin(angle) * dist,
});

const pOffset = (p: Point, perpAngle: number, offset: number): Point => ({
  x: p.x + Math.cos(perpAngle) * offset,
  y: p.y + Math.sin(perpAngle) * offset,
});

/**
 * Draws a detailed weapon anchored at the hand joint, pointing at `angle`.
 */
export function drawWeaponArt(
  g: G,
  hand: Point,
  angle: number,
  w: WeaponDef,
  s: number,
  alpha: number,
  time = 0,
): void {
  const L = (w.length || 20) * s;
  const dir = angle;
  const perp = dir + Math.PI / 2;

  const tip = pExt(hand, dir, L);

  const baseCol = w.color;
  const glowCol = w.glow;
  const darkSteel = 0x1b1e28;
  const medSteel = 0x3d4354;
  const goldBrass = 0xd4af37;
  const darkWood = 0x3e2c1e;
  const leatherWrap = 0x221a14;

  switch (w.shape as WeaponShape) {
    case 'katana': {
      const isOdachi = w.id === 'eclipse_odachi' || L > 85 * s;
      const hiltLen = (isOdachi ? 26 : 18) * s;
      const bladeLen = L;
      const hiltEnd = pExt(hand, dir + Math.PI, hiltLen);
      const curve = isOdachi ? 0.04 : 0.06;

      // 1. Kashira (Pommel cap)
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(hiltEnd.x, hiltEnd.y, 3.2 * s);
      g.lineStyle(1 * s, 0xffe680, alpha);
      g.strokeCircle(hiltEnd.x, hiltEnd.y, 3.2 * s);

      // 2. Tsuka (Wrapped Hilt)
      g.lineStyle(4.5 * s, leatherWrap, alpha);
      g.beginPath();
      g.moveTo(hiltEnd.x, hiltEnd.y);
      g.lineTo(hand.x, hand.y);
      g.strokePath();

      // Diamond wrap pattern (Ito)
      const wraps = isOdachi ? 6 : 4;
      g.lineStyle(1.8 * s, goldBrass, alpha * 0.85);
      for (let i = 1; i <= wraps; i++) {
        const wp = pExt(hiltEnd, dir, (hiltLen / (wraps + 1)) * i);
        const w1 = pOffset(wp, perp, 2.5 * s);
        const w2 = pOffset(wp, perp, -2.5 * s);
        g.beginPath();
        g.moveTo(w1.x, w1.y);
        g.lineTo(w2.x, w2.y);
        g.strokePath();
      }

      // 3. Fuchi & Tsuba (Guard collar & disc guard)
      const tsubaP = pExt(hand, dir, 2 * s);
      const tsubaA = pOffset(tsubaP, perp, 7.5 * s);
      const tsubaB = pOffset(tsubaP, perp, -7.5 * s);
      g.lineStyle(4 * s, darkSteel, alpha);
      g.beginPath();
      g.moveTo(tsubaA.x, tsubaA.y);
      g.lineTo(tsubaB.x, tsubaB.y);
      g.strokePath();
      g.lineStyle(1.4 * s, goldBrass, alpha);
      g.beginPath();
      g.moveTo(tsubaA.x, tsubaA.y);
      g.lineTo(tsubaB.x, tsubaB.y);
      g.strokePath();

      // 4. Habaki (Blade collar)
      const habakiP = pExt(tsubaP, dir, 4.5 * s);
      g.lineStyle(3.8 * s, goldBrass, alpha);
      g.beginPath();
      g.moveTo(tsubaP.x, tsubaP.y);
      g.lineTo(habakiP.x, habakiP.y);
      g.strokePath();

      // 5. Curved Katana Blade
      const mid = pExt(habakiP, dir - curve, bladeLen * 0.55);
      const bladeTip = pExt(habakiP, dir - curve * 1.5, bladeLen);

      // Spine (Mune) - dark reinforced steel backing
      g.lineStyle(4.2 * s, shadeColor(baseCol, 0.5), alpha);
      g.beginPath();
      g.moveTo(habakiP.x, habakiP.y);
      g.lineTo(mid.x, mid.y);
      g.lineTo(bladeTip.x, bladeTip.y);
      g.strokePath();

      // Blade core body
      g.lineStyle(2.6 * s, baseCol, alpha);
      g.beginPath();
      g.moveTo(habakiP.x, habakiP.y);
      g.lineTo(mid.x, mid.y);
      g.lineTo(bladeTip.x, bladeTip.y);
      g.strokePath();

      // Hamon (Wavy differential temper line)
      g.lineStyle(1.6 * s, glowCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(habakiP.x, habakiP.y);
      g.lineTo(mid.x, mid.y);
      g.lineTo(bladeTip.x, bladeTip.y);
      g.strokePath();

      // Razor cutting edge glint
      g.lineStyle(1.1 * s, 0xffffff, alpha * 0.9);
      const edgeMid = pOffset(mid, perp, -1.2 * s);
      const edgeTip = pOffset(bladeTip, perp, -0.6 * s);
      g.beginPath();
      g.moveTo(habakiP.x, habakiP.y);
      g.lineTo(edgeMid.x, edgeMid.y);
      g.lineTo(edgeTip.x, edgeTip.y);
      g.strokePath();

      // Tip sparkle / kissaki diamond
      g.fillStyle(0xffffff, alpha * 0.9);
      g.fillCircle(bladeTip.x, bladeTip.y, 1.8 * s);
      break;
    }

    case 'sabre': {
      const isCrimson = w.id === 'crimson_edge';
      const hiltLen = 17 * s;
      const hiltEnd = pExt(hand, dir + Math.PI, hiltLen);
      const curve = 0.16;

      // Pommel
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(hiltEnd.x, hiltEnd.y, 3.4 * s);

      // Grip
      g.lineStyle(4 * s, isCrimson ? 0x4a1218 : leatherWrap, alpha);
      g.beginPath();
      g.moveTo(hiltEnd.x, hiltEnd.y);
      g.lineTo(hand.x, hand.y);
      g.strokePath();

      // Swept basket guard / knuckle bow curving around the hand
      const bowMid = pOffset(pExt(hiltEnd, dir, hiltLen * 0.5), perp, 8 * s);
      const guardTop = pOffset(hand, perp, 6.5 * s);
      g.lineStyle(2.2 * s, goldBrass, alpha);
      g.beginPath();
      g.moveTo(hiltEnd.x, hiltEnd.y);
      g.lineTo(bowMid.x, bowMid.y);
      g.lineTo(guardTop.x, guardTop.y);
      g.strokePath();

      // Blade: sweeping curved scimitar blade with belly
      const b0 = hand;
      const bMid = pExt(b0, dir - curve, L * 0.5);
      const bTip = pExt(b0, dir - curve * 1.8, L);

      const bMidOut = pOffset(bMid, perp, -4.5 * s);
      const b0Out = pOffset(b0, perp, -3 * s);

      // Blade silhouette
      g.fillStyle(shadeColor(baseCol, 0.4), alpha);
      g.beginPath();
      g.moveTo(b0.x, b0.y);
      g.lineTo(bMid.x, bMid.y);
      g.lineTo(bTip.x, bTip.y);
      g.lineTo(bMidOut.x, bMidOut.y);
      g.lineTo(b0Out.x, b0Out.y);
      g.closePath();
      g.fillPath();

      // Blade metal fill
      g.fillStyle(baseCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(b0.x, b0.y);
      g.lineTo(bMid.x, bMid.y);
      g.lineTo(bTip.x, bTip.y);
      g.lineTo(pOffset(bMidOut, perp, 1.5 * s).x, pOffset(bMidOut, perp, 1.5 * s).y);
      g.closePath();
      g.fillPath();

      // Fuller / blood groove
      g.lineStyle(1.4 * s, glowCol, alpha * 0.85);
      g.beginPath();
      g.moveTo(pExt(b0, dir, 6 * s).x, pExt(b0, dir, 6 * s).y);
      g.lineTo(pExt(bMid, dir, 2 * s).x, pExt(bMid, dir, 2 * s).y);
      g.strokePath();

      // Razor cutting edge
      g.lineStyle(1.5 * s, 0xffffff, alpha * 0.95);
      g.beginPath();
      g.moveTo(b0Out.x, b0Out.y);
      g.lineTo(bMidOut.x, bMidOut.y);
      g.lineTo(bTip.x, bTip.y);
      g.strokePath();

      // Serrated spine notches if crimson edge
      if (isCrimson) {
        g.fillStyle(0xff2d55, alpha * 0.9);
        for (let i = 2; i <= 5; i++) {
          const sp = pExt(b0, dir - curve * 0.5, L * 0.12 * i);
          const barb = pOffset(sp, perp, 3 * s);
          g.fillTriangle(sp.x, sp.y, barb.x, barb.y, sp.x + 2 * s, sp.y + 2 * s);
        }
      }
      break;
    }

    case 'greatsword': {
      const isInferno = w.id === 'inferno_greatsword';
      const isTitan = w.id === 'titan_zweihander';
      const isObsidian = w.id === 'obsidian_cleaver';

      const hiltLen = 24 * s;
      const hiltEnd = pExt(hand, dir + Math.PI, hiltLen);
      const bladeW = (isTitan ? 11 : isObsidian ? 13 : 9.5) * s;

      // 1. Heavy Counterweight Pommel
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(hiltEnd.x, hiltEnd.y, 4.5 * s);
      g.lineStyle(1.5 * s, 0xffffff, alpha * 0.8);
      g.strokeCircle(hiltEnd.x, hiltEnd.y, 4.5 * s);

      // 2. Long Two-Handed Grip with Leather Wrap
      g.lineStyle(5.5 * s, isInferno ? 0x24140e : leatherWrap, alpha);
      g.beginPath();
      g.moveTo(hiltEnd.x, hiltEnd.y);
      g.lineTo(hand.x, hand.y);
      g.strokePath();

      // Cross-strap binding
      g.lineStyle(1.6 * s, isInferno ? 0xff7a2a : 0x8899aa, alpha * 0.7);
      for (let i = 1; i <= 4; i++) {
        const wp = pExt(hiltEnd, dir, (hiltLen / 5) * i);
        const w1 = pOffset(wp, perp, 3 * s);
        const w2 = pOffset(wp, perp, -3 * s);
        g.beginPath();
        g.moveTo(w1.x, w1.y);
        g.lineTo(w2.x, w2.y);
        g.strokePath();
      }

      // 3. Massive Crossguard
      const guardW = (isTitan ? 19 : 15) * s;
      const gL = pOffset(hand, perp, guardW);
      const gR = pOffset(hand, perp, -guardW);

      g.lineStyle(5 * s, darkSteel, alpha);
      g.beginPath();
      g.moveTo(gL.x, gL.y);
      g.lineTo(gR.x, gR.y);
      g.strokePath();

      g.lineStyle(2 * s, isInferno ? 0xff6a1a : glowCol, alpha * 0.9);
      g.beginPath();
      g.moveTo(gL.x, gL.y);
      g.lineTo(gR.x, gR.y);
      g.strokePath();

      // Guard finial points
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(gL.x, gL.y, 3 * s);
      g.fillCircle(gR.x, gR.y, 3 * s);

      // 4. Parrying hooks (Parierhaken) for Zweihander
      const ricassoEnd = pExt(hand, dir, L * 0.22);
      if (isTitan) {
        const hookL = pOffset(ricassoEnd, perp, 11 * s);
        const hookR = pOffset(ricassoEnd, perp, -11 * s);
        g.lineStyle(3 * s, goldBrass, alpha);
        g.beginPath();
        g.moveTo(ricassoEnd.x, ricassoEnd.y);
        g.lineTo(hookL.x, hookL.y);
        g.strokePath();
        g.beginPath();
        g.moveTo(ricassoEnd.x, ricassoEnd.y);
        g.lineTo(hookR.x, hookR.y);
        g.strokePath();
      }

      // 5. Broad Colossal Blade Body
      const bBaseL = pOffset(hand, perp, bladeW * 0.5);
      const bBaseR = pOffset(hand, perp, -bladeW * 0.5);

      const bTipL = pOffset(pExt(hand, dir, L * 0.9), perp, bladeW * 0.38);
      const bTipR = pOffset(pExt(hand, dir, L * 0.9), perp, -bladeW * 0.38);

      // Blade Silhouette - Dark steel underlayer
      g.fillStyle(shadeColor(baseCol, 0.35), alpha);
      g.beginPath();
      g.moveTo(bBaseL.x, bBaseL.y);
      g.lineTo(bTipL.x, bTipL.y);
      g.lineTo(tip.x, tip.y);
      g.lineTo(bTipR.x, bTipR.y);
      g.lineTo(bBaseR.x, bBaseR.y);
      g.closePath();
      g.fillPath();

      // Faceted Blade Bevels (left and right bevels)
      g.fillStyle(baseCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(bBaseL.x, bBaseL.y);
      g.lineTo(bTipL.x, bTipL.y);
      g.lineTo(tip.x, tip.y);
      g.lineTo(hand.x, hand.y);
      g.closePath();
      g.fillPath();

      g.fillStyle(shadeColor(baseCol, 0.75), alpha * 0.95);
      g.beginPath();
      g.moveTo(bBaseR.x, bBaseR.y);
      g.lineTo(bTipR.x, bTipR.y);
      g.lineTo(tip.x, tip.y);
      g.lineTo(hand.x, hand.y);
      g.closePath();
      g.fillPath();

      // Center Fuller Groove / Lava Fissure / Runic Inlay
      if (isInferno) {
        // Glowing molten lava crack running along blade spine
        g.lineStyle(2.8 * s, 0xff4a00, alpha);
        g.beginPath();
        g.moveTo(hand.x, hand.y);
        g.lineTo(tip.x, tip.y);
        g.strokePath();
        g.lineStyle(1.4 * s, 0xffe066, alpha);
        g.beginPath();
        g.moveTo(hand.x, hand.y);
        g.lineTo(pExt(hand, dir, L * 0.85).x, pExt(hand, dir, L * 0.85).y);
        g.strokePath();
      } else if (isObsidian) {
        // Obsidian glyphs
        g.lineStyle(2.2 * s, glowCol, alpha * 0.9);
        g.beginPath();
        g.moveTo(pExt(hand, dir, L * 0.1).x, pExt(hand, dir, L * 0.1).y);
        g.lineTo(pExt(hand, dir, L * 0.8).x, pExt(hand, dir, L * 0.8).y);
        g.strokePath();
      } else {
        // Double fuller
        g.lineStyle(1.6 * s, glowCol, alpha * 0.7);
        g.beginPath();
        g.moveTo(pExt(hand, dir, 6 * s).x, pExt(hand, dir, 6 * s).y);
        g.lineTo(pExt(hand, dir, L * 0.8).x, pExt(hand, dir, L * 0.8).y);
        g.strokePath();
      }

      // Razor Edge Highlights
      g.lineStyle(1.6 * s, 0xffffff, alpha * 0.9);
      g.beginPath();
      g.moveTo(bBaseL.x, bBaseL.y);
      g.lineTo(bTipL.x, bTipL.y);
      g.lineTo(tip.x, tip.y);
      g.lineTo(bTipR.x, bTipR.y);
      g.lineTo(bBaseR.x, bBaseR.y);
      g.strokePath();
      break;
    }

    case 'dagger': {
      const isVenom = w.id === 'venom_kris';
      const isMirror = w.id === 'mirror_shivs';
      const hiltLen = 12 * s;
      const hiltEnd = pExt(hand, dir + Math.PI, hiltLen);
      const bladeW = 5.5 * s;

      // Pommel: Ring pommel or faceted counterweight
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(hiltEnd.x, hiltEnd.y, 3 * s);
      g.fillStyle(0x0a0a14, alpha);
      g.fillCircle(hiltEnd.x, hiltEnd.y, 1.4 * s);

      // Grip
      g.lineStyle(3.6 * s, leatherWrap, alpha);
      g.beginPath();
      g.moveTo(hiltEnd.x, hiltEnd.y);
      g.lineTo(hand.x, hand.y);
      g.strokePath();

      // Guard
      const g1 = pOffset(hand, perp, 5.5 * s);
      const g2 = pOffset(hand, perp, -5.5 * s);
      g.lineStyle(2.5 * s, darkSteel, alpha);
      g.beginPath();
      g.moveTo(g1.x, g1.y);
      g.lineTo(g2.x, g2.y);
      g.strokePath();

      if (isVenom) {
        // Undulating wavy Kris blade
        const segments = 4;
        let cur = hand;
        g.lineStyle(3.5 * s, baseCol, alpha);
        g.beginPath();
        g.moveTo(cur.x, cur.y);
        for (let i = 1; i <= segments; i++) {
          const tP = pExt(hand, dir, (L / segments) * i);
          const side = i % 2 === 0 ? 3 * s : -3 * s;
          const waveP = pOffset(tP, perp, side);
          const pt = i === segments ? tip : waveP;
          g.lineTo(pt.x, pt.y);
        }
        g.strokePath();

        // Venom luminescence
        g.lineStyle(1.8 * s, glowCol, alpha * 0.9);
        g.beginPath();
        g.moveTo(hand.x, hand.y);
        g.lineTo(tip.x, tip.y);
        g.strokePath();
      } else {
        // Sharp faceted stiletto
        const bL = pOffset(hand, perp, bladeW * 0.5);
        const bR = pOffset(hand, perp, -bladeW * 0.5);

        g.fillStyle(baseCol, alpha * 0.95);
        g.beginPath();
        g.moveTo(bL.x, bL.y);
        g.lineTo(tip.x, tip.y);
        g.lineTo(bR.x, bR.y);
        g.closePath();
        g.fillPath();

        // Central ridge highlight
        g.lineStyle(1.4 * s, isMirror ? 0xffffff : glowCol, alpha * 0.95);
        g.beginPath();
        g.moveTo(hand.x, hand.y);
        g.lineTo(tip.x, tip.y);
        g.strokePath();

        // Outer razor edges
        g.lineStyle(1.2 * s, 0xffffff, alpha * 0.9);
        g.beginPath();
        g.moveTo(bL.x, bL.y);
        g.lineTo(tip.x, tip.y);
        g.lineTo(bR.x, bR.y);
        g.strokePath();
      }
      break;
    }

    case 'spear': {
      const isSolar = w.id === 'solar_lance';
      const shaftBack = pExt(hand, dir + Math.PI, L * 0.32);

      // Shaft (Ash or dark metal)
      g.lineStyle(4 * s, isSolar ? 0x6e481f : darkWood, alpha);
      g.beginPath();
      g.moveTo(shaftBack.x, shaftBack.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      // Butt-spike (ferrule)
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(shaftBack.x, shaftBack.y, 3 * s);

      // Shaft bindings
      g.lineStyle(1.6 * s, goldBrass, alpha * 0.85);
      for (let i = 1; i <= 3; i++) {
        const bp = pExt(shaftBack, dir, L * 0.18 * i);
        const b1 = pOffset(bp, perp, 2.5 * s);
        const b2 = pOffset(bp, perp, -2.5 * s);
        g.beginPath();
        g.moveTo(b1.x, b1.y);
        g.lineTo(b2.x, b2.y);
        g.strokePath();
      }

      // Spearhead socket collar
      const headBase = pExt(hand, dir, L * 0.76);
      g.lineStyle(5 * s, darkSteel, alpha);
      g.beginPath();
      g.moveTo(headBase.x, headBase.y);
      g.lineTo(pExt(headBase, dir, 6 * s).x, pExt(headBase, dir, 6 * s).y);
      g.strokePath();

      // Silk tassel / ribbons at socket
      const t1 = pOffset(headBase, perp, 7 * s);
      const t2 = pOffset(pExt(headBase, dir + Math.PI, 8 * s), perp, 11 * s);
      g.lineStyle(2.4 * s, glowCol, alpha * 0.85);
      g.beginPath();
      g.moveTo(headBase.x, headBase.y);
      g.lineTo(t1.x, t1.y);
      g.lineTo(t2.x, t2.y);
      g.strokePath();

      // Leaf-shaped spearhead blade
      const headWid = 7 * s;
      const hL = pOffset(pExt(headBase, dir, 7 * s), perp, headWid);
      const hR = pOffset(pExt(headBase, dir, 7 * s), perp, -headWid);

      g.fillStyle(shadeColor(baseCol, 0.4), alpha);
      g.beginPath();
      g.moveTo(headBase.x, headBase.y);
      g.lineTo(hL.x, hL.y);
      g.lineTo(tip.x, tip.y);
      g.lineTo(hR.x, hR.y);
      g.closePath();
      g.fillPath();

      g.fillStyle(baseCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(headBase.x, headBase.y);
      g.lineTo(hL.x, hL.y);
      g.lineTo(tip.x, tip.y);
      g.closePath();
      g.fillPath();

      // Central spine rib & edge highlight
      g.lineStyle(1.8 * s, isSolar ? 0xffea70 : 0xffffff, alpha * 0.95);
      g.beginPath();
      g.moveTo(headBase.x, headBase.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      if (isSolar) {
        // Orbiting solar ring
        g.lineStyle(1.8 * s, 0xffd000, alpha * 0.7);
        g.strokeCircle(tip.x, tip.y, 9 * s);
      }
      break;
    }

    case 'glaive': {
      const isDragon = w.id === 'dragon_glaive';
      const shaftBack = pExt(hand, dir + Math.PI, L * 0.35);

      // Reinforced Shaft
      g.lineStyle(4.5 * s, darkWood, alpha);
      g.beginPath();
      g.moveTo(shaftBack.x, shaftBack.y);
      g.lineTo(pExt(hand, dir, L * 0.65).x, pExt(hand, dir, L * 0.65).y);
      g.strokePath();

      // Butt spike
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(shaftBack.x, shaftBack.y, 3.2 * s);

      // Ferrule / collar
      const bladeBase = pExt(hand, dir, L * 0.62);
      g.lineStyle(5.5 * s, isDragon ? 0xc77826 : darkSteel, alpha);
      g.beginPath();
      g.moveTo(bladeBase.x, bladeBase.y);
      g.lineTo(pExt(bladeBase, dir, 8 * s).x, pExt(bladeBase, dir, 8 * s).y);
      g.strokePath();

      // Sweeping Naginata / Glaive blade
      const bCurve = 0.12;
      const bMid = pExt(bladeBase, dir - bCurve, L * 0.22);
      const bTip = pExt(bladeBase, dir - bCurve * 1.8, L * 0.42);

      const bMidBelly = pOffset(bMid, perp, -7 * s);
      const bBaseBelly = pOffset(bladeBase, perp, -4.5 * s);

      g.fillStyle(shadeColor(baseCol, 0.4), alpha);
      g.beginPath();
      g.moveTo(bladeBase.x, bladeBase.y);
      g.lineTo(bMid.x, bMid.y);
      g.lineTo(bTip.x, bTip.y);
      g.lineTo(bMidBelly.x, bMidBelly.y);
      g.lineTo(bBaseBelly.x, bBaseBelly.y);
      g.closePath();
      g.fillPath();

      g.fillStyle(baseCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(bladeBase.x, bladeBase.y);
      g.lineTo(bMid.x, bMid.y);
      g.lineTo(bTip.x, bTip.y);
      g.closePath();
      g.fillPath();

      // Razor cutting edge
      g.lineStyle(1.8 * s, 0xffffff, alpha * 0.9);
      g.beginPath();
      g.moveTo(bBaseBelly.x, bBaseBelly.y);
      g.lineTo(bMidBelly.x, bMidBelly.y);
      g.lineTo(bTip.x, bTip.y);
      g.strokePath();

      // Dragon spine hook if dragon glaive
      if (isDragon) {
        const spineHook = pOffset(bMid, perp, 5 * s);
        g.fillStyle(goldBrass, alpha);
        g.fillTriangle(bMid.x, bMid.y, spineHook.x, spineHook.y, bladeBase.x, bladeBase.y);
      }
      break;
    }

    case 'scythe': {
      const isSoul = w.id === 'soulreaper';
      const shaftBack = pExt(hand, dir + Math.PI, L * 0.38);

      // Curved Snath / Shaft
      const shaftMid = pOffset(pExt(hand, dir, L * 0.3), perp, 4 * s);
      g.lineStyle(4.5 * s, isSoul ? 0x1d1724 : darkWood, alpha);
      g.beginPath();
      g.moveTo(shaftBack.x, shaftBack.y);
      g.lineTo(shaftMid.x, shaftMid.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      // Scythe head mounting socket (Gothic skull / reinforced bracket)
      g.fillStyle(isSoul ? 0xe6e0d8 : darkSteel, alpha);
      g.fillCircle(tip.x, tip.y, 5 * s);
      g.lineStyle(1.5 * s, goldBrass, alpha);
      g.strokeCircle(tip.x, tip.y, 5 * s);

      // Huge wicked reaping crescent blade
      const scytheCurve = 0.65;
      const bladeLen = L * 0.52;
      const sMid = pOffset(pExt(tip, dir - scytheCurve, bladeLen * 0.5), perp, 16 * s);
      const sTip = pOffset(pExt(tip, dir - scytheCurve * 1.3, bladeLen), perp, 28 * s);

      const sInner = pOffset(pExt(tip, dir - scytheCurve * 0.6, bladeLen * 0.45), perp, 10 * s);

      // Reaping blade silhouette
      g.fillStyle(shadeColor(baseCol, 0.35), alpha);
      g.beginPath();
      g.moveTo(tip.x, tip.y);
      const spineMid = pOffset(pExt(tip, dir - scytheCurve, bladeLen * 0.5), perp, 20 * s);
      g.lineTo(spineMid.x, spineMid.y);
      g.lineTo(sTip.x, sTip.y);
      g.lineTo(sInner.x, sInner.y);
      g.closePath();
      g.fillPath();

      // Blade inner face
      g.fillStyle(baseCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(tip.x, tip.y);
      g.lineTo(sMid.x, sMid.y);
      g.lineTo(sTip.x, sTip.y);
      g.lineTo(sInner.x, sInner.y);
      g.closePath();
      g.fillPath();

      // Wicked razor inner cutting edge
      g.lineStyle(2 * s, glowCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(tip.x, tip.y);
      g.lineTo(sInner.x, sInner.y);
      g.lineTo(sTip.x, sTip.y);
      g.strokePath();

      // Reverse spine spike
      const revSpike = pOffset(tip, perp, -8 * s);
      g.fillStyle(darkSteel, alpha);
      g.fillTriangle(tip.x, tip.y, revSpike.x, revSpike.y, pExt(tip, dir + Math.PI, 8 * s).x, pExt(tip, dir + Math.PI, 8 * s).y);
      break;
    }

    case 'axe': {
      const shaftBack = pExt(hand, dir + Math.PI, L * 0.28);

      // Haft
      g.lineStyle(4.5 * s, darkWood, alpha);
      g.beginPath();
      g.moveTo(shaftBack.x, shaftBack.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      // Butt cap
      g.fillStyle(goldBrass, alpha);
      g.fillCircle(shaftBack.x, shaftBack.y, 3 * s);

      // Heavy Bearded Axe Head
      const headBase = pExt(hand, dir, L * 0.68);
      const bitTop = pOffset(tip, perp, 13 * s);
      const bitEdge = pOffset(pExt(tip, dir, 2 * s), perp, 18 * s);
      const bitBeard = pOffset(headBase, perp, 16 * s);
      const rearSpike = pOffset(tip, perp, -8 * s);

      // Axe head body
      g.fillStyle(shadeColor(baseCol, 0.4), alpha);
      g.beginPath();
      g.moveTo(headBase.x, headBase.y);
      g.lineTo(bitBeard.x, bitBeard.y);
      g.lineTo(bitEdge.x, bitEdge.y);
      g.lineTo(bitTop.x, bitTop.y);
      g.lineTo(tip.x, tip.y);
      g.lineTo(rearSpike.x, rearSpike.y);
      g.closePath();
      g.fillPath();

      // Bevel & temper line
      g.fillStyle(baseCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(headBase.x, headBase.y);
      g.lineTo(pOffset(headBase, perp, 8 * s).x, pOffset(headBase, perp, 8 * s).y);
      g.lineTo(bitEdge.x, bitEdge.y);
      g.lineTo(pOffset(tip, perp, 7 * s).x, pOffset(tip, perp, 7 * s).y);
      g.lineTo(tip.x, tip.y);
      g.closePath();
      g.fillPath();

      // Sharp cutting edge
      g.lineStyle(1.8 * s, glowCol, alpha * 0.9);
      g.beginPath();
      g.moveTo(bitTop.x, bitTop.y);
      g.lineTo(bitEdge.x, bitEdge.y);
      g.lineTo(bitBeard.x, bitBeard.y);
      g.strokePath();

      g.lineStyle(1.2 * s, 0xffffff, alpha * 0.9);
      g.beginPath();
      g.moveTo(bitTop.x, bitTop.y);
      g.lineTo(bitEdge.x, bitEdge.y);
      g.lineTo(bitBeard.x, bitBeard.y);
      g.strokePath();
      break;
    }

    case 'hammer': {
      const isGrave = w.id === 'gravebreaker_maul';
      const shaftBack = pExt(hand, dir + Math.PI, L * 0.28);

      // Haft with metal langets (straps)
      g.lineStyle(5 * s, darkWood, alpha);
      g.beginPath();
      g.moveTo(shaftBack.x, shaftBack.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      // Metal straps along shaft
      g.lineStyle(1.8 * s, darkSteel, alpha);
      g.beginPath();
      g.moveTo(pExt(hand, dir, L * 0.3).x, pExt(hand, dir, L * 0.3).y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      // Massive block hammer head
      const hBase = pExt(hand, dir, L * 0.72);
      const hW = (isGrave ? 26 : 22) * s;
      const hH = (isGrave ? 30 : 24) * s;

      const pFront = pOffset(hBase, perp, hW * 0.5);
      const pBack = pOffset(hBase, perp, -hW * 0.5);

      // Heavy head block
      g.fillStyle(shadeColor(baseCol, 0.4), alpha);
      g.fillRect(hBase.x - 10 * s, hBase.y - 12 * s, 20 * s, 24 * s);

      g.fillStyle(baseCol, alpha * 0.95);
      g.fillRoundedRect(hBase.x - 9 * s, hBase.y - 11 * s, 18 * s, 22 * s, 3 * s);

      // Border banding & reinforced plates
      g.lineStyle(2 * s, goldBrass, alpha * 0.9);
      g.strokeRoundedRect(hBase.x - 9 * s, hBase.y - 11 * s, 18 * s, 22 * s, 3 * s);

      // Armor piercing rear beak spike
      const beak = pOffset(hBase, perp, -16 * s);
      g.fillStyle(darkSteel, alpha);
      g.fillTriangle(hBase.x, hBase.y - 7 * s, beak.x, beak.y, hBase.x, hBase.y + 7 * s);

      // Runic inscription / glowing face
      g.lineStyle(1.6 * s, glowCol, alpha * 0.9);
      g.beginPath();
      g.moveTo(hBase.x - 5 * s, hBase.y);
      g.lineTo(hBase.x + 5 * s, hBase.y);
      g.strokePath();
      break;
    }

    case 'chain': {
      const isHellfire = w.id === 'hellfire_flail';

      // 1. Grip / Baton
      const hiltLen = 14 * s;
      const hiltEnd = pExt(hand, dir + Math.PI, hiltLen);
      g.lineStyle(4.5 * s, leatherWrap, alpha);
      g.beginPath();
      g.moveTo(hiltEnd.x, hiltEnd.y);
      g.lineTo(hand.x, hand.y);
      g.strokePath();

      g.fillStyle(goldBrass, alpha);
      g.fillCircle(hiltEnd.x, hiltEnd.y, 3 * s);

      // 2. Dynamic interlinked chain links
      const numLinks = 8;
      let prev = hand;
      for (let i = 1; i <= numLinks; i++) {
        const t = i / numLinks;
        const wave = Math.sin(t * Math.PI + time * 6) * 12 * s;
        const pnt = pExt(hand, dir, L * t);
        const cur = pOffset(pnt, perp, wave);

        // Chain link ring
        g.lineStyle(2.4 * s, i % 2 === 0 ? 0x9aa4b8 : 0x4a4d5e, alpha * 0.95);
        g.beginPath();
        g.moveTo(prev.x, prev.y);
        g.lineTo(cur.x, cur.y);
        g.strokePath();

        g.fillStyle(0x0a0a12, alpha * 0.5);
        g.fillCircle(cur.x, cur.y, 2.2 * s);
        prev = cur;
      }

      // 3. Spiked Flail / Sickle Head
      if (isHellfire) {
        // Burning spiked morningstar sphere
        g.fillStyle(0xff3a00, alpha * 0.95);
        g.fillCircle(tip.x, tip.y, 8 * s);
        g.fillStyle(0xffe066, alpha * 0.9);
        g.fillCircle(tip.x, tip.y, 4.5 * s);

        // Spikes radiating
        g.lineStyle(2 * s, 0x1f1610, alpha);
        for (let a = 0; a < 6; a++) {
          const spAng = (a * Math.PI) / 3;
          const s1 = pExt(tip, spAng, 7 * s);
          const s2 = pExt(tip, spAng, 12 * s);
          g.beginPath();
          g.moveTo(s1.x, s1.y);
          g.lineTo(s2.x, s2.y);
          g.strokePath();
        }
      } else {
        // Weighted sickle dart / meteor kunai
        g.fillStyle(baseCol, alpha * 0.95);
        g.fillTriangle(tip.x, tip.y, tip.x - 7 * s, tip.y - 6 * s, tip.x - 7 * s, tip.y + 6 * s);
        g.lineStyle(1.6 * s, glowCol, alpha * 0.9);
        g.strokeTriangle(tip.x, tip.y, tip.x - 7 * s, tip.y - 6 * s, tip.x - 7 * s, tip.y + 6 * s);
      }
      break;
    }

    case 'energy': {
      // High-tech emitter hilt with side projector fins
      const hiltLen = 14 * s;
      const hiltEnd = pExt(hand, dir + Math.PI, hiltLen);

      g.lineStyle(5.5 * s, darkSteel, alpha);
      g.beginPath();
      g.moveTo(hiltEnd.x, hiltEnd.y);
      g.lineTo(hand.x, hand.y);
      g.strokePath();

      // Energy power cell rings
      g.lineStyle(2 * s, glowCol, alpha * 0.95);
      g.beginPath();
      g.moveTo(pExt(hiltEnd, dir, 4 * s).x, pExt(hiltEnd, dir, 4 * s).y);
      g.lineTo(pExt(hiltEnd, dir, 10 * s).x, pExt(hiltEnd, dir, 10 * s).y);
      g.strokePath();

      // Projector collar / emitter fins
      const f1 = pOffset(hand, perp, 6 * s);
      const f2 = pOffset(hand, perp, -6 * s);
      g.lineStyle(3 * s, goldBrass, alpha);
      g.beginPath();
      g.moveTo(f1.x, f1.y);
      g.lineTo(f2.x, f2.y);
      g.strokePath();

      // Outer plasma containment aura
      g.lineStyle(10 * s, glowCol, alpha * 0.25);
      g.beginPath();
      g.moveTo(hand.x, hand.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      // Radiant energy blade beam
      g.lineStyle(5 * s, baseCol, alpha * 0.85);
      g.beginPath();
      g.moveTo(hand.x, hand.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();

      // Pure white hot core
      g.lineStyle(2 * s, 0xffffff, alpha * 0.95);
      g.beginPath();
      g.moveTo(hand.x, hand.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();
      break;
    }

    case 'gauntlet': {
      // Armored vambrace & reinforced knuckle block
      const cuff = pExt(hand, dir + Math.PI, 10 * s);
      g.fillStyle(shadeColor(baseCol, 0.4), alpha);
      g.fillRoundedRect(cuff.x - 6 * s, cuff.y - 7 * s, 14 * s, 14 * s, 3 * s);

      // Knuckle strike plate
      g.fillStyle(baseCol, alpha * 0.95);
      g.fillRoundedRect(hand.x - 6 * s, hand.y - 6 * s, 13 * s, 12 * s, 2 * s);

      // Conduit tubes with electric glow
      g.lineStyle(2 * s, glowCol, alpha * 0.95);
      g.strokeRoundedRect(hand.x - 6 * s, hand.y - 6 * s, 13 * s, 12 * s, 2 * s);

      // Knuckle studs
      g.fillStyle(0xffffff, alpha * 0.9);
      for (let k = -1; k <= 1; k++) {
        g.fillCircle(hand.x + 4 * s, hand.y + k * 4 * s, 1.6 * s);
      }
      break;
    }

    case 'claws': {
      const isFan = w.id === 'tempest_fans';

      if (isFan) {
        // War-Fan (Tessen) open fan ribs
        const fanSpan = 0.85;
        const fanLen = L;
        const ribs = 5;

        // Fan parchment / membrane
        g.fillStyle(shadeColor(baseCol, 0.5), alpha * 0.7);
        g.beginPath();
        g.moveTo(hand.x, hand.y);
        for (let i = 0; i < ribs; i++) {
          const a = dir - fanSpan * 0.5 + (fanSpan / (ribs - 1)) * i;
          const pt = pExt(hand, a, fanLen);
          g.lineTo(pt.x, pt.y);
        }
        g.closePath();
        g.fillPath();

        // Steel ribs & crescent razor blades
        g.lineStyle(1.8 * s, glowCol, alpha * 0.9);
        for (let i = 0; i < ribs; i++) {
          const a = dir - fanSpan * 0.5 + (fanSpan / (ribs - 1)) * i;
          const pt = pExt(hand, a, fanLen);
          g.beginPath();
          g.moveTo(hand.x, hand.y);
          g.lineTo(pt.x, pt.y);
          g.strokePath();

          // Outer tip crescent
          g.fillStyle(0xffffff, alpha * 0.9);
          g.fillCircle(pt.x, pt.y, 2 * s);
        }
      } else {
        // Razor curved talons
        const cuff = pExt(hand, dir + Math.PI, 6 * s);
        g.fillStyle(darkSteel, alpha);
        g.fillCircle(cuff.x, cuff.y, 4 * s);

        for (let i = -1; i <= 1; i++) {
          const clawAngle = dir + i * 0.28;
          const talonMid = pExt(hand, clawAngle - 0.08, L * 0.55);
          const talonTip = pExt(hand, clawAngle - 0.22, L);

          g.lineStyle(3.2 * s, baseCol, alpha * 0.95);
          g.beginPath();
          g.moveTo(hand.x, hand.y);
          g.lineTo(talonMid.x, talonMid.y);
          g.lineTo(talonTip.x, talonTip.y);
          g.strokePath();

          // Gleaming talon edge
          g.lineStyle(1.4 * s, glowCol, alpha * 0.95);
          g.beginPath();
          g.moveTo(hand.x, hand.y);
          g.lineTo(talonMid.x, talonMid.y);
          g.lineTo(talonTip.x, talonTip.y);
          g.strokePath();
        }
      }
      break;
    }

    case 'none':
    default: {
      // Spiked knuckle wrap for Iron Fists
      g.fillStyle(0x282a35, alpha * 0.9);
      g.fillRoundedRect(hand.x - 4 * s, hand.y - 4 * s, 9 * s, 8 * s, 2 * s);
      g.lineStyle(1.2 * s, glowCol, alpha * 0.85);
      g.strokeRoundedRect(hand.x - 4 * s, hand.y - 4 * s, 9 * s, 8 * s, 2 * s);
      break;
    }
  }
}
