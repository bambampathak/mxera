// MXERA — Minimal 3D Effects
(function () {
  'use strict';

  // ─── 1. Floating particles (canvas, ~30 particles, no libraries) ───
  const canvas = document.createElement('canvas');
  canvas.id = 'fx-canvas';
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1;opacity:0.4';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let particles = [];
  const MAX = 30;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.r = Math.random() * 2.5 + 1;
      this.dx = (Math.random() - 0.5) * 0.4;
      this.dy = (Math.random() - 0.5) * 0.4;
      this.life = Math.random() * 1 + 0.5;
      this.maxLife = this.life;
    }
    update() {
      this.x += this.dx;
      this.y += this.dy;
      this.life -= 0.005;
      if (this.life <= 0 || this.x < -20 || this.x > canvas.width + 20 || this.y < -20 || this.y > canvas.height + 20)
        this.reset();
    }
    draw() {
      const a = this.life / this.maxLife;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,55,${a * 0.6})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < MAX; i++) particles.push(new Particle());

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.update();
      p.draw();
    });
    // draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(212,175,55,${(1 - dist / 120) * 0.15})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animateParticles);
  }
  animateParticles();

  // ─── 2. Card 3D tilt on hover ───
  const tiltCards = document.querySelectorAll(
    '.category-card, .product-card, .about-card, .stat-card, .contact-card'
  );
  tiltCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -8;
      const rotY = ((x - cx) / cx) * 8;
      card.style.setProperty('--rx', rotX + 'deg');
      card.style.setProperty('--ry', rotY + 'deg');
      card.style.transform =
        'perspective(600px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale3d(1.02,1.02,1.02)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform =
        'perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    });
  });

  // ─── 3. Scroll reveal (intersection observer) ───
  if ('IntersectionObserver' in window) {
    const revealEls = document.querySelectorAll(
      '.hero, .stats, .categories, .products, .about, .contact, section'
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fx-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealEls.forEach((el) => {
      el.classList.add('fx-hidden');
      io.observe(el);
    });
  }

  // ─── 4. Hero mouse parallax ───
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
      hero.style.setProperty('--parallax-x', x + 'px');
      hero.style.setProperty('--parallax-y', y + 'px');
    });
  }
})();