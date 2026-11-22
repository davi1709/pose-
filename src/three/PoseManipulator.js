import * as THREE from 'three';
import { JOINTS } from './BodyMesh.js';

/**
 * Direct manipulation for the editor: grab the mannequin with a finger or the mouse.
 *
 *  • Dots on the joints:
 *      hands & feet  → 2-bone IK (drag the hand and the shoulder + elbow follow)
 *      elbows/knees  → swing the upper limb
 *      hand/toe tips → bend the wrist / ankle
 *      head top      → nod / turn the head        neck dot → bend the torso
 *      hips dot      → slide the whole person across the floor
 *  • Grab anywhere else on the body → that body part rotates to follow your finger.
 *  • Tap a body part → select it (for the precise sliders).
 *  • Drag empty space → orbit the camera (OrbitControls), as before.
 */

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

// handle id → where it sits (bone + local offset) and what it drives
const HANDLES = [
  { id: 'pelvis', bone: 'pelvis', at: [0, 0, 0], kind: 'move', color: '#fbbf24', r: 0.034 },
  { id: 'neck', bone: 'neck', at: [0, 0, 0], kind: 'aim', drive: 'spine' },
  { id: 'headTop', bone: 'head', at: [0, 0.24, 0.01], kind: 'aim', drive: 'neck' },
  ...['L', 'R'].flatMap((s) => [
    { id: 'elbow' + s, bone: 'elbow' + s, at: [0, 0, 0], kind: 'aim', drive: 'shoulder' + s },
    { id: 'wrist' + s, bone: 'wrist' + s, at: [0, 0, 0], kind: 'ik', upper: 'shoulder' + s, lower: 'elbow' + s, color: '#a78bfa', r: 0.03 },
    { id: 'hand' + s, bone: 'wrist' + s, at: [0, -0.13, 0], kind: 'aim', drive: 'wrist' + s, r: 0.018 },
    { id: 'knee' + s, bone: 'knee' + s, at: [0, 0, 0], kind: 'aim', drive: 'hip' + s },
    { id: 'ankle' + s, bone: 'ankle' + s, at: [0, 0, 0], kind: 'ik', upper: 'hip' + s, lower: 'knee' + s, color: '#a78bfa', r: 0.03 },
    { id: 'toe' + s, bone: 'ankle' + s, at: [0, -0.05, 0.16], kind: 'aim', drive: 'ankle' + s, r: 0.018 },
  ]),
];
// a body-part grab rotates the bone that owns that part
const BODY_DRIVE = { pelvis: 'spine', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head' };

export class PoseManipulator {
  constructor(sr, { onCommit, onSelect, onDragStart } = {}) {
    this.sr = sr;
    this.onCommit = onCommit;
    this.onSelect = onSelect;
    this.onDragStart = onDragStart;
    this.enabled = true;
    this.handleSets = new Map(); // figure → [{ def, mesh }]
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane();
    this.drag = null;

    const geo = new THREE.SphereGeometry(1, 16, 12);
    this.geo = geo;
    this.mats = {};
    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    const c = sr.canvas;
    c.addEventListener('pointerdown', this._down, { capture: true });
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerup', this._up);
    c.addEventListener('pointercancel', this._up);
    this.sync();
  }

  mat(color) {
    if (!this.mats[color])
      this.mats[color] = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.92 });
    return this.mats[color];
  }

  /** (Re)create the dots when figures are added, removed or rebuilt. */
  sync() {
    const figs = this.sr.stage.figures;
    for (const [f, set] of this.handleSets) {
      if (!figs.includes(f)) {
        set.forEach((h) => h.mesh.removeFromParent());
        this.handleSets.delete(f);
      }
    }
    for (const f of figs) {
      if (this.handleSets.has(f)) continue;
      const set = HANDLES.map((def) => {
        const m = new THREE.Mesh(this.geo, this.mat(def.color || '#ffffff'));
        m.scale.setScalar((def.r || 0.024) / f.root.scale.x);
        m.position.set(...def.at);
        m.renderOrder = 999;
        m.userData.isHandle = true;
        m.visible = this.enabled;
        f.joints[def.bone].add(m);
        return { def, mesh: m };
      });
      this.handleSets.set(f, set);
    }
    this.sr.invalidate();
  }

  setEnabled(on) {
    this.enabled = on;
    for (const set of this.handleSets.values()) set.forEach((h) => (h.mesh.visible = on));
    this.sr.invalidate();
  }

  _ndc(e) {
    const r = this.sr.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  /** Nearest dot within ~26 px of the pointer (finger-friendly). */
  _pickHandle(e) {
    if (!this.enabled) return null;
    const r = this.sr.canvas.getBoundingClientRect();
    let best = null, bestD = 26;
    for (const [f, set] of this.handleSets) {
      for (const h of set) {
        h.mesh.getWorldPosition(_v).project(this.sr.camera);
        const x = ((_v.x + 1) / 2) * r.width + r.left, y = ((1 - _v.y) / 2) * r.height + r.top;
        const d = Math.hypot(x - e.clientX, y - e.clientY);
        if (d < bestD) (bestD = d), (best = { f, h });
      }
    }
    return best;
  }

  _down(e) {
    if (e.button > 0 || !this.sr.stage.figures.length) return;
    const handle = this._pickHandle(e);
    let hit = null;
    if (!handle) {
      this.ray.setFromCamera(this._ndc(e), this.sr.camera);
      const meshes = this.sr.stage.figures.map((f) => ((f.mesh.boundingSphere = null), f.mesh));
      const h = this.ray.intersectObjects(meshes, false)[0];
      if (h) {
        const f = this.sr.stage.figures.find((x) => x.mesh === h.object);
        hit = { f, joint: f.jointFromHit(h), point: h.point.clone() };
      }
    }
    if (!handle && !hit) return; // empty space → let OrbitControls orbit
    e.stopImmediatePropagation();
    if (this.sr.controls) this.sr.controls.enabled = false;
    this.sr.canvas.setPointerCapture(e.pointerId);

    const f = handle ? handle.f : hit.f;
    const grabWorld = handle ? handle.h.mesh.getWorldPosition(new THREE.Vector3()) : hit.point;
    const camDir = this.sr.camera.getWorldDirection(new THREE.Vector3());
    this.plane.setFromNormalAndCoplanarPoint(camDir, grabWorld);

    let mode, drive, local;
    if (handle) {
      const d = handle.h.def;
      mode = d.kind;
      drive = d.drive || d.upper;
      this.def = d;
      if (mode === 'aim') local = f.joints[drive].worldToLocal(grabWorld.clone());
      handle.h.mesh.scale.multiplyScalar(1.5);
      this.activeHandle = handle.h;
    } else {
      // grabbing a body part: rotate the bone that owns it about its own joint
      mode = 'aim';
      drive = BODY_DRIVE[hit.joint] || hit.joint;
      local = f.joints[drive].worldToLocal(grabWorld.clone());
      this.def = null;
    }
    const fi = this.sr.stage.figures.indexOf(f);
    this.drag = {
      f, fi, mode, drive, local, start: { x: e.clientX, y: e.clientY }, moved: false,
      joint: handle ? handle.h.def.bone : hit.joint,
      offset: handle && mode === 'ik' ? new THREE.Vector3() : null,
      floorY: f.root.position.y, rootStart: f.root.position.clone(), grabStart: grabWorld.clone(),
    };
  }

  _move(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) < 5) return;
    if (!d.moved) {
      d.moved = true;
      this.onDragStart?.();
    }
    this.ray.setFromCamera(this._ndc(e), this.sr.camera);
    const T = new THREE.Vector3();
    if (d.mode === 'move') {
      // slide on the floor plane at hip height
      const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -d.grabStart.y);
      if (!this.ray.ray.intersectPlane(floor, T)) return;
      d.f.root.position.x = d.rootStart.x + (T.x - d.grabStart.x);
      d.f.root.position.z = d.rootStart.z + (T.z - d.grabStart.z);
    } else {
      if (!this.ray.ray.intersectPlane(this.plane, T)) return;
      const J = d.f.joints;
      if (d.mode === 'aim') {
        const bone = J[d.drive];
        aim(bone, bone.localToWorld(d.local.clone()), T);
      } else {
        solveTwoBone(J[this.def.upper], J[this.def.lower], J[this.def.bone], T, this.def.upper.startsWith('hip'));
      }
    }
    // keep animation targets in sync so nothing springs back
    for (const n of JOINTS) d.f.targets[n].copy(d.f.joints[n].quaternion);
    this.sr.invalidate();
  }

  _up(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (this.sr.controls) this.sr.controls.enabled = true;
    try {
      this.sr.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (this.activeHandle) {
      this.activeHandle.mesh.scale.multiplyScalar(1 / 1.5);
      this.activeHandle = null;
    }
    if (!d.moved) {
      this.onSelect?.({ figure: d.fi, joint: d.joint });
      this.sr.invalidate();
      return;
    }
    // read the rig back into pose data
    const joints = {};
    const D = 180 / Math.PI;
    for (const n of JOINTS) {
      const eul = new THREE.Euler().setFromQuaternion(d.f.joints[n].quaternion, 'XYZ');
      joints[n] = [eul.x * D, eul.y * D, eul.z * D].map((v) => Math.round(v));
    }
    this.onCommit?.({
      figure: d.fi,
      joints,
      pos: d.mode === 'move' ? [+d.f.root.position.x.toFixed(3), +d.f.root.position.z.toFixed(3)] : null,
      joint: d.mode === 'move' ? null : d.drive || d.joint,
    });
  }

  dispose() {
    const c = this.sr.canvas;
    c.removeEventListener('pointerdown', this._down, { capture: true });
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._up);
    for (const set of this.handleSets.values()) set.forEach((h) => h.mesh.removeFromParent());
    this.geo.dispose();
    Object.values(this.mats).forEach((m) => m.dispose());
  }
}

