import * as THREE from 'three';

/**
 * Pose library. Each pose holds 1..n figures; each figure holds joint rotations in degrees.
 * See src/three/Mannequin.js for axis conventions.
 */

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'solo', label: 'Solo' },
  { id: 'couples', label: 'Couples' },
  { id: 'group', label: 'Group' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'casual', label: 'Casual' },
  { id: 'artistic', label: 'Artistic' },
  { id: 'sitting', label: 'Sitting' },
  { id: 'family', label: 'Family' },
  { id: 'fitness', label: 'Fitness' },
];

/**
 * Compose intrinsic rotations in the order given and return XYZ Euler degrees.
 * e.g. seq('x', -80, 'z', 40, 'y', 90): flex forward, swing out, then twist about the limb axis.
 */
export function seq(...steps) {
  const q = new THREE.Quaternion();
  const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  for (let i = 0; i < steps.length; i += 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(AX[steps[i]], (steps[i + 1] * Math.PI) / 180));
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z].map((v) => Math.round((v * 180) / Math.PI));
}

const BASE = { shoulderL: [0, 0, 6], shoulderR: [0, 0, -6], elbowL: [-8, 0, 0], elbowR: [-8, 0, 0] };

/** Mirror a joint map left↔right (x kept, y/z negated). */
export function mirrorJoints(joints) {
  const out = {};
  const swap = (n) => (n.endsWith('L') ? n.slice(0, -1) + 'R' : n.endsWith('R') ? n.slice(0, -1) + 'L' : n);
  for (const [k, [x, y, z]] of Object.entries(joints)) out[swap(k)] = [x, -y, -z];
  return out;
}

const fig = (body, joints, extra = {}) => ({ body, joints: { ...BASE, ...joints }, ...extra });

// Re-usable limb snippets
const handOnHipL = { shoulderL: [8, 0, 42], elbowL: [0, 0, -108], wristL: [0, 0, 18] };
const handOnHipR = mirrorJoints(handOnHipL);
const pocketL = { shoulderL: [6, 0, 12], elbowL: [-22, 0, -12], wristL: [0, 0, -5] };
const pocketR = mirrorJoints(pocketL);
const crossArms = { shoulderL: [-28, -78, -12], elbowL: [-102, 0, 0], shoulderR: [-28, 78, 12], elbowR: [-102, 0, 0] };
const walkLegs = { hipL: [-24, 0, 0], kneeL: [8, 0, 0], ankleL: [-6, 0, 0], hipR: [16, 0, 0], kneeR: [32, 0, 0], ankleR: [24, 0, 0] };

