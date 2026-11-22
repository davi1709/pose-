import Icon from './Icon.jsx';
import { cx, haptic } from '../lib/haptics.js';

const ITEMS = [
  { id: 'discover', icon: 'compass', label: 'Discover' },
  { id: 'camera', icon: 'camera', label: 'Shoot' },
  { id: 'favorites', icon: 'heart', label: 'Saved' },
  { id: 'mine', icon: 'bookmark', label: 'Mine' },
];

export default function TabBar({ tab, setTab, onCamera, counts }) {
  return (
    <nav className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4">
      <div className="glass-dark pointer-events-auto flex items-center gap-1 rounded-[28px] p-1.5 shadow-2xl shadow-black/50">
        {ITEMS.map((it) =>
          it.id === 'camera' ? (
            <button
              key={it.id}
              aria-label="Open camera"
              onClick={() => {
                haptic(12);
                onCamera();
              }}
              className="press mx-1 grid h-12 w-14 place-items-center rounded-[22px] bg-gradient-to-br from-lilac-400 to-lilac-600 text-white shadow-lg shadow-lilac-600/40"
            >
              <Icon name="camera" size={21} stroke={2} />
            </button>
          ) : (
            <button
              key={it.id}
              onClick={() => {
                haptic(6);
                setTab(it.id);
              }}
              className={cx(
                'press relative flex h-12 min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-[22px] px-3 text-[10.5px] font-medium transition-colors',
                tab === it.id ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/75',
              )}
            >
              <Icon name={it.icon} size={19} stroke={tab === it.id ? 2.2 : 1.8} fill={tab === it.id && it.id !== 'discover' ? 'currentColor' : 'none'} />
              {it.label}
              {counts[it.id] > 0 && (
                <span className="absolute right-2 top-1.5 min-w-4 rounded-full bg-lilac-500 px-1 text-[9px] font-bold leading-4 text-white">{counts[it.id]}</span>
              )}
            </button>
          ),
        )}
      </div>
    </nav>
  );
}
