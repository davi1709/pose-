import * as THREE from 'three';

/**
 * Sculpted, seamless mannequin body.
 *
 * The body is described as a signed distance field: ellipsoids and tapered capsules
 * blended with smooth-min, like clay. It is meshed once per body type with Surface Nets,
 * using analytic SDF normals for glassy-smooth shading, then skinned to a 17-bone skeleton
 * with soft distance-based weights. Result: one continuous mesh per figure, no seams,
 * no hard edges, and it bends at the joints like a real artist's mannequin.
 */

export const JOINTS = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR',
];
const PARENT = {
  pelvis: null, spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck',
  shoulderL: 'chest', elbowL: 'shoulderL', wristL: 'elbowL', shoulderR: 'chest', elbowR: 'shoulderR', wristR: 'elbowR',
  hipL: 'pelvis', kneeL: 'hipL', ankleL: 'kneeL', hipR: 'pelvis', kneeR: 'hipR', ankleR: 'kneeR',
};

export const BODIES = {
  // A: broader shoulders, straighter waist   B: narrower shoulders, defined waist, fuller hips
  a: { scale: 1.0, shoulder: 0.185, hip: 0.09, chest: [0.165, 0.165, 0.112], pelvis: [0.148, 0.11, 0.104], waist: 0.104, arm: 0.046, thigh: 0.079, color: '#a7a2ec', bust: 'pecs' },
  b: { scale: 0.94, shoulder: 0.16, hip: 0.097, chest: [0.142, 0.155, 0.106], pelvis: [0.162, 0.118, 0.112], waist: 0.084, arm: 0.039, thigh: 0.083, color: '#d6c2ee', bust: 'bust' },
  // C: child, about 1.1 m tall, with a proportionally larger head and softer limbs
  c: { scale: 0.62, shoulder: 0.16, hip: 0.09, chest: [0.15, 0.15, 0.115], pelvis: [0.145, 0.11, 0.105], waist: 0.11, arm: 0.05, thigh: 0.087, color: '#f3c9b3', bust: 'none', head: 1.38 },
};

/** Bind pose: arms in an A-pose and legs slightly apart, so limbs never fuse when meshing. */
const BIND_ROT = { shoulderL: [0, 0, 42], shoulderR: [0, 0, -42], hipL: [0, 0, 3], hipR: [0, 0, -3] };

export function jointOffsets(B) {
  return {
    pelvis: [0, 0.98, 0], spine: [0, 0.06, 0], chest: [0, 0.18, 0], neck: [0, 0.27, 0], head: [0, 0.09, 0],
    shoulderL: [B.shoulder, 0.22, -0.005], elbowL: [0, -0.28, 0], wristL: [0, -0.25, 0],
    shoulderR: [-B.shoulder, 0.22, -0.005], elbowR: [0, -0.28, 0], wristR: [0, -0.25, 0],
    hipL: [B.hip, -0.04, 0], kneeL: [0, -0.44, 0], ankleL: [0, -0.43, 0],
    hipR: [-B.hip, -0.04, 0], kneeR: [0, -0.44, 0], ankleR: [0, -0.43, 0],
  };
}

/** Creates bones (in bind pose) for a body. Returns { bones: {name: Bone}, list: Bone[] } */
export function createBones(B) {
  const off = jointOffsets(B);
  const bones = {};
  const D = Math.PI / 180;
  for (const n of JOINTS) {
    const b = new THREE.Bone();
    b.name = n;
    b.position.set(...off[n]);
    const r = BIND_ROT[n] || [0, 0, 0];
    b.rotation.set(r[0] * D, r[1] * D, r[2] * D);
    bones[n] = b;
    if (PARENT[n]) bones[PARENT[n]].add(b);
  }
  return { bones, list: JOINTS.map((n) => bones[n]) };
}

