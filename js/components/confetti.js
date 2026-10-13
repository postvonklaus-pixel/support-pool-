/* ═══════════════════════════════════════════════════════
   NOVA Support Pool — Confetti Burst
   Canvas-based, self-cleaning, no deps
   ═══════════════════════════════════════════════════════ */

const COLORS = ['#7c3aed','#06b6d4','#a855f7','#22d3ee','#fbbf24','#34d399'];

export function confetti({ count = 60, duration = 2200, origin } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position:fixed;inset:0;width:100%;height:100%;
    pointer-events:none;z-index:var(--z-confetti,8500);
  `;
  document.body.appendChild(canvas);

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width  = window.innerWidth;
  const H      = canvas.height = window.innerHeight;
  const ox     = origin?.x ?? W / 2;
  const oy     = origin?.y ?? H * 0.35;
  const start  = Date.now();

  const particles = Array.from({ length: count }, () => ({
    x: ox,
    y: oy,
    r: 4 + Math.random() * 5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 10,
    vy: -6 - Math.random() * 8,
    gravity: 0.25 + Math.random() * 0.15,
    spin: (Math.random() - 0.5) * 0.3,
    angle: Math.random() * Math.PI * 2,
  }));

  let raf;

  const draw = () => {
    const elapsed = Date.now() - start;
    const progress = elapsed / duration;

    if (progress >= 1) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, W, H);

    particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity;
      p.angle += p.spin;

      const alpha = Math.max(0, 1 - progress * 1.4);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
      ctx.restore();
    });

    raf = requestAnimationFrame(draw);
  };

  raf = requestAnimationFrame(draw);
  setTimeout(() => { cancelAnimationFrame(raf); canvas.remove(); }, duration + 100);
}
