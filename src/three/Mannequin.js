import * as THREE from 'three';
import { JOINTS, BODIES, createBones, getBodyGeometry } from './BodyMesh.js';

export { JOINTS };

/**
 * One articulated mannequin: a single seamless skinned mesh (see BodyMesh.js) on a 17-bone skeleton.
 * The figure faces +Z with its left side at +X.
 *
 * Rotation conventions (degrees, Euler XYZ, relative to standing with arms hanging down):
 *   limbs:  x+ swings back | x- swings forward | z+ toward +X (out for LEFT limbs, in for RIGHT)
 *   knees: x+ bends | elbows: x- bends forward
 *   spine/chest/neck/head: x+ leans forward | z+ leans to the figure's right | y+ turns to the figure's left
 */

export const JOINT_LABELS = {
  pelvis: 'Hips', spine: 'Waist', chest: 'Chest', neck: 'Neck', head: 'Head',
  shoulderL: 'L Shoulder', elbowL: 'L Elbow', wristL: 'L Hand',
  shoulderR: 'R Shoulder', elbowR: 'R Elbow', wristR: 'R Hand',
  hipL: 'L Hip', kneeL: 'L Knee', ankleL: 'L Foot',
  hipR: 'R Hip', kneeR: 'R Knee', ankleR: 'R Foot',
};

export const FIGURE_COLORS = ['#a7a2ec', '#d6c2ee', '#9fc3ee', '#eebcd0'];

const D2R = Math.PI / 180;

/** Glossy body material with a per-figure "selected joint" highlight driven by the aBone attribute. */
function bodyMaterial(color) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18,
    sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.45,
  });
  m.userData.hl = { value: -1 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHL = m.userData.hl;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBone;\nuniform float uHL;\nvarying float vHL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHL = abs(aBone - uHL) < 0.5 ? 1.0 : 0.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHL;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.42, 0.98), vHL * 0.85);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.28, 0.12, 0.6) * vHL;');
  };
  return m;
}

/** Inverted-hull outline material that follows skinning. */
function hullMaterial(color) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.userData.thickness = { value: 0.011 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uThick = m.userData.thickness;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uThick;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * uThick;');
  };
  return m;
}

export class Mannequin {
  constructor({ body = 'a', color, ghostly = false } = {}) {
    this.bodyKey = BODIES[body] ? body : 'a';
    const B = BODIES[this.bodyKey];
    this.root = new THREE.Group();
    this.root.name = 'figure';
    this.targets = {};
    this.props = [];
    this.mode = 'ghost';
    this.highlighted = null;
    this.ghostly = ghostly; // e.g. a mirror reflection: drawn translucent

    this.material = bodyMaterial(color || B.color);
    this.flatMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    if (ghostly) {
      Object.assign(this.material, { transparent: true, opacity: 0.42 });
      Object.assign(this.flatMaterial, { transparent: true, opacity: 0.38 });
    }
    this.hullMaterial = hullMaterial('#ffffff');

    const geometry = getBodyGeometry(this.bodyKey);
    const { bones, list } = createBones(B);
    this.joints = bones;
    const mesh = new THREE.SkinnedMesh(geometry, this.material);
    mesh.add(bones.pelvis);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.userData.figureMesh = true;
    this.root.add(mesh);
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(list);
    mesh.bind(this.skeleton); // bind pose = A-pose the geometry was sculpted in

    const hull = new THREE.SkinnedMesh(geometry, this.hullMaterial);
    hull.frustumCulled = false;
    hull.visible = false;
    hull.userData.isHull = true;
    hull.bind(this.skeleton, mesh.bindMatrix);
    this.root.add(hull);

    this.mesh = mesh;
    this.hull = hull;
    this.meshes = [mesh];
    for (const n of JOINTS) this.targets[n] = new THREE.Quaternion();
    this.setPose({}, true);
    this.root.scale.setScalar(B.scale);
  }

  setPose(spec = {}, instant = false) {
    const e = new THREE.Euler();
    for (const name of JOINTS) {
      const r = spec.joints?.[name] || [0, 0, 0];
      e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ');
      this.targets[name].setFromEuler(e);
      if (instant) this.joints[name].quaternion.copy(this.targets[name]);
    }
  }

  getJoint(name) {
    const e = new THREE.Euler().setFromQuaternion(this.targets[name], 'XYZ');
    return [e.x / D2R, e.y / D2R, e.z / D2R].map((v) => Math.round(v));
  }