/* ------------------------------------------------------------------ */
/*  Body description: parts in bone-local space, grouped for blending  */
/* ------------------------------------------------------------------ */
function bodyParts(B) {
  const s = B.thigh / 0.08;
  const P = [];
  const ell = (bone, group, c, r) => P.push({ bone, group, t: 0, c, r });
  const cone = (bone, group, a, b, r1, r2) => P.push({ bone, group, t: 1, a, b, r1, r2 });

  // torso
  ell('pelvis', 'torso', [0, -0.02, -0.005], B.pelvis);
  for (const x of [1, -1]) ell('pelvis', 'torso', [x * 0.066, -0.06, -0.045], [0.074, 0.082, 0.07].map((v) => v * (B.bust === 'bust' ? 1.08 : 1)));
  ell('spine', 'torso', [0, 0.1, 0], [B.waist * 1.3, 0.15, B.waist * 0.9]);
  ell('chest', 'torso', [0, 0.13, 0], B.chest);
  if (B.bust === 'bust') for (const x of [1, -1]) ell('chest', 'torso', [x * 0.062, 0.1, 0.058], [0.06, 0.056, 0.05]);
  else if (B.bust === 'none') { /* child: no chest shaping */ }
  else for (const x of [1, -1]) ell('chest', 'torso', [x * 0.072, 0.15, 0.048], [0.074, 0.058, 0.046]);
  cone('chest', 'torso', [-B.shoulder * 0.78, 0.212, -0.012], [B.shoulder * 0.78, 0.212, -0.012], 0.05, 0.05);
  // neck + head
  cone('neck', 'head', [0, -0.03, 0], [0, 0.12, 0.005], 0.047, 0.042);
  const H = B.head || 1;
  ell('head', 'head', [0, 0.115 * H, 0.012], [0.087 * H, 0.117 * H, 0.099 * H]);
  ell('head', 'head', [0, 0.062 * H, 0.042 * H], [0.058 * H, 0.05 * H, 0.06 * H]);
  for (const side of ['L', 'R']) {
    const g = 'arm' + side;
    ell('shoulder' + side, g, [0, -0.01, 0], [B.arm * 1.25, B.arm * 1.35, B.arm * 1.2]);
    cone('shoulder' + side, g, [0, 0, 0], [0, -0.28, 0], B.arm, B.arm * 0.78);
    cone('elbow' + side, g, [0, 0, 0], [0, -0.245, 0], B.arm * 0.8, B.arm * 0.56);
    ell('wrist' + side, g, [0, -0.07, 0.004], [0.02, 0.07, 0.043]);
    cone('wrist' + side, g, [0, -0.03, 0.035], [0, -0.075, 0.05], 0.014, 0.011); // thumb
    const l = 'leg' + side;
    cone('hip' + side, l, [0, 0.01, 0], [0, -0.44, 0], B.thigh, B.thigh * 0.6);
    cone('knee' + side, l, [0, 0, 0], [0, -0.43, 0], B.thigh * 0.62, B.thigh * 0.4);
    ell('knee' + side, l, [0, -0.14, -0.018], [0.047 * s, 0.11, 0.05 * s]); // calf
    ell('ankle' + side, l, [0, -0.045, 0.055], [0.04, 0.032, 0.112]);
    ell('ankle' + side, l, [0, -0.035, -0.012], [0.037, 0.04, 0.042]); // heel
  }
  return P;
}

const BLEND = { torso: 0.055, head: 0.03, armL: 0.022, armR: 0.022, legL: 0.025, legR: 0.025 };
const ATTACH = { head: 0.035, armL: 0.035, armR: 0.035, legL: 0.045, legR: 0.045 };

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Compile parts into flat arrays + inverse bind matrices for fast evaluation. */
function compile(B) {
  const { bones } = createBones(B);
  const root = new THREE.Group();
  root.add(bones.pelvis);
  root.updateMatrixWorld(true);
  const parts = bodyParts(B).map((p) => {
    const mw = bones[p.bone].matrixWorld;
    const inv = mw.clone().invert().elements; // column-major
    // world-space bounding sphere, used to skip parts that can't affect a point
    let c, r;
    if (p.t === 0) (c = new THREE.Vector3(...p.c)), (r = Math.max(...p.r));
    else {
      const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b);
      c = a.clone().add(b).multiplyScalar(0.5);
      r = a.distanceTo(b) / 2 + Math.max(p.r1, p.r2);
    }
    c.applyMatrix4(mw);
    return { ...p, inv, boneIndex: JOINTS.indexOf(p.bone), wx: c.x, wy: c.y, wz: c.z, wr: r };
  });
  const groups = Object.keys(BLEND);
  const byGroup = groups.map((g) => parts.filter((p) => p.group === g));
  const spheres = byGroup.map((ps) => {
    const c = ps.reduce((a, p) => a.add(new THREE.Vector3(p.wx, p.wy, p.wz)), new THREE.Vector3()).multiplyScalar(1 / ps.length);
    const r = Math.max(...ps.map((p) => Math.sqrt((p.wx - c.x) ** 2 + (p.wy - c.y) ** 2 + (p.wz - c.z) ** 2) + p.wr));
    return [c.x, c.y, c.z, r];
  });
  return { parts, groups, byGroup, spheres };
}

