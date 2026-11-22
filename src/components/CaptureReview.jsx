import { useState } from 'react';
import Icon from './Icon.jsx';
import { cx, haptic } from '../lib/haptics.js';

async function toFile(url, name) {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: 'image/jpeg' });
}

export default function CaptureReview({ shot, onClose }) {
  const [withGuide, setWithGuide] = useState(false);
  const [saved, setSaved] = useState(false);
  const url = withGuide && shot.guideUrl ? shot.guideUrl : shot.url;
  const name = `pose-${(shot.poseName || 'photo').toLowerCase().replace(/\W+/g, '-')}-${shot.at}.jpg`;

  const save = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    haptic(12);
    setSaved(true);
  };

  const share = async () => {
    try {
      const file = await toFile(url, name);
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: shot.poseName });
      else save();
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-2xl animate-fade-in">
      <div className="safe-top flex items-center justify-between px-4 pb-3">
        <button onClick={onClose} className="press glass-dark flex h-10 items-center gap-1.5 rounded-full pl-2.5 pr-4 text-[14px] font-medium">
          <Icon name="back" size={18} stroke={2.2} /> Retake
        </button>
        <div className="text-center">
          <div className="text-[14px] font-semibold">{shot.poseName}</div>
          <div className="text-[11px] text-white/45">{new Date(shot.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div className="w-[92px]" />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        <img key={url} src={url} alt="Captured" className="max-h-full max-w-full rounded-3xl object-contain shadow-2xl shadow-black/60 animate-pop" />
      </div>

      <div className="safe-bottom space-y-3 px-4 pt-4">
        {shot.guideUrl && (
          <div className="mx-auto flex max-w-md justify-center">
            <div className="glass-dark flex rounded-full p-1 text-[13px] font-medium">
              {[['Photo', false], ['With guide', true]].map(([l, v]) => (
                <button key={l} onClick={() => setWithGuide(v)} className={cx('press rounded-full px-4 py-1.5', withGuide === v ? 'bg-white text-ink-950' : 'text-white/70')}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-md gap-2.5">
          <button onClick={share} className="press glass flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold">
            <Icon name="share" size={18} /> Share
          </button>
          <button onClick={save} className="press flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-ink-950">
            <Icon name={saved ? 'check' : 'download'} size={18} stroke={2.2} /> {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