  setJoint(name, rot, instant = true) {
    this.targets[name].setFromEuler(new THREE.Euler(rot[0] * D2R, rot[1] * D2R, rot[2] * D2R, 'XYZ'));
    if (instant) this.joints[name].quaternion.copy(this.targets[name]);
  }

  update(dt) {
    const k = 1 - Math.pow(0.0008, dt); // frame-rate independent easing
    let moving = false;
    for (const name of JOINTS) {
      const q = this.joints[name].quaternion;
      if (q.angleTo(this.targets[name]) > 0.0005) {
        q.slerp(this.targets[name], k);
        moving = true;
      }
    }
    return moving;
  }

  /** Lowest/highest skinned vertex positions in world space (sampled for speed). */
  worldBox(step = 6, box = new THREE.Box3()) {
    const v = new THREE.Vector3();
    const m = this.mesh;
    m.updateMatrixWorld(true);
    this.skeleton.update();
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += step) {
      m.getVertexPosition(i, v);
      v.applyMatrix4(m.matrixWorld);
      box.expandByPoint(v);
    }
    return box;
  }

  setMode(mode, color) {
    this.mode = mode;
    if (color) {
      this.flatMaterial.color.set(color);
      this.hullMaterial.color.set(color);
    }
    this.flatMaterial.colorWrite = mode !== 'outline';
    this.mesh.material = mode === 'ghost' ? this.material : this.flatMaterial;
    this.hull.visible = mode === 'outline';
    this.mesh.castShadow = mode === 'ghost' && !this.ghostly;
    this.hull.visible = mode === 'outline' && !this.ghostly;
    for (const p of this.props)
      p.traverse((o) => o.isMesh && (o.material = mode === 'ghost' ? o.userData.baseMat : this.flatMaterial));
  }

  /** Clip a reflection so it only shows inside the mirror glass (planes updated per frame by the stage). */
  setClipping(planes) {
    this.material.clippingPlanes = planes;
    this.flatMaterial.clippingPlanes = planes;
    this.material.needsUpdate = this.flatMaterial.needsUpdate = true;
  }

  setHighlight(joint) {
    this.highlighted = joint;
    this.material.userData.hl.value = joint ? JOINTS.indexOf(joint) : -1;
  }

  /** Which joint a raycast hit belongs to. */
  jointFromHit(hit) {
    const i = hit.face?.a;
    if (i == null) return null;
    return JOINTS[Math.round(this.mesh.geometry.attributes.aBone.getX(i))];
  }

  addProp(type, at) {
    const parent = this.joints[at];
    if (!parent) return;
    const g = makeProp(type);
    parent.add(g);
    this.props.push(g);
  }

  dispose() {
    // geometry is shared & cached per body type, so only materials are disposed
    [this.material, this.flatMaterial, this.hullMaterial].forEach((m) => m.dispose());
    this.props.forEach((p) => p.traverse((o) => o.isMesh && (o.geometry.dispose(), o.userData.baseMat?.dispose())));
  }
}

/* ------------------------------------ Props ------------------------------------ */
const pmat = (c, r = 0.4) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: 0.6, clearcoatRoughness: 0.3 });

