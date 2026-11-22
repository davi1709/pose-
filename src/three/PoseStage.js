import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Mannequin, FIGURE_COLORS, JOINTS, makeProp } from './Mannequin.js';

const D2R = Math.PI / 180;

/** A scene holding one pose (1..n mannequins + props), shared by the viewer, overlay and thumbnails. */
export class PoseStage {
  constructor({ shadows = true } = {}) {
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.propGroup = new THREE.Group();
    this.group.add(this.propGroup);
    this.propKey = '';
    this.ghostPropMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    this.figures = [];
    this.mode = 'ghost';
    this.modeColor = '#ffffff';
    this.showGround = true;

    const hemi = new THREE.HemisphereLight('#f4f0ff', '#3b3450', 0.8);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffffff', 1.9);
    key.position.set(2.5, 4, 3);
    key.castShadow = shadows;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.5, far: 12 });
    key.shadow.bias = -0.0005;
    key.shadow.radius = 6;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#c4b5fd', 1.6);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(3, 48).rotateX(-Math.PI / 2),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  attachEnvironment(renderer) {
    if (this.scene.environment) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();
  }

  setPose(pose, { instant = false } = {}) {
    const specs = pose?.figures || [];
    const sameRig =
      this.figures.length === specs.length &&
      specs.every((s, i) => this.figures[i].bodyKey === (s.body || 'a') && sameProps(this.figures[i].propSpec, s.props));

    if (!sameRig) {
      this.figures.forEach((f) => {
        this.group.remove(f.root);
        f.dispose();
      });
      this.figures = specs.map((s, i) => {
        const m = new Mannequin({ body: s.body || 'a', color: s.color || (i >= 2 && s.body !== 'c' ? FIGURE_COLORS[i % FIGURE_COLORS.length] : undefined) });
        m.propSpec = s.props;
        (s.props || []).forEach((p) => m.addProp(p.type, p.at));
        this.group.add(m.root);
        return m;
      });
      instant = true;
    }
    // stage-level props (stools, benches)
    const pk = JSON.stringify(pose?.props || []);
    if (pk !== this.propKey) {
      this.propKey = pk;
      this.propGroup.clear();
      for (const pr of pose?.props || []) {
        const g = makeProp(pr.type);
        g.position.set(pr.pos?.[0] || 0, 0, pr.pos?.[1] || 0);
        g.rotation.y = (pr.rotY || 0) * D2R;
        this.propGroup.add(g);
      }
    }
    specs.forEach((s, i) => {
      const f = this.figures[i];
      f.setPose(s, instant);
      f.root.position.set(s.pos?.[0] || 0, (s.lift || 0), s.pos?.[1] || 0);
      f.root.rotation.y = (s.rotY || 0) * D2R;
      groundFigure(f, s.lift || 0);
      f.setMode(this.mode, this.modeColor);
    });
    this.pose = pose;
  }

  setMode(mode, color) {
    this.mode = mode;
    this.modeColor = color || this.modeColor;
    this.ground.visible = this.showGround && mode === 'ghost';
    this.figures.forEach((f) => f.setMode(mode, this.modeColor));
    this.ghostPropMat.color.set(this.modeColor);
    this.propGroup.traverse((o) => o.isMesh && (o.material = mode === 'ghost' ? o.userData.baseMat : this.ghostPropMat));
  }

  update(dt) {
    let moving = false;
    for (const f of this.figures) moving = f.update(dt) || moving;
    return moving;
  }

  /** World-space bounding box using target pose (snaps first so framing is stable). */
  bounds() {
    const box = new THREE.Box3();
    this.group.updateMatrixWorld(true);
    for (const f of this.figures) {
      f.worldBox(5, box);
      for (const p of f.props) box.expandByObject(p);
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 1.8, 0.3));
    return box;
  }

  /** Point a perspective camera so the pose fills `fill` of the frame height. */
  frame(camera, { fill = 0.86, azimuth = 0, elevation = 4 } = {}) {
    const box = this.bounds();
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fov = camera.fov * D2R;
    const hFov = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
    const distH = size.y / fill / 2 / Math.tan(fov / 2);
    const distW = Math.max(size.x, size.z) / fill / 2 / Math.tan(hFov / 2);
    const dist = Math.max(distH, distW) + size.z / 2;
    const az = azimuth * D2R;
    const el = elevation * D2R;
    camera.position.set(
      center.x + Math.sin(az) * Math.cos(el) * dist,
      center.y + Math.sin(el) * dist,
      center.z + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    return { center, dist };
  }
}

/** Plant the target pose's lowest point on y=0 (plus optional lift for jumps). */
function groundFigure(f, lift) {
  const saved = JOINTS.map((n) => f.joints[n].quaternion.clone());
  JOINTS.forEach((n) => f.joints[n].quaternion.copy(f.targets[n]));
  f.root.position.y = 0;
  f.root.updateMatrixWorld(true);
  const box = f.worldBox(4);
  JOINTS.forEach((n, i) => f.joints[n].quaternion.copy(saved[i]));
  f.root.position.y = -box.min.y + lift;
}

function sameProps(a = [], b = []) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

/* ---------- Thumbnail factory: one shared offscreen renderer for the whole library ---------- */
let thumbCtx = null;
const thumbCache = new Map();
const thumbKey = (pose) => pose.id + ':' + (pose.updatedAt || 0);
export const cachedThumbnail = (pose) => thumbCache.get(thumbKey(pose));

export function renderThumbnail(pose, { w = 360, h = 460 } = {}) {
  const key = thumbKey(pose);
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (!thumbCtx) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const stage = new PoseStage();
    stage.attachEnvironment(renderer);
    const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
    thumbCtx = { renderer, stage, camera };
  }
  const { renderer, stage, camera } = thumbCtx;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  stage.setPose(pose, { instant: true });
  stage.setMode('ghost');
  stage.frame(camera, { fill: 0.84, azimuth: pose.view?.azimuth ?? 14, elevation: 6 });
  renderer.setClearColor(0x000000, 0);
  renderer.render(stage.scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}
