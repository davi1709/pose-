import { useCallback, useEffect, useMemo, useState } from 'react';
import Library from './components/Library.jsx';
import TabBar from './components/TabBar.jsx';
import PoseDetail from './components/PoseDetail.jsx';
import CameraView from './components/CameraView.jsx';
import PoseEditor from './components/PoseEditor.jsx';
import CaptureReview from './components/CaptureReview.jsx';
import PhotoPose from './components/PhotoPose.jsx';
import { decodePoseLink } from './lib/share.js';
import { POSES, blankPose } from './data/poses.js';
import { useLocalStorage } from './lib/storage.js';
import { getBodyGeometry } from './three/BodyMesh.js';
import Icon from './components/Icon.jsx';

/** Sculpts both mannequin bodies once (~0.5–1.5 s) behind a branded splash. */
function useBodiesReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      getBodyGeometry('b');
      getBodyGeometry('a');
      setReady(true);
    }, 80);
    return () => clearTimeout(id);
  }, []);
  return ready;
}

function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-ink-950">
      <div className="flex flex-col items-center animate-fade-in">
        <div className="grid h-16 w-16 animate-float place-items-center rounded-[22px] bg-gradient-to-br from-lilac-300 to-lilac-600 shadow-2xl shadow-lilac-600/40">
          <Icon name="ghost" size={30} stroke={2} />
        </div>
        <div className="mt-5 font-display text-[34px] italic">Pos<span className="text-lilac-300">é</span></div>
        <div className="mt-2 text-[13px] text-white/45">Sculpting your mannequins…</div>
        <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-white/10"><div className="skeleton h-full w-full" /></div>
      </div>
    </div>
  );
}

/**
 * Screen model: the library is always mounted underneath; detail / camera / editor
 * stack on top as full-screen layers, so going "back" is instant and keeps scroll position.
 */