function partDist(p, x, y, z) {
  const m = p.inv;
  const lx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const ly = m[1] * x + m[5] * y + m[9] * z + m[13];
  const lz = m[2] * x + m[6] * y + m[10] * z + m[14];
  if (p.t === 0) {
    // ellipsoid (iq's bound approximation)
    const cx = (lx - p.c[0]), cy = (ly - p.c[1]), cz = (lz - p.c[2]);
    const r = p.r;
    const ax = cx / r[0], ay = cy / r[1], az = cz / r[2];
    const bx = ax / r[0], by = ay / r[1], bz = az / r[2];
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
  }
  // round cone (iq) from a(r1) to b(r2)
  const a = p.a, b = p.b, r1 = p.r1, r2 = p.r2;
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = lx - a[0], pay = ly - a[1], paz = lz - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const yy = pax * bax + pay * bay + paz * baz;
  const z_ = yy - l2;
  const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = z_ * z_ * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z_) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
}

function makeSDF(C) {
  const { byGroup, groups, spheres } = C;
  const gd = new Float64Array(groups.length);
  const ks = groups.map((g) => BLEND[g]);
  return (x, y, z) => {
    for (let g = 0; g < byGroup.length; g++) {
      const S = spheres[g];
      const dx = x - S[0], dy = y - S[1], dz = z - S[2];
      const glb = Math.sqrt(dx * dx + dy * dy + dz * dz) - S[3];
      if (glb > 0.12) { gd[g] = glb; continue; } // far away: a lower bound is all we need
      const ps = byGroup[g];
      const k = ks[g];
      let d = Infinity;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const ex = x - p.wx, ey = y - p.wy, ez = z - p.wz;
        const lb = Math.sqrt(ex * ex + ey * ey + ez * ez) - p.wr;
        if (lb > d + k) continue; // this part cannot change the blended result
        const pd = partDist(p, x, y, z);
        d = d === Infinity ? pd : smin(d, pd, k);
      }
      gd[g] = d;
    }
    // torso blends separately with each limb; limbs never blend with each other
    const t = gd[0];
    let d = t;
    for (let g = 1; g < groups.length; g++) d = Math.min(d, smin(t, gd[g], ATTACH[groups[g]]));
    return d;
  };
}

