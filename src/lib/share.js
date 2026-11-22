/**
 * Share poses as links: the pose JSON is packed into the URL hash (#pose=…).
 * Nothing is uploaded, and the link works on any device that opens the app.
 */
const strip = (p) => ({ name: p.name, category: p.category, blurb: p.blurb, cues: p.cues, props: p.props, view: p.view, figures: p.figures });

function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function poseLink(pose) {
  return location.origin + location.pathname + '#pose=' + toB64Url(JSON.stringify(strip(pose)));
}

export function decodePoseLink(hash) {
  const m = /#pose=([\w-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const p = JSON.parse(fromB64Url(m[1]));
    return Array.isArray(p.figures) && p.figures.length ? p : null;
  } catch {
    return null;
  }
}

/** Native share sheet when available, otherwise copy to clipboard. Returns 'shared' | 'copied' | 'failed'. */
export async function sharePose(pose) {
  const url = poseLink(pose);
  try {
    if (navigator.share) {
      await navigator.share({ title: `Posé · ${pose.name}`, text: `Try this pose: ${pose.name}`, url });
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