export default function App() {
  const [tab, setTab] = useState('discover');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useLocalStorage('pose:favs', ['lean-in']);
  const [custom, setCustom] = useLocalStorage('pose:custom', []);
  const [shots, setShots] = useState([]);
  const [stack, setStack] = useState([]); // [{ screen, pose, from }]
  const [viewShot, setViewShot] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const ready = useBodiesReady();

  // Open a pose shared by link (#pose=…): import it into "Mine" and show it
  useEffect(() => {
    if (!ready) return;
    const shared = decodePoseLink(location.hash);
    if (!shared) return;
    history.replaceState(null, '', location.pathname + location.search);
    const p = { ...shared, id: 'shared-' + Date.now().toString(36), custom: true, level: 'Custom', updatedAt: Date.now() };
    setCustom((c) => [p, ...c]);
    setStack([{ screen: 'detail', pose: p }]);
  }, [ready, setCustom]);

  const allPoses = useMemo(() => [...custom, ...POSES], [custom]);
  const top = stack[stack.length - 1];
  const push = (screen, pose) => setStack((s) => [...s, { screen, pose }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const replaceTop = (patch) => setStack((s) => [...s.slice(0, -1), { ...s[s.length - 1], ...patch }]);

  const toggleFav = useCallback((id) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])), [setFavorites]);
  const savePose = (p) => setCustom((c) => [p, ...c.filter((x) => x.id !== p.id)]);

  const quickShoot = () => {
    const pool = category === 'all' ? POSES : POSES.filter((p) => p.category === category);
    push('camera', pool[Math.floor(Math.random() * pool.length)]);
  };

  if (!ready) return <Splash />;

  return (
    <div className="relative min-h-full bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(139,108,246,0.18),transparent_60%)]">
      <div aria-hidden={!!top} className={top ? 'pointer-events-none' : ''}>
        <Library
          tab={tab}
          poses={POSES}
          custom={custom}
          favorites={favorites}
          toggleFav={toggleFav}
          onOpen={(p) => push('detail', p)}
          onQuickShoot={quickShoot}
          onCreate={() => setCreateOpen(true)}
          onPhoto={() => push('photo', null)}
          category={category}
          setCategory={setCategory}
          query={query}
          setQuery={setQuery}
          shots={shots}
          onOpenShot={setViewShot}
        />
        <TabBar
          tab={tab}
          setTab={(t) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onCamera={quickShoot}
          counts={{ favorites: favorites.length, mine: custom.length }}
        />
      </div>

      {stack.map((entry, i) => {
        const active = i === stack.length - 1;
        // Keep lower layers unmounted when a heavy (WebGL/camera) screen is on top.
        if (!active) return null;
        const { screen, pose } = entry;
        if (screen === 'detail')
          return (
            <PoseDetail
              key={i + pose.id}
              pose={pose}
              fav={favorites.includes(pose.id)}
              onFav={toggleFav}
              onBack={pop}
              onShoot={(p) => push('camera', p)}
              onEdit={(p) => push('editor', p)}
              onDelete={(p) => { setCustom((c) => c.filter((x) => x.id !== p.id)); pop(); }}
            />
          );
        if (screen === 'camera')
          return (
            <CameraView
              key={i}
              pose={pose}
              poses={allPoses.some((p) => p.id === pose.id) ? allPoses : [pose, ...allPoses]}
              onClose={pop}
              onEdit={(p) => push('editor', p)}
              onPoseChange={(p) => replaceTop({ pose: p })}
              onCopyPose={(image) => push('photo', { image })}
              onShot={(s) => setShots((list) => [s, ...list].slice(0, 24))}
              lastShot={shots[0]}
            />
          );
        if (screen === 'photo')
          return (
            <PhotoPose
              key={i}
              initialImage={pose?.image}
              onBack={pop}
              onEdit={(p) => replaceTop({ screen: 'editor', pose: p })}
              onSave={(p) => {
                savePose(p);
                setTab('mine');
                replaceTop({ screen: 'detail', pose: p });
              }}
              onShoot={(p) => {
                savePose(p);
                replaceTop({ screen: 'camera', pose: p });
              }}
            />
          );
        if (screen === 'editor')
          return (
            <PoseEditor
              key={i + pose.id}
              pose={pose}
              onBack={pop}
              onSave={(p) => {
                savePose(p);
                setTab('mine');
                setStack((s) => [...s.slice(0, -1).filter((e) => e.screen !== 'detail' || e.pose.id !== p.id), { screen: 'detail', pose: p }]);
              }}
              onShoot={(p) => setStack((s) => [...s.slice(0, -1), { screen: 'camera', pose: p }])}
            />
          );
        return null;
      })}

      {viewShot && <CaptureReview shot={viewShot} onClose={() => setViewShot(null)} />}

      {createOpen && (
        <CreateSheet
          onClose={() => setCreateOpen(false)}
          onEditor={() => { setCreateOpen(false); push('editor', blankPose()); }}
          onPhoto={() => { setCreateOpen(false); push('photo', null); }}
          onRandom={() => { setCreateOpen(false); push('editor', POSES[Math.floor(Math.random() * POSES.length)]); }}
        />
      )}
    </div>
  );
}

function CreateSheet({ onClose, onEditor, onPhoto, onRandom }) {
  const Item = ({ icon, title, sub, onClick, accent }) => (
    <button onClick={onClick} className={'press flex w-full items-center gap-4 rounded-2xl p-4 text-left ' + (accent ? 'bg-gradient-to-br from-lilac-500 to-lilac-700 shadow-lg shadow-lilac-900/40' : 'bg-white/[0.06] ring-1 ring-white/[0.07]')}>
      <span className={'grid h-12 w-12 flex-none place-items-center rounded-2xl ' + (accent ? 'bg-white/20' : 'bg-white/10')}><Icon name={icon} size={22} /></span>
      <span className="min-w-0">
        <span className="block text-[15.5px] font-semibold">{title}</span>
        <span className="block text-[12.5px] text-white/60">{sub}</span>
      </span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="safe-bottom w-full max-w-md rounded-t-[30px] bg-ink-900 px-5 pt-3 ring-1 ring-white/10 animate-sheet sm:rounded-[30px] sm:pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <h2 className="font-display text-[26px]">Create a pose</h2>
        <p className="mb-4 mt-1 text-[13.5px] text-white/50">Start from a photo, from scratch, or remix a pose.</p>
        <div className="space-y-2.5">
          <Item accent icon="image" title="From a photo" sub="Copy any pose from a picture with AI that runs on your device" onClick={onPhoto} />
          <Item icon="wand" title="In the editor" sub="Drag the mannequin’s joints with your finger or mouse" onClick={onEditor} />
          <Item icon="shuffle" title="Remix a random pose" sub="Start from a library pose and make it yours" onClick={onRandom} />
        </div>
        <button onClick={onClose} className="press mt-4 w-full py-2 text-[14px] text-white/50">Cancel</button>
      </div>
    </div>
  );
}
