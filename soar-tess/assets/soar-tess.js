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
  const stateLabel = document.getElementById('acf-state-label');
  const canvasModeLabel = document.getElementById('canvas-mode-label');
  const viewDescription = document.getElementById('view-description');
  const viewSeeing = document.getElementById('view-seeing');
  const viewAcf = document.getElementById('view-acf');
  const refresh = document.getElementById('acf-refresh');
  let imageMode = 'acf';
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

  function drawSeeingStar(ctx, x, y, fwhm, brightness, warm = false) {
    const radius = fwhm * 1.25;
    const peak = Math.min(1, .96 * Math.sqrt(brightness));
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, warm ? `rgba(255,247,222,${peak})` : `rgba(245,251,255,${peak})`);
    gradient.addColorStop(.08, warm ? `rgba(255,211,137,${peak * .78})` : `rgba(188,221,255,${peak * .78})`);
    gradient.addColorStop(.32, warm ? `rgba(255,155,92,${peak * .3})` : `rgba(103,166,224,${peak * .3})`);
    gradient.addColorStop(.62, warm ? `rgba(205,92,67,${peak * .08})` : `rgba(65,112,167,${peak * .08})`);
    gradient.addColorStop(1, 'rgba(20,35,55,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

    ctx.strokeStyle = imageMode === 'acf' ? 'rgba(115,226,209,.065)' : 'rgba(120,168,255,.045)';
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

    if (imageMode === 'acf') {
      for (let i = 0; i < 42; i += 1) {
        const theta = rand() * Math.PI * 2;
        const radial = Math.pow(rand(), .62) * Math.min(width, height) * .31;
        const x = cx + Math.cos(theta) * radial;
        const y = cy + Math.sin(theta) * radial;
        drawGlow(ctx, x, y, 4 + rand() * 10, .018 + rand() * .035, rand() > .5);
      }
    }

    const sepArcsec = Number(separation.value);
    const paDegrees = Number(angle.value);
    const deltaMag = Number(contrast.value);
    const fluxRatio = Math.pow(10, -0.4 * deltaMag);
    const sepPixels = (sepArcsec / 2.8) * Math.min(width, height);
    const radians = paDegrees * Math.PI / 180;
    const dx = Math.sin(radians) * sepPixels;
    const dy = -Math.cos(radians) * sepPixels;
    if (imageMode === 'acf') {
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
    } else {
      const seeingFwhm = (1.1 / 2.8) * Math.min(width, height);
      drawSeeingStar(ctx, cx + dx, cy + dy, seeingFwhm, fluxRatio, true);
      drawSeeingStar(ctx, cx, cy, seeingFwhm, 1, false);
    }

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
      if (imageMode === 'seeing') {
        if (sepArcsec < .72 || deltaMag > 2.7) state.textContent = 'Blended';
        else if (sepArcsec < 1.05) state.textContent = 'Elongated';
        else state.textContent = 'Partly resolved';
      } else if (sepArcsec < .13 || deltaMag > 4.2) state.textContent = 'Subtle pair';
      else if (sepArcsec < .2 || deltaMag > 3.2) state.textContent = 'Emerging pair';
      else state.textContent = 'Clear pair';
    }

    if (imageMode === 'seeing') {
      canvas.setAttribute('aria-label', `Illustrative seeing-limited image with a companion at ${sepArcsec.toFixed(2)} arcseconds, position angle ${paDegrees.toFixed(0)} degrees, and brightness contrast ${deltaMag.toFixed(1)} magnitudes, blurred by 1.1 arcsecond seeing.`);
    } else {
      canvas.setAttribute('aria-label', `Illustrative speckle autocorrelation with mirrored companion peaks at ${sepArcsec.toFixed(2)} arcseconds, position angle ${paDegrees.toFixed(0)} degrees, and brightness contrast ${deltaMag.toFixed(1)} magnitudes.`);
    }
  }

  function setImageMode(mode) {
    imageMode = mode === 'seeing' ? 'seeing' : 'acf';
    const seeingActive = imageMode === 'seeing';
    viewSeeing?.classList.toggle('active', seeingActive);
    viewAcf?.classList.toggle('active', !seeingActive);
    viewSeeing?.setAttribute('aria-pressed', String(seeingActive));
    viewAcf?.setAttribute('aria-pressed', String(!seeingActive));
    if (canvasModeLabel) canvasModeLabel.textContent = seeingActive ? 'Seeing-limited image · ~1.1″ FWHM' : 'Illustrative ACF';
    if (stateLabel) stateLabel.textContent = seeingActive ? 'seeing-limited appearance' : 'illustrative ACF visibility';
    if (viewDescription) viewDescription.textContent = seeingActive
      ? 'Ordinary atmospheric seeing blends the stars into one broad point-spread function.'
      : 'The autocorrelation reveals the companion as a symmetric pair of peaks.';
    drawAcf();
  }

  [separation, angle, contrast].forEach((input) => input?.addEventListener('input', drawAcf));
  viewSeeing?.addEventListener('click', () => setImageMode('seeing'));
  viewAcf?.addEventListener('click', () => setImageMode('acf'));
  refresh?.addEventListener('click', () => {
    textureSeed = Math.floor(Math.random() * 1000000) + 1;
    drawAcf();
  });

  let resizeFrame = null;
  window.addEventListener('resize', () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawAcf);
  });
  setImageMode('acf');

  const tessScaleVisual = document.getElementById('tess-scale-visual');
  const tessPixel = document.getElementById('tess-pixel');
  const tessZoom = document.getElementById('tess-zoom');
  let tessZoomed = false;

  function updateTessScale() {
    tessScaleVisual?.classList.toggle('zoomed', tessZoomed);
    tessZoom?.setAttribute('aria-pressed', String(tessZoomed));
    if (tessZoom) tessZoom.textContent = tessZoomed ? 'Return to the 21″ TESS pixel' : 'Zoom into the 2.8″ SOAR field';
    if (tessPixel) tessPixel.setAttribute('aria-label', tessZoomed
      ? 'Zoomed view of a 2.8 arcsecond HRCam field containing a close binary star'
      : 'Scale comparison showing a 2.8 arcsecond HRCam field inside one 21 arcsecond TESS pixel');
  }

  tessZoom?.addEventListener('click', () => {
    tessZoomed = !tessZoomed;
    updateTessScale();
  });
  updateTessScale();

  const binarySeparation = document.getElementById('binary-separation');
  const binaryDistance = document.getElementById('binary-distance');
  const hostMeter = document.getElementById('host-meter');
  const hostPercent = document.getElementById('host-percent');
  const modelCallout = document.getElementById('model-callout');
  const orbitSystem = document.getElementById('orbit-system');

  function updateSuppression() {
    if (!binarySeparation) return;
    const sliderPosition = Number(binarySeparation.value);
    const minLog = Math.log10(5);
    const maxLog = Math.log10(3000);
    const distance = Math.round(Math.pow(10, minLog + (sliderPosition / 1000) * (maxLog - minLog)));
    const s0 = 0.129;
    const a50 = 228;
    const widthDex = 0.518;
    const logistic = 1 / (1 + Math.exp(-(Math.log10(distance) - Math.log10(a50)) / widthDex));
    const occurrence = Math.round((s0 + (1 - s0) * logistic) * 100);
    const scaledX = 18 + (sliderPosition / 1000) * 48;

    if (binaryDistance) binaryDistance.textContent = `${distance} AU`;
    if (hostMeter) hostMeter.style.setProperty('--meter', `${occurrence}%`);
    if (hostPercent) hostPercent.textContent = `${occurrence}%`;
    if (orbitSystem) {
      orbitSystem.style.setProperty('--binary-x', `${scaledX.toFixed(1)}%`);
      orbitSystem.style.setProperty('--orbit-width', `${(scaledX * 2).toFixed(1)}%`);
    }
    binarySeparation.setAttribute('aria-valuetext', `${distance} astronomical units; the smooth draft model is approximately ${occurrence} percent of the field companion frequency`);

    if (!modelCallout) return;
    if (distance <= 50) {
      modelCallout.innerHTML = `<b>Deep deficit.</b> At ${distance} AU, the smooth model is about ${occurrence}% of the field frequency. In the fixed projected-separation count, SOAR sees 24 sources inside 50 AU where 87.2 are expected.`;
    } else if (distance <= 100) {
      modelCallout.innerHTML = `<b>Still strongly suppressed.</b> At ${distance} AU, the smooth model is about ${occurrence}% of the field frequency. Inside 100 AU, the fixed count is 48 observed sources versus 142.8 expected.`;
    } else if (distance <= 500) {
      modelCallout.innerHTML = `<b>Gradual recovery.</b> At ${distance} AU, the smooth model reaches about ${occurrence}% of the field frequency. Its model-dependent halfway scale is 228 AU, not a hard boundary.`;
    } else {
      modelCallout.innerHTML = `<b>Approaching the field population.</b> At ${distance.toLocaleString()} AU, the smooth model reaches about ${occurrence}% of the field frequency. Gaia's wide-companion census constrains this part of the recovery.`;
    }
  }

  binarySeparation?.addEventListener('input', updateSuppression);
  updateSuppression();
})();
