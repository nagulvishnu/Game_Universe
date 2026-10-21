/**
 * SHADOWSTRIKE — Stylized 2D Shadow Warrior Character Renderer.
 *
 * Replaces basic stick figures with an articulated, layered 2D anime-inspired
 * shadow combat warrior:
 * - Anatomical torso, chestplate, pauldrons, sash and layered shinobi tunic
 * - Articulated muscular limbs with bracers, shin guards, knee/elbow cops and tabi boots
 * - Dynamic trailing headband ribbons and flowing sash ties
 * - Expressive glowing anime eyes with outer luminescence and specular pupil
 * - Full integration with the Adaptive Contrast System (dark, bright, and hybrid arenas)
 * - Custom visual personalities for each fighter (Kage, Raze, Bastion, Volt, etc.)
 */

import type Phaser from 'phaser';
import type { Skeleton, Joint } from './StickRig';
import type { WeaponDef } from '../../data/weapons';
import type { EquipmentDef } from '../../data/equipment';
import type { ContrastStyle } from '../contrast/AdaptiveContrast';
import { drawWeaponArt, shadeColor, blendColor } from './WeaponRenderer';

type G = Phaser.GameObjects.Graphics;

export interface CharacterRenderStyle {
  body: number;
  eye: number;
  outline: number;
  equipment: Partial<Record<string, EquipmentDef>>;
  scale: number;
  alpha: number;
  contrast?: ContrastStyle;
  fighterId?: string;
  time?: number;
}

const vExt = (p: Joint, ang: number, len: number): Joint => ({
  x: p.x + Math.cos(ang) * len,
  y: p.y + Math.sin(ang) * len,
});

const vOffset = (p: Joint, perp: number, dist: number): Joint => ({
  x: p.x + Math.cos(perp) * dist,
  y: p.y + Math.sin(perp) * dist,
});

const vAngle = (a: Joint, b: Joint): number => Math.atan2(b.y - a.y, b.x - a.x);

/**
 * Draws an articulated, tapered limb segment with anatomical contouring,
 * inner material fill, armor guard overlay, and rim highlights.
 */
function drawLimbSegment(
  g: G,
  start: Joint,
  end: Joint,
  w1: number,
  w2: number,
  fillColor: number,
  outlineColor: number,
  rimColor: number,
  s: number,
  alpha: number,
  hasArmor = false,
  armorColor = 0x333b4d
): void {
  const ang = vAngle(start, end);
  const perp = ang + Math.PI / 2;

  const s1 = vOffset(start, perp, (w1 * s) / 2);
  const s2 = vOffset(start, perp, (-w1 * s) / 2);
  const e1 = vOffset(end, perp, (w2 * s) / 2);
  const e2 = vOffset(end, perp, (-w2 * s) / 2);

  // 1. Dark silhouette / outline underlayer
  g.lineStyle(1.8 * s, outlineColor, alpha * 0.9);
  g.fillStyle(fillColor, alpha);
  g.beginPath();
  g.moveTo(s1.x, s1.y);
  g.lineTo(e1.x, e1.y);
  g.lineTo(e2.x, e2.y);
  g.lineTo(s2.x, s2.y);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // 2. Segmented armor plate / bracer overlay
  if (hasArmor) {
    const midStart = vExt(start, ang, (w1 * s) * 0.6);
    const midEnd = vExt(end, ang, -(w2 * s) * 0.4);
    const m1 = vOffset(midStart, perp, (w1 * s) * 0.45);
    const m2 = vOffset(midStart, perp, (-w1 * s) * 0.45);
    const me1 = vOffset(midEnd, perp, (w2 * s) * 0.45);
    const me2 = vOffset(midEnd, perp, (-w2 * s) * 0.45);

    g.fillStyle(armorColor, alpha * 0.95);
    g.beginPath();
    g.moveTo(m1.x, m1.y);
    g.lineTo(me1.x, me1.y);
    g.lineTo(me2.x, me2.y);
    g.lineTo(m2.x, m2.y);
    g.closePath();
    g.fillPath();

    // Armor plate border
    g.lineStyle(1.2 * s, blendColor(armorColor, 0xffffff, 0.35), alpha * 0.8);
    g.strokePath();
  }

  // 3. Crisp edge rim highlight along the upper contour
  g.lineStyle(1.4 * s, rimColor, alpha * 0.95);
  g.beginPath();
  g.moveTo(s1.x, s1.y);
  g.lineTo(e1.x, e1.y);
  // faint secondary glow band just outside the rim
  g.lineStyle(3 * s, rimColor, alpha * 0.14);
  g.strokePath();
  g.lineStyle(1.4 * s, rimColor, alpha * 0.95);
  g.beginPath();
  g.moveTo(s1.x, s1.y);
  g.lineTo(e1.x, e1.y);
  g.strokePath();
}

/**
 * Renders the complete articulated 2D shadow warrior.
 */