/** Rotate `bone` (about its own joint) so the world point `from` swings toward `to`. */
function aim(bone, from, to) {
  const P = bone.getWorldPosition(new THREE.Vector3());
  const a = from.clone().sub(P);
  const b = to.clone().sub(P);
  if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return;
  const delta = _q.setFromUnitVectors(a.normalize(), b.normalize());
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(delta.clone().multiply(world)));
  bone.updateMatrixWorld(true);
}

/** Analytic two-bone IK that keeps the current bend direction (elbows stay elbows, knees stay knees). */
function solveTwoBone(upper, lower, end, target, isLeg) {
  const S = upper.getWorldPosition(new THREE.Vector3());
  const E = lower.getWorldPosition(new THREE.Vector3());
  const W = end.getWorldPosition(new THREE.Vector3());
  const a = S.distanceTo(E), b = E.distanceTo(W);
  const toT = target.clone().sub(S);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = toT.normalize();
  // bend side: where the joint currently points, or a sensible default when straight
  let perp = E.clone().sub(S);
  perp.sub(dir.clone().multiplyScalar(perp.dot(dir)));
  if (perp.lengthSq() < 1e-6) {
    const fwd = new THREE.Vector3(0, 0, isLeg ? 1 : -1).applyQuaternion(upper.parent.getWorldQuaternion(new THREE.Quaternion()));
    perp = fwd.sub(dir.clone().multiplyScalar(fwd.dot(dir)));
  }
  perp.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const E2 = S.clone().addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA);
  aim(upper, E, E2);
  const W2 = end.getWorldPosition(new THREE.Vector3());
  aim(lower, W2, S.clone().addScaledVector(dir, d));
}
