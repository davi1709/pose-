import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera lifecycle with graceful fallbacks.
 * status: 'starting' | 'live' | 'denied' | 'unavailable' | 'insecure' | 'busy' | 'error'
 */
export function useCamera(facing = 'user') {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [zoomCaps, setZoomCaps] = useState(null);
  const [zoom, setZoomState] = useState(1);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    setStatus('starting');
    if (!window.isSecureContext) return setStatus('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unavailable');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
    } catch (err) {
      if (err?.name === 'OverconstrainedError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e2) {
          err = e2;
        }
      }
      if (!stream) {
        const map = { NotAllowedError: 'denied', SecurityError: 'denied', NotFoundError: 'unavailable', NotReadableError: 'busy' };
        return setStatus(map[err?.name] || 'error');
      }
    }
    streamRef.current = stream;
    const v = videoRef.current;
    if (v) {
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      try {
        await v.play();
      } catch {
        /* autoplay will resume on next gesture */
      }
    }
    const track = stream.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() || {};
    setZoomCaps(caps.zoom ? { min: caps.zoom.min, max: caps.zoom.max } : null);
    setZoomState(track?.getSettings?.().zoom || 1);
    setStatus('live');
  }, [facing, stop]);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const setZoom = useCallback(async (z) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: z }] });
      setZoomState(z);
    } catch {
      /* unsupported */
    }
  }, []);

  return { videoRef, status, retry: start, zoomCaps, zoom, setZoom };
}