export function drawShadowWarrior(
  g: G,
  sk: Skeleton,
  style: CharacterRenderStyle,
  weapon: WeaponDef | null,
  flashT = 0
): void {
  const s = style.scale;
  const t = style.time ?? performance.now() / 1000;
  const eq = style.equipment;
  const c = style.contrast;

  // Base palette influenced by adaptive contrast
  let bodyCol = c ? c.bodyColor : style.body;
  let clothCol = c ? c.clothColor : shadeColor(style.body, 0.52);
  let armorCol = c ? c.armorPlateColor : blendColor(style.body, style.outline, 0.4);
  let outlineCol = c ? c.outlineColor : 0x090a10;
  // Rim light follows the fighter's accent colour, so the silhouette glows
  // in the character's own neon (mockup: black body + violet rim).
  let rimCol = c ? c.rimColor : blendColor(style.eye, 0xffffff, 0.25);
  let eyeCol = c ? c.eyeColor : style.eye;

  if (flashT > 0) {
    bodyCol = blendColor(bodyCol, 0xffffff, flashT);
    clothCol = blendColor(clothCol, 0xffffff, flashT);
    armorCol = blendColor(armorCol, 0xffffff, flashT);
  }

  const fId = style.fighterId || '';

  // Fighter-specific armor customization
  if (fId === 'raze') {
    armorCol = 0x3d1712; // Berserker scorched plate
    clothCol = 0x1f0c0a;
  } else if (fId === 'bastion') {
    armorCol = 0x485266; // Heavy bastion steel
    clothCol = 0x222633;
  } else if (fId === 'volt') {
    armorCol = 0x242d40;
    clothCol = 0x121724;
  } else if (fId === 'glacius') {
    armorCol = 0x1c3647; // Black-ice plate
    clothCol = 0x0c1b26;
  } else if (fId === 'kage' || fId === 'oblivion' || fId === '') {
    // Shadow protagonist: near-black violet armour so the body reads as a
    // silhouette and the accent rim does the sculpting (like the key art).
    armorCol = blendColor(bodyCol, style.eye, 0.14);
    clothCol = shadeColor(bodyCol, 1.0);
  }

  // Outfit styling override
  const outfit = eq.outfit;
  if (outfit && outfit.style !== 'base') {
    clothCol = outfit.color;
    armorCol = blendColor(armorCol, outfit.glow, 0.45);
    rimCol = blendColor(rimCol, outfit.glow, 0.5);
  }

  // Armor styling override
  const armor = eq.armor;
  if (armor && armor.style !== 'none') {
    armorCol = armor.color;
    rimCol = armor.glow;
  }

  // ------------------------------------------------ AURA (Rendered Behind Fighter)
  const aura = eq.aura;
  if (aura && aura.style !== 'none') {
    drawAuraEnhanced(g, sk, aura, s, style.alpha, t);
  }

  // ------------------------------------------------ NEON UNDER-GLOW
  // Soft accent silhouette halo behind the whole fighter — the mockup's
  // "glowing shadow" look. Pulsates gently with the animation clock.
  const glowPulse = 0.07 + Math.sin((style.time ?? performance.now() / 1000) * 2.4) * 0.02;
  g.fillStyle(eyeCol, style.alpha * glowPulse);
  g.fillEllipse(sk.hip.x, sk.hip.y - 44 * s, 62 * s, 108 * s);
  g.fillStyle(eyeCol, style.alpha * glowPulse * 0.8);
  g.fillCircle(sk.head.x, sk.head.y, 20 * s);
  g.fillStyle(eyeCol, style.alpha * glowPulse * 0.55);
  g.fillEllipse(sk.hip.x, sk.hip.y - 44 * s, 84 * s, 132 * s);

  // ------------------------------------------------ BACK ACCESSORY
  const back = eq.back;
  if (back && back.style !== 'none') {
    drawBackAccessory(g, sk, back, s, style.alpha);
  }

  // ------------------------------------------------ BACK LEG (Left Leg)
  const backBodyCol = shadeColor(bodyCol, 0.75);
  const backArmorCol = shadeColor(armorCol, 0.75);
  // Thigh
  drawLimbSegment(g, sk.hip, sk.kneeL, 10.5, 8.5, backBodyCol, outlineCol, rimCol, s, style.alpha, true, backArmorCol);
  // Knee joint
  g.fillStyle(backArmorCol, style.alpha);
  g.fillCircle(sk.kneeL.x, sk.kneeL.y, 4.8 * s);
  // Shin / Lower Leg
  drawLimbSegment(g, sk.kneeL, sk.footL, 8, 6.5, backBodyCol, outlineCol, rimCol, s, style.alpha, true, backArmorCol);
  // Back Foot / Boot
  g.fillStyle(backBodyCol, style.alpha);
  g.fillRoundedRect(sk.footL.x - 7 * s, sk.footL.y - 3.5 * s, 15 * s, 7 * s, 2.5 * s);
  const boots = eq.boots;
  if (boots && boots.style !== 'none') {
    drawBootsDecorations(g, sk.footL, boots, s, style.alpha * 0.8, t);
  }

  // ------------------------------------------------ BACK ARM (Left Arm)
  const backArmCol = shadeColor(bodyCol, 0.78);
  // Upper Arm
  drawLimbSegment(g, sk.shoulderL, sk.elbowL, 8, 6.8, backArmCol, outlineCol, rimCol, s, style.alpha, false, backArmorCol);
  // Elbow joint
  g.fillStyle(backArmorCol, style.alpha);
  g.fillCircle(sk.elbowL.x, sk.elbowL.y, 3.8 * s);
  // Forearm
  drawLimbSegment(g, sk.elbowL, sk.handL, 6.5, 5.5, backArmCol, outlineCol, rimCol, s, style.alpha, true, backArmorCol);
  // Hand
  g.fillStyle(backArmCol, style.alpha);
  g.fillCircle(sk.handL.x, sk.handL.y, 4.2 * s);
  g.lineStyle(1 * s, outlineCol, style.alpha);
  g.strokeCircle(sk.handL.x, sk.handL.y, 4.2 * s);
  const gloves = eq.gloves;
  if (gloves && gloves.style !== 'none') {
    drawGlovesDecorations(g, sk.handL, gloves, s, style.alpha * 0.85);
  }

  // Dual wield left hand weapon if dual
  if (weapon && weapon.grip === 'dual' && weapon.shape !== 'none') {
    drawWeaponArt(g, sk.handL, sk.handLAngle, weapon, s * 0.92, style.alpha * 0.88, t);
  }

  // ------------------------------------------------ TORSO & CHESTPLATE
  const torsoAngle = vAngle(sk.hip, sk.neck);
  const torsoPerp = torsoAngle + Math.PI / 2;

  // Waist and hip coordinates
  const hipL = vOffset(sk.hip, torsoPerp, -9 * s);
  const hipR = vOffset(sk.hip, torsoPerp, 9 * s);
  // Midsection coordinates
  const midTorso = vExt(sk.hip, torsoAngle, 18 * s);
  const midL = vOffset(midTorso, torsoPerp, -10.5 * s);
  const midR = vOffset(midTorso, torsoPerp, 10.5 * s);
  // Chest and shoulder coordinates
  const chestTop = vExt(sk.hip, torsoAngle, 32 * s);
  const chestL = vOffset(chestTop, torsoPerp, -13 * s);
  const chestR = vOffset(chestTop, torsoPerp, 13 * s);
  const neckBase = vExt(sk.neck, torsoAngle, -2 * s);

  // Torso base shape (Athletic V-taper)
  g.lineStyle(2 * s, outlineCol, style.alpha);
  g.fillStyle(clothCol, style.alpha);
  g.beginPath();
  g.moveTo(hipL.x, hipL.y);
  g.lineTo(midL.x, midL.y);
  g.lineTo(chestL.x, chestL.y);
  g.lineTo(neckBase.x, neckBase.y);
  g.lineTo(chestR.x, chestR.y);
  g.lineTo(midR.x, midR.y);
  g.lineTo(hipR.x, hipR.y);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // Layered Shinobi Tunic V-Neck Lapels
  g.lineStyle(1.8 * s, bodyCol, style.alpha * 0.9);
  g.beginPath();
  g.moveTo(chestL.x + 3 * s, chestL.y);
  g.lineTo(midTorso.x, midTorso.y);
  g.lineTo(chestR.x - 3 * s, chestR.y);
  g.strokePath();

  // Armored Cuirass / Breastplate
  const plateTop = vExt(midTorso, torsoAngle, 8 * s);
  const pL = vOffset(plateTop, torsoPerp, -10 * s);
  const pR = vOffset(plateTop, torsoPerp, 10 * s);
  const pBot = vExt(midTorso, torsoAngle, -4 * s);

  g.fillStyle(armorCol, style.alpha * 0.95);
  g.beginPath();
  g.moveTo(pL.x, pL.y);
  g.lineTo(chestTop.x, chestTop.y);
  g.lineTo(pR.x, pR.y);
  g.lineTo(vOffset(pBot, torsoPerp, 7 * s).x, vOffset(pBot, torsoPerp, 7 * s).y);
  g.lineTo(vOffset(pBot, torsoPerp, -7 * s).x, vOffset(pBot, torsoPerp, -7 * s).y);
  g.closePath();
  g.fillPath();

  // Breastplate metallic rim and central crest
  g.lineStyle(1.4 * s, rimCol, style.alpha * 0.85);
  g.beginPath();
  g.moveTo(pL.x, pL.y);
  g.lineTo(chestTop.x, chestTop.y);
  g.lineTo(pR.x, pR.y);
  g.strokePath();

  // Breathing energy core on the cuirass
  const coreX = vExt(midTorso, torsoAngle, 5 * s);
  const corePulse = 0.55 + Math.sin(t * 3.1) * 0.25;
  g.fillStyle(eyeCol, style.alpha * 0.25 * corePulse);
  g.fillCircle(coreX.x, coreX.y, 5.5 * s);
  g.fillStyle(eyeCol, style.alpha * corePulse * 0.9);
  g.fillCircle(coreX.x, coreX.y, 2.4 * s);
  g.fillStyle(0xffffff, style.alpha * corePulse);
  g.fillCircle(coreX.x, coreX.y, 1 * s);

  if (armor && armor.style !== 'none') {
    drawArmorPlateDecorations(g, sk, armor, s, style.alpha);
  }

  // Obi Sash / Belt with Knot & Dangling Tails
  const obiH = 6 * s;
  const obiL = vOffset(sk.hip, torsoPerp, -9.5 * s);
  const obiR = vOffset(sk.hip, torsoPerp, 9.5 * s);
  g.fillStyle(0x181a24, style.alpha);
  g.fillRoundedRect(obiL.x, obiL.y - obiH * 0.5, 19 * s, obiH, 2 * s);
  g.lineStyle(1.4 * s, style.outline, style.alpha * 0.9);
  g.strokeRoundedRect(obiL.x, obiL.y - obiH * 0.5, 19 * s, obiH, 2 * s);

  // Sash knot & dynamic hanging ribbon tails
  const ribbonSway = Math.sin(t * 6) * 3.5 * s;
  const knotP = vExt(sk.hip, torsoAngle, 2 * s);
  g.fillStyle(style.outline, style.alpha * 0.95);
  g.fillCircle(knotP.x, knotP.y, 3 * s);

  g.lineStyle(2.4 * s, style.outline, style.alpha * 0.9);
  g.beginPath();
  g.moveTo(knotP.x, knotP.y);
  g.lineTo(knotP.x - 6 * s + ribbonSway, knotP.y + 16 * s);
  g.strokePath();

  // Shoulder Pauldrons (Spike or tiered plate)
  const drawPauldron = (sh: Joint, facingSide: number) => {
    const pW = (fId === 'raze' ? 14 : 11) * s;
    const pH = (fId === 'raze' ? 16 : 10) * s;
    g.fillStyle(armorCol, style.alpha);
    g.fillRoundedRect(sh.x - (pW * 0.5), sh.y - (pH * 0.6), pW, pH, 3 * s);
    g.lineStyle(1.4 * s, rimCol, style.alpha * 0.9);
    g.strokeRoundedRect(sh.x - (pW * 0.5), sh.y - (pH * 0.6), pW, pH, 3 * s);

    if (fId === 'raze') {
      // Berserker pauldron spike
      g.fillStyle(0xff5a2a, style.alpha);
      g.fillTriangle(sh.x - 3 * s, sh.y - 7 * s, sh.x, sh.y - 16 * s, sh.x + 3 * s, sh.y - 7 * s);
    }
  };
  drawPauldron(sk.shoulderL, -1);
  drawPauldron(sk.shoulderR, 1);

  // ------------------------------------------------ FRONT LEG (Right Leg)
  // Thigh
  drawLimbSegment(g, sk.hip, sk.kneeR, 11.5, 9, bodyCol, outlineCol, rimCol, s, style.alpha, true, armorCol);
  // Knee Armor Cop
  g.fillStyle(armorCol, style.alpha);
  g.fillCircle(sk.kneeR.x, sk.kneeR.y, 5.2 * s);
  g.lineStyle(1.4 * s, rimCol, style.alpha * 0.9);
  g.strokeCircle(sk.kneeR.x, sk.kneeR.y, 5.2 * s);
  // Shin Guard / Greaves
  drawLimbSegment(g, sk.kneeR, sk.footR, 8.8, 7.2, bodyCol, outlineCol, rimCol, s, style.alpha, true, armorCol);
  // Front Tabi Boot
  g.fillStyle(clothCol, style.alpha);
  g.fillRoundedRect(sk.footR.x - 8 * s, sk.footR.y - 4 * s, 18 * s, 8 * s, 3 * s);
  g.lineStyle(1.4 * s, outlineCol, style.alpha);
  g.strokeRoundedRect(sk.footR.x - 8 * s, sk.footR.y - 4 * s, 18 * s, 8 * s, 3 * s);
  if (boots && boots.style !== 'none') {
    drawBootsDecorations(g, sk.footR, boots, s, style.alpha, t);
  }

  // ------------------------------------------------ FRONT ARM (Right Arm - Weapon Arm)
  // Upper Arm
  drawLimbSegment(g, sk.shoulderR, sk.elbowR, 8.8, 7.4, bodyCol, outlineCol, rimCol, s, style.alpha, false, armorCol);
  // Elbow Cop
  g.fillStyle(armorCol, style.alpha);
  g.fillCircle(sk.elbowR.x, sk.elbowR.y, 4.4 * s);
  g.lineStyle(1.2 * s, rimCol, style.alpha * 0.85);
  g.strokeCircle(sk.elbowR.x, sk.elbowR.y, 4.4 * s);
  // Forearm Vambrace
  drawLimbSegment(g, sk.elbowR, sk.handR, 7.5, 6.2, bodyCol, outlineCol, rimCol, s, style.alpha, true, armorCol);
  // Hand (Clenched gripping fist)
  g.fillStyle(clothCol, style.alpha);
  g.fillCircle(sk.handR.x, sk.handR.y, 4.8 * s);
  g.lineStyle(1.4 * s, outlineCol, style.alpha);
  g.strokeCircle(sk.handR.x, sk.handR.y, 4.8 * s);
  if (gloves && gloves.style !== 'none') {
    drawGlovesDecorations(g, sk.handR, gloves, s, style.alpha);
  }

  // ------------------------------------------------ WEAPON (Right Hand)
  if (weapon && weapon.shape !== 'none') {
    drawWeaponArt(g, sk.handR, sk.handRAngle, weapon, s, style.alpha, t);
  }

  // ------------------------------------------------ HEAD & FACE
  const hX = sk.head.x;
  const hY = sk.head.y;

  // Neck
  drawLimbSegment(g, sk.neck, sk.head, 8.5, 8.5, clothCol, outlineCol, rimCol, s, style.alpha, false);

  // Stylized Ninja Cowl / Shadow Faceplate Silhouette
  const headR = 12 * s;
  // Spiky anime hair silhouette — drawn just before the head so the spikes
  // read as part of the head outline (key-art style wild hair).
  const topY = hY - headR * 0.9;
  g.fillStyle(bodyCol, style.alpha);
  g.fillTriangle(hX - 9 * s, topY + 3 * s, hX - 9.5 * s, hY - headR - 8 * s, hX - 3 * s, topY + 2 * s);
  g.fillTriangle(hX - 3.5 * s, topY + 3 * s, hX - 1 * s, hY - headR - 12 * s, hX + 3 * s, topY + 2.5 * s);
  g.fillTriangle(hX + 2.5 * s, topY + 3 * s, hX + 6.5 * s, hY - headR - 9 * s, hX + 9 * s, topY + 2 * s);
  // accent sheen along one spike for the neon-lit hair edge
  g.lineStyle(1.3 * s, rimCol, style.alpha * 0.55);
  g.beginPath();
  g.moveTo(hX - 1 * s, hY - headR - 12 * s);
  g.lineTo(hX - 9.5 * s, hY - headR - 8 * s);
  g.strokePath();

  g.fillStyle(bodyCol, style.alpha);
  g.fillCircle(hX, hY, headR);
  g.lineStyle(1.8 * s, outlineCol, style.alpha);
  g.strokeCircle(hX, hY, headR);

  // Face cowl wrap shadow
  g.fillStyle(clothCol, style.alpha * 0.95);
  g.beginPath();
  g.arc(hX, hY, headR - 1 * s, Math.PI * 0.1, Math.PI * 1.1);
  g.closePath();
  g.fillPath();

  // Headband plate (Hitai-ate / Shinobi Forehead Protector)
  const hbY = hY - 4 * s;
  g.fillStyle(armorCol, style.alpha);
  g.fillRoundedRect(hX - 9 * s, hbY - 3 * s, 18 * s, 6 * s, 2 * s);
  g.lineStyle(1.2 * s, rimCol, style.alpha * 0.9);
  g.strokeRoundedRect(hX - 9 * s, hbY - 3 * s, 18 * s, 6 * s, 2 * s);

  // Dynamic Trailing Headband Ribbons (Flowing behind neck)
  const ribbonX = hX - 8 * s;
  const ribbonY = hbY;
  const wave1 = Math.sin(t * 7.5) * 4 * s;
  const wave2 = Math.cos(t * 6.5) * 5 * s;

  g.lineStyle(2.6 * s, style.outline, style.alpha * 0.92);
  g.beginPath();
  g.moveTo(ribbonX, ribbonY);
  g.lineTo(ribbonX - 16 * s + wave1, ribbonY + 6 * s);
  g.lineTo(ribbonX - 30 * s + wave2, ribbonY + 12 * s);
  g.strokePath();

  g.lineStyle(1.8 * s, style.outline, style.alpha * 0.7);
  g.beginPath();
  g.moveTo(ribbonX, ribbonY + 2 * s);
  g.lineTo(ribbonX - 14 * s - wave2 * 0.5, ribbonY + 12 * s);
  g.lineTo(ribbonX - 26 * s + wave1, ribbonY + 20 * s);
  g.strokePath();

  // ------------------------------------------------ FLOWING SHINOBI SCARF
  // A long layered scarf streaming off the neck — its wave reads as motion
  // even when the pose is idle, giving the fighter life.
  const scarfRoot = vOffset(sk.head, vAngle(sk.neck, sk.head) + Math.PI * 0.62, 7 * s);
  const lean = (sk.neck.x - sk.hip.x) * 0.06 * s;
  const scW = (phase: number, len: number, drop: number) =>
    Math.sin(t * 6.5 - phase) * len * 0.14 * s - drop * s;
  g.lineStyle(4.6 * s, style.outline, style.alpha * 0.96);
  g.beginPath();
  g.moveTo(scarfRoot.x, scarfRoot.y);
  g.lineTo(scarfRoot.x - 15 * s - lean + scW(0, 8, 2), scarfRoot.y + 7 * s + scW(1, 6, 4));
  g.lineTo(scarfRoot.x - 31 * s - lean * 2 + scW(2, 9, 4), scarfRoot.y + 9 * s + scW(2.4, 7, 9));
  g.lineTo(scarfRoot.x - 44 * s - lean * 3 + scW(3.1, 10, 6), scarfRoot.y + 7 * s + scW(3.6, 8, 15));
  g.strokePath();
  // accent underside so the scarf reads against the body
  g.lineStyle(2 * s, blendColor(eyeCol, style.outline, 0.25), style.alpha * 0.8);
  g.beginPath();
  g.moveTo(scarfRoot.x - 4 * s, scarfRoot.y + 3 * s);
  g.lineTo(scarfRoot.x - 22 * s - lean + scW(1.4, 8, 5), scarfRoot.y + 10 * s + scW(1.9, 7, 6));
  g.lineTo(scarfRoot.x - 38 * s - lean * 2.4 + scW(2.8, 9, 5), scarfRoot.y + 12 * s + scW(3.1, 7, 12));
  g.strokePath();

  // Expressive Glowing Anime Eyes
  const eX = hX + 4.8 * s;
  const eY = hY - 1.2 * s;

  // Eye outer luminous aura
  g.fillStyle(eyeCol, style.alpha * 0.45);
  g.fillEllipse(eX, eY, 11 * s, 6.5 * s);

  // Sharp fierce eye slit contour
  g.fillStyle(eyeCol, style.alpha * 0.98);
  g.beginPath();
  g.moveTo(eX - 4.5 * s, eY);
  g.lineTo(eX - 0.5 * s, eY - 3 * s);
  g.lineTo(eX + 5.5 * s, eY - 0.5 * s);
  g.lineTo(eX, eY + 2 * s);
  g.closePath();
  g.fillPath();

  // Vertical energy flare rising from the eye (extra menace)
  g.lineStyle(1.6 * s, eyeCol, style.alpha * 0.5);
  g.beginPath();
  g.moveTo(eX + 1 * s, eY - 3.5 * s);
  g.lineTo(eX + 2.2 * s, eY - 7.5 * s);
  g.strokePath();

  // Pure white energetic pupil spark
  g.fillStyle(0xffffff, style.alpha);
  g.fillEllipse(eX + 1.2 * s, eY - 0.4 * s, 3.2 * s, 1.8 * s);

  // ------------------------------------------------ MASKS & HEADGEAR
  const mask = eq.mask;
  if (mask && mask.style !== 'none') {
    drawMaskEnhanced(g, sk, mask, s, style.alpha, rimCol);
  }
  const head = eq.head;
  if (head && head.style !== 'none') {
    drawHeadgearEnhanced(g, sk, head, s, style.alpha, rimCol);
  }
}

