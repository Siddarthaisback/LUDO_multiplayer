import confetti from 'canvas-confetti';

export function fireConfetti(durationSeconds: number = 3) {
  const end = Date.now() + durationSeconds * 1000;
  const colors = ['#ef4444', '#22c55e', '#eab308', '#3b82f6', '#a855f7', '#ec4899'];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

export function fireCelebrationBurst(x = 0.5, y = 0.5) {
  confetti({
    particleCount: 60,
    spread: 70,
    origin: { x, y },
    colors: ['#ffd700', '#ff6b6b', '#48dbfb', '#1dd1a1', '#f368e0'],
  });
}