/* ------------------------------ Surface Nets ------------------------------ */
function surfaceNets(sdf, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const N = nx * ny * nz;
  const f = new Float32Array(N);
  const idx = (x, y, z) => x + nx * (y + ny * z);

  // Narrow band: coarse pass every 4 nodes, refine only near the surface.
  const S = 4;
  const cx = Math.ceil(nx / S) + 1, cy = Math.ceil(ny / S) + 1, cz = Math.ceil(nz / S) + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let z = 0; z < cz; z++) for (let y = 0; y < cy; y++) for (let x = 0; x < cx; x++)
    coarse[x + cx * (y + cy * z)] = sdf(min[0] + x * S * h, min[1] + y * S * h, min[2] + z * S * h);
  const band = S * h * 1.9;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const c = coarse[Math.round(x / S) + cx * (Math.round(y / S) + cy * Math.round(z / S))];
    f[idx(x, y, z)] = Math.abs(c) > band ? c : sdf(min[0] + x * h, min[1] + y * h, min[2] + z * h);
  }

  const vmap = new Int32Array(N).fill(-1);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let mask = 0;
    for (let i = 0; i < 8; i++) {
      const c = corners[i];
      v[i] = f[idx(x + c[0], y + c[1], z + c[2])];
      if (v[i] < 0) mask |= 1 << i;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      const A = corners[a], Bc = corners[b];
      sx += A[0] + t * (Bc[0] - A[0]);
      sy += A[1] + t * (Bc[1] - A[1]);
      sz += A[2] + t * (Bc[2] - A[2]);
      n++;
    }
    vmap[idx(x, y, z)] = pos.length / 3;
    pos.push(min[0] + (x + sx / n) * h, min[1] + (y + sy / n) * h, min[2] + (z + sz / n) * h);
  }

  const index = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const i0 = idx(x, y, z);
    const inside = f[i0] < 0;
    // edge along +x
    if (inside !== (f[idx(x + 1, y, z)] < 0))
      quad(vmap[idx(x, y, z)], vmap[idx(x, y - 1, z)], vmap[idx(x, y - 1, z - 1)], vmap[idx(x, y, z - 1)], !inside);
    // edge along +y
    if (inside !== (f[idx(x, y + 1, z)] < 0))
      quad(vmap[idx(x, y, z)], vmap[idx(x, y, z - 1)], vmap[idx(x - 1, y, z - 1)], vmap[idx(x - 1, y, z)], !inside);
    // edge along +z
    if (inside !== (f[idx(x, y, z + 1)] < 0))
      quad(vmap[idx(x, y, z)], vmap[idx(x - 1, y, z)], vmap[idx(x - 1, y - 1, z)], vmap[idx(x, y - 1, z)], !inside);
  }
  return { positions: new Float32Array(pos), index };
}

/* ------------------------------ Build + cache ------------------------------ */
const cache = {};

export function getBodyGeometry(bodyKey, { cell = 0.0085 } = {}) {
  if (cache[bodyKey]) return cache[bodyKey];
  const B = BODIES[bodyKey] || BODIES.a;
  const C = compile(B);
  const sdf = makeSDF(C);
  const yMax = B.head ? 1.86 + 0.15 * (B.head - 1) : 1.86;
  const { positions, index } = surfaceNets(sdf, [-0.75, -0.03, -0.24], [0.75, yMax, 0.28], cell);

  const n = positions.length / 3;
  const normals = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const aBone = new Float32Array(n);
  const e = 0.0015;
  const boneD = new Float64Array(JOINTS.length);
  const SIGMA = 0.011;

  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    // analytic-ish normals from the SDF gradient → perfectly smooth shading
    const d1 = sdf(x + e, y - e, z - e), d2 = sdf(x - e, y - e, z + e), d3 = sdf(x - e, y + e, z - e), d4 = sdf(x + e, y + e, z + e);
    const gx = d1 - d2 - d3 + d4, gy = -d1 - d2 + d3 + d4, gz = -d1 + d2 - d3 + d4;
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    normals[i * 3] = gx / gl;
    normals[i * 3 + 1] = gy / gl;
    normals[i * 3 + 2] = gz / gl;

    // soft skin weights from distance to each bone's parts
    boneD.fill(1e9);
    for (const p of C.parts) {
      const d = partDist(p, x, y, z);
      if (d < boneD[p.boneIndex]) boneD[p.boneIndex] = d;
    }
    let dmin = 1e9, best = 0;
    for (let b = 0; b < boneD.length; b++) if (boneD[b] < dmin) (dmin = boneD[b]), (best = b);
    const ws = [];
    for (let b = 0; b < boneD.length; b++) {
      const w = Math.exp(-(boneD[b] - dmin) / SIGMA);
      if (w > 0.02) ws.push([b, w]);
    }
    ws.sort((a, b) => b[1] - a[1]);
    const top = ws.slice(0, 4);
    const sum = top.reduce((s, w) => s + w[1], 0);
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k] = top[k] ? top[k][0] : 0;
      skinWeight[i * 4 + k] = top[k] ? top[k][1] / sum : 0;
    }
    aBone[i] = best;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  g.setAttribute('aBone', new THREE.BufferAttribute(aBone, 1));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  g.computeBoundingSphere();
  cache[bodyKey] = g;
  return g;
}
