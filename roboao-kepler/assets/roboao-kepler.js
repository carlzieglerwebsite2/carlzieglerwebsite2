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

  const aoSlider = document.getElementById('ao-slider');
  const aoStage = document.getElementById('ao-stage');
  const aoFwhm = document.getElementById('ao-fwhm');
  const aoCallout = document.getElementById('ao-callout');
  const aoAnimate = document.getElementById('ao-animate');
  const primaryStar = aoStage?.querySelector('.primary-star');
  const companionStar = aoStage?.querySelector('.companion-star');
  let aoAnimation = null;

  function setAoCorrection(value) {
    if (!aoSlider || !aoStage || !aoFwhm || !primaryStar || !companionStar) return;
    const t = Math.max(0, Math.min(1, Number(value) / 100));
    const fwhm = 1.10 - (0.95 * t);
    const blur = 13.5 * Math.pow(1 - t, 1.35) + 0.25;
    const scale = 2.15 - (1.32 * t);
    aoSlider.value = String(Math.round(t * 100));
    aoFwhm.textContent = `${fwhm.toFixed(2)}″`;
    primaryStar.style.setProperty('--psf-blur', `${blur.toFixed(2)}px`);
    primaryStar.style.setProperty('--psf-scale', scale.toFixed(2));
    companionStar.style.setProperty('--psf-blur', `${(blur * 1.04).toFixed(2)}px`);
    companionStar.style.setProperty('--psf-scale', scale.toFixed(2));
    companionStar.style.opacity = String(0.28 + (0.7 * t));
    aoStage.classList.toggle('resolved', t > 0.62);

    if (!aoCallout) return;
    if (t < 0.35) {
      aoCallout.innerHTML = '<b>Blended.</b> At seeing-limited resolution, the fainter source is buried in the primary star\'s point-spread function.';
    } else if (t < 0.68) {
      aoCallout.innerHTML = '<b>Separating.</b> Correcting the atmospheric wavefront narrows the PSF and the asymmetry from the companion begins to emerge.';
    } else {
      aoCallout.innerHTML = '<b>Resolved.</b> At survey-like angular resolution the two sources can be measured separately, including their separation, position angle, and flux contrast.';
    }
  }

  aoSlider?.addEventListener('input', () => {
    if (aoAnimation) cancelAnimationFrame(aoAnimation);
    setAoCorrection(aoSlider.value);
  });

  aoAnimate?.addEventListener('click', () => {
    if (!aoSlider) return;
    if (aoAnimation) cancelAnimationFrame(aoAnimation);
    if (reducedMotion) {
      setAoCorrection(100);
      return;
    }
    const started = performance.now();
    const duration = 1800;
    const animate = (now) => {
      const raw = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - raw, 3);
      setAoCorrection(eased * 100);
      if (raw < 1) aoAnimation = requestAnimationFrame(animate);
      else aoAnimation = null;
    };
    aoAnimation = requestAnimationFrame(animate);
  });
  setAoCorrection(0);

  const deltaMag = document.getElementById('delta-mag');
  const observedRadius = document.getElementById('observed-radius');
  const deltaMagValue = document.getElementById('delta-mag-value');
  const radiusValue = document.getElementById('radius-value');
  const extraLight = document.getElementById('extra-light');
  const radiusCorrection = document.getElementById('radius-correction');
  const correctedRadius = document.getElementById('corrected-radius');
  const binarySecondary = document.getElementById('binary-secondary');
  const correctedCurve = document.getElementById('corrected-curve');

  function updateDilution() {
    if (!deltaMag || !observedRadius) return;
    const dm = Number(deltaMag.value);
    const radius = Number(observedRadius.value);
    const fluxRatio = Math.pow(10, -0.4 * dm);
    const companionFraction = fluxRatio / (1 + fluxRatio);
    const correction = Math.sqrt(1 + fluxRatio);
    const corrected = radius * correction;

    if (deltaMagValue) deltaMagValue.textContent = `Δm ${dm.toFixed(1)}`;
    if (radiusValue) radiusValue.textContent = `${radius.toFixed(2)} R⊕`;
    if (extraLight) extraLight.textContent = `${(companionFraction * 100).toFixed(1)}%`;
    if (radiusCorrection) radiusCorrection.textContent = `×${correction.toFixed(2)}`;
    if (correctedRadius) correctedRadius.textContent = `${corrected.toFixed(2)} R⊕`;

    if (binarySecondary) {
      const brightness = Math.max(0.18, Math.min(1, Math.sqrt(fluxRatio)));
      const size = 24 + (36 * brightness);
      binarySecondary.style.setProperty('--secondary-size', `${size.toFixed(1)}px`);
      binarySecondary.style.setProperty('--secondary-opacity', String(0.34 + 0.62 * brightness));
    }

    if (correctedCurve) {
      const depth = Math.min(1, (correction - 1) / (Math.SQRT2 - 1));
      const yShoulder = 82 + 20 * depth;
      const yDeep = 112 + 37 * depth;
      const yBottom = 120 + 44 * depth;
      correctedCurve.setAttribute('d', `M30 55H255 Q270 55 275 ${yShoulder.toFixed(1)} L285 ${yDeep.toFixed(1)} Q290 ${yBottom.toFixed(1)} 300 ${yBottom.toFixed(1)} H330 Q340 ${yBottom.toFixed(1)} 345 ${yDeep.toFixed(1)} L355 ${yShoulder.toFixed(1)} Q360 55 375 55 H600`);
    }
  }
  deltaMag?.addEventListener('input', updateDilution);
  observedRadius?.addEventListener('input', updateDilution);
  updateDilution();

  const separation = document.getElementById('separation');
  const separationValue = document.getElementById('separation-value');
  const separationStage = document.getElementById('separation-stage');
  const associationReadout = document.getElementById('association-readout');

  function updateSeparation() {
    if (!separation || !separationStage) return;
    const sep = Number(separation.value);
    const min = Number(separation.min);
    const max = Number(separation.max);
    const t = (sep - min) / (max - min);
    const x = 36 + (52 * t);
    const line = Math.max(12, x - 24);
    separationStage.style.setProperty('--sep-x', `${x.toFixed(1)}%`);
    separationStage.style.setProperty('--sep-line', `${line.toFixed(1)}%`);
    if (separationValue) separationValue.textContent = `${sep.toFixed(2)}″`;
    if (!associationReadout) return;
    if (sep < 1) {
      associationReadout.innerHTML = '<strong>Bound-dominated regime</strong><span>Most detected neighbors inside 1″ were likely physically associated in Survey V.</span>';
    } else {
      associationReadout.innerHTML = '<strong>Association needs more information</strong><span>At wider separations, chance alignments become increasingly important. Survey V used stellar-density models and multi-band photometry rather than separation alone.</span>';
    }
  }
  separation?.addEventListener('input', updateSeparation);
  updateSeparation();
})();
