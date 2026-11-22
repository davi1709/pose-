import { useEffect, useRef, useState } from 'react';
import { renderThumbnail, cachedThumbnail } from '../three/PoseStage.js';

/*
 * Thumbnails are rendered lazily: only when a card scrolls into view, one at a time,
 * with a short pause between renders so scrolling and taps always stay responsive.
 */
const queue = [];
let pumping = false;

function pump() {
  if (!queue.length) return void (pumping = false);
  pumping = true;
  const { pose, cb } = queue.shift();
  try {
    cb(renderThumbnail(pose));
  } catch (e) {
    console.warn('thumbnail failed', e);
  }
  setTimeout(() => requestAnimationFrame(pump), 12);
}

/** Returns [url, ref]: attach ref to the element whose visibility should trigger rendering. */
export function useThumbnail(pose, { lazy = true } = {}) {
  const [url, setUrl] = useState(() => (pose ? cachedThumbnail(pose) : null));
  const [visible, setVisible] = useState(!lazy);
  const ref = useRef(null);

  useEffect(() => {
    if (!lazy || visible) return;
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return void setVisible(true);
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()),
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, visible]);

  useEffect(() => {
    if (!pose || !visible) return;
    const cached = cachedThumbnail(pose);
    if (cached) return void setUrl(cached);
    let alive = true;
    const job = { pose, cb: (u) => alive && setUrl(u) };
    queue.push(job);
    if (!pumping) requestAnimationFrame(pump);
    return () => {
      alive = false;
      const i = queue.indexOf(job);
      if (i >= 0) queue.splice(i, 1);
    };
  }, [pose, visible]);

  return [url, ref];
}
