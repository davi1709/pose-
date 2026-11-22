import { useEffect, useRef } from 'react';
import { StageRenderer } from '../three/StageRenderer.js';

/**
 * React wrapper around StageRenderer. The renderer instance is exposed via `rendererRef`
 * so parents (editor, camera) can drive it imperatively without re-rendering React.
 */
export default function PoseViewer({
  pose, orbit = true, autoRotate = false, ground = true, fill = 0.84, preserve = false,
  mode = 'ghost', modeColor, highlight, onPick, onInteract, rendererRef, className = '',
}) {
  const canvasRef = useRef(null);
  const sr = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    const r = new StageRenderer(canvasRef.current, { orbit, ground, fill, preserve, autoRotate });
    sr.current = r;
    if (rendererRef) rendererRef.current = r;
    first.current = true;
    return () => {
      r.dispose();
      sr.current = null;
      if (rendererRef) rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sr.current || !pose) return;
    sr.current.setPose(pose, { instant: first.current, reframe: true });
    first.current = false;
  }, [pose]);

  useEffect(() => {
    sr.current?.setMode(mode, modeColor);
  }, [mode, modeColor, pose]);

  useEffect(() => {
    sr.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    if (sr.current) sr.current.onInteract = onInteract;
  }, [onInteract]);

  useEffect(() => {
    const r = sr.current;
    if (!r) return;
    r.stage.figures.forEach((f, i) => f.setHighlight(highlight && highlight.figure === i ? highlight.joint : null));
    r.invalidate();
  }, [highlight, pose]);

  // Tap (not drag) → pick a joint
  const down = useRef(null);
  const onPointerDown = (e) => (down.current = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onPointerUp = (e) => {
    const d = down.current;
    if (!onPick || !d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 400) {
      onPick(sr.current?.pick(e.clientX, e.clientY) || null);
    }
  };

  return (
    <div className={'relative h-full w-full ' + className}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className="absolute inset-0 h-full w-full touch-none outline-none"
      />
    </div>
  );
}
