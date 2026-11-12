import * as THREE from "three";

export interface Scene3D {
  update(dt: number): void;
  render(r: THREE.WebGLRenderer, w: number, h: number): void;
  dispose(): void;
}

class Host {
  canvas!: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  current: Scene3D | null = null;
  last = 0;
  fps = 60;
  res = 1;
  running = false;
  w = 1;
  h = 1;
  pixelRatio = 1;
  private frameTimes: number[] = [];

  init(container: HTMLElement) {
    if (this.renderer) return;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    container.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = false;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frameTimes.push(dt);
      if (this.frameTimes.length > 30) this.frameTimes.shift();
      this.fps = 1 / (this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length);
      if (this.current) {
        this.current.update(dt);
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(0, 0, this.w, this.h);
        this.renderer.clear();
        this.current.render(this.renderer, this.w, this.h);
      }
    };
    requestAnimationFrame(loop);
  }
  setResolution(scale: number) {
    this.res = scale;
    this.resize();
  }
  resize() {
    if (!this.renderer) return;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * this.res;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.w, this.h, false);
  }
  setScene(s: Scene3D | null) {
    if (this.current && this.current !== s) this.current.dispose();
    this.current = s;
  }
}
export const host = new Host();