export const POSES = [
  /* ------------------------------- SOLO ------------------------------- */
  {
    id: 'contrapposto', name: 'Classic Contrapposto', category: 'solo', level: 'Easy',
    blurb: 'The timeless S-curve. Weight on one leg, shoulders and hips tilt in opposite directions.',
    cues: ['Shift all your weight onto your right leg', 'Soften the left knee forward', 'Drop one shoulder, tilt your chin a touch'],
    figures: [fig('b', {
      pelvis: [0, 8, -6], spine: [0, 0, 3], chest: [0, -4, 7], head: [2, 10, 5],
      shoulderL: [4, 0, 9], elbowL: [-12, 0, 0], shoulderR: [2, 0, -11], elbowR: [-14, 0, 0],
      hipL: [-10, 0, -5], kneeL: [20, 0, 0], ankleL: [-4, 0, 0], hipR: [0, 0, 7], kneeR: [2, 0, 0],
    })],
  },
  {
    id: 'hand-hip', name: 'Hand on Hip', category: 'solo', level: 'Easy',
    blurb: 'Creates space between arm and waist, which flatters any body shape. Cross the front leg for extra shape.',
    cues: ['Place your left hand on your waist', 'Cross your right knee over the left', 'Lengthen your neck, chin slightly down'],
    figures: [fig('b', {
      ...handOnHipL, pelvis: [0, -6, 4], chest: [0, 6, -4], head: [4, -8, -6],
      shoulderR: [4, 0, -9], elbowR: [-10, 0, 0],
      hipR: [-10, 0, 9], kneeR: [22, 0, 0], ankleR: [12, 0, 0], hipL: [0, 0, 4],
    })],
  },
  {
    id: 'over-shoulder', name: 'Over the Shoulder', category: 'solo', level: 'Medium',
    blurb: 'Turn away and glance back. Great for showing off an outfit back, hair, or a view.',
    cues: ['Turn your back to the camera', 'Twist from the waist, not the neck', 'Look back over your left shoulder'],
    view: { azimuth: 0 },
    figures: [fig('b', {
      chest: [0, -24, 0], neck: [0, -22, 0], head: [-4, -40, 0], spine: [0, -10, 0],
      shoulderL: [10, 0, 8], elbowL: [-10, 0, 0], shoulderR: [-6, 0, -10], elbowR: [-30, 0, 0],
      hipL: [-8, 0, -3], kneeL: [16, 0, 0], ankleL: [10, 0, 0],
    }, { rotY: 158 })],
  },
  {
    id: 'mirror-selfie', name: 'Mirror Selfie', category: 'solo', level: 'Easy',
    blurb: 'Phone at face height so it frames your features, with a knee pop for shape.',
    cues: ['Hold the phone at chin height', 'Pop your left knee in', 'Free hand on the waist'],
    figures: [fig('b', {
      shoulderR: [-68, 0, -4], elbowR: [-96, 0, 0], wristR: [0, 0, 0],
      ...handOnHipL, chest: [0, 8, -3], head: [6, 12, 3], pelvis: [0, -8, -5],
      hipL: [-8, 0, -7], kneeL: [26, 0, 0], ankleL: [16, 0, 0], hipR: [0, 0, 5],
    }, { props: [{ type: 'phone', at: 'wristR' }], rotY: -12 })],
  },
  {
    id: 'phone-check', name: 'Candid Phone Check', category: 'solo', level: 'Easy',
    blurb: 'Fake-candid in seconds. Look down at your phone like you just got a text.',
    cues: ['Hold the phone at chest height', 'Look down at the screen', 'Relax your shoulders'],
    figures: [fig('b', {
      shoulderR: [-30, 0, 8], elbowR: [-80, 0, 0], shoulderL: [-20, 0, -4], elbowL: [-70, -30, 0],
      head: [28, 0, 0], neck: [10, 0, 0], pelvis: [0, 6, -4], chest: [0, 0, 4],
      hipR: [-10, 0, 6], kneeR: [20, 0, 0], ankleR: [10, 0, 0],
    }, { props: [{ type: 'phone', at: 'wristR' }], rotY: 18 })],
  },

  /* ----------------------------- EDITORIAL ----------------------------- */
  {
    id: 'power-stance', name: 'Power Stance', category: 'editorial', level: 'Easy',
    blurb: 'Feet wide, hands on hips, chin up. Shoot from a lower angle to make it look bigger.',
    cues: ['Feet a little wider than your hips', 'Both hands on your hips', 'Chin up, eyes straight at the lens'],
    figures: [fig('a', {
      ...handOnHipL, ...handOnHipR, head: [-6, 0, 0], chest: [-4, 0, 0],
      hipL: [0, 0, 13], hipR: [0, 0, -13], ankleL: [0, 0, -12], ankleR: [0, 0, 12],
    })],
  },
  {
    id: 'chin-rest', name: 'The Thinker', category: 'editorial', level: 'Medium',
    blurb: 'One hand to the chin, one arm across the body. Polished and introspective.',
    cues: ['Fold your left arm across your waist', 'Bring your right fingertips to your chin', 'Look slightly off-camera'],
    figures: [fig('b', {
      shoulderR: [-30, 34, 6], elbowR: [-146, 0, 0], wristR: [10, 0, 0],
      shoulderL: [-18, -74, -6], elbowL: [-92, 0, 0],
      head: [4, -18, -4], chest: [0, 6, 0], pelvis: [0, -8, -4],
      hipL: [-6, 0, -6], kneeL: [16, 0, 0], ankleL: [8, 0, 0],
    }, { rotY: 14 })],
  },
  {
    id: 'hair-touch', name: 'Hair Touch', category: 'editorial', level: 'Medium',
    blurb: 'An elbow raised to the side opens up the frame and lengthens the torso.',
    cues: ['Lift your left elbow out to the side', 'Run your hand through your hair', 'Tilt your head toward the raised arm'],
    figures: [fig('b', {
      shoulderL: [-12, 0, 140], elbowL: [0, 0, 128], wristL: [0, 0, 20],
      shoulderR: [4, 0, -12], elbowR: [-14, 0, 0],
      head: [0, 8, -12], chest: [0, 0, -4], pelvis: [0, 0, 6],
      hipR: [-8, 0, 4], kneeR: [18, 0, 0], ankleR: [10, 0, 0], hipL: [0, 0, -2],
    })],
  },

  /* ------------------------------ CASUAL ------------------------------ */
  {
    id: 'walking', name: 'The Walk-By', category: 'casual', level: 'Easy',
    blurb: 'Mid-stride energy. Have someone burst-shoot while you walk toward the camera.',
    cues: ['Walk slowly toward the camera', 'Swing your arms naturally', 'Glance to the side, not at the lens'],
    figures: [fig('b', {
      ...walkLegs, shoulderL: [18, 0, 8], elbowL: [-10, 0, 0], shoulderR: [-20, 0, -8], elbowR: [-26, 0, 0],
      pelvis: [0, -6, 0], chest: [0, 8, 0], head: [2, -22, 0],
    }, { rotY: 20, props: [{ type: 'cup', at: 'wristR' }] })],
  },
  {
    id: 'crossed-lean', name: 'Cross-Leg Lean', category: 'casual', level: 'Easy',
    blurb: 'Ankles crossed, hands in pockets. Effortless and relaxed. Lean on a wall if you have one.',
    cues: ['Cross your right ankle over the left', 'Hands loosely in your pockets', 'Shoulders down, relaxed smile'],
    figures: [fig('a', {
      ...pocketL, ...pocketR, pelvis: [0, 0, -4], chest: [0, 0, 5], head: [2, 6, 4],
      hipR: [0, 0, 13], kneeR: [4, 0, 0], ankleR: [0, 0, -10], hipL: [0, 0, -2],
    })],
  },
  {
    id: 'arms-crossed', name: 'Confident Cross', category: 'casual', level: 'Easy',
    blurb: 'Arms folded, weight back, and a slight smirk.',
    cues: ['Fold your arms loosely', 'Shift your weight to the back foot', 'Small smile, chin slightly down'],
    figures: [fig('a', {
      ...crossArms, pelvis: [0, 10, -4], chest: [-3, -6, 4], head: [4, -6, 0],
      hipL: [-12, 0, -2], kneeL: [10, 0, 0], ankleL: [-4, 0, 0], hipR: [4, 0, 5],
    }, { rotY: -18 })],
  },
  {
    id: 'street-squat', name: 'Street Squat', category: 'casual', level: 'Medium',
    blurb: 'A low, streetwear-style crouch with elbows resting on your knees.',
    cues: ['Squat down low, heels flat', 'Rest your elbows on your knees', 'Look straight at the lens'],
    figures: [fig('a', {
      hipL: [-112, 0, 22], kneeL: [140, 0, 0], ankleL: [-28, 0, -6],
      hipR: [-112, 0, -22], kneeR: [140, 0, 0], ankleR: [-28, 0, 6],
      spine: [18, 0, 0], chest: [16, 0, 0], head: [-26, 0, 0],
      shoulderL: [-56, 0, 10], elbowL: [-40, 0, -14], shoulderR: [-56, 0, -10], elbowR: [-40, 0, 14],
    })],
  },
  {
    id: 'peace', name: 'Peace & Pop', category: 'casual', level: 'Easy',
    blurb: 'Playful hand by the face with a cute knee pop. Great for festivals and travel.',
    cues: ['Bring a peace sign up next to your face', 'Pop your left knee', 'Tilt your head toward your hand'],
    figures: [fig('b', {
      shoulderR: [-14, 0, -58], elbowR: [0, 0, -116], wristR: [0, 0, 0],
      head: [2, -6, 12], pelvis: [0, 0, -6], chest: [0, 0, 6],
      hipL: [-8, 0, -8], kneeL: [28, 0, 0], ankleL: [18, 0, 0], hipR: [0, 0, 6],
    })],
  },

  /* ----------------------------- ARTISTIC ----------------------------- */
  {
    id: 'dancer', name: 'Dancer Reach', category: 'artistic', level: 'Hard',
    blurb: 'Long lines from fingertips to pointed toes. Shoot it with the horizon low in frame.',
    cues: ['Sweep your left arm high overhead', 'Extend your right leg back, toes pointed', 'Arch gently and lift your gaze'],
    figures: [fig('b', {
      shoulderL: [-14, 0, 165], elbowL: [-8, 0, 0], shoulderR: [-10, 0, -82], elbowR: [0, 0, -8],
      hipR: [36, 0, -4], kneeR: [6, 0, 0], ankleR: [46, 0, 0],
      spine: [-8, 0, -4], chest: [-10, 0, -6], head: [-18, 0, -4],
    }, { rotY: 28 })],
  },
  {
    id: 'sky-gaze', name: 'Sky Gaze', category: 'artistic', level: 'Easy',
    blurb: 'Face lifted to the light, arms floating. Dreamy at golden hour.',
    cues: ['Tip your chin up toward the sky', 'Float your arms slightly away from your body', 'Close your eyes and breathe'],
    figures: [fig('b', {
      head: [-34, 8, 0], neck: [-10, 0, 0], chest: [-8, 0, 0],
      shoulderL: [12, 0, 24], elbowL: [-8, 0, 0], wristL: [0, 0, 20],
      shoulderR: [12, 0, -24], elbowR: [-8, 0, 0], wristR: [0, 0, -20],
      hipL: [-6, 0, -3], kneeL: [12, 0, 0], ankleL: [10, 0, 0],
    }, { props: [{ type: 'flowers', at: 'wristR' }] })],
  },

  /* ------------------------------ COUPLES ------------------------------ */
  {
    id: 'lean-in', name: 'Lean In', category: 'couples', level: 'Easy',
    blurb: 'The cosy classic. One partner crosses their ankles, and the other rests their head on their shoulder.',
    cues: ['Stand close, shoulder to shoulder', 'Partner A: cross your ankles, hands in pockets', 'Partner B: rest your head on their shoulder'],
    figures: [
      fig('a', { ...pocketL, ...pocketR, hipR: [0, 0, 13], kneeR: [4, 0, 0], ankleR: [0, 0, -10], hipL: [0, 0, -2], head: [6, 14, -8], chest: [0, 6, -3] }, { pos: [-0.15, 0], rotY: 10 }),
      fig('b', { head: [4, -14, 16], neck: [0, 0, 6], chest: [0, -6, 6], pelvis: [0, -6, -3], shoulderR: [-30, 0, 18], elbowR: [-50, 0, 0], hipL: [-6, 0, -6], kneeL: [14, 0, 0], ankleL: [8, 0, 0] }, { pos: [0.15, 0.04], rotY: -14, props: [{ type: 'bag', at: 'wristL' }] }),
    ],
  },
  {
    id: 'back-to-back', name: 'Back to Back', category: 'couples', level: 'Easy',
    blurb: 'Playful and confident: backs together, arms crossed, both looking at the lens.',
    cues: ['Stand back to back', 'Both of you fold your arms', 'Turn your heads toward the camera'],
    figures: [
      fig('a', { ...crossArms, chest: [0, 18, 0], neck: [0, 14, 0], head: [0, 34, 0], hipR: [-6, 0, 0], kneeR: [10, 0, 0] }, { pos: [-0.15, 0], rotY: -96 }),
      fig('b', { ...crossArms, chest: [0, -18, 0], neck: [0, -14, 0], head: [0, -36, 4], hipL: [-8, 0, 0], kneeL: [14, 0, 0], ankleL: [10, 0, 0] }, { pos: [0.15, 0], rotY: 96 }),
    ],
  },
  {
    id: 'forehead', name: 'Forehead Touch', category: 'couples', level: 'Medium',
    blurb: 'Intimate and soft. Eyes closed and foreheads together, best framed in profile.',
    cues: ['Face each other, toes almost touching', 'A: hands on B’s waist. B: hands on A’s chest', 'Lean in until foreheads meet, eyes closed'],
    view: { azimuth: 0 },
    figures: [
      fig('a', { head: [18, 0, 0], neck: [10, 0, 0], chest: [8, 0, 0], shoulderL: [-44, 0, -8], elbowL: [-24, 0, 0], shoulderR: [-44, 0, 8], elbowR: [-24, 0, 0] }, { pos: [-0.2, 0], rotY: 90 }),
      fig('b', { head: [-6, 0, 0], chest: [4, 0, 0], shoulderL: [-38, 0, -12], elbowL: [-88, 0, 0], shoulderR: [-38, 0, 12], elbowR: [-88, 0, 0], hipL: [-6, 0, 0], kneeL: [14, 0, 0], ankleL: [24, 0, 0] }, { pos: [0.2, 0], rotY: -90 }),
    ],
  },
  {
    id: 'hand-in-hand', name: 'Hand in Hand', category: 'couples', level: 'Easy',
    blurb: 'Walk toward the camera holding hands and look at each other, not the lens.',
    cues: ['Hold hands and walk slowly toward the camera', 'Look at each other and laugh', 'Keep your outer arm swinging naturally'],
    figures: [
      fig('a', { ...walkLegs, shoulderL: [-6, 0, 16], elbowL: [-12, 0, 0], shoulderR: [14, 0, -8], head: [0, 34, -4], chest: [0, 10, 0] }, { pos: [-0.24, 0], rotY: 8 }),
      fig('b', { ...mirrorJoints(walkLegs), shoulderR: [-6, 0, -16], elbowR: [-12, 0, 0], shoulderL: [14, 0, 8], head: [-6, -30, 6], chest: [0, -10, 0] }, { pos: [0.24, 0.05], rotY: -8 }),
    ],
  },

  /* ------------------------------- GROUP ------------------------------- */
  {
    id: 'squad', name: 'Squad Goals', category: 'group', level: 'Easy',
    blurb: 'Classic V formation: the middle person a step forward, the sides angled in.',
    cues: ['Middle person takes one step forward', 'Sides: angle your bodies toward the centre', 'Everyone: chin down a touch, shoulders relaxed'],
    figures: [
      fig('b', { ...handOnHipR, hipL: [-10, 0, -4], kneeL: [20, 0, 0], ankleL: [10, 0, 0], head: [2, -12, 6] }, { pos: [-0.52, -0.2], rotY: 28 }),
      fig('a', { ...crossArms, hipL: [0, 0, 8], hipR: [0, 0, -8], head: [-2, 0, 0] }, { pos: [0, 0.18] }),
      fig('b', { ...handOnHipL, hipR: [-10, 0, 4], kneeR: [20, 0, 0], ankleR: [10, 0, 0], head: [2, 12, -6] }, { pos: [0.52, -0.2], rotY: -28 }),
    ],
  },
  {
    id: 'jump', name: 'Jump Shot', category: 'group', level: 'Hard',
    blurb: 'Everyone in the air at once. Use burst mode and count “3-2-1-jump!” together.',
    cues: ['Count down together: 3, 2, 1', 'Jump and tuck your feet up', 'Arms up and out, big smiles'],
    figures: [
      fig('b', { shoulderL: [-10, 0, 150], shoulderR: [-10, 0, -150], elbowL: [0, 0, 12], elbowR: [0, 0, -12], hipL: [-50, 0, 6], kneeL: [100, 0, 0], hipR: [-8, 0, -4], kneeR: [70, 0, 0], ankleR: [30, 0, 0], head: [-10, 0, 0] }, { pos: [-0.55, 0], rotY: 10, lift: 0.36 }),
      fig('a', { shoulderL: [-6, 0, 140], shoulderR: [-6, 0, -140], hipL: [-40, 0, 8], kneeL: [90, 0, 0], hipR: [-40, 0, -8], kneeR: [90, 0, 0], ankleL: [20, 0, 0], ankleR: [20, 0, 0], head: [-14, 0, 0] }, { pos: [0, 0.1], lift: 0.44 }),
      fig('b', { shoulderL: [-10, 0, 150], shoulderR: [-10, 0, -150], elbowL: [0, 0, 12], elbowR: [0, 0, -12], hipR: [-50, 0, -6], kneeR: [100, 0, 0], hipL: [-8, 0, 4], kneeL: [70, 0, 0], ankleL: [30, 0, 0], head: [-10, 0, 0] }, { pos: [0.55, 0], rotY: -10, lift: 0.36 }),
    ],
  },
];


