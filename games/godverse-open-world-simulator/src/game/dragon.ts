import * as THREE from 'three';
import type { Game } from './engine';

const TARGET = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
const VELOCITY = new THREE.Vector3();

export class ShadowDragon {
  root = new THREE.Group();
  active = false;
  cooldown = 0;
  private leftWing = new THREE.Group();
  private rightWing = new THREE.Group();
  private readonly playerWasVisible: boolean;
  private readonly scales: THREE.MeshStandardMaterial;
  private readonly glow: THREE.MeshBasicMaterial;

  constructor(private g: Game) {
    this.playerWasVisible = g.player.root.visible;
    this.scales = new THREE.MeshStandardMaterial({
      color: 0x171020, roughness: 0.43, metalness: 0.32,
      emissive: 0x230b3b, emissiveIntensity: 0.55,
    });
    this.glow = new THREE.MeshBasicMaterial({ color: 0xc07aff });
    this.build();
    this.root.visible = false;
    g.scene.add(this.root);
  }

  private build() {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.scales);
    body.scale.set(1.05, 0.75, 2.45);
    body.position.y = -1.3;
    this.root.add(body);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 12), this.scales);
    chest.scale.set(0.95, 0.9, 0.9);
    chest.position.set(0, -0.75, -1.25);
    this.root.add(chest);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.5, 10), this.scales);
    neck.rotation.x = Math.PI / 2.8;
    neck.position.set(0, -0.5, -2.05);
    this.root.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 10), this.scales);
    head.scale.set(0.8, 0.75, 1.25);
    head.position.set(0, -0.05, -2.85);
    this.root.add(head);

    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.85, 7), this.scales);
      horn.position.set(side * 0.32, 0.36, -2.7);
      horn.rotation.z = side * 0.45;
      this.root.add(horn);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), this.glow);
      eye.position.set(side * 0.37, 0.02, -3.2);
      this.root.add(eye);

      const wing = side < 0 ? this.leftWing : this.rightWing;
      wing.position.set(side * 0.72, -0.7, -0.85);
      wing.rotation.y = side * 0.18;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(side * 1.5, 0.5, side * 3.2, 0.75);
      shape.lineTo(side * 2.25, -0.25);
      shape.lineTo(side * 2.55, -0.95);
      shape.lineTo(side * 1.55, -0.55);
      shape.lineTo(side * 1.25, -1.25);
      shape.lineTo(side * 0.6, -0.72);
      shape.closePath();
      const membrane = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({
          color: 0x251137, emissive: 0x3e1761, emissiveIntensity: 0.5,
          side: THREE.DoubleSide, transparent: true, opacity: 0.94,
        }),
      );
      wing.add(membrane);
      this.root.add(wing);
    }

    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18 - i * 0.018, 0.65, 6), this.scales);
      spike.position.set(0, -0.65, 0.2 + i * 0.72);
      spike.rotation.x = Math.PI;
      this.root.add(spike);
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 3.0, 8), this.scales);
    tail.position.set(0, -1.4, 3.4);
    tail.rotation.x = -Math.PI / 2;
    this.root.add(tail);

    const saddle = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.16, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x8c5a35, roughness: 0.7 }),
    );
    saddle.position.set(0, -0.43, -0.15);
    this.root.add(saddle);
  }

  summon() {
    this.active = true;
    this.root.visible = true;
    this.g.player.root.visible = true;
    this.g.player.setFlying(true);
    this.g.toast('Shadow Dragon summoned — click to breathe fire, G to dismount', '#c99aff');
    this.g.audio.play('whoosh');
  }

  dismiss() {
    if (!this.active) return;
    this.active = false;
    this.root.visible = false;
    this.g.player.root.visible = this.playerWasVisible;
    this.g.toast('You dismounted the Shadow Dragon', '#c99aff');
  }

  use() {
    if (!this.active) {
      this.summon();
      return;
    }
    if (this.cooldown > 0) return;
    this.cooldown = 0.9;
    const aim = this.g.aim;
    TARGET.copy(aim.point);
    if (aim.hit === 'sky') TARGET.y = Math.max(this.g.terrain.heightAt(TARGET.x, TARGET.z), this.g.ocean.level) + 1;
    ORIGIN.copy(this.g.player.pos).add(new THREE.Vector3(0, 0.1, 0)).add(
      VELOCITY.set(-Math.sin(this.g.input.yaw), 0, -Math.cos(this.g.input.yaw)).multiplyScalar(3.2),
    );
    const distance = ORIGIN.distanceTo(TARGET);
    VELOCITY.copy(TARGET).sub(ORIGIN).normalize();
    for (let i = 0; i < 42; i++) {
      const t = (i / 42) * Math.min(distance, 110);
      const p = ORIGIN.clone().addScaledVector(VELOCITY, t);
      this.g.fx.flame(p, VELOCITY.clone().multiplyScalar(45), 1.1 + t * 0.012, 0.45);
    }
    this.g.explode(TARGET, 27, {
      force: 65, crater: 0.35, pal: this.g.player.palette,
      fire: true, sound: true, big: true,
    });
    this.g.toast('Shadow Dragon: Cinder Breath', '#c99aff');
  }

  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.active) return;
    this.root.position.copy(this.g.player.pos);
    this.root.rotation.y = this.g.input.yaw;
    const flap = Math.sin(this.g.clock * 7) * 0.32;
    this.leftWing.rotation.z = flap;
    this.rightWing.rotation.z = -flap;
    this.root.position.y += Math.sin(this.g.clock * 2.5) * 0.22;
  }
}
