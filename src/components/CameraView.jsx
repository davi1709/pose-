import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import PoseViewer from './PoseViewer.jsx';
import CaptureReview from './CaptureReview.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { useThumbnail } from '../hooks/useThumbnail.js';
import { cx, haptic } from '../lib/haptics.js';

const TIMERS = [0, 3, 5, 10];
const STYLES = [
  { id: 'ghost', label: 'Ghost', icon: 'ghost' },
  { id: 'silhouette', label: 'Solid', icon: 'user' },
  { id: 'outline', label: 'Outline', icon: 'scan' },
];
const DEFAULT_T = { x: 0, y: 0, s: 1 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const Guide = memo(PoseViewer);

export default function CameraView({ pose, poses, onClose, onEdit, onPoseChange, onShot, lastShot, onCopyPose }) {
  const [facing, setFacing] = useState('environment');
  const { videoRef, status, retry, zoomCaps, zoom, setZoom } = useCamera(facing);
  const [backdrop, setBackdrop] = useState(null); // null | 'practice' | dataURL of uploaded photo
  const [timer, setTimer] = useState(3);
  const [grid, setGrid] = useState(false);
  const [style, setStyle] = useState('ghost');
  const [opacity, setOpacity] = useState(0.55);
  const [turn, setTurn] = useState(0);
  const [tilt, setTilt] = useState(pose.view?.elevation ?? 4); // camera height: <0 low angle, >0 from above
  const [rot3d, setRot3d] = useState(false); // one-finger drag rotates the ghost in 3D
  const [t, setT] = useState(DEFAULT_T);
  const [mirrorGuide, setMirrorGuide] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [panel, setPanel] = useState(false);
  const [cue, setCue] = useState(0);
  const [count, setCount] = useState(null);
  const [flash, setFlash] = useState(0);
  const [review, setReview] = useState(null);
  const [toast, setToast] = useState(null);
  const [refBig, setRefBig] = useState(false);

  const rootRef = useRef(null);
  const guideRef = useRef(null);
  const imgRef = useRef(null);
  const fileRef = useRef(null);

  const selfie = facing === 'user';
  const mirrorVideo = selfie && !backdrop;
  const hasFeed = status === 'live' || !!backdrop;

  // Mirror the guide by default for the selfie camera so "left" cues match what you see.
  useEffect(() => setMirrorGuide(selfie), [selfie]);
  useEffect(() => {
    setCue(0);
    setTilt(pose.view?.elevation ?? 4);
  }, [pose.id, pose.view?.elevation]);

  // View the ghost from higher or lower, like moving the photographer's camera up or down
  useEffect(() => {
    guideRef.current?.reframe({ azimuth: pose.view?.azimuth ?? 0, elevation: tilt });
  }, [tilt, pose]);

  // Rotate the whole figure group to match the subject's angle.
  useEffect(() => {
    const r = guideRef.current;
    if (!r) return;
    r.stage.group.rotation.y = (turn * Math.PI) / 180;
    r.invalidate();
  }, [turn, pose]);

  const toastTimer = useRef(0);
  const say = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1400);
  };

  /* ---------------- Gestures: drag to move, pinch to resize, double-tap to reset ---------------- */
  const pts = useRef(new Map());
  const g0 = useRef(null);
  const lastTap = useRef(0);
  const snapshot = () => {
    const arr = [...pts.current.values()];
    const mid = arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
    const dist = arr.length > 1 ? Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) : 0;
    g0.current = { mid, dist, t, turn, tilt };
  };
  const onDown = (e) => {
    if (count !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot();
    const now = performance.now();
    if (pts.current.size === 1 && now - lastTap.current < 280) {
      setT(DEFAULT_T);
      haptic(10);
      say('Guide re-centred');
    }
    lastTap.current = now;
  };
  const onMove = (e) => {
    if (!pts.current.has(e.pointerId) || !g0.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const arr = [...pts.current.values()];
    const mid = arr.reduce((a, p) => ({ x: a.x + p.x / arr.length, y: a.y + p.y / arr.length }), { x: 0, y: 0 });
    const s0 = g0.current;
    if (rot3d && arr.length === 1) {
      setTurn(Math.round(clamp(s0.turn + (mid.x - s0.mid.x) * 0.45, -180, 180)));
      setTilt(Math.round(clamp(s0.tilt + (mid.y - s0.mid.y) * 0.3, -35, 80)));
      return;
    }
    let s = s0.t.s;
    if (arr.length > 1 && s0.dist > 0) s = clamp(s0.t.s * (Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) / s0.dist), 0.35, 2.6);
    setT({ x: s0.t.x + (mid.x - s0.mid.x), y: s0.t.y + (mid.y - s0.mid.y), s });
  };
  const onUp = (e) => {
    pts.current.delete(e.pointerId);
    snapshot();
  };
  const onWheel = (e) => setT((p) => ({ ...p, s: clamp(p.s * (e.deltaY > 0 ? 0.94 : 1.06), 0.35, 2.6) }));

  /* ---------------- Capture ---------------- */
  const capture = useCallback(() => {
    const root = rootRef.current;
    const R = root.getBoundingClientRect();
    let src, sw, sh;
    if (backdrop && backdrop !== 'practice') {
      src = imgRef.current;
      sw = src.naturalWidth;
      sh = src.naturalHeight;
    } else if (status === 'live') {
      src = videoRef.current;
      sw = src.videoWidth;
      sh = src.videoHeight;
    }
    // Crop exactly what's visible on screen (object-cover), at native resolution where possible.
    let cw, ch, cx0 = 0, cy0 = 0;
    if (src && sw) {
      const k = Math.max(R.width / sw, R.height / sh);
      cw = R.width / k;
      ch = R.height / k;
      cx0 = (sw - cw) / 2;
      cy0 = (sh - ch) / 2;
    } else {
      cw = R.width * 2;
      ch = R.height * 2;
    }
    const W = Math.round(cw), H = Math.round(ch);
    const plain = document.createElement('canvas');
    plain.width = W;
    plain.height = H;
    const ctx = plain.getContext('2d');
    if (src && sw) {
      ctx.save();
      if (mirrorVideo) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(src, cx0, cy0, cw, ch, 0, 0, W, H);
      ctx.restore();
    } else {
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#2a2340');
      grd.addColorStop(1, '#0d0b13');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }

    // Second version with the ghost composited at its on-screen position.
    const withGuide = document.createElement('canvas');
    withGuide.width = W;
    withGuide.height = H;
    const g = withGuide.getContext('2d');
    g.drawImage(plain, 0, 0);
    const sr = guideRef.current;
    if (sr && showGuide) {
      sr.renderNow();
      const gc = sr.canvas.getBoundingClientRect();
      const f = W / R.width;
      g.save();
      g.globalAlpha = opacity;
      if (mirrorGuide) {
        g.translate((gc.right - R.left) * f, (gc.top - R.top) * f);
        g.scale(-1, 1);
      } else {
        g.translate((gc.left - R.left) * f, (gc.top - R.top) * f);
      }
      g.drawImage(sr.canvas, 0, 0, gc.width * f, gc.height * f);
      g.restore();
    }

    const shot = {
      at: Date.now(),
      poseId: pose.id,
      poseName: pose.name,
      url: plain.toDataURL('image/jpeg', 0.92),
      guideUrl: withGuide.toDataURL('image/jpeg', 0.92),
    };
    setFlash((n) => n + 1);
    haptic([20, 40, 20]);
    onShot(shot);
    setReview(shot);
  }, [backdrop, status, videoRef, mirrorVideo, showGuide, opacity, mirrorGuide, pose, onShot]);

  /** Grab the current frame (no guide) and turn the person in it into a new pose. */
  const copyPose = () => {
    const v = videoRef.current;
    let url = null;
    if (backdrop && backdrop !== 'practice') url = backdrop;
    else if (status === 'live' && v?.videoWidth && v.readyState >= 2) {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const g = c.getContext('2d');
      if (mirrorVideo) {
        g.translate(c.width, 0);
        g.scale(-1, 1);
      }
      g.drawImage(v, 0, 0);
      url = c.toDataURL('image/jpeg', 0.9);
    }
    if (!url) return say('No camera image to copy');
    haptic([10, 30, 10]);
    onCopyPose?.(url);
  };

  // Countdown driver
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      setCount(null);
      capture();
      return;
    }
    haptic(count <= 3 ? 14 : 6);
    const id = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [count, capture]);

  const shutter = () => {
    if (count !== null) {
      setCount(null);
      haptic(8);
      return;
    }
    if (timer) setCount(timer);
    else capture();
  };

  // Keyboard: space = shoot, esc = close, ←/→ = cues
  useEffect(() => {
    const k = (e) => {
      if (review) return;
      if (e.code === 'Space') { e.preventDefault(); shutter(); }
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCue((c) => (c + 1) % pose.cues.length);
      if (e.key === 'ArrowLeft') setCue((c) => (c - 1 + pose.cues.length) % pose.cues.length);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setBackdrop(rd.result);
    rd.readAsDataURL(f);
    e.target.value = '';
  };

  const zoomStops = zoomCaps ? [0.5, 1, 2, 3, 5].filter((z) => z >= zoomCaps.min - 0.01 && z <= zoomCaps.max + 0.01) : [];

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 overflow-hidden bg-black text-white animate-fade-in">
      {/* Feed */}
      <video ref={videoRef} playsInline muted autoPlay className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', status === 'live' && !backdrop ? 'opacity-100' : 'opacity-0', mirrorVideo && '-scale-x-100')} />
      {backdrop && backdrop !== 'practice' && <img ref={imgRef} src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {backdrop === 'practice' && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#3a3058,#120f1a_70%)]" />}

      {grid && (
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 animate-fade-in">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border-[0.5px] border-white/25" />)}
        </div>
      )}

      {/* Gesture catcher */}
      <div className="absolute inset-0 touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} />

      {/* Ghost guide */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[150px] top-[96px] will-change-transform"
        style={{
          transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.s}) scaleX(${mirrorGuide ? -1 : 1})`,
          opacity: showGuide && hasFeed ? opacity : 0,
          transition: pts.current.size ? 'opacity .3s' : 'transform .35s var(--ease-out-expo), opacity .3s',
          filter: style === 'ghost' ? 'drop-shadow(0 0 18px rgba(171,148,251,.45))' : 'drop-shadow(0 0 6px rgba(0,0,0,.35))',
        }}
      >
        <Guide pose={pose} orbit={false} ground={false} preserve fill={0.92} mode={style} modeColor="#ffffff" rendererRef={guideRef} />
      </div>

      {/* Countdown + flash */}
      {count !== null && count > 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div key={count} className="animate-count font-display text-[160px] font-light leading-none text-white drop-shadow-[0_4px_30px_rgba(0,0,0,.5)]">{count}</div>
        </div>
      )}
      {flash > 0 && <div key={flash} className="pointer-events-none absolute inset-0 bg-white animate-flash" />}

      {/* Top bar */}
      <div className="safe-top absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pb-6">
        <div className="flex items-center justify-between">
          <button onClick={onClose} aria-label="Close camera" className="press glass-dark grid h-10 w-10 place-items-center rounded-full"><Icon name="x" size={19} stroke={2.2} /></button>
          <div className="glass-dark flex items-center gap-0.5 rounded-full p-1">
            <TopBtn label="Timer" onClick={() => { const n = TIMERS[(TIMERS.indexOf(timer) + 1) % TIMERS.length]; setTimer(n); say(n ? `Timer ${n}s` : 'Timer off'); }} active={!!timer}>
              <Icon name="timer" size={17} />
              {!!timer && <span className="absolute right-0.5 top-0 text-[9px] font-bold">{timer}</span>}
            </TopBtn>
            <TopBtn label="Grid" onClick={() => setGrid((v) => !v)} active={grid}><Icon name="grid" size={17} /></TopBtn>
            <TopBtn label="Guide style" onClick={() => { const n = STYLES[(STYLES.findIndex((s) => s.id === style) + 1) % STYLES.length]; setStyle(n.id); say(`${n.label} guide`); }}>
              <Icon name={STYLES.find((s) => s.id === style).icon} size={17} />
            </TopBtn>
            <TopBtn label="Flip camera" onClick={() => { setFacing((f) => (f === 'user' ? 'environment' : 'user')); setBackdrop(null); }}><Icon name="flip" size={17} /></TopBtn>
          </div>
          <button onClick={() => onEdit(pose)} aria-label="Edit pose" className="press glass-dark grid h-10 w-10 place-items-center rounded-full"><Icon name="pen" size={17} /></button>
        </div>

        {/* Coaching cue */}
        {hasFeed && (
          <button onClick={() => { haptic(6); setCue((c) => (c + 1) % pose.cues.length); }} className="press glass-dark mx-auto mt-3 flex max-w-[92%] items-center gap-2.5 rounded-full py-2 pl-2 pr-3.5 text-left animate-fade-up">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-lilac-500"><Icon name="user" size={14} stroke={2.4} /></span>
            <span key={cue} className="text-[13.5px] font-medium leading-tight animate-fade-in">{pose.cues[cue]}</span>
            <span className="ml-1 flex-none text-[11px] font-semibold text-white/50">{cue + 1}/{pose.cues.length}</span>
          </button>
        )}
      </div>

      {/* Right rail */}
      {hasFeed && (
        <div className={cx('absolute right-3 flex -translate-y-1/2 flex-col gap-2 transition-all duration-300', panel ? 'top-[30%] z-10' : 'top-1/2')}>
          <RailBtn label="Rotate guide in 3D" active={rot3d} onClick={() => { setRot3d((v) => !v); haptic(8); say(rot3d ? 'Drag to move the guide' : 'Drag to turn & tilt the guide'); }}><Icon name="cube" size={18} /></RailBtn>
          <RailBtn label="Adjust guide" active={panel} onClick={() => setPanel((p) => !p)}><Icon name="sliders" size={18} /></RailBtn>
          <RailBtn label="Mirror guide" active={mirrorGuide} onClick={() => { setMirrorGuide((m) => !m); haptic(6); }}><Icon name="mirror" size={18} /></RailBtn>
          <RailBtn label={showGuide ? 'Hide guide' : 'Show guide'} active={!showGuide} onClick={() => setShowGuide((s) => !s)}><Icon name="eye" size={18} /></RailBtn>
          <RailBtn label="Copy pose from camera" onClick={copyPose}><Icon name="wand" size={18} /></RailBtn>
          <RailBtn label="Reset" onClick={() => { setT(DEFAULT_T); setTurn(0); setTilt(pose.view?.elevation ?? 4); setOpacity(0.55); haptic(8); say('Guide reset'); }}><Icon name="rotate" size={18} /></RailBtn>
        </div>
      )}

      {pose.refPhoto && hasFeed && (
        <button onClick={() => setRefBig((b) => !b)} className={cx('absolute left-3 overflow-hidden rounded-xl shadow-xl ring-2 ring-white/30 transition-all duration-300', refBig ? 'top-[120px] w-44' : 'top-[120px] w-16')} aria-label="Reference photo">
          <img src={pose.refPhoto} alt="" className="w-full" />
        </button>
      )}

      {toast && <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-[13px] font-medium backdrop-blur-md animate-pop">{toast}</div>}

      {/* Camera unavailable */}
      {!hasFeed && status !== 'starting' && (
        <Unavailable status={status} onRetry={retry} onUpload={() => fileRef.current?.click()} onPractice={() => setBackdrop('practice')} />
      )}
      {!hasFeed && status === 'starting' && (
        <div className="absolute inset-0 grid place-items-center text-[14px] text-white/60"><div className="flex items-center gap-2"><span className="h-2 w-2 animate-ping rounded-full bg-lilac-400" />Waking up the camera…</div></div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* Bottom controls */}
      <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent pt-10 [&>*]:pointer-events-auto">
        {panel && hasFeed && (
          <div className="glass-dark mx-3 mb-3 space-y-1 rounded-3xl px-4 py-3 animate-fade-up sm:mx-auto sm:max-w-md">
            <Slider label="Visibility" value={opacity} min={0.15} max={0.95} step={0.01} fmt={(v) => Math.round(v * 100) + '%'} onChange={setOpacity} />
            <Slider label="Size" value={t.s} min={0.35} max={2.6} step={0.01} fmt={(v) => v.toFixed(2) + '×'} onChange={(s) => setT((p) => ({ ...p, s }))} />
            <Slider label="Turn" value={turn} min={-180} max={180} step={1} fmt={(v) => v + '°'} onChange={setTurn} />
            <Slider label="Cam height" value={tilt} min={-35} max={80} step={1} fmt={(v) => (v > 0 ? '↓' : v < 0 ? '↑' : '') + Math.abs(v) + '°'} onChange={setTilt} />
            <div className="flex gap-1.5">
              {[['Low', -20], ['Eye', 4], ['High', 30], ['Top', 62]].map(([l, v]) => (
                <button key={l} onClick={() => { setTilt(v); haptic(6); }} className={cx('press flex-1 rounded-xl py-1.5 text-[11.5px] font-medium', Math.abs(tilt - v) < 3 ? 'bg-lilac-500 text-white' : 'bg-white/[0.07] text-white/65')}>
                  {l === 'Low' ? 'Low angle' : l === 'Eye' ? 'Eye level' : l === 'High' ? 'From above' : 'Overhead'}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 pt-1">
              {STYLES.map((s) => (
                <button key={s.id} onClick={() => setStyle(s.id)} className={cx('press flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-medium', style === s.id ? 'bg-white text-ink-950' : 'bg-white/[0.07] text-white/70')}>
                  <Icon name={s.icon} size={14} /> {s.label}
                </button>
              ))}
            </div>
            <p className="pt-1 text-center text-[11px] text-white/40">Drag to move · pinch to resize · double-tap to re-centre · 3D button to turn & tilt by dragging</p>
          </div>
        )}

        {zoomStops.length > 1 && status === 'live' && !backdrop && (
          <div className="mb-3 flex justify-center">
            <div className="glass-dark flex gap-0.5 rounded-full p-1">
              {zoomStops.map((z) => (
                <button key={z} onClick={() => setZoom(z)} className={cx('press h-8 min-w-8 rounded-full px-2 text-[12px] font-semibold', Math.abs(zoom - z) < 0.05 ? 'bg-white/90 text-ink-950' : 'text-white/80')}>
                  {z}{Math.abs(zoom - z) < 0.05 ? '×' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <PoseStrip poses={poses} current={pose} onPick={(p) => { haptic(8); onPoseChange(p); }} />

        <div className="mx-auto mt-3 flex max-w-md items-center justify-between px-8">
          <button onClick={() => lastShot && setReview(lastShot)} className="press h-12 w-12 overflow-hidden rounded-2xl bg-white/10 ring-2 ring-white/20" aria-label="Last photo">
            {lastShot ? <img src={lastShot.url} alt="" className="h-full w-full object-cover" /> : <Icon name="image" size={18} className="mx-auto text-white/50" />}
          </button>
          <button onClick={shutter} aria-label="Take photo" className="press relative grid h-[78px] w-[78px] place-items-center rounded-full ring-[3.5px] ring-white/90">
            <span className={cx('grid place-items-center rounded-full transition-all duration-300', count !== null ? 'h-8 w-8 rounded-lg bg-rose-500' : 'h-[64px] w-[64px] bg-white')}>
              {count === null && !!timer && <span className="text-[12px] font-bold text-ink-950">{timer}s</span>}
            </span>
          </button>
          <button onClick={() => { const i = poses.findIndex((p) => p.id === pose.id); onPoseChange(poses[(i + 1) % poses.length]); haptic(8); }} className="press glass-dark grid h-12 w-12 place-items-center rounded-2xl" aria-label="Next pose">
            <Icon name="shuffle" size={18} />
          </button>
        </div>
        <div className="mt-1.5 h-4 text-center text-[11px] text-white/50">{count !== null ? 'Tap to cancel' : ''}</div>
      </div>

      {review && <CaptureReview shot={review} onClose={() => setReview(null)} />}
    </div>
  );
}

function TopBtn({ children, onClick, active, label }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={cx('press relative grid h-9 w-9 place-items-center rounded-full transition-colors', active ? 'bg-white/20 text-white' : 'text-white/80')}>
      {children}
    </button>
  );
}

function RailBtn({ children, onClick, active, label }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={cx('press grid h-11 w-11 place-items-center rounded-full backdrop-blur-xl transition-colors', active ? 'bg-white text-ink-950' : 'bg-black/35 text-white ring-1 ring-white/15')}>
      {children}
    </button>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex items-center gap-3">
      <span className="w-[70px] flex-none text-[12px] font-medium text-white/60">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} style={{ '--fill': fill + '%' }} onChange={(e) => onChange(+e.target.value)} />
      <span className="w-12 flex-none text-right text-[12px] tabular-nums text-white/80">{fmt(value)}</span>
    </label>
  );
}

function StripItem({ pose, active, onPick }) {
  const [thumb, ref] = useThumbnail(pose);
  return (
    <button ref={ref} onClick={() => onPick(pose)} className={cx('press h-[58px] w-[46px] flex-none overflow-hidden rounded-xl transition-all', active ? 'bg-white/25 ring-2 ring-white' : 'bg-white/10 opacity-75')}>
      {thumb && <img src={thumb} alt={pose.name} className="h-full w-full object-contain" />}
    </button>
  );
}

function PoseStrip({ poses, current, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('[data-active="1"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [current.id]);
  return (
    <div ref={ref} className="no-scrollbar flex gap-2 overflow-x-auto px-[calc(50%-23px)] py-1">
      {poses.map((p) => (
        <div key={p.id} data-active={p.id === current.id ? '1' : '0'}>
          <StripItem pose={p} active={p.id === current.id} onPick={onPick} />
        </div>
      ))}
    </div>
  );
}

function Unavailable({ status, onRetry, onUpload, onPractice }) {
  const copy = {
    denied: ['Camera access is off', 'Allow camera access in your browser’s site settings, then try again. If you’re viewing this inside an embedded preview, open the app in its own tab.'],
    insecure: ['Camera needs HTTPS', 'Browsers only allow the camera on secure (https://) pages or localhost.'],
    unavailable: ['No camera found', 'This device or browser has no camera available.'],
    busy: ['Camera is busy', 'Another app is using the camera. Close it and try again.'],
    error: ['Couldn’t start the camera', 'Something went wrong while opening the camera.'],
  }[status] || ['Camera unavailable', ''];
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-[radial-gradient(ellipse_at_50%_30%,#2a2340,#09080d_70%)] px-6">
      <div className="glass w-full max-w-sm rounded-[28px] p-6 text-center animate-fade-up">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><Icon name="camera" size={24} /></div>
        <h2 className="mt-4 text-[18px] font-semibold">{copy[0]}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">{copy[1]}</p>
        <div className="mt-5 space-y-2">
          {status !== 'insecure' && status !== 'unavailable' && (
            <button onClick={onRetry} className="press h-12 w-full rounded-2xl bg-white text-[14.5px] font-semibold text-ink-950">Try again</button>
          )}
          <button onClick={onUpload} className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-[14.5px] font-medium"><Icon name="upload" size={17} /> Use a photo as background</button>
          <button onClick={onPractice} className="press h-11 w-full rounded-2xl text-[14px] font-medium text-lilac-300">Practise without camera</button>
        </div>
      </div>
    </div>
  );
}
