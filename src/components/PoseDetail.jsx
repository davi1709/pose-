import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import PoseViewer from './PoseViewer.jsx';
import { cx, haptic } from '../lib/haptics.js';
import { sharePose } from '../lib/share.js';

const TIPS = {
  solo: 'Hold the phone at chest height and tilt it slightly down for natural proportions.',
  couples: 'Shoot from slightly below eye level and leave a little headroom above the taller partner.',
  group: 'Step back and zoom in rather than going wide, so faces at the edges don’t stretch.',
  editorial: 'Lower the camera to hip height. It makes legs look longer and the pose more confident.',
  casual: 'Use burst mode or a 10s timer and keep moving, because candid shots need a little motion.',
  artistic: 'Put the light behind or beside the subject for shape and rim light.',
};

const VIEWS = [
  { id: 'front', label: 'Front', azimuth: 0 },
  { id: 'three', label: '¾', azimuth: 40 },
  { id: 'side', label: 'Side', azimuth: 90 },
  { id: 'back', label: 'Back', azimuth: 180 },
  { id: 'above', label: 'Above', azimuth: 20, elevation: 38 },
];

export default function PoseDetail({ pose, fav, onFav, onBack, onShoot, onEdit, onDelete }) {
  const [spin, setSpin] = useState(true);
  const [toast, setToast] = useState(null);
  const share = async () => {
    haptic(8);
    const r = await sharePose(pose);
    if (r === 'copied') setToast('Link copied: send it to anyone');
    else if (r === 'failed') setToast('Couldn’t share from this browser');
    if (r === 'copied' || r === 'failed') setTimeout(() => setToast(null), 2200);
  };
  const [view, setView] = useState(null);
  const rendererRef = useRef(null);

  const setAngle = (v) => {
    haptic(6);
    setView(v.id);
    setSpin(false);
    rendererRef.current?.reframe({ azimuth: (pose.view?.azimuth || 0) + v.azimuth, elevation: v.elevation ?? 4 });
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink-950 animate-fade-in lg:flex-row">
      {/* 3D stage */}
      <div className="relative h-[58dvh] flex-none overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#2d2645_0%,#13111a_62%,#09080d_100%)] lg:h-full lg:flex-1">
        <div className="absolute bottom-[14%] left-1/2 h-10 w-2/3 max-w-md -translate-x-1/2 rounded-[100%] bg-lilac-500/15 blur-2xl" />
        <PoseViewer pose={pose} autoRotate={spin} rendererRef={rendererRef} onInteract={() => { setSpin(false); setView(null); }} />

        <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4">
          <button onClick={onBack} aria-label="Back" className="press glass-dark grid h-10 w-10 place-items-center rounded-full">
            <Icon name="back" size={20} stroke={2.2} />
          </button>
          <div className="flex gap-2">
            <button onClick={share} aria-label="Share pose" className="press glass-dark grid h-10 w-10 place-items-center rounded-full">
              <Icon name="share" size={17} />
            </button>
            {pose.custom && (
              <button onClick={() => onDelete(pose)} aria-label="Delete pose" className="press glass-dark grid h-10 w-10 place-items-center rounded-full text-rose-300">
                <Icon name="trash" size={17} />
              </button>
            )}
            <button
              onClick={() => { haptic(10); onFav(pose.id); }}
              aria-label="Favourite"
              className={cx('press grid h-10 w-10 place-items-center rounded-full', fav ? 'bg-lilac-500 text-white' : 'glass-dark')}
            >
              <Icon name="heart" size={18} stroke={2} fill={fav ? 'currentColor' : 'none'} className={fav ? 'animate-pop' : ''} />
            </button>
          </div>
        </div>

        {toast && <div className="absolute left-1/2 top-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2 text-[13px] backdrop-blur animate-pop">{toast}</div>}
        {pose.refPhoto && (
          <img src={pose.refPhoto} alt="Reference photo" className="absolute bottom-24 left-4 w-20 rounded-xl shadow-xl ring-2 ring-white/20 animate-fade-up lg:w-28" />
        )}
        <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-2 lg:bottom-6">
          <div className="glass-dark flex items-center gap-0.5 rounded-full p-1 text-[12px] font-medium">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => setAngle(v)} className={cx('press rounded-full px-3 py-1.5 transition-colors', view === v.id ? 'bg-white text-ink-950' : 'text-white/70')}>
                {v.label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-white/15" />
            <button onClick={() => { setSpin((s) => !s); setView(null); }} className={cx('press flex items-center gap-1 rounded-full px-3 py-1.5', spin ? 'bg-lilac-500 text-white' : 'text-white/70')}>
              <Icon name="rotate" size={13} stroke={2.2} /> 360°
            </button>
          </div>
          <div className="text-[11px] text-white/35">Drag to rotate · pinch to zoom</div>
        </div>
      </div>

      {/* Info sheet */}
      <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-[30px] bg-ink-900 ring-1 ring-white/[0.06] animate-sheet lg:mt-0 lg:w-[420px] lg:flex-none lg:rounded-none">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 lg:hidden" />
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6 pt-4 lg:px-8 lg:pt-16">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-lilac-300">
            <span>{pose.category}</span><span className="text-white/20">•</span>
            <span className="text-white/45">{pose.level}</span><span className="text-white/20">•</span>
            <span className="text-white/45">{pose.figures.length > 1 ? `${pose.figures.length} people` : 'Solo'}</span>
          </div>
          <h1 className="mt-2 font-display text-[32px] leading-[1.05] tracking-tight">{pose.name}</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">{pose.blurb}</p>

          <h2 className="mt-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/40">How to nail it</h2>
          <ol className="mt-3 space-y-2">
            {pose.cues.map((c, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.05] animate-fade-up" style={{ animationDelay: `${120 + i * 60}ms` }}>
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-lilac-500/20 text-[12px] font-bold text-lilac-200">{i + 1}</span>
                <span className="pt-0.5 text-[14px] text-white/85">{c}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex gap-3 rounded-2xl bg-gradient-to-br from-lilac-500/15 to-transparent p-3.5 ring-1 ring-lilac-400/15">
            <Icon name="sparkles" size={18} className="mt-0.5 flex-none text-lilac-300" />
            <p className="text-[13px] leading-relaxed text-white/70"><span className="font-semibold text-white">Pro tip: </span>{TIPS[pose.category] || TIPS.solo}</p>
          </div>
        </div>

        <div className="safe-bottom flex gap-2.5 border-t border-white/[0.06] bg-ink-900/90 px-5 pt-3 backdrop-blur-xl lg:px-8">
          <button onClick={() => onEdit(pose)} className="press glass flex h-14 flex-none items-center gap-2 rounded-2xl px-5 text-[15px] font-semibold">
            <Icon name="sliders" size={18} /> Adjust
          </button>
          <button
            onClick={() => { haptic(14); onShoot(pose); }}
            className="press flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-ink-950 shadow-xl shadow-white/10"
          >
            <Icon name="camera" size={19} stroke={2.1} /> Pose with camera
          </button>
        </div>
      </div>
    </div>
  );
}
