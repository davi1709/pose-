import { useMemo } from 'react';
import Icon from './Icon.jsx';
import PoseCard from './PoseCard.jsx';
import { CATEGORIES } from '../data/poses.js';
import { cx, haptic } from '../lib/haptics.js';

const TABS = {
  discover: { title: 'Strike a pose', sub: 'Pick one of {n} 3D guides, line yourself up, and shoot.' },
  favorites: { title: 'Favourites', sub: 'The poses you keep coming back to.' },
  mine: { title: 'My poses', sub: 'Poses you built or tweaked in the editor.' },
};

export default function Library({
  tab, poses, custom, favorites, toggleFav, onOpen, onQuickShoot, onCreate, onPhoto,
  category, setCategory, query, setQuery, shots, onOpenShot,
}) {
  const source = tab === 'mine' ? custom : tab === 'favorites' ? [...poses, ...custom].filter((p) => favorites.includes(p.id)) : poses;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((p) => {
      if (tab === 'discover' && category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      return (p.name + ' ' + p.category + ' ' + p.blurb).toLowerCase().includes(q);
    });
  }, [source, category, query, tab]);

  const t = TABS[tab];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-36 sm:px-6">
      {/* Header */}
      <header className="safe-top flex items-center justify-between pb-2 pt-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-lilac-300 to-lilac-600 shadow-lg shadow-lilac-600/30">
            <Icon name="ghost" size={18} stroke={2} className="text-white" />
          </div>
          <span className="font-display text-[26px] italic leading-none tracking-tight">
            Pos<span className="text-lilac-300">é</span>
          </span>
        </div>
        <button onClick={onCreate} className="press glass flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-white/90">
          <Icon name="plus" size={15} stroke={2.4} /> Create
        </button>
      </header>

      <section className="animate-fade-up pt-4">
        <h1 className="font-display text-[34px] leading-[1.05] tracking-tight sm:text-5xl">{t.title}</h1>
        <p className="mt-1.5 text-[14px] text-white/50">{t.sub.replace('{n}', poses.length)}</p>
      </section>

      {tab === 'discover' && (
        <>
          {/* Hero actions */}
          <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              onClick={onQuickShoot}
              className="press group relative col-span-2 overflow-hidden rounded-[26px] bg-gradient-to-br from-lilac-500 via-lilac-600 to-[#4b2bb8] p-5 text-left shadow-xl shadow-lilac-900/40"
            >
              <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
              <div className="absolute bottom-0 right-4 h-28 w-20 animate-float rounded-t-full border-2 border-dashed border-white/40" />
              <div className="relative">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  <Icon name="shuffle" size={13} stroke={2.2} /> Pose me
                </div>
                <div className="mt-2 font-display text-[26px] leading-tight">Open camera</div>
                <div className="mt-1 max-w-[70%] text-[13px] text-white/75">We'll pick a flattering pose and overlay it live.</div>
              </div>
            </button>
            <button onClick={onPhoto} className="press group relative col-span-1 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#3b2f63] to-ink-800 p-4 text-left ring-1 ring-lilac-400/25">
              <span className="absolute right-3 top-3 rounded-full bg-lilac-400/20 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-lilac-200">AI</span>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><Icon name="image" size={19} /></div>
              <div className="mt-3 text-[15px] font-semibold">Photo → Pose</div>
              <div className="text-[12px] text-white/55">Copy any pose from a picture</div>
            </button>
            <button onClick={onCreate} className="press glass col-span-1 rounded-[26px] p-4 text-left">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><Icon name="wand" size={19} /></div>
              <div className="mt-3 text-[15px] font-semibold">Pose editor</div>
              <div className="text-[12px] text-white/50">Drag joints with your finger</div>
            </button>
          </section>

          {shots.length > 0 && (
            <section className="mt-7">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/45">Recent shots</h2>
                <span className="text-[12px] text-white/35">{shots.length} this session</span>
              </div>
              <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
                {shots.map((s, i) => (
                  <button key={s.at} onClick={() => onOpenShot(s)} className="press h-24 w-[72px] flex-none overflow-hidden rounded-2xl ring-1 ring-white/10 animate-pop" style={{ animationDelay: `${i * 40}ms` }}>
                    <img src={s.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Search + categories */}
      <div className="sticky top-0 z-20 -mx-4 mt-6 bg-gradient-to-b from-ink-950 via-ink-950/95 to-ink-950/0 px-4 pb-3 pt-2 sm:-mx-6 sm:px-6">
        <label className="glass flex h-12 items-center gap-2.5 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-lilac-400/50">
          <Icon name="search" size={18} className="text-white/45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search poses: lean, walk, couple…"
            className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/35"
          />
          {query && (
            <button onClick={() => setQuery('')} className="press grid h-6 w-6 place-items-center rounded-full bg-white/15">
              <Icon name="x" size={12} stroke={2.6} />
            </button>
          )}
        </label>
        {tab === 'discover' && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  haptic(6);
                  setCategory(c.id);
                }}
                className={cx(
                  'press h-9 flex-none rounded-full px-4 text-[13px] font-medium transition-colors',
                  category === c.id ? 'bg-white text-ink-950 shadow-lg shadow-white/10' : 'bg-white/[0.06] text-white/70 ring-1 ring-white/[0.07] hover:bg-white/10',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {list.length ? (
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((p, i) => (
            <PoseCard key={p.id + (p.updatedAt || '')} pose={p} index={i} fav={favorites.includes(p.id)} onFav={toggleFav} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <EmptyState tab={tab} onCreate={onCreate} hasQuery={!!query} />
      )}
    </div>
  );
}

function EmptyState({ tab, onCreate, hasQuery }) {
  const copy = hasQuery
    ? ['No matches', 'Try another word, like “lean” or “walk”.']
    : tab === 'favorites'
      ? ['No favourites yet', 'Tap the heart on any pose to keep it here.']
      : ['Nothing here yet', 'Build a pose from scratch or tweak one from the library.'];
  return (
    <div className="mt-10 flex flex-col items-center text-center animate-fade-up">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white/[0.06] ring-1 ring-white/10">
        <Icon name={tab === 'favorites' ? 'heart' : 'ghost'} size={26} className="text-lilac-300" />
      </div>
      <div className="mt-4 text-[17px] font-semibold">{copy[0]}</div>
      <div className="mt-1 max-w-xs text-[14px] text-white/50">{copy[1]}</div>
      {tab === 'mine' && !hasQuery && (
        <button onClick={onCreate} className="press mt-5 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-ink-950">
          Open the pose editor
        </button>
      )}
    </div>
  );
}
