/** Light haptic feedback where supported (Android Chrome). iOS Safari ignores it gracefully. */
export const haptic = (pattern = 8) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
};

export const cx = (...c) => c.filter(Boolean).join(' ');
