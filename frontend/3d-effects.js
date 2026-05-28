/* ============================================================
   MXERA — 3D Effects & Animations Engine v2
   More animated, more modern, more dynamic
   ============================================================ */
(function () {
  'use strict';

  /* ---------- UTILITIES ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
  }

  /* ---------- MOUSE TRACKING ---------- */
  const mouse = { x: 0, y: 0, lx: 0, ly: 0, rx: 0, ry: 0 };
  document.addEventListener('mousemove', function (e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouse.rx = e.clientX;
    mouse.ry = e.clientY;
  });

  /* ===========================================
     1. THREE.JS — ENHANCED 3D PARTICLE UNIVERSE
     =========================================== */
  function initThreeScene() {
    var canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    canvas.setAttribute('style',
      'position:fixed !important;' +
      'top:0 !important;' +
      'left:0 !important;' +
      'width:100vw !important;' +
      'height:100vh !important;' +
      'z-index:0 !important;' +
      'pointer-events:none !important;' +
      'display:block !important;' +
      'contain:strict !important;'
    );

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060606, 0.0008);

    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.z = 600;

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ---- LAYER 1: Core particle nebula (3000 particles) ----
    var particleCount = 3000;
    var geometry = new THREE.BufferGeometry();
    var positions = new Float32Array(particleCount * 3);
    var colors = new Float32Array(particleCount * 3);
    var sizes = new Float32Array(particleCount);
    var velocities = [];

    var goldColor = new THREE.Color(0xd4af37);
    var warmColor = new THREE.Color(0xf3d36b);
    var whiteColor = new THREE.Color(0xffffff);
    var amberColor = new THREE.Color(0xffbf00);
    var copperColor = new THREE.Color(0xb87333);
    var blushColor = new THREE.Color(0xcd7f32);

    var colorPalette = [goldColor, warmColor, whiteColor, amberColor, copperColor, blushColor];

    for (var i = 0; i < particleCount; i++) {
      var radius = 200 + Math.random() * 800;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      var col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      sizes[i] = 0.8 + Math.random() * 5;

      velocities.push({
        theta: theta,
        phi: phi,
        radius: radius,
        speed: 0.0003 + Math.random() * 0.003,
        orbitRadius: 3 + Math.random() * 30,
        orbitSpeed: 0.0002 + Math.random() * 0.001,
        phase: Math.random() * Math.PI * 2
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Soft glow texture
    var texCanvas = document.createElement('canvas');
    texCanvas.width = 64;
    texCanvas.height = 64;
    var tCtx = texCanvas.getContext('2d');
    var grad = tCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    tCtx.fillStyle = grad;
    tCtx.fillRect(0, 0, 64, 64);
    var particleTexture = new THREE.CanvasTexture(texCanvas);

    var material = new THREE.PointsMaterial({
      size: 5,
      map: particleTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
      opacity: 0.9,
      sizeAttenuation: true
    });

    var particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // ---- LAYER 2: Distant star field ----
    var starCount = 1000;
    var starGeo = new THREE.BufferGeometry();
    var starPos = new Float32Array(starCount * 3);
    var starSizes = new Float32Array(starCount);
    for (var i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 3000;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 3000;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 3000;
      starSizes[i] = 0.3 + Math.random() * 1.2;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    var starMat = new THREE.PointsMaterial({
      color: 0xd4af37,
      size: 0.6,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    var stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ---- LAYER 3: Occasional shooting stars ----
    var shootingStars = [];
    var shootGeo = new THREE.BufferGeometry();
    var shootPos = new Float32Array(60);
    var shootColors = new Float32Array(60);
    shootGeo.setAttribute('position', new THREE.BufferAttribute(shootPos, 3));
    shootGeo.setAttribute('color', new THREE.BufferAttribute(shootColors, 3));
    var shootMat = new THREE.PointsMaterial({
      size: 1.5,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0,
      vertexColors: true,
      depthWrite: false
    });
    var shootPoints = new THREE.Points(shootGeo, shootMat);
    scene.add(shootPoints);

    function spawnShootingStar() {
      var trailLen = 20;
      var startX = (Math.random() - 0.5) * 1500;
      var startY = (Math.random() - 0.5) * 1500;
      var startZ = (Math.random() - 0.5) * 1500;
      var dirX = (Math.random() - 0.5) * 10;
      var dirY = (Math.random() - 0.5) * 10 + 5;
      var dirZ = (Math.random() - 0.5) * 10;

      var life = 0;
      var maxLife = 60 + Math.random() * 40;
      var hue = 0.1 + Math.random() * 0.05;

      return {
        pos: new THREE.Vector3(startX, startY, startZ),
        dir: new THREE.Vector3(dirX, dirY, dirZ),
        life: life,
        maxLife: maxLife,
        trailLen: trailLen,
        hue: hue
      };
    }

    var shootTimer = 0;

    // ---- MOUSE INTERACTION ----
    var targetRotX = 0;
    var targetRotY = 0;
    var currentRotX = 0;
    var currentRotY = 0;

    // ---- PULSE STATE ----
    var pulsePhase = 0;

    function animateParticles() {
      // Mouse-follow with smooth lerp
      targetRotX = mouse.y * 0.12;
      targetRotY = mouse.x * 0.12;
      currentRotX = lerp(currentRotX, targetRotX, 0.025);
      currentRotY = lerp(currentRotY, targetRotY, 0.025);

      particles.rotation.x = currentRotX;
      particles.rotation.y = currentRotY;
      stars.rotation.x = currentRotX * 0.3;
      stars.rotation.y = currentRotY * 0.3;

      pulsePhase += 0.01;

      // Orbit particles
      var pos = geometry.attributes.position.array;
      var sizesAttr = geometry.attributes.size.array;
      var time = Date.now() * 0.0005;

      for (var i = 0; i < particleCount; i++) {
        var v = velocities[i];
        v.theta += v.speed;
        v.phi += v.speed * 0.2;
        var pulse = Math.sin(time + v.phase) * v.orbitRadius;
        var r = v.radius + pulse;
        pos[i * 3] = r * Math.sin(v.phi) * Math.cos(v.theta);
        pos[i * 3 + 1] = r * Math.sin(v.phi) * Math.sin(v.theta);
        pos[i * 3 + 2] = r * Math.cos(v.phi);

        // Pulse sizes
        sizesAttr[i] = (0.8 + Math.random() * 5) * (0.8 + 0.3 * Math.sin(pulsePhase + v.phase));
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;

      // Auto gentle rotation
      particles.rotation.y += 0.0005;
      stars.rotation.y += 0.0002;

      // Shooting stars
      shootTimer++;
      if (shootTimer > 120 + Math.random() * 200) {
        shootingStars.push(spawnShootingStar());
        shootTimer = 0;
      }

      // Update shooting stars
      var sPos = shootGeo.attributes.position.array;
      var sCol = shootGeo.attributes.color.array;
      var anyAlive = false;

      for (var si = shootingStars.length - 1; si >= 0; si--) {
        var ss = shootingStars[si];
        ss.life++;

        if (ss.life > ss.maxLife) {
          shootingStars.splice(si, 1);
          continue;
        }

        anyAlive = true;
        ss.pos.x += ss.dir.x * 0.5;
        ss.pos.y += ss.dir.y * 0.5;
        ss.pos.z += ss.dir.z * 0.5;

        var trailLen = ss.trailLen;
        var alpha = 1 - (ss.life / ss.maxLife);

        for (var t = 0; t < trailLen && t < ss.life; t++) {
          var idx = t * 3;
          sPos[idx] = ss.pos.x - ss.dir.x * t * 0.5;
          sPos[idx + 1] = ss.pos.y - ss.dir.y * t * 0.5;
          sPos[idx + 2] = ss.pos.z - ss.dir.z * t * 0.5;
          var ta = alpha * (1 - t / trailLen);
          sCol[idx] = 1;
          sCol[idx + 1] = 0.85;
          sCol[idx + 2] = 0.5;
        }
      }

      if (anyAlive) {
        shootMat.opacity = 1;
      } else {
        shootMat.opacity = 0;
      }
      shootGeo.attributes.position.needsUpdate = true;
      shootGeo.attributes.color.needsUpdate = true;

      // Dynamic opacity pulse on all particles
      material.opacity = 0.75 + 0.15 * Math.sin(pulsePhase * 0.5);
      starMat.opacity = 0.35 + 0.2 * Math.sin(pulsePhase * 0.3 + 1);

      renderer.render(scene, camera);
      requestAnimationFrame(animateParticles);
    }

    animateParticles();

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ===========================================
     2. CARD 3D TILT — ENHANCED
     =========================================== */
  function initCardTilt() {
    var cards = document.querySelectorAll(
      '.product-card, .category-card, .stat-card'
    );
    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        var rotateX = mapRange(y, 0, rect.height, 8, -8);
        var rotateY = mapRange(x, 0, rect.width, -8, 8);

        card.style.transform =
          'perspective(1200px) rotateX(' +
          rotateX.toFixed(1) +
          'deg) rotateY(' +
          rotateY.toFixed(1) +
          'deg) translateZ(20px) scale3d(1.02,1.02,1.02)';
        card.style.transition = 'transform 0.06s linear';
        card.style.boxShadow =
          '0 25px 60px rgba(212,175,55,0.15), 0 0 0 1px rgba(212,175,55,0.2)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform =
          'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale3d(1,1,1)';
        card.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1)';
        card.style.boxShadow = '';
      });
    });
  }

  /* ===========================================
     3. SCROLL REVEAL — WITH STAGGER
     =========================================== */
  function initScrollReveal() {
    var selectors = [
      '.section-header', '.product-card', '.category-card',
      '.stat-card', '.hero-sub', '.hero h1', '.hero p',
      '.hero-actions', '.hero-card', '.footer-grid > *',
      '.about-content', '.contact-content', '.testimonial-card',
      '.stats-grid > *', '.category-grid > *'
    ];
    var revealElements = document.querySelectorAll(selectors.join(','));

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
      );

      revealElements.forEach(function (el) {
        el.classList.add('reveal-hidden');
        observer.observe(el);
      });
    } else {
      revealElements.forEach(function (el) { el.classList.add('revealed'); });
    }
  }

  /* ===========================================
     4. PARALLAX ON SCROLL
     =========================================== */
  function initParallax() {
    var elements = document.querySelectorAll(
      '.hero-image, .floating-badge, .hero-bottom, .hero-card'
    );
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var scrollY = window.pageYOffset;
          elements.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax-speed') || '0.12');
            var translateY = (scrollY * speed).toFixed(1);
            el.style.transform = 'translate3d(0, ' + translateY + 'px, 0)';
          });
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ===========================================
     5. MOUSE GLOW — LARGER, RICHER
     =========================================== */
  function initMouseGlow() {
    var glow = document.createElement('div');
    glow.className = 'mouse-glow';
    document.body.appendChild(glow);

    var glowX = window.innerWidth / 2;
    var glowY = window.innerHeight / 2;
    var currentX = glowX;
    var currentY = glowY;

    document.addEventListener('mousemove', function (e) {
      glowX = e.clientX;
      glowY = e.clientY;
    });

    function animateGlow() {
      currentX = lerp(currentX, glowX, 0.06);
      currentY = lerp(currentY, glowY, 0.06);
      glow.style.left = currentX + 'px';
      glow.style.top = currentY + 'px';
      glow.style.transform = 'translate(-50%,-50%) scale(' +
        (1 + 0.05 * Math.sin(Date.now() * 0.002)) + ')';
      requestAnimationFrame(animateGlow);
    }
    animateGlow();
  }

  /* ===========================================
     6. STATS COUNTER — SMOOTHER
     =========================================== */
  function initStatsCounter() {
    var statCards = document.querySelectorAll('.stat-card h2');
    statCards.forEach(function (el) {
      var text = el.textContent;
      var targetNum = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(targetNum)) return;
      var suffix = text.replace(/[0-9.]/g, '');
      el.dataset.target = targetNum;
      el.dataset.suffix = suffix;
      el.textContent = '0' + suffix;

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCounter(el, targetNum, suffix);
              observer.unobserve(el);
            }
          });
        },
        { threshold: 0.4 }
      );
      observer.observe(el);
    });
  }

  function animateCounter(el, target, suffix) {
    var start = 0;
    var duration = 2200;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);
      var display = target >= 1000 ? current.toLocaleString() : current;
      el.textContent = display + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString() + suffix;
    }
    requestAnimationFrame(step);
  }

  /* ===========================================
     7. FLOATING SHAPES — MORE DYNAMIC
     =========================================== */
  function initFloatingShapes() {
    var symbols = ['◆', '◇', '✦', '○', '△', '◇', '◆', '✦'];
    var colors = [
      'rgba(212,175,55,0.12)', 'rgba(212,175,55,0.15)',
      'rgba(243,211,107,0.10)', 'rgba(255,255,255,0.06)',
      'rgba(212,175,55,0.08)', 'rgba(183,116,55,0.12)',
      'rgba(212,175,55,0.10)', 'rgba(255,215,0,0.08)'
    ];
    var items = [];

    for (var i = 0; i < 18; i++) {
      var el = document.createElement('div');
      el.className = 'floating-shape';
      var sym = symbols[i % symbols.length];
      var col = colors[i % colors.length];
      var size = 12 + Math.random() * 24;
      el.textContent = sym;
      el.style.cssText =
        'position:fixed;pointer-events:none;z-index:0;' +
        'font-size:' + size.toFixed(1) + 'px;' +
        'color:' + col + ';opacity:0;' +
        'left:' + (Math.random() * 100).toFixed(1) + 'vw;' +
        'top:' + (Math.random() * 100).toFixed(1) + 'vh;' +
        'transform:translate3d(0,0,0);' +
        'will-change:transform,opacity;';
      document.body.appendChild(el);

      items.push({
        el: el,
        startX: parseFloat(el.style.left),
        startY: parseFloat(el.style.top),
        speed: 0.2 + Math.random() * 0.8,
        driftX: (Math.random() - 0.5) * 50,
        driftY: (Math.random() - 0.5) * 50,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 2,
        scale: 0.4 + Math.random() * 1,
        delay: Math.random() * 4000,
        opacityMax: 0.2 + Math.random() * 0.5
      });
    }

    var startTime = Date.now();
    function animate() {
      var elapsed = Date.now() - startTime;
      items.forEach(function (item) {
        var t = (elapsed - item.delay) / 1000;
        if (t < 0) return;
        var opacity = Math.min(1, t / 3);
        var y = item.startY + Math.sin(t * item.speed * 0.4 + items.indexOf(item)) * item.driftY;
        var x = item.startX + Math.cos(t * item.speed * 0.25 + items.indexOf(item) * 0.7) * item.driftX;
        item.rotation += item.rotSpeed * 0.5;

        item.el.style.opacity = (opacity * item.opacityMax).toFixed(3);
        item.el.style.transform =
          'translate3d(' + x.toFixed(1) + 'vw,' + y.toFixed(1) + 'vh,0) ' +
          'rotate(' + item.rotation.toFixed(1) + 'deg) ' +
          'scale(' + item.scale.toFixed(2) + ')';
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

  /* ===========================================
     8. MAGNETIC BUTTONS
     =========================================== */
  function initMagneticButtons() {
    var btns = document.querySelectorAll('.primary-btn, .secondary-btn, .nav-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        var strength = 8;
        var dist = Math.sqrt(x * x + y * y);
        if (dist > 100) return;
        var pull = 1 - dist / 100;
        btn.style.transform =
          'translate3d(' + (x * 0.15 * pull).toFixed(1) + 'px,' +
          (y * 0.15 * pull).toFixed(1) + 'px,0) scale(1.03)';
        btn.style.transition = 'transform 0.1s ease-out';
      });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = 'translate3d(0,0,0) scale(1)';
        btn.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1)';
      });
    });
  }

  /* ===========================================
     9. RIPPLE CLICK EFFECT
     =========================================== */
  function initRippleEffect() {
    var ripplables = document.querySelectorAll(
      '.primary-btn, .secondary-btn, .nav-btn, .category-card, .buy-btn'
    );
    ripplables.forEach(function (el) {
      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.addEventListener('click', function (e) {
        var rect = el.getBoundingClientRect();
        var ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        var size = Math.max(rect.width, rect.height) * 1.5;
        var x = e.clientX - rect.left - size / 2;
        var y = e.clientY - rect.top - size / 2;
        ripple.style.cssText =
          'position:absolute;width:' + size.toFixed(1) + 'px;' +
          'height:' + size.toFixed(1) + 'px;' +
          'left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px;' +
          'border-radius:50%;background:rgba(255,255,255,0.25);' +
          'transform:scale(0);pointer-events:none;' +
          'animation:rippleAnim 0.6s ease-out forwards;';
        el.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 700);
      });
    });
  }

  /* ===========================================
     10. HERO 3D DEPTH PARALLAX — STRONGER
     =========================================== */
  function initHeroDepth() {
    var hero = document.querySelector('.hero-wrapper');
    if (!hero) return;
    var layers = hero.querySelectorAll('.hero-sub, h1, p, .hero-actions, .hero-card');
    var depths = [0.03, 0.06, 0.04, 0.08, -0.05];

    document.addEventListener('mousemove', function () {
      var x = mouse.x;
      var y = mouse.y;
      layers.forEach(function (layer, i) {
        var d = depths[i] || 0;
        var moveX = (x * d * 40).toFixed(1);
        var moveY = (y * d * 40).toFixed(1);
        layer.style.transform =
          'translate3d(' + moveX + 'px, ' + moveY + 'px, 0)';
        layer.style.transition = 'transform 0.25s ease-out';
      });
    });

    hero.addEventListener('mouseleave', function () {
      layers.forEach(function (layer) {
        layer.style.transform = 'translate3d(0, 0, 0)';
        layer.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1)';
      });
    });
  }

  /* ===========================================
     11. SHIMMER ON CTA BUTTONS
     =========================================== */
  function initShimmerEffect() {
    var buttons = document.querySelectorAll('.primary-btn, .nav-btn');
    buttons.forEach(function (btn) {
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        btn.style.setProperty('--shine-x', (e.clientX - rect.left) + 'px');
        btn.style.setProperty('--shine-y', (e.clientY - rect.top) + 'px');
      });
    });
  }

  /* ===========================================
     12. NAV 3D EFFECT & ACTIVE INDICATOR
     =========================================== */
  function initNavEffects() {
    var navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(function (link) {
      link.addEventListener('mouseenter', function () {
        this.style.transform = 'perspective(500px) translateZ(20px)';
        this.style.transition = 'transform 0.15s';
        this.style.color = '#fff';
      });
      link.addEventListener('mouseleave', function () {
        this.style.transform = 'perspective(500px) translateZ(0px)';
        this.style.color = '';
      });
    });
  }

  /* ===========================================
     13. SCROLL PROGRESS BAR
     =========================================== */
  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.style.cssText =
      'position:fixed;top:0;left:0;height:3px;' +
      'background:linear-gradient(90deg,#d4af37,#f3d36b,#d4af37);' +
      'z-index:9999;width:0%;transition:width 0.1s;' +
      'box-shadow:0 0 10px rgba(212,175,55,0.4);';
    document.body.appendChild(bar);

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var scrollTop = window.pageYOffset;
          var docHeight = document.documentElement.scrollHeight - window.innerHeight;
          var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          bar.style.width = progress.toFixed(1) + '%';
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ===========================================
     14. DYNAMIC GRADIENT ANIMATION ON PRODUCT CARDS
     =========================================== */
  function initCardBorderGlow() {
    var cards = document.querySelectorAll('.product-card, .category-card');
    cards.forEach(function (card, idx) {
      card.style.setProperty('--card-index', idx);
    });
  }

  /* ===========================================
     15. SMOOTH IMAGE ZOOM ON PRODUCT CARDS
     =========================================== */
  function initImageZoom() {
    var cards = document.querySelectorAll('.product-card');
    cards.forEach(function (card) {
      var img = card.querySelector('.product-image img');
      if (!img) return;
      card.addEventListener('mousemove', function (e) {
        var rect = card.querySelector('.product-image').getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width) * 100;
        var y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = x.toFixed(1) + '% ' + y.toFixed(1) + '%';
        img.style.transform = 'scale(1.12)';
      });
      card.addEventListener('mouseleave', function () {
        img.style.transformOrigin = 'center center';
        img.style.transform = 'scale(1)';
      });
    });
  }

  /* ===========================================
     INIT EVERYTHING
     =========================================== */
  function init() {
    // Inject ripple keyframe
    if (!document.getElementById('ripple-style')) {
      var style = document.createElement('style');
      style.id = 'ripple-style';
      style.textContent =
        '@keyframes rippleAnim{0%{transform:scale(0);opacity:0.6}100%{transform:scale(3);opacity:0}}';
      document.head.appendChild(style);
    }

    // Three.js
    if (typeof THREE !== 'undefined') {
      initThreeScene();
    } else {
      var checkThree = setInterval(function () {
        if (typeof THREE !== 'undefined') {
          initThreeScene();
          clearInterval(checkThree);
        }
      }, 200);
      setTimeout(function () { clearInterval(checkThree); }, 5000);
    }

    initCardTilt();
    initScrollReveal();
    initParallax();
    initMouseGlow();
    initStatsCounter();
    initFloatingShapes();
    initMagneticButtons();
    initRippleEffect();
    initHeroDepth();
    initShimmerEffect();
    initNavEffects();
    initScrollProgress();
    initCardBorderGlow();
    initImageZoom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();