function drawMaskEnhanced(g: G, sk: Skeleton, m: EquipmentDef, s: number, alpha: number, rimCol: number) {
  const { x, y } = sk.head;
  switch (m.style) {
    case 'oni':
      g.fillStyle(m.color, alpha);
      g.fillEllipse(x + 2.5 * s, y + 2 * s, 18 * s, 16 * s);
      g.lineStyle(1.6 * s, m.glow, alpha);
      g.strokeEllipse(x + 2.5 * s, y + 2 * s, 18 * s, 16 * s);
      // Fangs
      g.fillStyle(0xffffff, alpha);
      g.fillTriangle(x + 5 * s, y + 4 * s, x + 8 * s, y + 9 * s, x + 3 * s, y + 5 * s);
      break;
    case 'visor':
      g.fillStyle(m.color, alpha);
      g.fillRoundedRect(x - 3 * s, y - 4 * s, 16 * s, 7.5 * s, 2 * s);
      g.fillStyle(m.glow, alpha * 0.95);
      g.fillRect(x - 1 * s, y - 2.2 * s, 13 * s, 2.8 * s);
      g.lineStyle(1.2 * s, rimCol, alpha * 0.8);
      g.strokeRoundedRect(x - 3 * s, y - 4 * s, 16 * s, 7.5 * s, 2 * s);
      break;
    case 'kitsune':
      g.fillStyle(m.color, alpha);
      g.fillEllipse(x + 3.5 * s, y + 0.5 * s, 18 * s, 14 * s);
      g.fillStyle(m.glow, alpha);
      g.fillTriangle(x + 10 * s, y - 3 * s, x + 17 * s, y, x + 10 * s, y + 3 * s);
      break;
    case 'wrap':
    default:
      g.fillStyle(m.color, alpha);
      g.fillRoundedRect(x - 8 * s, y + 1.5 * s, 19 * s, 6 * s, 2 * s);
      break;
  }
}