const SIT = { hipL: [-86, 0, 6], kneeL: [86, 0, 0], ankleL: [0, 0, 0], hipR: [-86, 0, -6], kneeR: [86, 0, 0], ankleR: [0, 0, 0] };
const SIT_CROSS_R = { hipL: [-84, 0, 4], kneeL: [84, 0, 0], hipR: [-104, 0, 16], kneeR: [80, 0, 0], ankleR: [18, 0, 0] };
const handOnChestR = { shoulderR: [-24, 44, 6], elbowR: [-112, 0, 0], wristR: [0, 0, 10] };
const handsToFace = { shoulderL: [-30, -36, 4], elbowL: [-142, 0, 0], shoulderR: [-30, 36, -4], elbowR: [-142, 0, 0] };
const kneePopL = { hipL: [-8, 0, -6], kneeL: [24, 0, 0], ankleL: [14, 0, 0], hipR: [0, 0, 5] };

POSES.push(
  /* ------------------------------ more SOLO ------------------------------ */
  {
    id: 'stool-perch', name: 'Stool Perch', category: 'solo', level: 'Easy',
    blurb: 'Seated and elegant: legs crossed at the knee, hands stacked, back long. Any stool, wall ledge or step works.',
    cues: ['Sit on the front half of the seat', 'Cross your right knee over the left', 'Stack your hands on your knee, back tall'],
    props: [{ type: 'stool', pos: [0, -0.07] }],
    figures: [fig('b', { ...SIT_CROSS_R, shoulderL: [-42, 0, -8], elbowL: [-38, 0, 0], shoulderR: [-44, 0, 10], elbowR: [-30, 0, 0], chest: [4, 0, 0], head: [2, 14, 6] }, { rotY: -16 })],
  },
  {
    id: 'shy-toes', name: 'Shy Toes', category: 'solo', level: 'Easy',
    blurb: 'Sweet and playful: hands behind your back, toes turned in, head tilted.',
    cues: ['Clasp your hands behind your back', 'Turn your toes slightly inward', 'Tilt your head and smile softly'],
    figures: [fig('b', { shoulderL: [22, 0, 4], elbowL: [0, 0, -78], shoulderR: [22, 0, -4], elbowR: [0, 0, 78], hipL: [0, -16, -2], kneeL: [14, 0, 0], hipR: [0, 16, 2], kneeR: [4, 0, 0], head: [10, 0, -10], chest: [0, 0, 3] })],
  },
  {
    id: 'side-profile', name: 'Side Profile', category: 'editorial', level: 'Medium',
    blurb: 'Clean profile lines, chin forward and shoulders back. Stunning against a plain wall or in backlight.',
    cues: ['Turn your body sideways to the camera', 'Push your chin slightly forward and down', 'Bend the front knee a little'],
    figures: [fig('b', { chest: [-5, -8, 0], head: [-2, -18, 0], shoulderL: [8, 0, 6], shoulderR: [-10, 0, -6], elbowR: [-40, 0, 0], hipL: [-12, 0, 0], kneeL: [22, 0, 0], ankleL: [14, 0, 0], hipR: [4, 0, 0] }, { rotY: 84 })],
  },
  {
    id: 'shades', name: 'Shades Down', category: 'editorial', level: 'Easy',
    blurb: 'Hand at your sunglasses, looking over the frames. Cool, fun and very street-style.',
    cues: ['Hold your sunglasses at the bridge', 'Lower them a touch and look over the frames', 'Other hand on your waist'],
    figures: [fig('a', { shoulderR: [-28, 30, 8], elbowR: [-148, 0, 0], ...handOnHipL, head: [8, 6, 0], pelvis: [0, 8, -4], chest: [0, -4, 4], hipL: [-8, 0, -4], kneeL: [16, 0, 0] }, { rotY: -10, props: [{ type: 'sunglasses', at: 'wristR' }] })],
  },
  {
    id: 'face-frame', name: 'Face Frame', category: 'editorial', level: 'Easy',
    blurb: 'Both hands softly framing your face. A beauty-shot classic for close-ups.',
    cues: ['Bring both hands up beside your face', 'Keep fingers soft, barely touching', 'Tilt your head slightly and relax your jaw'],
    figures: [fig('b', { ...handsToFace, head: [4, 6, 8], chest: [2, 0, 0], ...kneePopL })],
  },
  {
    id: 'collar-pop', name: 'Collar Pop', category: 'editorial', level: 'Easy',
    blurb: 'Both hands at the collar or jacket lapels. Confident, menswear-style energy.',
    cues: ['Grab your collar or lapels with both hands', 'Feet a little apart, weight back', 'Chin up, small smirk'],
    figures: [fig('a', { shoulderL: [-12, -26, 8], elbowL: [-132, 0, 0], shoulderR: [-12, 26, -8], elbowR: [-132, 0, 0], head: [-8, -10, 0], chest: [-4, 0, 0], hipL: [0, 0, 9], hipR: [-6, 0, -8], kneeR: [10, 0, 0] }, { rotY: 12 })],
  },
  {
    id: 'coffee-sip', name: 'Coffee Sip', category: 'casual', level: 'Easy',
    blurb: 'Cup at your lips, eyes down or out the window. The ultimate café candid.',
    cues: ['Hold the cup just below your lips', 'Rest your other arm across your waist', 'Look down at the cup, not at the lens'],
    figures: [fig('b', { shoulderR: [-34, 30, 6], elbowR: [-140, 0, 0], shoulderL: [-18, -74, -6], elbowL: [-90, 0, 0], head: [12, 10, 0], ...kneePopL }, { rotY: 18, props: [{ type: 'cup', at: 'wristR' }] })],
  },
  {
    id: 'laugh', name: 'Candid Laugh', category: 'casual', level: 'Easy',
    blurb: 'Head tipped back mid-laugh, hand to your chest. Have the photographer tell a terrible joke.',
    cues: ['Put a hand on your chest', 'Tip your head back and really laugh', 'Let your shoulders move. Burst mode helps'],
    figures: [fig('b', { ...handOnChestR, head: [-22, 8, 8], neck: [-6, 0, 0], chest: [-6, 0, 4], shoulderL: [6, 0, 14], elbowL: [-20, 0, 0], ...kneePopL })],
  },
  {
    id: 'bench-lean', name: 'Bench Lean-Back', category: 'casual', level: 'Easy',
    blurb: 'Relaxed weekend energy: lean back on your hands with one leg stretched out.',
    cues: ['Sit near the front edge', 'Lean back on straight arms behind you', 'Stretch one leg out, turn your face to the sun'],
    props: [{ type: 'bench', pos: [0, -0.1] }],
    figures: [fig('a', { spine: [-14, 0, 0], chest: [-6, 0, 0], head: [-4, 18, 0], shoulderL: [42, 0, 20], elbowL: [-4, 0, 0], shoulderR: [42, 0, -20], elbowR: [-4, 0, 0], hipL: [-78, 0, 8], kneeL: [80, 0, 0], hipR: [-70, 0, -10], kneeR: [30, 0, 0], ankleR: [20, 0, 0] })],
  },
  {
    id: 'knees-up', name: 'Knees Up', category: 'casual', level: 'Easy',
    blurb: 'Sitting on the floor hugging your knees. Cosy at home, at the beach or on a picnic blanket.',
    cues: ['Sit down and pull your knees up', 'Wrap your arms around your shins', 'Rest your cheek on your knees'],
    figures: [fig('b', { hipL: [-122, 0, 6], kneeL: [150, 0, 0], ankleL: [-20, 0, 0], hipR: [-122, 0, -6], kneeR: [150, 0, 0], ankleR: [-20, 0, 0], spine: [16, 0, 0], chest: [14, 0, 0], head: [10, 20, 14], shoulderL: [-64, 0, -6], elbowL: [-42, 0, 0], shoulderR: [-64, 0, 6], elbowR: [-42, 0, 0] }, { rotY: 20 })],
  },

  /* ----------------------------- more ARTISTIC ----------------------------- */
  {
    id: 'stretch', name: 'Morning Stretch', category: 'artistic', level: 'Easy',
    blurb: 'Up on your toes, arms reaching high. Long and airy, beautiful in silhouette.',
    cues: ['Rise up onto your toes', 'Reach both arms high overhead', 'Lift your chin and lengthen everything'],
    figures: [fig('b', { shoulderL: [-6, 0, 166], elbowL: [0, 0, -10], shoulderR: [-6, 0, -166], elbowR: [0, 0, 10], ankleL: [38, 0, 0], ankleR: [38, 0, 0], kneeL: [8, 0, 0], chest: [-8, 0, 0], head: [-16, 0, 0] })],
  },
  {
    id: 'twirl', name: 'Dress Twirl', category: 'artistic', level: 'Medium',
    blurb: 'Mid-spin with arms floating and one heel kicked up. Shoot in burst mode while you turn.',
    cues: ['Spin slowly on the spot', 'Float your arms out at hip height', 'Kick one heel up behind you'],
    figures: [fig('b', { shoulderL: [6, 0, 52], elbowL: [-10, 0, 0], shoulderR: [6, 0, -52], elbowR: [-10, 0, 0], hipR: [22, 0, -4], kneeR: [64, 0, 0], ankleR: [30, 0, 0], chest: [0, 18, -4], head: [-8, 26, 0], pelvis: [0, 8, 0] }, { rotY: 18 })],
  },
  {
    id: 'flamingo', name: 'Flamingo', category: 'artistic', level: 'Medium',
    blurb: 'Balance on one leg with the other knee lifted. Playful and full of movement.',
    cues: ['Lift your right knee to hip height', 'Point the toes of the lifted foot', 'Arms out wide for balance and flair'],
    figures: [fig('b', { hipR: [-82, 0, -4], kneeR: [96, 0, 0], ankleR: [30, 0, 0], shoulderL: [-10, 0, 96], elbowL: [0, 0, 10], shoulderR: [-10, 0, -96], elbowR: [0, 0, -10], head: [-6, 0, -6], chest: [-4, 0, 0] }, { rotY: 14 })],
  },
  {
    id: 'lunge-reach', name: 'Lunge & Reach', category: 'artistic', level: 'Hard',
    blurb: 'A deep forward lunge with one arm reaching to the sky. Dynamic, athletic, great on stairs or rooftops.',
    cues: ['Step your left foot far forward and bend the knee', 'Keep your back leg long', 'Reach your right arm up and look at your hand'],
    figures: [fig('a', { hipL: [-70, 0, 4], kneeL: [78, 0, 0], ankleL: [-6, 0, 0], hipR: [34, 0, -4], kneeR: [8, 0, 0], ankleR: [26, 0, 0], shoulderR: [-20, 0, -160], shoulderL: [16, 0, 24], spine: [6, 0, 0], chest: [-12, 0, 0], head: [-22, 0, 0] }, { rotY: 62 })],
  },

  /* ----------------------------- more COUPLES ----------------------------- */
  {
    id: 'back-hug', name: 'Back Hug', category: 'couples', level: 'Easy',
    blurb: 'Wrapped up from behind, chin on the shoulder. Warm, sweet and easy for anyone.',
    cues: ['Partner A: stand behind and wrap your arms around their waist', 'Rest your chin near their shoulder', 'Partner B: hold their arms and lean back slightly'],
    figures: [
      fig('a', { shoulderL: [-48, -58, 0], elbowL: [-70, 0, 0], shoulderR: [-48, 58, 0], elbowR: [-70, 0, 0], head: [16, 0, -12], neck: [10, 0, 0], chest: [6, 0, 0] }, { pos: [0.05, -0.16] }),
      fig('b', { shoulderL: [-26, 0, -4], elbowL: [-64, 0, 0], shoulderR: [-26, 0, 4], elbowR: [-64, 0, 0], head: [-4, 14, 8], chest: [-4, 0, 0], ...kneePopL }, { pos: [0, 0.12] }),
    ],
  },
  {
    id: 'forehead-kiss', name: 'Forehead Kiss', category: 'couples', level: 'Easy',
    blurb: 'A soft kiss on the forehead, eyes closed. Tender and never awkward.',
    cues: ['Face each other, close together', 'A: hands on B’s waist, lean down', 'B: hands on A’s chest, chin up, eyes closed'],
    view: { azimuth: 0 },
    figures: [
      fig('a', { head: [26, 0, 0], neck: [14, 0, 0], chest: [8, 0, 0], shoulderL: [-42, 0, -8], elbowL: [-28, 0, 0], shoulderR: [-42, 0, 8], elbowR: [-28, 0, 0] }, { pos: [-0.18, 0], rotY: 90 }),
      fig('b', { head: [-18, 0, 0], chest: [-4, 0, 0], shoulderL: [-36, 0, -12], elbowL: [-92, 0, 0], shoulderR: [-36, 0, 12], elbowR: [-92, 0, 0], hipL: [-6, 0, 0], kneeL: [14, 0, 0], ankleL: [30, 0, 0] }, { pos: [0.16, 0], rotY: -90 }),
    ],
  },
  {
    id: 'proposal', name: 'The Proposal', category: 'couples', level: 'Medium',
    blurb: 'Down on one knee. Practise the angles so the real moment looks perfect.',
    cues: ['A: kneel on your right knee, left foot forward', 'Hold the ring out at chest height', 'B: hands to your mouth, react!'],
    figures: [
      fig('a', { hipL: [-88, 0, 4], kneeL: [92, 0, 0], hipR: [8, 0, -2], kneeR: [96, 0, 0], ankleR: [46, 0, 0], shoulderL: [-62, 0, -6], elbowL: [-34, 0, 0], shoulderR: [-56, 0, 6], elbowR: [-40, 0, 0], head: [-12, 0, 0] }, { pos: [-0.36, 0.05], rotY: 72 }),
      fig('b', { ...handsToFace, shoulderL: [-30, -40, 2], shoulderR: [-30, 40, -2], elbowL: [-148, 0, 0], elbowR: [-148, 0, 0], head: [10, 0, 0], hipL: [-8, 0, 0], kneeL: [16, 0, 0] }, { pos: [0.3, 0], rotY: -64 }),
    ],
  },
  {
    id: 'spin-me', name: 'Spin Me', category: 'couples', level: 'Medium',
    blurb: 'One partner twirls the other under a raised arm. Pure movement and joy.',
    cues: ['Hold hands high between you', 'B: spin under A’s arm', 'Both: laugh and keep moving'],
    figures: [
      fig('a', { shoulderL: [-16, 0, 148], elbowL: [0, 0, -16], shoulderR: [8, 0, -10], head: [-10, 20, 0], chest: [0, 14, -4], hipR: [-8, 0, 0], kneeR: [12, 0, 0] }, { pos: [-0.3, 0], rotY: 26 }),
      fig('b', { shoulderR: [-16, 0, -154], elbowR: [0, 0, 12], shoulderL: [4, 0, 46], elbowL: [-12, 0, 0], hipL: [18, 0, 4], kneeL: [58, 0, 0], ankleL: [30, 0, 0], head: [-8, -28, 0], chest: [0, -16, 4] }, { pos: [0.16, 0.06], rotY: -30 }),
    ],
  },
  {
    id: 'bench-date', name: 'Bench Date', category: 'couples', level: 'Easy',
    blurb: 'Side by side on a bench, one head on a shoulder. Quiet, cinematic and cosy.',
    cues: ['Sit close, hips touching', 'B: rest your head on A’s shoulder', 'A: tilt your head in and look out'],
    props: [{ type: 'bench', pos: [0, -0.1] }],
    figures: [
      fig('a', { ...SIT, shoulderL: [-40, 0, -6], elbowL: [-40, 0, 0], shoulderR: [-38, 0, 6], elbowR: [-42, 0, 0], head: [2, 6, -10], chest: [2, 0, 0] }, { pos: [-0.18, 0] }),
      fig('b', { ...SIT_CROSS_R, hipR: [-100, 0, 14], head: [0, -6, 20], neck: [0, 0, 8], chest: [0, 0, 8], shoulderR: [-40, 0, 20], elbowR: [-46, 0, 0], shoulderL: [-38, 0, -8], elbowL: [-40, 0, 0] }, { pos: [0.18, 0.02], rotY: -6 }),
    ],
  },
  {
    id: 'walk-away', name: 'Walk Away', category: 'couples', level: 'Easy',
    blurb: 'Walking away hand in hand while one of you looks back at the camera. A storytelling shot.',
    cues: ['Hold hands and walk away from the camera', 'B: glance back over your shoulder', 'Keep a natural, slow stride'],
    figures: [
      fig('a', { ...walkLegs, shoulderR: [-6, 0, -16], elbowR: [-12, 0, 0], shoulderL: [14, 0, 8], head: [0, -10, 0] }, { pos: [0.22, 0], rotY: 180 }),
      fig('b', { ...mirrorJoints(walkLegs), shoulderL: [-6, 0, 16], elbowL: [-12, 0, 0], shoulderR: [14, 0, -8], chest: [0, -22, 0], neck: [0, -20, 0], head: [-4, -46, 0] }, { pos: [-0.22, 0.04], rotY: 180 }),
    ],
  },

  /* ------------------------------ more GROUP ------------------------------ */
  {
    id: 'huddle', name: 'Huddle Hug', category: 'group', level: 'Easy',
    blurb: 'Arms over each other’s shoulders, heads in close. Best-friends energy.',
    cues: ['Stand shoulder to shoulder', 'Drape your arms over your neighbours’ shoulders', 'Lean your heads in together'],
    figures: [
      fig('b', { shoulderL: [-8, 0, 82], elbowL: [0, 0, -58], head: [2, 6, -14], chest: [0, 0, -4], ...kneePopL }, { pos: [-0.42, 0.04], rotY: 14 }),
      fig('a', { shoulderL: [-8, 0, 84], elbowL: [0, 0, -60], shoulderR: [-8, 0, -84], elbowR: [0, 0, 60], head: [-4, 0, 0] }, { pos: [0, 0] }),
      fig('b', { shoulderR: [-8, 0, -82], elbowR: [0, 0, 58], head: [2, -6, 14], chest: [0, 0, 4], hipR: [-8, 0, 6], kneeR: [24, 0, 0] }, { pos: [0.42, 0.04], rotY: -14 }),
    ],
  },
  {
    id: 'squad-walk', name: 'Squad Walk', category: 'group', level: 'Easy',
    blurb: 'Walking toward the camera in a loose line, chatting. Movie-poster energy.',
    cues: ['Walk toward the camera side by side', 'Talk and laugh, don’t look at the lens', 'Stagger slightly, middle person a half step ahead'],
    figures: [
      fig('a', { ...walkLegs, shoulderL: [18, 0, 8], shoulderR: [-20, 0, -8], elbowR: [-26, 0, 0], head: [0, -26, 0], chest: [0, 6, 0] }, { pos: [-0.62, -0.18], rotY: 10 }),
      fig('b', { ...mirrorJoints(walkLegs), shoulderL: [-20, 0, 8], elbowL: [-26, 0, 0], shoulderR: [18, 0, -8], head: [-6, 10, 0] }, { pos: [0, 0.14], props: [{ type: 'bag', at: 'wristR' }] }),
      fig('a', { ...walkLegs, ...pocketL, ...pocketR, head: [0, 28, 0] }, { pos: [0.62, -0.18], rotY: -10 }),
    ],
  },
  {
    id: 'bench-squad', name: 'Bench Squad', category: 'group', level: 'Easy',
    blurb: 'Three on a bench, each with a different sitting pose, which keeps a group shot from looking stiff.',
    cues: ['Sit close together on the bench', 'Vary it: one leans in, one crosses legs, one leans back', 'Middle person: hands on knees, look at the lens'],
    props: [{ type: 'bench', pos: [0, -0.1] }],
    figures: [
      fig('b', { ...SIT_CROSS_R, shoulderL: [-40, 0, -8], elbowL: [-38, 0, 0], shoulderR: [-40, 0, 10], elbowR: [-36, 0, 0], head: [0, -10, 10] }, { pos: [-0.46, 0] }),
      fig('a', { ...SIT, hipL: [-86, 0, 12], hipR: [-86, 0, -12], shoulderL: [-30, 0, 8], elbowL: [-56, 0, 0], shoulderR: [-30, 0, -8], elbowR: [-56, 0, 0], spine: [10, 0, 0], head: [-6, 0, 0] }, { pos: [0, 0] }),
      fig('b', { ...SIT, spine: [-10, 0, 0], shoulderL: [36, 0, 20], shoulderR: [36, 0, -20], hipL: [-76, 0, 6], kneeL: [56, 0, 0], head: [-6, 16, 0] }, { pos: [0.46, 0] }),
    ],
  },
  {
    id: 'arm-in-arm', name: 'Arm in Arm', category: 'group', level: 'Easy',
    blurb: 'Four friends linked at the elbows. Simple, joyful, and it keeps everyone close.',
    cues: ['Line up shoulder to shoulder', 'Hook elbows with the person next to you', 'Lean in and laugh together'],
    figures: [
      fig('a', { shoulderL: [-6, 0, 24], elbowL: [-60, 0, -20], hipR: [-8, 0, 4], kneeR: [16, 0, 0], head: [0, 14, -6] }, { pos: [-0.75, 0], rotY: 14 }),
      fig('b', { shoulderL: [-6, 0, 24], elbowL: [-60, 0, -20], shoulderR: [-4, 0, -26], elbowR: [-20, 0, 0], head: [4, 10, -8], ...kneePopL }, { pos: [-0.25, 0.05], rotY: 6 }),
      fig('b', { shoulderR: [-6, 0, -24], elbowR: [-60, 0, 20], shoulderL: [-4, 0, 26], elbowL: [-20, 0, 0], head: [-6, -8, 10] }, { pos: [0.25, 0.05], rotY: -6 }),
      fig('a', { shoulderR: [-6, 0, -24], elbowR: [-60, 0, 20], hipL: [-8, 0, -4], kneeL: [16, 0, 0], head: [0, -14, 6] }, { pos: [0.75, 0], rotY: -14 }),
    ],
  },
);


