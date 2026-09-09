export type HapticType = 'roll' | 'six' | 'hop' | 'capture' | 'win' | 'tap' | 'urgent';

export function triggerHaptic(type: HapticType): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    switch (type) {
      case 'tap':
        navigator.vibrate(15);
        break;
      case 'roll':
        navigator.vibrate([20, 20, 30]);
        break;
      case 'six':
        navigator.vibrate([40, 40, 80]);
        break;
      case 'hop':
        navigator.vibrate(18);
        break;
      case 'capture':
        navigator.vibrate([70, 40, 110]);
        break;
      case 'win':
        navigator.vibrate([100, 50, 100, 50, 250]);
        break;
      case 'urgent':
        navigator.vibrate([50, 100, 50]);
        break;
    }
  } catch {
    // Graceful fallback on devices that block vibration without user gesture
  }
}
