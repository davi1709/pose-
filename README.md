# Posé: 3D pose guide with a live camera overlay

Pick a pose, or **create one from any photo**, see it as a 3D mannequin, then open the camera. A semi-transparent ghost of the pose sits over the live feed so you can line up and take the shot.

## Features
- **119 poses** in 12 categories: solo, cute, candid, editorial, casual, walls/trees/mirrors, sitting, artistic, fitness, couples, family (with a child mannequin) and groups of up to 4. Props include walls, trees, full-length mirrors with a live reflection, stools, benches, phone, cup, book, bag, flowers and sunglasses.
- **Sculpted, seamless mannequins**: one continuous skinned body per figure, no hard edges.
- **Live camera overlay**: drag, pinch and turn the ghost; **change the camera angle** (low angle → eye level → from above → overhead) with presets, a slider, or the 3D mode (drag to turn and tilt); Ghost, Solid or Outline styles; mirror; coaching cues; timer; zoom; capture with or without the guide; share sheet.
- **Photo → Pose (AI)**: pick or take a photo and MediaPipe Pose detects the body; the app rebuilds it on the mannequin. It runs **100% on the device**, and photos are never uploaded.
- **Copy pose from camera**: tap the wand in the camera view to turn the person in frame into a pose.
- **Direct-manipulation editor**: drag dots with your finger or mouse (IK hands and feet, swinging elbows and knees, a body-move dot) or grab any body part; precise sliders; mirror; undo; up to 4 people; add a person from a photo.
- **Share poses by link** (`#pose=…`, nothing uploaded), favourites, "My poses" (saved in the browser).
- **Installable (PWA)**: use "Add to Home Screen" on a phone.

## Run locally
```bash
npm install
npm run dev            # http://localhost:5173 (also shown on your LAN)
npm run build          # production build → dist/
```
Phones only allow the camera on **HTTPS**, so deploy it (below) to use it on a phone.

## Deploy (auto-update on every push)
1. Push this folder to a GitHub repository.
2. **Netlify**: *Add new site → Import from Git →* pick the repo. Settings come from `netlify.toml` (build `npm run build`, publish `dist`).
   **Vercel** works the same way: *New Project →* import the repo (`vercel.json` included).
3. Done. Every `git push` to `main` rebuilds and updates the live site automatically.

## Architecture
```
src/
├─ App.jsx                 Screen stack (library → detail → camera / editor / photo), create sheet, share-link import
├─ data/poses.js           119 poses, categories, mirrorJoints / reflect / seq() helpers
├─ three/
│  ├─ BodyMesh.js          Sculpted body: SDF of blended ellipsoids/capsules → Surface Nets mesh → soft skin weights
│  ├─ Mannequin.js         Skinned mannequin (17 bones), 3 render modes, joint highlight, props
│  ├─ PoseStage.js         Scene, lights, multi-figure poses, stage props, auto-grounding, framing, thumbnails
│  ├─ StageRenderer.js     Render-on-demand loop, OrbitControls, raycast picking
│  └─ PoseManipulator.js   Drag dots + body parts: two-bone IK, aim rotations, move person
├─ lib/
│  ├─ photoPose.js         MediaPipe Pose loader + landmark → joint-rotation retargeting
│  ├─ share.js             Pose ↔ URL hash encoding, native share / clipboard
│  ├─ storage.js, haptics.js
├─ hooks/                  useCamera (getUserMedia), useThumbnail (lazy, queued rendering)
└─ components/             Library, PoseCard, TabBar, PoseDetail, PoseViewer, CameraView,
                           CaptureReview, PoseEditor, PhotoPose
public/
├─ mediapipe-pose/         Self-hosted pose-AI model + WASM (~22 MB, loaded only when you use Photo → Pose)
├─ icons/, manifest.webmanifest
```

### Pose format
```js
{ id, name, category, level, blurb, cues: [...],
  props: [{ type: 'bench', pos: [x, z] }],            // optional stage props
  figures: [{ body: 'a' | 'b' | 'c', pos: [x, z], rotY, lift,
              joints: { hipR: [x, y, z], ... },          // degrees, XYZ (see Mannequin.js header)
              props: [{ type: 'phone', at: 'wristR' }] }] }
```