function drawHeadgearEnhanced(g: G, sk: Skeleton, h: EquipmentDef, s: number, alpha: number, rimCol: number) {
  const { x, y } = sk.head;
  switch (h.style) {
    case 'hood':
      g.fillStyle(h.color, alpha * 0.95);
      g.beginPath();
      g.arc(x, y, 14.5 * s, Math.PI * 1.05, Math.PI * 2.05, false);
      g.lineTo(x - 12 * s, y + 14 * s);
      g.closePath();
      g.fillPath();
      g.lineStyle(1.6 * s, h.glow, alpha * 0.9);
      g.strokePath();
      break;
    case 'horns':
      g.fillStyle(h.color, alpha);
      g.fillTriangle(x - 7 * s, y - 8 * s, x - 15 * s, y - 26 * s, x - 2 * s, y - 11 * s);
      g.fillTriangle(x + 7 * s, y - 8 * s, x + 15 * s, y - 26 * s, x + 2 * s, y - 11 * s);
      g.lineStyle(1.4 * s, h.glow, alpha * 0.9);
      g.strokeTriangle(x + 7 * s, y - 8 * s, x + 15 * s, y - 26 * s, x + 2 * s, y - 11 * s);
      break;
    case 'crown':
      g.fillStyle(h.color, alpha);
      g.fillRect(x - 11 * s, y - 16 * s, 22 * s, 5 * s);
      for (let i = -1; i <= 1; i++) {
        g.fillTriangle(x + i * 8 * s - 3 * s, y - 16 * s, x + i * 8 * s, y - 27 * s, x + i * 8 * s + 3 * s, y - 16 * s);
      }
      g.lineStyle(1.4 * s, h.glow, alpha);
      g.strokeRect(x - 11 * s, y - 16 * s, 22 * s, 5 * s);
      break;
    case 'halo':
      // Floating astral halo above head
      g.lineStyle(2.4 * s, h.glow, alpha * 0.95);
      g.strokeEllipse(x, y - 21 * s, 24 * s, 8 * s);
      g.lineStyle(1.2 * s, 0xffffff, alpha);
      g.strokeEllipse(x, y - 21 * s, 20 * s, 6 * s);
      // Floating star spark
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(x + 10 * s, y - 22 * s, 2 * s);
      break;
    case 'topknot':
      // Ronin topknot hair bun and tie
      g.fillStyle(h.color, alpha);
      g.fillCircle(x - 2 * s, y - 16 * s, 6 * s);
      g.fillEllipse(x + 1 * s, y - 19 * s, 10 * s, 5 * s);
      g.lineStyle(1.6 * s, h.glow, alpha);
      g.lineBetween(x - 5 * s, y - 14 * s, x + 2 * s, y - 14 * s);
      break;
  }
}

