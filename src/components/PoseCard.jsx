import Icon from './Icon.jsx';
import { useThumbnail } from '../hooks/useThumbnail.js';
import { cx, haptic } from '../lib/haptics.js';

const LEVEL_TONE = {
  Easy: 'text-emerald-300 bg-emerald-400/10',
  Medium: 'text-amber-200 bg-amber-300/10',
  Hard: 'text-rose-300 bg-rose-400/10',
  Custom: 'text-lilac-300 bg-lilac-400/15',
};

export default function PoseCard({ pose, fav, onFav, onOpen, index = 0 }) {
  const [thumb, thumbRef] = useThumbnail(pose);
  const people = pose.figures.length;
  return (
    <div
      className="group relative animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <button
        onClick={() => onOpen(pose)}
        className="press relative block w-full overflow-hidden rounded-[22px] bg-gradient-to-b from-ink-700/80 to-ink-800 text-left ring-1 ring-white/[0.06] transition-shadow hover:ring-lilac-400/40"
      >
        <div ref={thumbRef} className="relative aspect-[4/5]">
          <div className="absolute inset-x-6 bottom-6 top-10 rounded-full bg-lilac-500/10 blur-2xl" />
          {thumb ? (
            <img src={thumb} alt="" draggable={false} className="relative h-full w-full object-contain animate-fade-in transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className="skeleton absolute inset-3 rounded-2xl" />
          )}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur-md">
            <Icon name={people > 1 ? 'users' : 'user'} size={11} stroke={2.2} />
            {people > 1 ? people : 'Solo'}
          </div>
        </div>
        <div className="px-3 pb-3 pt-0.5">
          <div className="truncate text-[13.5px] font-semibold tracking-tight">{pose.name}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cx('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', LEVEL_TONE[pose.level] || LEVEL_TONE.Custom)}>{pose.level}</span>
            <span className="truncate text-[11px] capitalize text-white/40">{pose.category}</span>
          </div>
        </div>
      </button>
      <button
        aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
        onClick={(e) => {
          e.stopPropagation();
          haptic(10);
          onFav(pose.id);
        }}
        className={cx(
          'press absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition-colors',
          fav ? 'bg-lilac-500 text-white shadow-lg shadow-lilac-600/40' : 'bg-black/30 text-white/80',
        )}
      >
        <Icon name="heart" size={15} stroke={2} fill={fav ? 'currentColor' : 'none'} className={fav ? 'animate-pop' : ''} />
      </button>
    </div>
  );
}
