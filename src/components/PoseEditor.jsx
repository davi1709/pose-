import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import PoseViewer from './PoseViewer.jsx';
import { JOINT_LABELS } from '../three/Mannequin.js';
import { mirrorJoints } from '../data/poses.js';
import { PoseManipulator } from '../three/PoseManipulator.js';
import { poseFromImage } from '../lib/photoPose.js';
import { cx, haptic } from '../lib/haptics.js';

const GROUPS = [
  { label: 'Body', joints: ['pelvis', 'spine', 'chest', 'neck', 'head'] },
  { label: 'Arms', joints: ['shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR'] },
  { label: 'Legs', joints: ['hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'] },
];
const AXES = [
  { i: 0, label: 'Bend', hint: 'forward / back' },
  { i: 1, label: 'Twist', hint: 'rotate' },
  { i: 2, label: 'Tilt', hint: 'side to side' },
];
const clone = (o) => JSON.parse(JSON.stringify(o));
const STAND = { shoulderL: [0, 0, 6], shoulderR: [0, 0, -6], elbowL: [-8, 0, 0], elbowR: [-8, 0, 0] };

export default function PoseEditor({ pose, onBack, onSave, onShoot }) {
  const [draft, setDraft] = useState(() => {
    const d = clone(pose);
    if (!d.custom) Object.assign(d, { id: 'custom-' + Date.now().toString(36), name: pose.name + ' (mine)', custom: true, level: 'Custom', basedOn: pose.id });
    return d;
  });
  const [initial] = useState(draft);
  const [fig, setFig] = useState(0);
  const [joint, setJoint] = useState('shoulderL');
  const [group, setGroup] = useState(1);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('joints');
  const [dots, setDots] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const rendererRef = useRef(null);
  const manipRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const photoRef = useRef(null);

  // Direct manipulation: drag dots / body parts with finger or mouse
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const m = new PoseManipulator(r, {
      onDragStart: () => setHistory((h) => [...h.slice(-40), clone(draftRef.current)]),
      onSelect: (hit) => pick(hit),
      onCommit: ({ figure, joints, pos, joint }) => {
        setDraft((d) => {
          const n = clone(d);
          n.figures[figure].joints = joints;
          if (pos) n.figures[figure].pos = pos;
          return n;
        });
        setFig(figure);
        if (joint) {
          setJoint(joint);
          setGroup(GROUPS.findIndex((g) => g.joints.includes(joint)));
          setTab('joints');
        }
        haptic(6);
      },
    });
    manipRef.current = m;
    if (import.meta.env.DEV) window.__manip = m; // QA hook (dev builds only)
    return () => {
      m.dispose();
      manipRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => manipRef.current?.setEnabled(dots), [dots]);

  // Push every draft change straight into the 3D stage (no React re-mount, no camera jump).
  const rigKey = draft.figures.map((f) => f.body).join();
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.stage.setPose(draft, { instant: true });
    manipRef.current?.sync();
    r.stage.figures.forEach((f, i) => f.setHighlight(i === fig ? joint : null));
    r.invalidate();
  }, [draft, fig, joint]);
  useEffect(() => {
    rendererRef.current?.reframe();
  }, [rigKey, draft.figures.length]);

  const snapshot = useCallback(() => setHistory((h) => [...h.slice(-40), clone(draft)]), [draft]);
  const undo = () => {
    if (!history.length) return;
    haptic(8);
    setDraft(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const update = (fn) => setDraft((d) => {
    const n = clone(d);
    fn(n);
    return n;
  });

  const value = draft.figures[fig]?.joints?.[joint] || [0, 0, 0];
  const setAxis = (i, v) => update((d) => {
    const j = (d.figures[fig].joints[joint] ||= [0, 0, 0]);
    j[i] = v;
  });

  const pick = (hit) => {
    if (!hit) return;
    haptic(6);
    setFig(hit.figure);
    setJoint(hit.joint);
    setGroup(GROUPS.findIndex((g) => g.joints.includes(hit.joint)));
    setTab('joints');
  };

  const addPerson = () => {
    if (draft.figures.length >= 4) return;
    snapshot();
    update((d) => {
      const n = d.figures.length;
      const xs = d.figures.map((f) => f.pos?.[0] || 0);
      d.figures.push({ body: n % 2 ? 'a' : 'b', joints: { ...STAND }, pos: [Math.max(...xs) + 0.5, 0], rotY: 0 });
    });
    setFig(draft.figures.length);
    haptic(10);
  };
  const removePerson = () => {
    if (draft.figures.length < 2) return;
    snapshot();
    update((d) => d.figures.splice(fig, 1));
    setFig(0);
  };

  const addFromPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || draft.figures.length >= 4) return;
    setPhotoBusy(true);
    try {
      const url = await new Promise((ok) => {
        const rd = new FileReader();
        rd.onload = () => ok(rd.result);
        rd.readAsDataURL(file);
      });
      const { figure } = await poseFromImage(url);
      snapshot();
      const n = draft.figures.length;
      update((d) => {
        const xs = d.figures.map((f) => f.pos?.[0] || 0);
        d.figures.push({ ...figure, body: n % 2 ? 'a' : 'b', pos: [Math.max(...xs) + 0.5, 0], rotY: 0 });
      });
      setFig(n);
      haptic([10, 30, 10]);
    } catch (err) {
      alertMsg(err.message === 'NO_PERSON' ? 'No person found in that photo' : 'Couldn’t load the pose AI');
    } finally {
      setPhotoBusy(false);
    }
  };
  const [msg, setMsg] = useState(null);
  const alertMsg = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2200);
  };

  const finalize = () => ({ ...draft, updatedAt: Date.now() });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950 animate-fade-in lg:flex-row">
      <div className="relative min-h-0 flex-1 bg-[radial-gradient(ellipse_at_50%_35%,#2a2440_0%,#100e16_65%)]">
        <PoseViewer pose={initial} rendererRef={rendererRef} highlight={{ figure: fig, joint }} />
        {msg && <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-[13px] backdrop-blur animate-pop">{msg}</div>}
        <div className="safe-top absolute inset-x-0 top-0 flex items-center gap-2 px-4">
          <button onClick={onBack} aria-label="Back" className="press glass-dark grid h-10 w-10 flex-none place-items-center rounded-full"><Icon name="back" size={20} stroke={2.2} /></button>
          <input
            value={draft.name}
            onChange={(e) => update((d) => { d.name = e.target.value; })}
            className="glass-dark h-10 min-w-0 flex-1 rounded-full px-4 text-[14.5px] font-semibold outline-none focus:ring-2 focus:ring-lilac-400/60"
            aria-label="Pose name"
          />
          <button onClick={() => setDots((v) => !v)} aria-label="Toggle drag points" title="Drag points" className={cx('press grid h-10 w-10 flex-none place-items-center rounded-full', dots ? 'bg-white text-ink-950' : 'glass-dark')}><Icon name="move" size={17} /></button>
          <button onClick={undo} disabled={!history.length} aria-label="Undo" className="press glass-dark grid h-10 w-10 flex-none place-items-center rounded-full disabled:opacity-35"><Icon name="undo" size={17} /></button>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 px-6 text-center text-[11.5px] leading-snug text-white/45">
          {dots ? <>Drag the dots to pose · <span className="text-lilac-300">purple</span> moves a whole arm or leg · <span className="text-amber-300">yellow</span> moves the person · drag empty space to orbit</> : 'Tap a body part to select it · drag to orbit'}
        </div>
      </div>

      <div className="safe-bottom flex-none rounded-t-[28px] bg-ink-900 px-4 pt-3 ring-1 ring-white/[0.06] animate-sheet lg:w-[400px] lg:rounded-none lg:pt-16">
        {/* Person + mode tabs */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-3">
          {draft.figures.map((_, i) => (
            <button key={i} onClick={() => setFig(i)} className={cx('press flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium', fig === i ? 'bg-lilac-500 text-white' : 'bg-white/[0.07] text-white/65')}>
              <Icon name="user" size={13} stroke={2.2} /> Person {i + 1}
            </button>
          ))}
          {draft.figures.length < 4 && (
            <>
              <button onClick={addPerson} className="press flex h-8 flex-none items-center gap-1 rounded-full border border-dashed border-white/20 px-3 text-[12.5px] text-white/60"><Icon name="plus" size={13} stroke={2.4} /> Add</button>
              <button onClick={() => photoRef.current?.click()} disabled={photoBusy} className="press flex h-8 flex-none items-center gap-1 rounded-full border border-dashed border-lilac-400/40 px-3 text-[12.5px] text-lilac-200 disabled:opacity-60">
                <Icon name="image" size={13} stroke={2.2} /> {photoBusy ? 'Reading…' : 'From photo'}
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={addFromPhoto} />
            </>
          )}
        </div>

        <div className="flex gap-1.5">
          {GROUPS.map((g, i) => (
            <button key={g.label} onClick={() => { setTab('joints'); setGroup(i); setJoint(g.joints[0]); }} className={cx('press flex-1 rounded-xl py-1.5 text-[12px] font-semibold uppercase tracking-wider', tab === 'joints' && group === i ? 'bg-white/12 text-white' : 'text-white/40')}>{g.label}</button>
          ))}
          <button onClick={() => setTab('body')} className={cx('press flex-1 rounded-xl py-1.5 text-[12px] font-semibold uppercase tracking-wider', tab === 'body' ? 'bg-white/12 text-white' : 'text-white/40')}>Place</button>
        </div>

        {tab === 'joints' ? (
          <>
            <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
              {GROUPS[group].joints.map((j) => (
                <button key={j} onClick={() => { setJoint(j); haptic(5); }} className={cx('press h-9 flex-none rounded-full px-3.5 text-[13px] font-medium transition-colors', joint === j ? 'bg-white text-ink-950' : 'bg-white/[0.06] text-white/70 ring-1 ring-white/[0.06]')}>{JOINT_LABELS[j]}</button>
              ))}
            </div>
            <div className="mt-3 space-y-0.5">
              {AXES.map((a) => (
                <AxisSlider key={a.i} label={a.label} hint={a.hint} value={value[a.i] || 0} onStart={snapshot} onChange={(v) => setAxis(a.i, v)} />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Action icon="rotate" label="Reset joint" onClick={() => { snapshot(); update((d) => { d.figures[fig].joints[joint] = STAND[joint] || [0, 0, 0]; }); }} />
              <Action icon="mirror" label="Mirror" onClick={() => { snapshot(); haptic(8); update((d) => { d.figures[fig].joints = mirrorJoints(d.figures[fig].joints); }); }} />
              <Action icon="user" label="Stand" onClick={() => { snapshot(); update((d) => { d.figures[fig].joints = { ...STAND }; }); }} />
            </div>
          </>
        ) : (
          <div className="space-y-0.5 pb-1 pt-2">
            <AxisSlider label="Turn" hint="whole body" value={draft.figures[fig].rotY || 0} onStart={snapshot} onChange={(v) => update((d) => { d.figures[fig].rotY = v; })} />
            <AxisSlider label="Left/right" min={-1.5} max={1.5} step={0.01} fmt={(v) => v.toFixed(2) + 'm'} value={draft.figures[fig].pos?.[0] || 0} onStart={snapshot} onChange={(v) => update((d) => { const f = d.figures[fig]; f.pos = [v, f.pos?.[1] || 0]; })} />
            <AxisSlider label="Depth" min={-1.5} max={1.5} step={0.01} fmt={(v) => v.toFixed(2) + 'm'} value={draft.figures[fig].pos?.[1] || 0} onStart={snapshot} onChange={(v) => update((d) => { const f = d.figures[fig]; f.pos = [f.pos?.[0] || 0, v]; })} />
            <AxisSlider label="Jump" min={0} max={0.8} step={0.01} fmt={(v) => v.toFixed(2) + 'm'} value={draft.figures[fig].lift || 0} onStart={snapshot} onChange={(v) => update((d) => { d.figures[fig].lift = v; })} />
            <div className="grid grid-cols-4 gap-2 pt-2">
              {[['a', 'Build A'], ['b', 'Build B'], ['c', 'Child']].map(([b, l]) => (
                <Action key={b} icon="user" label={l} active={draft.figures[fig].body === b} onClick={() => { snapshot(); update((d) => { d.figures[fig].body = b; }); }} />
              ))}
              <Action icon="trash" label="Remove" disabled={draft.figures.length < 2} onClick={removePerson} />
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2.5">
          <button onClick={() => { haptic(12); onSave(finalize()); }} className="press glass flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold">
            <Icon name="bookmark" size={17} /> Save
          </button>
          <button onClick={() => { haptic(14); onShoot(finalize()); }} className="press flex h-13 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-ink-950">
            <Icon name="camera" size={18} stroke={2.1} /> Shoot this pose
          </button>
        </div>
      </div>
    </div>
  );
}

function AxisSlider({ label, hint, value, onChange, onStart, min = -180, max = 180, step = 1, fmt = (v) => Math.round(v) + '°' }) {
  const fill = ((value - min) / (max - min)) * 100;
  const nudge = (d) => {
    onStart();
    onChange(Math.min(max, Math.max(min, +(value + d).toFixed(2))));
  };
  const inc = step < 1 ? 0.05 : 5;
  return (
    <div className="flex items-center gap-2">
      <div className="w-[74px] flex-none leading-tight">
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[10.5px] text-white/35">{hint}</div>}
      </div>
      <button onClick={() => nudge(-inc)} className="press grid h-7 w-7 flex-none place-items-center rounded-full bg-white/[0.07]" aria-label={`${label} decrease`}><Icon name="minus" size={13} stroke={2.4} /></button>
      <input type="range" min={min} max={max} step={step} value={value} style={{ '--fill': fill + '%' }} onPointerDown={onStart} onKeyDown={onStart} onChange={(e) => onChange(+e.target.value)} />
      <button onClick={() => nudge(inc)} className="press grid h-7 w-7 flex-none place-items-center rounded-full bg-white/[0.07]" aria-label={`${label} increase`}><Icon name="plus" size={13} stroke={2.4} /></button>
      <span className="w-12 flex-none text-right text-[12.5px] tabular-nums text-white/75">{fmt(value)}</span>
    </div>
  );
}

function Action({ icon, label, onClick, active, disabled }) {
  return (
    <button disabled={disabled} onClick={onClick} className={cx('press flex h-10 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-medium disabled:opacity-30', active ? 'bg-lilac-500 text-white' : 'bg-white/[0.06] text-white/75')}>
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}