function drawAuraEnhanced(g: G, sk: Skeleton, a: EquipmentDef, s: number, alpha: number, t: number) {
  const cX = sk.hip.x;
  const cY = sk.hip.y - 25 * s;
  switch (a.style) {
    case 'ember':
      for (let i = 0; i < 6; i++) {
        const pT = (t * 1.8 + i * 1.1) % 3;
        const eX = cX + Math.sin(t * 2 + i * 1.5) * (26 + i * 4) * s;
        const eY = cY + 35 * s - pT * 32 * s;
        const eR = Math.max(1, (3.5 - pT) * s);
        g.fillStyle(a.glow, alpha * (1 - pT / 3) * 0.85);
        g.fillCircle(eX, eY, eR);
      }
      break;
    case 'frost':
      for (let i = 0; i < 7; i++) {
        const ang = t * 1.2 + (i * Math.PI * 2) / 7;
        const fR = (30 + Math.sin(t * 3 + i) * 6) * s;
        const fX = cX + Math.cos(ang) * fR;
        const fY = cY + Math.sin(ang) * (fR * 0.7);
        g.fillStyle(a.glow, alpha * 0.8);
        g.fillCircle(fX, fY, 2.2 * s);
        g.lineStyle(1 * s, 0xffffff, alpha * 0.7);
        g.lineBetween(fX - 3 * s, fY, fX + 3 * s, fY);
        g.lineBetween(fX, fY - 3 * s, fX, fY + 3 * s);
      }
      break;
    case 'volt':
      for (let i = 0; i < 3; i++) {
        const vAng = t * 5 + i * 2.1;
        const r1 = 28 * s;
        const x1 = cX + Math.cos(vAng) * r1;
        const y1 = cY + Math.sin(vAng) * r1;
        const x2 = cX + Math.cos(vAng + 0.9) * (r1 * 0.7);
        const y2 = cY + Math.sin(vAng + 0.9) * (r1 * 0.7);
        const mx = (x1 + x2) / 2 + Math.sin(t * 15 + i) * 8 * s;
        const my = (y1 + y2) / 2 + Math.cos(t * 15 + i) * 8 * s;
        g.lineStyle(1.8 * s, a.glow, alpha * 0.9);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(mx, my);
        g.lineTo(x2, y2);
        g.strokePath();
      }
      break;
    case 'void':
      g.lineStyle(2.2 * s, a.glow, alpha * 0.6);
      g.strokeEllipse(cX, cY, (44 + Math.sin(t * 4) * 4) * s, (60 + Math.cos(t * 3) * 6) * s);
      for (let i = 0; i < 4; i++) {
        const oAng = -t * 2.5 + (i * Math.PI) / 2;
        const ox = cX + Math.cos(oAng) * 26 * s;
        const oy = cY + Math.sin(oAng) * 38 * s;
        g.fillStyle(a.color, alpha * 0.9);
        g.fillCircle(ox, oy, 3 * s);
      }
      break;
    case 'celestial':
      g.lineStyle(1.6 * s, 0xffffff, alpha * 0.7);
      g.strokeEllipse(cX, cY, 48 * s, 68 * s);
      for (let i = 0; i < 5; i++) {
        const sAng = t * 1.5 + (i * Math.PI * 2) / 5;
        const sx = cX + Math.cos(sAng) * 28 * s;
        const sy = cY + Math.sin(sAng) * 42 * s;
        g.fillStyle(0xffffff, alpha * 0.95);
        g.fillCircle(sx, sy, 2.5 * s);
      }
      break;
  }
}

