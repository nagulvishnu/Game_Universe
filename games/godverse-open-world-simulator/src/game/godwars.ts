import * as THREE from 'three';
import type { Game } from './engine';
import { Humanoid } from './models';
import { hud } from './store';

export interface RivalGod {
  id: string;
  name: string;
  title: string;
  region: string;
  x: number;
  z: number;
  color: number;
  color2: number;
  hp: number;
  powers: string[];
}

export const RIVAL_GODS: RivalGod[] = [
  { id: 'ashara', name: 'Ashara', title: 'The Cinder Queen', region: 'Ember Wastes', x: 80, z: 700, color: 0xff6138, color2: 0xffc04d, hp: 420, powers: ['fire', 'nova', 'blast', 'strength', 'wind', 'storm', 'meteor', 'd_vehicle', 'd_building', 'disaster'] },
  { id: 'vael', name: 'Vael', title: 'The Frost Sovereign', region: 'Frost Reach', x: 100, z: -640, color: 0x7adfff, color2: 0xd8f7ff, hp: 520, powers: ['ice', 'tsunami', 'shield', 'teleport', 'freeze', 'portal', 'c_vehicle', 'c_animal', 'c_npc', 'tornado'] },
  { id: 'thorn', name: 'Thorn', title: 'Warden of the Verdant', region: 'Hollow Forest', x: -800, z: -150, color: 0x59e88a, color2: 0xc6ff77, hp: 640, powers: ['terraform', 'quake', 'attract', 'c_settlement', 'c_building', 'c_structure', 'c_weapon', 'matter', 'speed'] },
  { id: 'nyx', name: 'Nyx', title: 'The Storm Beyond', region: 'Storm Isles', x: 1500, z: 650, color: 0xb273ff, color2: 0x5cdcff, hp: 780, powers: ['lightning', 'beam', 'laser_eyes', 'divine_beam', 'blackhole', 'distort', 'rewind', 'gravity', 'planet', 'accel', 'telekinesis', 'jump', 'repel', 'd_env', 'shockwave', 'shadow_dragon', 'shadow_soldiers', 'summon_beasts'] },
];

const DAMAGE: Record<string, number> = {
  divine_bolt: 34, fire: 15, lightning: 28, ice: 20, wind: 14, beam: 11,
  strength: 42, blast: 38, nova: 65, blackhole: 30, gravity: 18, meteor: 36,
  tsunami: 24, quake: 32, terraform: 12, distort: 26, shockwave: 29,
  shadow_dragon: 40, laser_eyes: 48, divine_beam: 62,
  shadow_soldiers: 12, summon_beasts: 16,
};

interface RivalActor {
  god: RivalGod;
  humanoid: Humanoid;
  aura: THREE.Mesh;
  hp: number;
}

const RAY = new THREE.Vector3();
const CENTER = new THREE.Vector3();

export class GodWars {
  actor: RivalActor | null = null;
  guardTime = 0;
  attackCooldown = 0;
  powerCooldown = 0;
  private wasInvulnerable = true;
  private elapsed = 0;

  constructor(private g: Game) {}

  get active() { return hud.get().warActive; }
  get savedPreviousInvulnerability() { return this.wasInvulnerable; }

  challenge(id: string) {
    const state = hud.get();
    const god = RIVAL_GODS.find((candidate) => candidate.id === id);
    if (!god || state.ownedRegions.includes(god.region)) return;
    this.removeActor();
    this.wasInvulnerable = this.g.player.invulnerable;
    const ground = this.g.terrain.heightAt(god.x, god.z);
    const position = new THREE.Vector3(god.x, ground + 30, god.z + 78);
    this.g.teleportTo(position);
    this.g.input.yaw = 0;
    this.g.input.pitch = -0.32;
    this.g.player.setFlying(true);
    this.g.player.hp = 100;
    this.g.player.invulnerable = false;
    this.actor = this.createActor(god, ground);
    this.guardTime = 0;
    this.attackCooldown = 2;
    this.powerCooldown = 0;
    this.elapsed = 0;
    hud.set({
      selectedGod: god.id, warActive: true, warStatus: 'active', warChoice: 'none',
      warGodHp: god.hp, warGodMaxHp: god.hp,
    });
    this.g.toast(`${god.name} has answered your challenge`, `#${god.color.toString(16).padStart(6, '0')}`);
  }

