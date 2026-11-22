import * as THREE from 'three';

/**
 * Photo → pose.
 * 1. MediaPipe Pose (runs fully in the browser via WebAssembly) finds 33 body landmarks in 3D.
 * 2. We retarget those landmarks onto our 17-bone mannequin as joint rotations.
 *
 * Model files are self-hosted in /public/mediapipe-pose (works offline on your own domain).
 * When they aren't reachable (e.g. the standalone HTML opened from disk) we fall back to the jsDelivr CDN.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';
let detectorPromise = null;

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = ok;
    s.onerror = () => fail(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

async function resolveBase() {
  if (location.protocol.startsWith('http')) {
    const local = new URL((import.meta.env?.BASE_URL || './') + 'mediapipe-pose/', location.href).href;
    try {
      const r = await fetch(local + 'pose_web.binarypb', { method: 'HEAD' });
      // dev servers may answer unknown paths with index.html, so check it's not HTML
      if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) return local;
    } catch {
      /* fall through to CDN */
    }
  }
  return CDN;
}

/** Lazily loads the detector once (~10 MB the first time, cached by the browser afterwards). */
export function loadDetector(onStatus) {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    onStatus?.('Loading the pose AI (first time only)…');
    const base = await resolveBase();
    if (!window.Pose) await loadScript(base + 'pose.js');
    const pose = new window.Pose({ locateFile: (f) => base + f });
    pose.setOptions({ modelComplexity: 1, staticImageMode: true, smoothLandmarks: false, enableSegmentation: false, minDetectionConfidence: 0.35 });
    let resolver = null;
    pose.onResults((r) => resolver?.(r));
    await pose.initialize();
    return {
      detect: (image) =>
        new Promise((ok, fail) => {
          resolver = ok;
          pose.send({ image }).catch(fail);
        }),
    };
  })().catch((e) => {
    detectorPromise = null;
    throw e;
  });
  return detectorPromise;
}

/** Downscale big photos (phone cameras are 12+ MP) for faster, more reliable detection. */
export async function imageFromSource(src, max = 1280) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/* ----------------------------- retargeting ----------------------------- */
const LM = {
  nose: 0, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16,
  pinkyL: 17, pinkyR: 18, indexL: 19, indexR: 20, hipL: 23, hipR: 24, knL: 25, knR: 26,
  anL: 27, anR: 28, heelL: 29, heelR: 30, toeL: 31, toeR: 32,
};
const DOWN = new THREE.Vector3(0, -1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const D = 180 / Math.PI;

const basis = (x, yHint) => {
  const X = x.clone().normalize();
  const Y = yHint.clone().sub(X.clone().multiplyScalar(X.dot(yHint))).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
};
const toEuler = (q) => {
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x * D, e.y * D, e.z * D].map((v) => Math.round(v));
};

/**
 * Convert MediaPipe world landmarks (metres, y down, z toward camera = negative)
 * into a figure spec for our mannequin. Low-visibility limbs keep a neutral pose.
 */
export function landmarksToFigure(world, { body = 'b' } = {}) {
  const P = (i) => new THREE.Vector3(world[i].x, -world[i].y, -world[i].z);
  const vis = (...ids) => ids.every((i) => (world[i].visibility ?? 1) > 0.35);
  const mid = (a, b) => P(a).add(P(b)).multiplyScalar(0.5);
  const joints = {};

  const midHip = mid(LM.hipL, LM.hipR);
  const midSh = mid(LM.shL, LM.shR);
  const up = midSh.clone().sub(midHip);

  // Torso: pelvis from the hip line, chest from the shoulder line; spine shares the difference.
  const Qp = basis(P(LM.hipL).sub(P(LM.hipR)), up);
  const Qc = basis(P(LM.shL).sub(P(LM.shR)), up);
  const Qs = Qp.clone().slerp(Qc, 0.5);
  joints.pelvis = toEuler(Qp);
  joints.spine = toEuler(Qp.clone().invert().multiply(Qs));
  joints.chest = toEuler(Qs.clone().invert().multiply(Qc));

  // Head from ears + nose. Corrects for the nose sitting lower than the ears at rest.
  let Qh = Qc.clone();
  if (vis(LM.earL, LM.earR, LM.nose)) {
    const earMid = mid(LM.earL, LM.earR);
    const x = P(LM.earL).sub(P(LM.earR)).normalize();
    const f = P(LM.nose).sub(earMid);
    const z = f.clone().sub(x.clone().multiplyScalar(x.dot(f))).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    const Qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const rest = new THREE.Vector3(0, -0.28, 1).normalize();
    Qh = Qb.multiply(new THREE.Quaternion().setFromUnitVectors(FWD, rest).invert());
  }
  const Qn = Qc.clone().slerp(Qh, 0.45);
  joints.neck = toEuler(Qc.clone().invert().multiply(Qn));
  joints.head = toEuler(Qn.clone().invert().multiply(Qh));

  // Limb chains: aim each bone along its landmark segment, expressed in the parent's frame.
  const chain = (parentQ, segs, names, rests) => {
    let Q = parentQ.clone();
    segs.forEach(([a, b], i) => {
      const dir = (typeof b === 'function' ? b() : P(b)).sub(typeof a === 'function' ? a() : P(a)).normalize();
      const local = dir.applyQuaternion(Q.clone().invert());
      const q = new THREE.Quaternion().setFromUnitVectors(rests[i], local);
      joints[names[i]] = toEuler(q);
      Q = Q.multiply(q);
    });
  };
  for (const s of ['L', 'R']) {
    const sh = LM['sh' + s], el = LM['el' + s], wr = LM['wr' + s];
    const handTip = () => mid(LM['index' + s], LM['pinky' + s]);
    if (vis(sh, el, wr)) chain(Qc, [[sh, el], [el, wr], [wr, handTip]], ['shoulder' + s, 'elbow' + s, 'wrist' + s], [DOWN, DOWN, DOWN]);
    else joints['shoulder' + s] = [0, 0, s === 'L' ? 6 : -6];
    const hp = LM['hip' + s], kn = LM['kn' + s], an = LM['an' + s];
    if (vis(hp, kn, an)) {
      chain(Qp, [[hp, kn], [kn, an]], ['hip' + s, 'knee' + s], [DOWN, DOWN]);
      if (vis(LM['heel' + s], LM['toe' + s])) {
        // foot: aim heel→toe in the shin's frame
        const Qshin = Qp.clone()
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...joints['hip' + s].map((v) => v / D), 'XYZ')))
          .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...joints['knee' + s].map((v) => v / D), 'XYZ')));
        const dir = P(LM['toe' + s]).sub(P(LM['heel' + s])).normalize().applyQuaternion(Qshin.invert());
        joints['ankle' + s] = toEuler(new THREE.Quaternion().setFromUnitVectors(FWD, dir));
      }
    }
  }
  return { body, joints };
}

/** Full pipeline: image source (dataURL / canvas) → { figure, landmarks2d } or throws. */
export async function poseFromImage(src, opts = {}) {
  const det = await loadDetector(opts.onStatus);
  opts.onStatus?.('Reading the pose…');
  const canvas = typeof src === 'string' ? await imageFromSource(src) : src;
  const r = await det.detect(canvas);
  if (!r?.poseWorldLandmarks?.length) throw new Error('NO_PERSON');
  return { figure: landmarksToFigure(r.poseWorldLandmarks, opts), landmarks2d: r.poseLandmarks, width: canvas.width, height: canvas.height };
}

/** Skeleton connections for drawing the 2D overlay on the photo. */
export const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [27, 29], [28, 30], [15, 19], [16, 20],
];