function drawArmorPlateDecorations(g: G, sk: Skeleton, armor: EquipmentDef, s: number, alpha: number) {
  const m = sk.hip;
  const n = sk.neck;
  const midX = (m.x + n.x) / 2;
  const midY = (m.y + n.y) / 2;

  switch (armor.style) {
    case 'light':
      g.lineStyle(1.4 * s, armor.glow, alpha * 0.9);
      g.lineBetween(midX - 7 * s, midY - 6 * s, midX, midY + 4 * s);
      g.lineBetween(midX + 7 * s, midY - 6 * s, midX, midY + 4 * s);
      break;
    case 'heavy':
      // Bulwark cross harness straps & rivets
      g.fillStyle(armor.glow, alpha * 0.9);
      g.fillCircle(midX - 5 * s, midY - 6 * s, 1.8 * s);
      g.fillCircle(midX + 5 * s, midY - 6 * s, 1.8 * s);
      g.fillCircle(midX - 4 * s, midY + 4 * s, 1.8 * s);
      g.fillCircle(midX + 4 * s, midY + 4 * s, 1.8 * s);
      break;
    case 'spirit':
      // Glowing crystalline veins
      g.lineStyle(1.6 * s, armor.glow, alpha);
      g.beginPath();
      g.moveTo(midX, midY - 10 * s);
      g.lineTo(midX - 4 * s, midY - 2 * s);
      g.lineTo(midX, midY + 6 * s);
      g.lineTo(midX + 4 * s, midY - 2 * s);
      g.closePath();
      g.strokePath();
      break;
    case 'dragon':
      // Jagged wyrm bone ribs
      g.fillStyle(armor.glow, alpha * 0.9);
      for (let i = -1; i <= 1; i++) {
        g.fillTriangle(midX - 8 * s, midY + i * 5 * s, midX, midY + i * 5 * s - 2 * s, midX - 8 * s, midY + i * 5 * s + 3 * s);
        g.fillTriangle(midX + 8 * s, midY + i * 5 * s, midX, midY + i * 5 * s - 2 * s, midX + 8 * s, midY + i * 5 * s + 3 * s);
      }
      break;
  }
}