/* =============================== EXPANSION PACK =============================== */
const handOnHipR2 = mirrorJoints({ shoulderL: [8, 0, 42], elbowL: [0, 0, -108], wristL: [0, 0, 18] });
const kneel = { hipL: [-88, 0, 4], kneeL: [92, 0, 0], hipR: [8, 0, -2], kneeR: [96, 0, 0], ankleR: [46, 0, 0] };
const prayer = { shoulderL: [-18, -54, 8], elbowL: [-112, 0, 0], shoulderR: [-18, 54, -8], elbowR: [-112, 0, 0] };
const STOOL = [{ type: 'stool', pos: [0, -0.07] }];
const BENCH = [{ type: 'bench', pos: [0, -0.1] }];

POSES.push(
  /* ------------------------------ SITTING ------------------------------ */
  {
    id: 'stool-forward', name: 'Elbows on Knees', category: 'sitting', level: 'Easy',
    blurb: 'Lean forward with your forearms on your thighs and look up at the lens. Relaxed and confident.',
    cues: ['Sit with your knees hip-width apart', 'Rest your forearms on your thighs', 'Lean in and look up into the lens'],
    props: STOOL,
    figures: [fig('a', { ...SIT, hipL: [-86, 0, 12], hipR: [-86, 0, -12], spine: [18, 0, 0], chest: [12, 0, 0], head: [-26, 0, 0], shoulderL: [-56, 0, 8], elbowL: [-62, 0, 0], shoulderR: [-56, 0, -8], elbowR: [-62, 0, 0] })],
  },
  {
    id: 'stool-foot-up', name: 'Heel on the Rung', category: 'sitting', level: 'Easy',
    blurb: 'One foot up on the stool rung and the other leg long. Creates beautiful angles while seated.',
    cues: ['Put your right heel up on the rung', 'Let your left leg reach toward the floor', 'Rest a hand on the raised knee'],
    props: STOOL,
    figures: [fig('b', { hipL: [-72, 0, 8], kneeL: [56, 0, 0], ankleL: [14, 0, 0], hipR: [-112, 0, -4], kneeR: [124, 0, 0], ankleR: [-10, 0, 0], shoulderR: [-48, 0, 4], elbowR: [-22, 0, 0], shoulderL: [-30, 0, -6], elbowL: [-42, 0, 0], head: [0, 14, 6], chest: [2, 0, 0] }, { rotY: -20 })],
  },
  {
    id: 'floor-lounge', name: 'Floor Lounge', category: 'sitting', level: 'Easy',
    blurb: 'Lean back on your hands on the floor, one knee up. Perfect for beaches, picnics and rooftops.',
    cues: ['Sit on the floor and lean back on your hands', 'Bend one knee, keep the other leg long', 'Turn your face toward the light'],
    figures: [fig('b', { hipL: [-84, 0, 4], kneeL: [12, 0, 0], ankleL: [20, 0, 0], hipR: [-104, 0, -4], kneeR: [110, 0, 0], spine: [-20, 0, 0], chest: [-6, 0, 0], shoulderL: [46, 0, 22], elbowL: [-2, 0, 0], shoulderR: [46, 0, -22], elbowR: [-2, 0, 0], head: [-10, 18, 0] }, { rotY: 24 })],
  },
  {
    id: 'criss-cross', name: 'Criss-Cross', category: 'sitting', level: 'Easy',
    blurb: 'Cross-legged on the floor with your hands on your knees. Calm, centred and friendly.',
    cues: ['Sit cross-legged on the floor', 'Rest your hands on your knees', 'Sit tall and soften your shoulders'],
    figures: [fig('b', { hipL: seq('x', -82, 'z', 42, 'y', 90), kneeL: [138, 0, 0], hipR: seq('x', -82, 'z', -42, 'y', -90), kneeR: [138, 0, 0], shoulderL: [-34, 0, 14], elbowL: [-24, 0, 0], shoulderR: [-34, 0, -14], elbowR: [-24, 0, 0], spine: [4, 0, 0], head: [4, 0, 6] })],
  },
  {
    id: 'chin-hands', name: 'Chin in Hands', category: 'sitting', level: 'Easy',
    blurb: 'Elbows on knees, chin resting in your hands. Dreamy and very cute.',
    cues: ['Sit with knees apart, elbows on your knees', 'Rest your chin in both hands', 'Look slightly up and off-camera'],
    props: BENCH,
    figures: [fig('b', { ...SIT, hipL: [-88, 0, 16], hipR: [-88, 0, -16], spine: [26, 0, 0], chest: [10, 0, 0], neck: [-12, 0, 0], head: [-22, 8, 0], shoulderL: [-70, -26, 6], elbowL: [-120, 0, 0], shoulderR: [-70, 26, -6], elbowR: [-120, 0, 0] })],
  },
  {
    id: 'book-nook', name: 'Book Nook', category: 'sitting', level: 'Easy',
    blurb: 'Lost in a good book. A cosy candid for cafés, libraries and window seats.',
    cues: ['Cross your legs and hold the book at chest height', 'Look down at the page', 'Let a small smile happen'],
    props: STOOL,
    figures: [fig('b', { ...SIT_CROSS_R, shoulderL: [-44, -30, 0], elbowL: [-82, 0, 0], shoulderR: [-44, 30, 0], elbowR: [-82, 0, 0], head: [26, 0, 0], chest: [4, 0, 0] }, { rotY: -24, props: [{ type: 'book', at: 'wristR' }] })],
  },

  /* ------------------------------ FAMILY ------------------------------ */
  {
    id: 'family-walk', name: 'Family Walk', category: 'family', level: 'Easy',
    blurb: 'The little one in the middle, everyone holding hands and walking toward the camera.',
    cues: ['Child in the middle, holding both hands', 'Walk slowly toward the camera', 'Parents: look down at the child'],
    figures: [
      fig('a', { ...walkLegs, shoulderL: [-8, 0, 24], elbowL: [-6, 0, 0], shoulderR: [16, 0, -8], head: [16, 24, 0] }, { pos: [-0.44, 0], rotY: 6 }),
      fig('c', { ...mirrorJoints(walkLegs), shoulderL: [-14, 0, 42], elbowL: [-4, 0, 0], shoulderR: [-14, 0, -42], elbowR: [-4, 0, 0], head: [-10, 0, 0] }, { pos: [0, 0.06] }),
      fig('b', { ...walkLegs, shoulderR: [-8, 0, -24], elbowR: [-6, 0, 0], shoulderL: [16, 0, 8], head: [16, -24, 0] }, { pos: [0.44, 0], rotY: -6 }),
    ],
  },
  {
    id: 'shoulder-ride', name: 'Shoulder Ride', category: 'family', level: 'Medium',
    blurb: 'The classic: little one up on a parent’s shoulders, arms in the air.',
    cues: ['Lift the child onto your shoulders', 'Hold their shins securely', 'Child: arms up and cheer!'],
    figures: [
      fig('a', { shoulderL: [-20, 0, 66], elbowL: [0, 0, 118], shoulderR: [-20, 0, -66], elbowR: [0, 0, -118], head: [-6, 0, 0] }, { pos: [0, 0] }),
      fig('c', { hipL: [-78, 0, 40], kneeL: [84, 0, 0], hipR: [-78, 0, -40], kneeR: [84, 0, 0], shoulderL: [-10, 0, 140], elbowL: [0, 0, 10], shoulderR: [-10, 0, -140], elbowR: [0, 0, -10], head: [-12, 0, 0] }, { pos: [0, -0.02], lift: 1.04 }),
    ],
  },
  {
    id: 'family-portrait', name: 'Family Portrait', category: 'family', level: 'Easy',
    blurb: 'Parents close together behind, the child in front. Timeless and easy for everyone.',
    cues: ['Parents stand close, angled toward each other', 'Child stands in front, in the middle', 'Rest a hand on the child’s shoulder'],
    figures: [
      fig('a', { shoulderL: [-36, 0, 12], elbowL: [-34, 0, 0], head: [2, 8, -6], hipR: [-6, 0, 2], kneeR: [10, 0, 0] }, { pos: [-0.2, -0.18], rotY: 14 }),
      fig('b', { shoulderR: [-34, 0, -10], elbowR: [-30, 0, 0], head: [2, -8, 8], ...kneePopL }, { pos: [0.2, -0.18], rotY: -14 }),
      fig('c', { ...handOnHipL, ...handOnHipR2, head: [-4, 0, 6] }, { pos: [0, 0.22] }),
    ],
  },
  {
    id: 'kneel-hug', name: 'Kneeling Hug', category: 'family', level: 'Easy',
    blurb: 'Come down to their level for a big hug. Real emotion, real smiles.',
    cues: ['Kneel on one knee facing the child', 'Wrap your arms around them', 'Child: arms around your neck'],
    figures: [
      fig('b', { ...kneel, shoulderL: [-60, -44, 0], elbowL: [-64, 0, 0], shoulderR: [-60, 44, 0], elbowR: [-64, 0, 0], head: [8, 0, -14], chest: [8, 0, 0] }, { pos: [-0.24, 0], rotY: 70 }),
      fig('c', { shoulderL: [-96, -30, 0], elbowL: [-60, 0, 0], shoulderR: [-96, 30, 0], elbowR: [-60, 0, 0], head: [6, 0, 14] }, { pos: [0.0, 0.05], rotY: -100 }),
    ],
  },
  {
    id: 'swing-up', name: 'Swing Me Up', category: 'family', level: 'Medium',
    blurb: 'Parents swing the child up between them. Burst mode is essential!',
    cues: ['Hold the child’s hands on both sides', 'Count to three and lift together', 'Child: tuck your knees up!'],
    figures: [
      fig('a', { shoulderL: [-34, 0, 52], elbowL: [-10, 0, 0], head: [6, 30, 0], hipR: [-8, 0, 0], kneeR: [14, 0, 0] }, { pos: [-0.42, 0], rotY: 18 }),
      fig('c', { shoulderL: [-12, 0, 74], shoulderR: [-12, 0, -74], hipL: [-56, 0, 6], kneeL: [96, 0, 0], hipR: [-40, 0, -6], kneeR: [86, 0, 0], head: [-14, 0, 0] }, { pos: [0, 0.04], lift: 0.34 }),
      fig('b', { shoulderR: [-34, 0, -52], elbowR: [-10, 0, 0], head: [6, -30, 0], ...kneePopL }, { pos: [0.42, 0], rotY: -18 }),
    ],
  },

  /* ------------------------------ FITNESS ------------------------------ */
  {
    id: 'double-bicep', name: 'Double Bicep', category: 'fitness', level: 'Easy',
    blurb: 'The classic flex. Arms up, elbows level with your shoulders, chest proud.',
    cues: ['Raise both arms to shoulder height', 'Bend your elbows and make fists', 'Chest up, small smile'],
    figures: [fig('a', { shoulderL: [-4, 0, 88], elbowL: [0, 0, 92], shoulderR: [-4, 0, -88], elbowR: [0, 0, -92], hipL: [0, 0, 9], hipR: [0, 0, -9], head: [-6, 0, 0], chest: [-4, 0, 0] })],
  },
  {
    id: 'plank', name: 'Plank', category: 'fitness', level: 'Medium',
    blurb: 'A strong straight line from head to heels. Shoot it side-on and low to the ground.',
    cues: ['Hands under your shoulders, arms straight', 'Body in one straight line', 'Look slightly ahead, not down'],
    view: { azimuth: 0 },
    figures: [fig('a', { pelvis: [84, 0, 0], shoulderL: [-84, 0, 4], elbowL: [0, 0, 0], shoulderR: [-84, 0, -4], elbowR: [0, 0, 0], hipL: [0, 0, 2], hipR: [0, 0, -2], ankleL: [10, 0, 0], ankleR: [10, 0, 0], head: [-34, 0, 0] }, { rotY: 90 })],
  },
  {
    id: 'warrior', name: 'Warrior II', category: 'fitness', level: 'Medium',
    blurb: 'A grounded yoga classic: wide legs, front knee bent, arms long, gaze over the front hand.',
    cues: ['Step your feet wide apart', 'Bend your right knee over your ankle', 'Arms out long, look over your right hand'],
    figures: [fig('b', { hipR: seq('z', -50, 'y', -90), kneeR: [54, 0, 0], hipL: [0, 0, 24], shoulderL: [0, 0, 90], elbowL: [0, 0, 0], shoulderR: [0, 0, -90], elbowR: [0, 0, 0], head: [0, -70, 0] })],
  },
  {
    id: 'tree', name: 'Tree Pose', category: 'fitness', level: 'Medium',
    blurb: 'Balance on one leg with the other foot at your inner knee and hands at your heart.',
    cues: ['Stand on your left leg', 'Place your right foot on your inner left leg', 'Bring your palms together at your chest'],
    figures: [fig('b', { hipR: seq('z', -64, 'y', -90), kneeR: [136, 0, 0], ankleR: [20, 0, 0], ...prayer, head: [0, 0, 0] })],
  },
  {
    id: 'sprint', name: 'Sprint', category: 'fitness', level: 'Hard',
    blurb: 'Full running stride with driving arms. Use burst mode while running past the camera.',
    cues: ['Run past the camera at an angle', 'Drive your knee forward', 'Pump your arms at 90°'],
    figures: [fig('a', { hipL: [-58, 0, 0], kneeL: [70, 0, 0], ankleL: [-10, 0, 0], hipR: [30, 0, 0], kneeR: [96, 0, 0], ankleR: [30, 0, 0], shoulderL: [38, 0, 8], elbowL: [-92, 0, 0], shoulderR: [-48, 0, -8], elbowR: [-92, 0, 0], spine: [10, 0, 0], head: [-8, 0, 0] }, { rotY: 62, lift: 0.06 })],
  },
  {
    id: 'quad-stretch', name: 'Quad Stretch', category: 'fitness', level: 'Easy',
    blurb: 'A balance stretch that looks great in silhouette at the end of a run.',
    cues: ['Stand on your left leg', 'Pull your right heel up behind you', 'Reach your left arm forward for balance'],
    figures: [fig('b', { hipR: [10, 0, 0], kneeR: [152, 0, 0], ankleR: [20, 0, 0], shoulderR: [34, 0, -6], elbowR: [-14, 0, 0], shoulderL: [-88, 0, 10], elbowL: [0, 0, 0], head: [-6, 0, 0] }, { rotY: 56 })],
  },
  {
    id: 'star-jump', name: 'Star Jump', category: 'fitness', level: 'Medium',
    blurb: 'Arms and legs out wide, mid-air. Energetic and joyful.',
    cues: ['Jump up as high as you can', 'Spread arms and legs into a star', 'Big smile at the top!'],
    figures: [fig('a', { shoulderL: [0, 0, 138], shoulderR: [0, 0, -138], hipL: [0, 0, 24], hipR: [0, 0, -24], ankleL: [30, 0, 0], ankleR: [30, 0, 0], head: [-10, 0, 0] }, { lift: 0.18 })],
  },

  /* ------------------------- more SOLO / EDITORIAL / CASUAL ------------------------- */
  {
    id: 'hands-in-hair', name: 'Hands in Hair', category: 'editorial', level: 'Medium',
    blurb: 'Both hands lifted into your hair, elbows wide and chin up. Pure fashion-editorial drama.',
    cues: ['Lift both hands into your hair', 'Open your elbows wide', 'Tip your chin up and close your eyes'],
    figures: [fig('b', { shoulderL: [-12, 0, 140], elbowL: [0, 0, 128], shoulderR: [-12, 0, -140], elbowR: [0, 0, -128], head: [-12, 0, 6], chest: [-6, 0, 0], ...kneePopL })],
  },
  {
    id: 'one-knee', name: 'One Knee Down', category: 'editorial', level: 'Medium',
    blurb: 'Kneeling on one knee with an arm draped over the other. Strong and grounded.',
    cues: ['Kneel on your right knee', 'Drape your left forearm over the raised knee', 'Look straight into the lens'],
    figures: [fig('a', { ...kneel, shoulderL: [-40, 0, 10], elbowL: [-52, 0, 0], ...handOnHipR2, head: [-6, 0, 0], chest: [6, 0, 0] }, { rotY: -24 })],
  },
  {
    id: 'glance-back', name: 'Glance Back', category: 'solo', level: 'Easy',
    blurb: 'Walking away and looking back over your shoulder, like you’ve just been called.',
    cues: ['Walk away from the camera', 'Turn your head back over your shoulder', 'Keep your stride relaxed'],
    figures: [fig('b', { ...walkLegs, chest: [0, -24, 0], neck: [0, -20, 0], head: [-4, -48, 0], shoulderL: [14, 0, 8], shoulderR: [-12, 0, -8] }, { rotY: 180 })],
  },
  {
    id: 'look-down', name: 'Looking Down', category: 'casual', level: 'Easy',
    blurb: 'Hands in pockets, eyes down, like you’re lost in thought. Easy candid magic.',
    cues: ['Hands in your pockets', 'Look down toward your shoes', 'Bend one knee slightly'],
    figures: [fig('a', { ...pocketL, ...pocketR, head: [32, 10, 0], neck: [10, 0, 0], hipL: [-8, 0, -4], kneeL: [16, 0, 0], ankleL: [8, 0, 0] }, { rotY: 16 })],
  },
  {
    id: 'hands-knees', name: 'Hands on Knees', category: 'casual', level: 'Easy',
    blurb: 'Bent forward with your hands on your knees, laughing. Playful and full of life.',
    cues: ['Bend your knees slightly', 'Place your hands on your knees and lean in', 'Look up at the lens and laugh'],
    figures: [fig('b', { hipL: [-30, 0, 4], hipR: [-30, 0, -4], kneeL: [34, 0, 0], kneeR: [34, 0, 0], ankleL: [-6, 0, 0], ankleR: [-6, 0, 0], spine: [24, 0, 0], chest: [16, 0, 0], head: [-34, 0, 0], shoulderL: [-58, 0, -6], elbowL: [-6, 0, 0], shoulderR: [-58, 0, 6], elbowR: [-6, 0, 0] })],
  },
  {
    id: 'heart-hands', name: 'Heart Hands', category: 'casual', level: 'Easy',
    blurb: 'Make a heart with your hands in front of your chest. Instantly cute.',
    cues: ['Bring your hands together in front of your chest', 'Make a heart shape with your fingers', 'Tilt your head and smile'],
    figures: [fig('b', { shoulderL: [-56, -34, 4], elbowL: [-54, 0, 0], shoulderR: [-56, 34, -4], elbowR: [-54, 0, 0], head: [4, 0, 8], ...kneePopL })],
  },
  {
    id: 'wave', name: 'Hello Wave', category: 'casual', level: 'Easy',
    blurb: 'A big friendly wave. Great for travel shots in front of landmarks.',
    cues: ['Raise your right hand up beside your head', 'Wave like you just saw a friend', 'Big open smile'],
    figures: [fig('b', { shoulderR: [-12, 0, -118], elbowR: [0, 0, -52], head: [0, -6, -6], ...kneePopL })],
  },
  {
    id: 'point', name: 'Point at You', category: 'casual', level: 'Easy',
    blurb: 'Point straight at the camera with a cheeky grin. Fun and full of character.',
    cues: ['Point your right finger straight at the lens', 'Lean in a little', 'Wink or grin'],
    figures: [fig('a', { shoulderR: [-88, 0, -8], elbowR: [-4, 0, 0], ...handOnHipL, head: [6, 0, 8], chest: [4, -10, 0], hipR: [-6, 0, 2], kneeR: [12, 0, 0] })],
  },
  {
    id: 'arch-back', name: 'Arch Back', category: 'artistic', level: 'Medium',
    blurb: 'Hands behind, chest lifted to the sky. Graceful and dramatic in backlight.',
    cues: ['Clasp your hands behind your back', 'Lift your chest toward the sky', 'Let your head fall gently back'],
    figures: [fig('b', { spine: [-14, 0, 0], chest: [-14, 0, 0], head: [-22, 0, 0], shoulderL: [24, 0, 22], elbowL: [0, 0, -10], shoulderR: [24, 0, -22], elbowR: [0, 0, 10], hipL: [-6, 0, 0], kneeL: [14, 0, 0], ankleL: [14, 0, 0] }, { rotY: 50 })],
  },
  {
    id: 'side-bend', name: 'Side Reach', category: 'artistic', level: 'Easy',
    blurb: 'One arm arcs overhead as you lean to the side. A long, elegant curve.',
    cues: ['Place your right hand on your hip', 'Sweep your left arm up and over', 'Lean gently to the right'],
    figures: [fig('b', { shoulderL: [-8, 0, 168], elbowL: [0, 0, 18], ...handOnHipR2, spine: [0, 0, 10], chest: [0, 0, 14], head: [0, 0, 6], hipR: [0, 0, 6] })],
  },

  /* ------------------------------ more COUPLES ------------------------------ */
  {
    id: 'dip', name: 'Dance Dip', category: 'couples', level: 'Hard',
    blurb: 'The romantic movie-ending dip. A supports B’s back while B leans back with one leg up.',
    cues: ['A: one hand behind B’s back', 'B: lean back and lift your right leg', 'Both: look into each other’s eyes'],
    view: { azimuth: 0 },
    figures: [
      fig('a', { spine: [16, 0, 0], chest: [10, 0, 0], head: [18, 0, 0], shoulderL: [-64, -40, 0], elbowL: [-50, 0, 0], shoulderR: [-30, 0, 10], elbowR: [-40, 0, 0], hipL: [-24, 0, 0], kneeL: [30, 0, 0], ankleL: [-6, 0, 0] }, { pos: [-0.2, 0], rotY: 90 }),
      fig('b', { spine: [-26, 0, 0], chest: [-22, 0, 0], head: [-24, 0, 0], shoulderL: [-10, 0, -30], shoulderR: [-60, 0, 20], elbowR: [-30, 0, 0], hipR: [-62, 0, 0], kneeR: [24, 0, 0], ankleR: [34, 0, 0], hipL: [10, 0, 0], kneeL: [30, 0, 0] }, { pos: [0.18, 0], rotY: -90 }),
    ],
  },
  {
    id: 'piggyback', name: 'Piggyback', category: 'couples', level: 'Medium',
    blurb: 'Pure fun: one partner rides on the other’s back, cheek to cheek.',
    cues: ['A: crouch slightly, hands back to catch B’s legs', 'B: hop on and wrap your arms over A’s shoulders', 'Cheeks together and laugh'],
    figures: [
      fig('a', { spine: [14, 0, 0], head: [-14, 0, 0], shoulderL: [26, 0, 34], elbowL: [-60, 0, 0], shoulderR: [26, 0, -34], elbowR: [-60, 0, 0], hipL: [-18, 0, 4], hipR: [-18, 0, -4], kneeL: [26, 0, 0], kneeR: [26, 0, 0], ankleL: [-8, 0, 0], ankleR: [-8, 0, 0] }, { pos: [0, 0.06] }),
      fig('b', { hipL: [-74, 0, 34], kneeL: [70, 0, 0], hipR: [-74, 0, -34], kneeR: [70, 0, 0], ankleL: [30, 0, 0], ankleR: [30, 0, 0], shoulderL: [-74, -30, 0], elbowL: [-58, 0, 0], shoulderR: [-74, 30, 0], elbowR: [-58, 0, 0], spine: [10, 0, 0], head: [6, 10, 12] }, { pos: [0.02, -0.2], lift: 0.42 }),
    ],
  },
  {
    id: 'cheek-kiss', name: 'Cheek Kiss', category: 'couples', level: 'Easy',
    blurb: 'B rises onto tiptoes to kiss A’s cheek while A beams at the camera.',
    cues: ['A: face the camera and smile', 'B: rise onto your toes and turn in', 'B: a soft kiss on A’s cheek'],
    figures: [
      fig('a', { ...pocketL, ...pocketR, head: [0, 0, -6] }, { pos: [-0.12, 0], rotY: 6 }),
      fig('b', { ankleL: [26, 0, 0], ankleR: [26, 0, 0], head: [6, -14, 10], chest: [0, -10, 8], shoulderR: [-62, 0, 30], elbowR: [-60, 0, 0], shoulderL: [-20, 0, -6], elbowL: [-20, 0, 0] }, { pos: [0.16, 0.06], rotY: -58 }),
    ],
  },
  {
    id: 'big-hug', name: 'Big Hug', category: 'couples', level: 'Easy',
    blurb: 'A full, warm hug: arms around each other with heads resting on shoulders.',
    cues: ['Step close and hug', 'A: arms around B’s waist', 'B: arms up around A’s neck'],
    view: { azimuth: 25 },
    figures: [
      fig('a', { shoulderL: [-60, -52, 0], elbowL: [-72, 0, 0], shoulderR: [-60, 52, 0], elbowR: [-72, 0, 0], head: [10, 0, -12], chest: [4, 0, 0] }, { pos: [-0.14, 0], rotY: 90 }),
      fig('b', { shoulderL: [-112, -22, 0], elbowL: [-70, 0, 0], shoulderR: [-112, 22, 0], elbowR: [-70, 0, 0], head: [0, 0, 14], ankleL: [14, 0, 0], ankleR: [14, 0, 0] }, { pos: [0.14, 0], rotY: -90 }),
    ],
  },
  {
    id: 'face-to-face', name: 'Face to Face', category: 'couples', level: 'Easy',
    blurb: 'Holding both hands low between you, smiling at each other. Simple and sweet.',
    cues: ['Face each other a step apart', 'Hold both hands low between you', 'Look at each other and laugh'],
    view: { azimuth: 0 },
    figures: [
      fig('a', { shoulderL: [-38, 0, 4], elbowL: [-22, 0, 0], shoulderR: [-38, 0, -4], elbowR: [-22, 0, 0], head: [10, 0, 0] }, { pos: [-0.27, 0], rotY: 90 }),
      fig('b', { shoulderL: [-38, 0, 4], elbowL: [-22, 0, 0], shoulderR: [-38, 0, -4], elbowR: [-22, 0, 0], head: [-6, 0, 0], ...kneePopL }, { pos: [0.27, 0], rotY: -90 }),
    ],
  },

  /* ------------------------------ more GROUP ------------------------------ */
  {
    id: 'group-wave', name: 'Wave Hello', category: 'group', level: 'Easy',
    blurb: 'Everybody waves at the camera, each in their own way. Never stiff, always happy.',
    cues: ['Stand in a loose line', 'Everyone waves, with different hands and heights', 'Big smiles!'],
    figures: [
      fig('b', { shoulderR: [-12, 0, -118], elbowR: [0, 0, -52], head: [0, -6, -6], ...kneePopL }, { pos: [-0.75, -0.06], rotY: 12 }),
      fig('a', { shoulderL: [-12, 0, 130], elbowL: [0, 0, 30], head: [-4, 0, 0] }, { pos: [-0.25, 0.06] }),
      fig('b', { shoulderL: [-10, 0, 150], shoulderR: [-10, 0, -150], head: [-8, 0, 0] }, { pos: [0.25, 0.06] }),
      fig('a', { shoulderR: [-12, 0, -118], elbowR: [0, 0, -52], ...handOnHipL }, { pos: [0.75, -0.06], rotY: -12 }),
    ],
  },
  {
    id: 'picnic', name: 'Picnic Circle', category: 'group', level: 'Easy',
    blurb: 'Friends sitting on the floor in a loose semicircle. Relaxed and natural.',
    cues: ['Sit in a semicircle facing the camera', 'Mix it up: cross-legged, lounging, knees up', 'Talk to each other, then glance at the lens'],
    figures: [
      fig('b', { hipL: [-84, 0, 4], kneeL: [12, 0, 0], hipR: [-104, 0, -4], kneeR: [110, 0, 0], spine: [-20, 0, 0], shoulderL: [46, 0, 22], shoulderR: [46, 0, -22], head: [-10, -10, 0] }, { pos: [-0.62, -0.1], rotY: 40 }),
      fig('a', { hipL: seq('x', -82, 'z', 42, 'y', 90), kneeL: [138, 0, 0], hipR: seq('x', -82, 'z', -42, 'y', -90), kneeR: [138, 0, 0], shoulderL: [-34, 0, 14], elbowL: [-24, 0, 0], shoulderR: [-34, 0, -14], elbowR: [-24, 0, 0] }, { pos: [0, 0.1] }),
      fig('b', { hipL: [-122, 0, 6], kneeL: [150, 0, 0], hipR: [-122, 0, -6], kneeR: [150, 0, 0], spine: [16, 0, 0], chest: [14, 0, 0], head: [6, 14, 10], shoulderL: [-64, 0, -6], elbowL: [-42, 0, 0], shoulderR: [-64, 0, 6], elbowR: [-42, 0, 0] }, { pos: [0.62, -0.1], rotY: -40 }),
    ],
  },
);

for (const p of POSES) if (['stool-perch', 'bench-lean', 'knees-up'].includes(p.id)) p.category = 'sitting';

// Display order: grouped by category
const ORDER = ['solo', 'editorial', 'casual', 'sitting', 'artistic', 'fitness', 'couples', 'family', 'group'];
POSES.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));

export const blankPose = () => ({
  id: 'custom-' + Date.now().toString(36),
  name: 'My Pose',
  category: 'solo',
  level: 'Custom',
  custom: true,
  blurb: 'Your own pose, built in the editor.',
  cues: ['Match the guide', 'Relax your shoulders', 'Breathe out and smile'],
  figures: [fig('b', {})],
});
