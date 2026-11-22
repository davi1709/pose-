import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PoseStage } from './PoseStage.js';

/**
 * Owns a WebGL renderer + PoseStage bound to a <canvas>. Renders on demand only
 * (when a pose animates, controls move, or something calls invalidate()) to save battery.
 */
export class StageRenderer {
  constructor(canvas, { orbit = false, ground = true, preserve = false, fov = 30, fill = 0.84, autoRotate = false } = {}) {
    this.canvas = canvas;
    this.fill = fill;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = ground;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.stage = new PoseStage({ shadows: ground });
    this.stage.showGround = ground;
    this.stage.ground.visible = ground;
    this.stage.attachEnvironment(this.renderer);
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 60);
    this.view = { azimuth: 0, elevation: 4 };

    if (orbit) {
      const c = new OrbitControls(this.camera, canvas);
      c.enableDamping = true;
      c.dampingFactor = 0.08;
      c.enablePan = false;
      c.rotateSpeed = 0.8;
      c.minPolarAngle = 0.25;
      c.maxPolarAngle = Math.PI / 2 + 0.12;
      c.autoRotate = autoRotate;
      c.autoRotateSpeed = 1.2;
      c.addEventListener('start', () => {
        c.autoRotate = false;
        this.onInteract?.();
      });
      c.addEventListener('change', () => this.invalidate());
      this.controls = c;
    }

    this.needsRender = true;
    this._last = performance.now();
    this._resize = new ResizeObserver(() => this.resize());
    this._resize.observe(canvas.parentElement || canvas);
    this.resize();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  invalidate() {
    this.needsRender = true;
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.stage.pose) this.reframe();
    this.invalidate();
  }

  setPose(pose, { instant = false, reframe = true } = {}) {
    this.stage.setPose(pose, { instant });
    if (reframe) this.reframe(pose?.view);
    this.invalidate();
  }

  reframe(view) {
    if (view) this.view = { azimuth: view.azimuth ?? 0, elevation: view.elevation ?? 4 };
    const { center, dist } = this.stage.frame(this.camera, { fill: this.fill, ...this.view });
    if (this.controls) {
      this.controls.target.copy(center);
      this.controls.minDistance = dist * 0.45;
      this.controls.maxDistance = dist * 2.2;
      this.controls.update();
    }
    this.invalidate();
  }

  setMode(mode, color) {
    this.stage.setMode(mode, color);
    this.invalidate();
  }

  setAutoRotate(on) {
    if (this.controls) this.controls.autoRotate = on;
    this.invalidate();
  }

  /** Raycast from a client point → { figure index, joint name } or null. */
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const meshes = this.stage.figures.map((f, i) => {
      f.mesh.userData.fig = i;
      f.mesh.boundingSphere = null; // recompute for the current pose
      return f.mesh;
    });
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const i = hit.object.userData.fig;
    return { figure: i, joint: this.stage.figures[i].jointFromHit(hit) };
  }

  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (document.hidden) return;
    let dirty = this.needsRender;
    if (this.stage.update(dt)) dirty = true;
    if (this.controls && this.controls.update()) dirty = true;
    if (this.controls?.autoRotate) dirty = true;
    if (dirty) {
      this.renderer.render(this.stage.scene, this.camera);
      this.needsRender = false;
      this.onRender?.();
    }
  }

  /** Render immediately (used before reading pixels for capture). */
  renderNow() {
    this.renderer.render(this.stage.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._resize.disconnect();
    this.controls?.dispose();
    this.stage.figures.forEach((f) => f.dispose());
    this.renderer.dispose();
  }
}