  select(id: string) {
    const god = RIVAL_GODS.find((candidate) => candidate.id === id);
    if (god && !hud.get().ownedRegions.includes(god.region) && !this.active) hud.set({ selectedGod: god.id, warStatus: 'idle', warChoice: 'none' });
  }

  restoreChallenge(id: string, hp: number, status: 'active' | 'victory', previousInvulnerable: boolean) {
    const god = RIVAL_GODS.find((candidate) => candidate.id === id);
    if (!god) throw new Error(`Cannot restore challenge: rival god "${id}" does not exist.`);
    this.removeActor();
    const ground = this.g.terrain.heightAt(god.x, god.z);
    this.actor = this.createActor(god, ground);
    this.actor.hp = Math.max(0, Math.min(god.hp, hp));
    this.wasInvulnerable = previousInvulnerable;
    this.guardTime = 0;
    this.attackCooldown = 2.4;
    this.powerCooldown = 0;
    this.elapsed = 0;
    hud.set({
      selectedGod: god.id,
      warActive: status === 'active',
      warStatus: status,
      warGodHp: this.actor.hp,
      warGodMaxHp: god.hp,
    });
  }

  private createActor(god: RivalGod, ground: number): RivalActor {
    const humanoid = new Humanoid({ skin: god.color2, shirt: god.color, pants: 0x19172c, hair: 0x171323, shoes: 0x171323, detail: true });
    humanoid.root.scale.setScalar(5.4);
    humanoid.mats.shirt.emissive.setHex(god.color);
    humanoid.mats.shirt.emissiveIntensity = 0.45;
    humanoid.mats.trim.color.setHex(god.color2);
    humanoid.mats.trim.emissive.setHex(god.color);
    humanoid.mats.trim.emissiveIntensity = 0.8;
    humanoid.root.position.set(god.x, ground, god.z);
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: god.color, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false }),
    );
    aura.position.y = 5;
    aura.scale.set(8, 11, 8);
    humanoid.root.add(aura);
    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.045, 8, 32),
      new THREE.MeshStandardMaterial({ color: god.color2, emissive: god.color, emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.25 }),
    );
    crown.position.y = 2.04;
    humanoid.head.add(crown);
    this.g.scene.add(humanoid.root);
    return { god, humanoid, aura, hp: god.hp };
  }

  rayHit(origin: THREE.Vector3, direction: THREE.Vector3): number | null {
    const actor = this.actor;
    if (!this.active || !actor) return null;
    RAY.copy(actor.humanoid.root.position).add(CENTER.set(0, 5, 0)).sub(origin);
    const along = RAY.dot(direction);
    if (along < 0) return null;
    const radiusSq = RAY.lengthSq() - along * along;
    const radius = 7.5;
    if (radiusSq > radius * radius) return null;
    return Math.max(0, along - Math.sqrt(radius * radius - radiusSq));
  }

  usePower(id: string) {
    if (!this.active || !this.actor) return;
    if (id === 'divine_guard') {
      this.guardTime = this.guardTime > 0 ? 0 : 4;
      this.g.toast(this.guardTime > 0 ? 'Divine Guard raised' : 'Divine Guard lowered', '#78dcff');
      return;
    }
    if (id === 'divine_dash') {
      const direction = this.g.input.forward(RAY).setY(0).normalize();
      this.g.player.pos.addScaledVector(direction, 22);
      this.g.player.pos.y = Math.max(this.g.player.pos.y, this.g.terrain.heightAt(this.g.player.pos.x, this.g.player.pos.z) + 8);
      this.g.player.vel.set(0, 0, 0);
      this.g.fx.flash(this.g.player.center(), 0x9affd6, 8, 80);
      return;
    }
    if (this.powerCooldown > 0) return;
    this.powerCooldown = id === 'divine_bolt' ? 0.35 : 0.65;
    this.damageRival(DAMAGE[id] ?? 18);
  }

  damageRival(damage: number) {
    if (!this.active || !this.actor || damage <= 0) return;
    const actor = this.actor;
    actor.hp = Math.max(0, actor.hp - damage);
    hud.set({ warGodHp: actor.hp });
    this.g.fx.flash(actor.humanoid.root.position.clone().add(new THREE.Vector3(0, 5, 0)), actor.god.color2, 8 + damage * 0.14, 110);
    actor.aura.scale.set(9, 12, 9);
    this.g.audio.play('hit', -1, 1.1);
    this.g.shake(Math.min(0.5, damage / 100));
    if (actor.hp <= 0) this.victory();
  }

  update(dt: number) {
    if (!this.active || !this.actor) return;
    const actor = this.actor;
    this.elapsed += dt;
    this.guardTime = Math.max(0, this.guardTime - dt);
    this.powerCooldown = Math.max(0, this.powerCooldown - dt);
    this.attackCooldown -= dt;
    actor.humanoid.root.rotation.y = Math.atan2(this.g.player.pos.x - actor.humanoid.root.position.x, this.g.player.pos.z - actor.humanoid.root.position.z);
    actor.humanoid.head.rotation.y = Math.sin(this.elapsed * 2.4) * 0.06;
    const pulse = 1 + Math.sin(this.elapsed * 3) * 0.06;
    actor.aura.scale.set(8 * pulse, 11 * pulse, 8 * pulse);
    if (this.attackCooldown <= 0 && this.g.player.pos.distanceTo(actor.humanoid.root.position) < 190) {
      this.attackCooldown = 2.4;
      const damage = this.guardTime > 0 ? 3 : 12;
      this.g.fx.flash(this.g.player.center(), actor.god.color, 16, 130);
      this.g.player.hurt(damage);
      this.g.audio.play('smallboom', -1, 0.7);
      this.g.shake(0.22);
    }
  }

  playerDefeated() {
    if (!this.active) return;
    this.finish('defeat');
    this.g.player.hp = 100;
    this.g.player.pos.set(0, 90, 120);
    this.g.player.vel.set(0, 0, 0);
    this.g.toast('You were defeated. The rival god still rules this region.', '#ff7a7a');
  }

  private victory() {
    const actor = this.actor;
    if (!actor) return;
    hud.set({ warStatus: 'victory' });
    this.finish('victory');
    this.g.toast(`${actor.god.name} defeated — choose their fate to claim their powers and region`, '#ffe27a');
  }

  resolve(choice: 'imprisoned' | 'killed') {
    if (hud.get().warStatus !== 'victory' || !this.actor) return;
    const actor = this.actor;
    const name = actor.god.name;
    const state = hud.get();
    const unlockedPowers = [...new Set([...state.unlockedPowers, ...actor.god.powers])];
    const ownedRegions = [...new Set([...state.ownedRegions, actor.god.region])];
    const nextGod = RIVAL_GODS.find((god) => !ownedRegions.includes(god.region));
    hud.set({ unlockedPowers, ownedRegions, warChoice: choice, warStatus: 'idle', selectedGod: nextGod?.id ?? actor.god.id });
    if (choice === 'imprisoned') this.imprison(actor);
    else this.removeActor();
    this.g.toast(`${choice === 'imprisoned' ? `${name} imprisoned` : `${name} killed`} — ${actor.god.region} and all ${actor.god.powers.length} powers claimed`, choice === 'imprisoned' ? '#85caff' : '#ff7777');
  }

  private imprison(actor: RivalActor) {
    const cell = new THREE.Group();
    const x = 0, z = 45, y = this.g.terrain.heightAt(x, z);
    const steel = new THREE.MeshStandardMaterial({ color: 0x72809a, metalness: 0.8, roughness: 0.28 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x30374a, metalness: 0.25, roughness: 0.75 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), stone);
    base.position.y = 0.5;
    cell.add(base);
    for (let i = 0; i <= 6; i++) {
      const offset = -6 + i * 2;
      for (const zSide of [-6, 6]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8, 0.18), steel);
        bar.position.set(offset, 4.5, zSide);
        cell.add(bar);
      }
      for (const xSide of [-6, 6]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8, 0.18), steel);
        bar.position.set(xSide, 4.5, offset);
        cell.add(bar);
      }
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 14), steel);
    roof.position.y = 8.5;
    cell.add(roof);
    actor.humanoid.root.scale.setScalar(2.4);
    actor.humanoid.root.position.set(0, 1, 0);
    cell.add(actor.humanoid.root);
    cell.position.set(x, y, z);
    this.g.scene.add(cell);
    this.actor = null;
  }

  private finish(status: 'victory' | 'defeat') {
    this.g.player.invulnerable = this.wasInvulnerable;
    hud.set({ warActive: false, warStatus: status, warGodHp: status === 'victory' ? 0 : hud.get().warGodHp });
  }

  private removeActor() {
    if (!this.actor) return;
    this.g.scene.remove(this.actor.humanoid.root);
    this.actor = null;
  }
}