export function makeProp(type) {
  const g = new THREE.Group();
  g.userData.prop = type;
  const add = (geo, m, p = [0, 0, 0], r = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(...p);
    mesh.rotation.set(r[0] * D2R, r[1] * D2R, r[2] * D2R);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.baseMat = m;
    g.add(mesh);
  };
  const rbox = (w, h, d, r = 0.01) => roundedBox(w, h, d, r);
  switch (type) {
    case 'phone':
      add(rbox(0.074, 0.152, 0.011, 0.008), pmat('#cfa9a2', 0.22), [0, -0.1, 0.036]);
      add(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 16), pmat('#3a3346', 0.2), [0.016, -0.045, 0.043], [90, 0, 0]);
      break;
    case 'bag':
      add(rbox(0.2, 0.15, 0.08, 0.02), pmat('#b8825a', 0.5), [0, -0.23, 0]);
      add(new THREE.TorusGeometry(0.06, 0.008, 10, 28, Math.PI), pmat('#8a5a36', 0.45), [0, -0.155, 0]);
      break;
    case 'cup':
      add(new THREE.CylinderGeometry(0.04, 0.031, 0.12, 24), pmat('#f3efe9', 0.5), [0, -0.09, 0.035]);
      add(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 24), pmat('#3b3240', 0.4), [0, -0.025, 0.035]);
      break;
    case 'flowers':
      add(new THREE.ConeGeometry(0.06, 0.25, 20), pmat('#a7c4a0', 0.6), [0, -0.12, 0.02], [180, 0, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.SphereGeometry(0.04, 16, 12), pmat(['#f4b6c2', '#fbe3a1', '#f7c6d9'][i % 3], 0.6), [Math.cos(a) * 0.05, -0.005, 0.02 + Math.sin(a) * 0.05]);
      }
      break;
    case 'sunglasses':
      for (const x of [-0.035, 0.035]) add(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 24), pmat('#1d1a24', 0.15), [x, 0, 0], [90, 0, 0]);
      add(new THREE.BoxGeometry(0.03, 0.005, 0.005), pmat('#1d1a24', 0.2), [0, 0.01, 0]);
      break;
    case 'wall':
      add(rbox(1.7, 2.3, 0.12, 0.02), pmat('#e9e3da', 0.85), [0, 1.15, 0]);
      add(rbox(1.7, 0.1, 0.16, 0.02), pmat('#d8d0c4', 0.8), [0, 0.05, 0.02]);
      break;
    case 'tree': {
      add(new THREE.CylinderGeometry(0.14, 0.2, 2.5, 24), pmat('#8c6a50', 0.9), [0, 1.25, 0]);
      add(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 12), pmat('#8c6a50', 0.9), [0.22, 2.25, 0], [0, 0, -38]);
      const leaf = pmat('#9fcb98', 0.75);
      [[0, 2.9, 0, 0.62], [0.45, 2.7, 0.1, 0.48], [-0.42, 2.75, -0.05, 0.5], [0.1, 3.25, -0.1, 0.45], [0, 2.75, 0.35, 0.42]].forEach(([x, y, z, r]) =>
        add(new THREE.SphereGeometry(r, 24, 18), leaf, [x, y, z]));
      break;
    }
    case 'mirror': {
      // hollow frame so the reflection behind the glass shows through
      const gold = pmat('#d8c39b', 0.3);
      add(rbox(0.74, 0.05, 0.05, 0.02), gold, [0, 1.825, 0]);
      add(rbox(0.74, 0.05, 0.05, 0.02), gold, [0, 0.075, 0]);
      add(rbox(0.05, 1.8, 0.05, 0.02), gold, [-0.345, 0.95, 0]);
      add(rbox(0.05, 1.8, 0.05, 0.02), gold, [0.345, 0.95, 0]);
      add(rbox(0.5, 0.04, 0.3, 0.01), gold, [0, 0.02, -0.08]);
      const glass = new THREE.MeshPhysicalMaterial({ color: '#e6edf7', metalness: 0.6, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false });
      add(new THREE.PlaneGeometry(0.64, 1.7), glass, [0, 0.95, 0]);
      g.children[g.children.length - 1].userData.glass = { w: 0.64, h: 1.7 };
      g.children[g.children.length - 1].castShadow = false;
      break;
    }
    case 'book':
      add(rbox(0.16, 0.22, 0.026, 0.006), pmat('#d9b98f', 0.55), [-0.06, -0.1, 0.07], [-20, 0, 80]);
      add(rbox(0.15, 0.21, 0.03, 0.004), pmat('#fbf7ef', 0.7), [-0.06, -0.1, 0.085], [-20, 0, 80]);
      break;
    case 'stool':
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 40), pmat('#e9e4f2', 0.35), [0, 0.385, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 12), pmat('#cfc6e0', 0.35), [Math.cos(a) * 0.11, 0.19, Math.sin(a) * 0.11], [Math.sin(a) * -8, 0, Math.cos(a) * 8]);
      }
      break;
    case 'bench':
      add(rbox(1.5, 0.05, 0.42, 0.02), pmat('#e9e4f2', 0.4), [0, 0.395, 0]);
      for (const x of [-0.62, 0.62]) add(rbox(0.06, 0.37, 0.36, 0.015), pmat('#cfc6e0', 0.4), [x, 0.185, 0]);
      break;
    default:
      break;
  }
  return g;
}

function roundedBox(w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const bev = Math.min(r, d / 2) * 0.9;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.6, bevelSegments: 4, curveSegments: 6 });
  geo.translate(0, 0, -(d - bev * 2) / 2);
  return geo;
}
