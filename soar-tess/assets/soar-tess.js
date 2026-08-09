(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const revealItems = document.querySelectorAll('.reveal:not(.visible)');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((el) => el.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach((el) => observer.observe(el));
  }

  const canvas = document.getElementById('acf-canvas');
  const separation = document.getElementById('acf-separation');
  const angle = document.getElementById('acf-angle');
  const contrast = document.getElementById('acf-contrast');
  const separationValue = document.getElementById('acf-separation-value');
  const angleValue = document.getElementById('acf-angle-value');
  const contrastValue = document.getElementById('acf-contrast-value');
  const projected = document.getElementById('acf-projected');
  const flux = document.getElementById('acf-flux');
  const state = document.getElementById('acf-state');
  const refresh = document.getElementById('acf-refresh');
  let textureSeed = 7319;

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (1664525 * value + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function drawGlow(ctx, x, y, radius, opacity, warm = false) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    if (warm) {
      gradient.addColorStop(0, `rgba(255,247,223,${opacity})`);
      gradient.addColorStop(.12, `rgba(255,198,109,${opacity * .92})`);
      gradient.addColorStop(.38, `rgba(255,125,87,${opacity * .38})`);
      gradient.addColorStop(1, 'rgba(255,95,77,0)');
    } else {
      gradient.addColorStop(0, `rgba(245,255,253,${opacity})`);
      gradient.addColorStop(.12, `rgba(115,226,209,${opacity * .88})`);
      gradient.addColorStop(.42, `rgba(70,128,157,${opacity * .3})`);
      gradient.addColorStop(1, 'rgba(55,100,128,0)');
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAcf() {
    if (!canvas || !separation || !angle || !contrast) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width || 760));
    const height = Math.max(360, Math.round(rect.height || 570));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#02050a';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const rand = seededRandom(textureSeed);

    ctx.strokeStyle = 'rgba(115,226,209,.065)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i += 1) {
      const x = (width / 8) * i;
      const y = (height / 8) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    for (let i = 0; i < 330; i += 1) {
      const x = rand() * width;
      const y = rand() * height;
      const radial = Math.hypot(x - cx, y - cy) / Math.hypot(cx, cy);
      const radius = .45 + rand() * 2.25;
      const alpha = (.015 + rand() * .07) * (1 - radial * .34);
      ctx.fillStyle = `rgba(${90 + Math.round(rand() * 70)},${135 + Math.round(rand() * 80)},${145 + Math.round(rand() * 90)},${Math.max(.008, alpha)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 42; i += 1) {
      const theta = rand() * Math.PI * 2;
      const radial = Math.pow(rand(), .62) * Math.min(width, height) * .31;
      const x = cx + Math.cos(theta) * radial;
      const y = cy + Math.sin(theta) * radial;
      drawGlow(ctx, x, y, 4 + rand() * 10, .018 + rand() * .035, rand() > .5);
    }

    const sepArcsec = Number(separation.value);
    const paDegrees = Number(angle.value);
    const deltaMag = Number(contrast.value);
    const fluxRatio = Math.pow(10, -0.4 * deltaMag);
    const sepPixels = (sepArcsec / 2.8) * Math.min(width, height);
    const radians = paDegrees * Math.PI / 180;
    const dx = Math.sin(radians) * sepPixels;
    const dy = -Math.cos(radians) * sepPixels;
    const companionOpacity = .18 + .78 * Math.pow(fluxRatio, .33);
    const companionRadius = 19 + 9 * Math.pow(fluxRatio, .18);

    drawGlow(ctx, cx, cy, 58, .97, false);
    drawGlow(ctx, cx, cy, 25, .96, true);
    drawGlow(ctx, cx + dx, cy + dy, companionRadius, companionOpacity, true);
    drawGlow(ctx, cx - dx, cy - dy, companionRadius, companionOpacity, true);

    ctx.strokeStyle = 'rgba(244,247,251,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(205,219,229,.48)';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText('N', width - 31, 39);
    ctx.fillText('E', width - 58, 65);
    ctx.strokeStyle = 'rgba(205,219,229,.4)';
    ctx.beginPath();
    ctx.moveTo(width - 31, 69); ctx.lineTo(width - 31, 47);
    ctx.moveTo(width - 31, 69); ctx.lineTo(width - 53, 69);
    ctx.stroke();

    if (separationValue) separationValue.textContent = `${sepArcsec.toFixed(2)}″`;
    if (angleValue) angleValue.textContent = `${paDegrees.toFixed(0)}°`;
    if (contrastValue) contrastValue.textContent = `Δm ${deltaMag.toFixed(1)}`;
    if (projected) projected.textContent = `${Math.round(sepArcsec * 200)} AU`;
    if (flux) flux.textContent = `${(fluxRatio * 100).toFixed(1)}%`;
    if (state) {
      if (sepArcsec < .13 || deltaMag > 4.2) state.textContent = 'Subtle pair';
      else if (sepArcsec < .2 || deltaMag > 3.2) state.textContent = 'Emerging pair';
      else state.textContent = 'Clear pair';
    }

    canvas.setAttribute('aria-label', `Illustrative speckle autocorrelation with mirrored companion peaks at ${sepArcsec.toFixed(2)} arcseconds, position angle ${paDegrees.toFixed(0)} degrees, and brightness contrast ${deltaMag.toFixed(1)} magnitudes.`);
  }

  [separation, angle, contrast].forEach((input) => input?.addEventListener('input', drawAcf));
  refresh?.addEventListener('click', () => {
    textureSeed = Math.floor(Math.random() * 1000000) + 1;
    drawAcf();
  });

  let resizeFrame = null;
  window.addEventListener('resize', () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawAcf);
  });
  drawAcf();

  const binarySeparation = document.getElementById('binary-separation');
  const binaryDistance = document.getElementById('binary-distance');
  const hostMeter = document.getElementById('host-meter');
  const hostPercent = document.getElementById('host-percent');
  const modelCallout = document.getElementById('model-callout');
  const orbitSystem = document.getElementById('orbit-system');

  function updateSuppression() {
    if (!binarySeparation) return;
    const distance = Number(binarySeparation.value);
    const suppressed = distance <= 58;
    const occurrence = suppressed ? 15 : 100;
    const scaledX = 18 + ((distance - 5) / 295) * 48;

    if (binaryDistance) binaryDistance.textContent = `${distance} AU`;
    if (hostMeter) hostMeter.style.setProperty('--meter', `${occurrence}%`);
    if (hostPercent) hostPercent.textContent = `${occurrence}%`;
    if (orbitSystem) {
      orbitSystem.style.setProperty('--binary-x', `${scaledX.toFixed(1)}%`);
      orbitSystem.style.setProperty('--orbit-width', `${(scaledX * 2).toFixed(1)}%`);
    }
    binarySeparation.setAttribute('aria-valuetext', `${distance} astronomical units; ${suppressed ? 'inside' : 'outside'} the 58 astronomical unit suppression cutoff`);

    if (!modelCallout) return;
    if (suppressed) {
      modelCallout.innerHTML = '<b>Strongly suppressed.</b> Inside the fitted 58 AU cutoff, the model contains only 15% as many planet-hosting binaries as the field population—about 6.7 times fewer.';
    } else {
      modelCallout.innerHTML = '<b>Field-like in the step model.</b> Outside the fitted 58 AU cutoff, the simple model returns to the field-binary occurrence rate. The observed transition is an ensemble result, not a hard boundary for an individual system.';
    }
  }

  binarySeparation?.addEventListener('input', updateSuppression);
  updateSuppression();
})();