function drawGlovesDecorations(g: G, hand: Joint, gloves: EquipmentDef, s: number, alpha: number) {
  switch (gloves.style) {
    case 'wraps':
      g.lineStyle(1.4 * s, 0xeeeeee, alpha * 0.85);
      g.lineBetween(hand.x - 3 * s, hand.y - 2 * s, hand.x + 3 * s, hand.y + 2 * s);
      break;
    case 'storm':
      g.fillStyle(gloves.glow, alpha);
      g.fillCircle(hand.x, hand.y, 2.5 * s);
      g.lineStyle(1.2 * s, gloves.glow, alpha);
      g.lineBetween(hand.x - 2 * s, hand.y - 4 * s, hand.x + 2 * s, hand.y + 4 * s);
      break;
    case 'talons':
      g.fillStyle(gloves.color, alpha);
      g.fillTriangle(hand.x + 2 * s, hand.y - 2 * s, hand.x + 8 * s, hand.y - 1 * s, hand.x + 2 * s, hand.y + 2 * s);
      break;
  }
}

function drawBootsDecorations(g: G, foot: Joint, boots: EquipmentDef, s: number, alpha: number, t: number) {
  switch (boots.style) {
    case 'tabi':
      // Split toe notch
      g.lineStyle(1.4 * s, 0x090a10, alpha);
      g.lineBetween(foot.x + 4 * s, foot.y - 2 * s, foot.x + 7 * s, foot.y - 2 * s);
      break;
    case 'jet':
      // Micro-thruster flame pulse
      const jPulse = 4 * s + Math.sin(t * 14) * 2.5 * s;
      g.fillStyle(boots.glow, alpha * 0.95);
      g.fillTriangle(foot.x - 7 * s, foot.y - 1 * s, foot.x - 7 * s - jPulse, foot.y + 2 * s, foot.x - 7 * s, foot.y + 4 * s);
      break;
    case 'titan':
      // Heavy bronze toe guard & banded plate
      g.fillStyle(boots.glow, alpha);
      g.fillRect(foot.x + 4 * s, foot.y - 3 * s, 5 * s, 6 * s);
      g.lineStyle(1.2 * s, 0xffffff, alpha * 0.7);
      g.strokeRect(foot.x + 4 * s, foot.y - 3 * s, 5 * s, 6 * s);
      break;
  }
}

