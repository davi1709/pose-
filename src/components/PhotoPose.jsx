import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import PoseViewer from './PoseViewer.jsx';
import { poseFromImage, CONNECTIONS, imageFromSource } from '../lib/photoPose.js';
import { cx, haptic } from '../lib/haptics.js';

const BODIES = [['b', 'Build B'], ['a', 'Build A'], ['c', 'Child']];

/** Small JPEG thumbnail of the reference photo, kept with the pose (shown as picture-in-picture in the camera). */
async function thumbOf(src, max = 220) {
  const c = await imageFromSource(src, max);
  return c.toDataURL('image/jpeg', 0.7);
}

export default function PhotoPose({ initialImage, onBack, onEdit, onSave, onShoot }) {
  const [image, setImage] = useState(initialImage || null);
  const [status, setStatus] = useState(initialImage ? 'loading' : 'pick');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [body, setBody] = useState('b');
  const [name, setName] = useState('Pose from photo');
  const [ref, setRef] = useState(null);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const overlayRef = useRef(null);
  const imgRef = useRef(null);

  // run detection whenever a new image arrives
  useEffect(() => {
    if (!image) return;
    let alive = true;
    setStatus('loading');
    setMessage('Getting ready…');
    poseFromImage(image, { onStatus: (m) => alive && setMessage(m) })
      .then(async (r) => {
        if (!alive) return;
        setResult(r);
        setRef(await thumbOf(image));
        setStatus('done');
        haptic([10, 30, 10]);
      })
      .catch((e) => {
        if (!alive) return;
        setStatus('error');
        setMessage(
          e.message === 'NO_PERSON'
            ? 'We couldn’t find a person in this photo. Try one where the whole body is visible, with one person and good light.'
            : 'The pose AI couldn’t load. Check your connection and try again.',
        );
      });
    return () => {
      alive = false;
    };
  }, [image]);

  // draw the detected skeleton over the photo
  useEffect(() => {
    const cv = overlayRef.current, im = imgRef.current;
    if (!cv || !im || !result) return;
    const draw = () => {
      const w = im.clientWidth, h = im.clientHeight;
      cv.width = w * 2;
      cv.height = h * 2;
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      const g = cv.getContext('2d');
      g.scale(2, 2);
      const L = result.landmarks2d;
      g.lineCap = 'round';
      g.lineWidth = 3.5;
      g.strokeStyle = 'rgba(196, 181, 253, 0.95)';
      g.shadowColor = 'rgba(124, 58, 237, .8)';
      g.shadowBlur = 8;
      for (const [a, b] of CONNECTIONS) {
        if ((L[a].visibility ?? 1) < 0.35 || (L[b].visibility ?? 1) < 0.35) continue;
        g.beginPath();
        g.moveTo(L[a].x * w, L[a].y * h);
        g.lineTo(L[b].x * w, L[b].y * h);
        g.stroke();
      }
      g.fillStyle = '#fff';
      for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
        if ((L[i].visibility ?? 1) < 0.35) continue;
        g.beginPath();
        g.arc(L[i].x * w, L[i].y * h, 4, 0, Math.PI * 2);
        g.fill();
      }
    };
    if (im.complete) draw();
    else im.onload = draw;
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [result, status]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setImage(rd.result);
    rd.readAsDataURL(f);
  };

  // stable preview object for the 3D viewer (only changes when the result or build changes)
  const preview = useMemo(() => result && { id: 'photo-preview', figures: [{ ...result.figure, body }] }, [result, body]);
  const buildPose = () => ({
    id: 'photo-' + Date.now().toString(36),
    name: name.trim() || 'Pose from photo',
    category: 'solo',
    level: 'Custom',
    custom: true,
    fromPhoto: true,
    refPhoto: ref,
    blurb: 'Created from your photo. Tweak it in the editor, then match it in the camera.',
    cues: ['Line yourself up with the guide', 'Match the arms first, then the legs', 'Relax your shoulders and breathe out'],
    figures: [{ ...result.figure, body }],
    updatedAt: Date.now(),
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950 animate-fade-in">
      <div className="safe-top flex items-center gap-3 px-4 pb-3">
        <button onClick={onBack} aria-label="Back" className="press glass-dark grid h-10 w-10 place-items-center rounded-full"><Icon name="back" size={20} stroke={2.2} /></button>
        <div>
          <div className="text-[16px] font-semibold">Photo → Pose</div>
          <div className="text-[12px] text-white/45">Turn any photo into a 3D guide</div>
        </div>
      </div>

      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {status === 'pick' && (
        <div className="flex flex-1 items-center justify-center px-5">
          <div className="w-full max-w-md animate-fade-up">
            <div className="relative mx-auto mb-6 grid h-44 w-full place-items-center overflow-hidden rounded-[28px] bg-gradient-to-br from-lilac-500/25 via-ink-800 to-ink-900 ring-1 ring-white/10">
              <div className="flex items-center gap-5">
                <div className="grid h-24 w-20 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Icon name="image" size={30} className="text-white/70" /></div>
                <Icon name="next" size={26} className="text-lilac-300" />
                <div className="grid h-24 w-20 place-items-center rounded-2xl bg-lilac-500/25 ring-1 ring-lilac-400/40"><Icon name="ghost" size={30} className="text-lilac-200" /></div>
              </div>
            </div>
            <h1 className="text-center font-display text-[30px] leading-tight">Copy any pose</h1>
            <p className="mx-auto mt-2 max-w-xs text-center text-[14px] text-white/55">Pick a photo you love, from Pinterest, a magazine or a friend, and we’ll rebuild the pose on a 3D mannequin.</p>
            <div className="mt-6 space-y-2.5">
              <button onClick={() => galleryRef.current?.click()} className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-ink-950"><Icon name="image" size={19} /> Choose a photo</button>
              <button onClick={() => cameraRef.current?.click()} className="press glass flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold"><Icon name="camera" size={19} /> Take a photo</button>
            </div>
            <ul className="mt-6 space-y-1.5 text-[12.5px] text-white/45">
              <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 text-lilac-300" /> Whole body in frame, head to toes</li>
              <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 text-lilac-300" /> One person per photo. For couples, add each person in the editor</li>
              <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 text-lilac-300" /> Runs on your device; photos are never uploaded</li>
            </ul>
          </div>
        </div>
      )}

      {(status === 'loading' || status === 'error') && image && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
          <div className="relative max-h-[55dvh] overflow-hidden rounded-3xl ring-1 ring-white/10">
            <img src={image} alt="" className="max-h-[55dvh] object-contain opacity-80" />
            {status === 'loading' && <div className="absolute inset-x-0 h-24 animate-[scan_1.8s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-lilac-400/40 to-transparent" />}
          </div>
          {status === 'loading' ? (
            <div className="flex items-center gap-2 text-[14px] text-white/70"><span className="h-2 w-2 animate-ping rounded-full bg-lilac-400" />{message}</div>
          ) : (
            <div className="max-w-sm text-center">
              <p className="text-[14px] text-white/70">{message}</p>
              <button onClick={() => setStatus('pick')} className="press mt-4 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-ink-950">Try another photo</button>
            </div>
          )}
        </div>
      )}

      {status === 'done' && preview && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-1 gap-2 px-3 lg:gap-4 lg:px-6">
            <div className="relative flex min-w-0 flex-1 items-center justify-center">
              <div className="relative">
                <img ref={imgRef} src={image} alt="" className="max-h-[52dvh] max-w-full rounded-2xl object-contain lg:max-h-[78dvh]" />
                <canvas ref={overlayRef} className="pointer-events-none absolute left-0 top-0" />
                <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10.5px] font-medium backdrop-blur">Photo</span>
              </div>
            </div>
            <div className="relative min-w-0 flex-1 rounded-2xl bg-[radial-gradient(ellipse_at_50%_35%,#2d2645,#13111a_70%)]">
              <PoseViewer pose={preview} autoRotate={false} />
              <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10.5px] font-medium backdrop-blur">3D · drag to rotate</span>
            </div>
          </div>
          <div className="safe-bottom space-y-3 px-4 pt-4 lg:w-[380px] lg:px-6 lg:pt-10">
            <input value={name} onChange={(e) => setName(e.target.value)} className="glass h-11 w-full rounded-xl px-4 text-[14.5px] font-semibold outline-none focus:ring-2 focus:ring-lilac-400/60" aria-label="Pose name" />
            <div className="flex gap-1.5">
              {BODIES.map(([b, l]) => (
                <button key={b} onClick={() => setBody(b)} className={cx('press flex-1 rounded-xl py-2 text-[12.5px] font-medium', body === b ? 'bg-lilac-500 text-white' : 'bg-white/[0.07] text-white/70')}>{l}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(buildPose())} className="press glass flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold"><Icon name="sliders" size={16} /> Fine-tune</button>
              <button onClick={() => { haptic(12); onSave(buildPose()); }} className="press glass flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold"><Icon name="bookmark" size={16} /> Save</button>
            </div>
            <button onClick={() => { haptic(14); onShoot(buildPose()); }} className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-ink-950"><Icon name="camera" size={19} stroke={2.1} /> Shoot with this pose</button>
            <button onClick={() => { setResult(null); setImage(null); setStatus('pick'); }} className="press w-full py-1 text-[13px] text-lilac-300">Use a different photo</button>
          </div>
        </div>
      )}
    </div>
  );
}