function drawBackAccessory(g: G, sk: Skeleton, b: EquipmentDef, s: number, alpha: number) {
  const n = sk.neck;
  switch (b.style) {
    case 'cape':
      g.fillStyle(b.color, alpha * 0.92);
      g.beginPath();
      g.moveTo(n.x, n.y);
      g.lineTo(n.x - 28 * s, n.y + 32 * s);
      g.lineTo(n.x - 16 * s, n.y + 58 * s);
      g.lineTo(n.x + 2 * s, n.y + 22 * s);
      g.closePath();
      g.fillPath();
      break;
    case 'wings':
      g.fillStyle(b.color, alpha * 0.9);
      for (let i = 0; i < 3; i++) {
        g.fillTriangle(n.x, n.y + 2 * s, n.x - (36 + i * 10) * s, n.y - (6 + i * 12) * s, n.x - (12 + i * 6) * s, n.y + (16 + i * 8) * s);
      }
      g.lineStyle(1.4 * s, b.glow, alpha * 0.85);
      g.strokeTriangle(n.x, n.y + 2 * s, n.x - 56 * s, n.y - 30 * s, n.x - 24 * s, n.y + 34 * s);
      break;
    case 'scarf':
      g.fillStyle(b.color, alpha);
      g.fillRect(n.x - 6 * s, n.y - 2 * s, 14 * s, 5 * s);
      g.beginPath();
      g.moveTo(n.x - 4 * s, n.y);
      g.lineTo(n.x - 36 * s, n.y - 12 * s);
      g.lineTo(n.x - 32 * s, n.y + 2 * s);
      g.closePath();
      g.fillPath();
      break;
    case 'sheath':
      g.lineStyle(4.5 * s, b.color, alpha);
      g.beginPath();
      g.moveTo(n.x - 4 * s, n.y + 6 * s);
      g.lineTo(n.x - 28 * s, n.y + 36 * s);
      g.strokePath();
      break;
  }
}
