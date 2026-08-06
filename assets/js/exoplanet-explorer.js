(() => {
  'use strict';

  const root = document.getElementById('exoplanet-explorer');
  if (!root) return;

  const els = {
    canvas: root.querySelector('#exo-chart'),
    chartShell: root.querySelector('#exo-chart-shell'),
    loading: root.querySelector('#exo-loading'),
    tooltip: root.querySelector('#exo-tooltip'),
    year: root.querySelector('#exo-year'),
    yearRange: root.querySelector('#exo-year-range'),
    previous: root.querySelector('#exo-year-prev'),
    next: root.querySelector('#exo-year-next'),
    play: root.querySelector('#exo-year-play'),
    search: root.querySelector('#exo-search'),
    searchStatus: root.querySelector('#exo-search-status'),
    milestone: root.querySelector('#exo-milestone'),
    totalValue: root.querySelector('#exo-total-value'),
    totalNote: root.querySelector('#exo-total-note'),
    newNote: root.querySelector('#exo-new-note'),
    methodList: root.querySelector('#exo-method-list'),
    updateLine: root.querySelector('#exo-update-line'),
    countButtons: [...root.querySelectorAll('[data-count-mode]')],
    regionButtons: [...root.querySelectorAll('[data-exo-region]')],
    regionInfo: root.querySelector('#exo-region-info'),
    solarButton: root.querySelector('#exo-solar-system'),
  };

  if (!els.canvas || !els.chartShell) return;

  const METHOD_COLORS = {
    'Transit': '#4fd6a2',
    'Radial Velocity': '#4aa8ff',
    'Microlensing': '#f2b84b',
    'Imaging': '#ff7185',
    'Transit Timing Variations': '#a986ff',
    'Eclipse Timing Variations': '#ef8de1',
    'Orbital Brightness Modulation': '#5cd6df',
    'Pulsar Timing': '#d46bff',
    'Astrometry': '#ff9559',
    'Pulsation Timing Variations': '#c9d55b',
    'Disk Kinematics': '#9ba8b8',
    'Other': '#8e9cab',
  };

  const SOLAR_SYSTEM = [
    { name: 'Mercury', period: 87.97, radius: .383, mass: .0553, kind: 'Terrestrial planet' },
    { name: 'Venus', period: 224.70, radius: .949, mass: .815, kind: 'Terrestrial planet' },
    { name: 'Earth', period: 365.26, radius: 1, mass: 1, kind: 'Terrestrial planet' },
    { name: 'Mars', period: 686.98, radius: .532, mass: .107, kind: 'Terrestrial planet' },
    { name: 'Jupiter', period: 4332.59, radius: 11.21, mass: 317.83, kind: 'Gas giant' },
    { name: 'Saturn', period: 10759.2, radius: 9.45, mass: 95.16, kind: 'Gas giant' },
    { name: 'Uranus', period: 30688.5, radius: 4.01, mass: 14.54, kind: 'Ice giant' },
    { name: 'Neptune', period: 60182, radius: 3.88, mass: 17.15, kind: 'Ice giant' },
  ];

  const MILESTONES = [
    {
      name: 'PSR B1257+12 c', year: 1992,
      label: 'The first confirmed exoplanetary system',
      detail: 'Timing of the millisecond pulsar PSR B1257+12 established the first secure planets beyond the Solar System.',
      source: 'https://ui.adsabs.harvard.edu/abs/1992Natur.355..145W/abstract',
    },
    {
      name: '51 Peg b', year: 1995,
      label: 'First planet around a Sun-like star',
      detail: '51 Pegasi b made radial velocity the first great engine of exoplanet discovery and revealed the unexpected hot-Jupiter population.',
      source: 'https://ui.adsabs.harvard.edu/abs/1995Natur.378..355M/abstract',
    },
    {
      name: 'HD 209458 b', year: 1999,
      label: 'First exoplanet observed to transit',
      detail: 'A planet already known from radial velocity was seen crossing its star, opening the era of precision planetary radii and transit spectroscopy.',
      source: 'https://ui.adsabs.harvard.edu/abs/2000ApJ...529L..45C/abstract',
    },
    {
      name: 'HR 8799 b', year: 2008,
      label: 'A landmark directly imaged planetary system',
      detail: 'Direct images revealed multiple massive planets around HR 8799, showing planetary systems at tens of AU without relying on a stellar reflex signal or transit.',
      source: 'https://ui.adsabs.harvard.edu/abs/2008Sci...322.1348M/abstract',
    },
    {
      name: 'Kepler-10 b', year: 2011,
      label: 'Kepler confirms its first rocky planet',
      detail: 'At about 1.4 Earth radii, Kepler-10 b demonstrated Kepler\'s ability to move the census into the terrestrial-size regime.',
      source: 'https://ui.adsabs.harvard.edu/abs/2011ApJ...729...27B/abstract',
    },
    {
      name: 'Proxima Cen b', year: 2016,
      label: 'A planet around the nearest star to the Sun',
      detail: 'Radial-velocity measurements revealed an approximately Earth-mass planet orbiting Proxima Centauri.',
      source: 'https://ui.adsabs.harvard.edu/abs/2016Natur.536..437A/abstract',
    },
    {
      name: 'TRAPPIST-1 e', year: 2017,
      label: 'Seven Earth-size worlds at TRAPPIST-1',
      detail: 'The compact resonant system made small, temperate planets around ultracool stars prime targets for comparative atmospheric studies.',
      source: 'https://ui.adsabs.harvard.edu/abs/2017Natur.542..456G/abstract',
    },
    {
      name: 'TOI-700 d', year: 2020,
      label: 'TESS reaches an Earth-size habitable-zone world',
      detail: 'TOI-700 d was the first Earth-size planet in a host star\'s habitable zone discovered by TESS.',
      source: 'https://ui.adsabs.harvard.edu/abs/2020AJ....160..116G/abstract',
    },
  ];

  const REGIONS = {
    neptune: {
      title: 'Hot Neptune desert',
      html: 'A real scarcity of intermediate-size planets on the very shortest orbits. The shaded guide follows the classic <strong>Mazeh et al. (2016)</strong> period–radius boundaries. Intense irradiation can strip lower-mass planets of H/He, while migration, tides, and disruption help shape the giant-planet edge. The exact boundary depends on the sample and is still being refined.',
      sources: [
        ['Mazeh et al. 2016', 'https://arxiv.org/abs/1602.07843'],
        ['Owen & Lai 2018', 'https://arxiv.org/abs/1807.00012'],
      ],
    },
    valley: {
      title: 'Radius valley',
      html: 'A deficit near ~2 R⊕ separates the super-Earth and sub-Neptune populations. The guide follows the measured slope <strong>R ∝ P<sup>−0.09</sup></strong> from Van Eylen et al. (2018). Atmospheric loss—photoevaporation and/or core-powered mass loss—is a leading explanation, although formation history and host-star properties also matter. The band shown here is a visual guide, not a universal boundary.',
      sources: [
        ['Van Eylen et al. 2018', 'https://arxiv.org/abs/1710.05398'],
      ],
    },
    giantvalley: {
      title: 'Giant-planet period valley',
      html: 'Giant planets are relatively sparse at periods of a few tens of days, between the hot-Jupiter concentration and the longer-period giant population. <strong>Udry et al. (2003)</strong> interpreted this as a transition between populations that experienced different migration histories. Later transit and RV samples show that the exact shape is selection- and mass-dependent, so the 10–100 day band here is deliberately a broad visual pointer rather than a fitted boundary.',
      sources: [
        ['Udry et al. 2003', 'https://www.aanda.org/articles/aa/pdf/2003/31/aa3256.pdf'],
        ['Santerne et al. 2016', 'https://www.aanda.org/articles/aa/full_html/2016/03/aa27329-15/aa27329-15.html'],
      ],
    },
    hotjupiter: {
      title: 'Hot-Jupiter pile-up',
      html: 'A conspicuous concentration of giant planets sits at periods of only a few days. These worlds almost certainly did not assemble where we see most of them today: disk migration and/or later high-eccentricity migration can move giants inward, while stellar tides and disruption sculpt the innermost edge. The shaded 2–5 day box is a visual guide to the classic pile-up, not a classification cut.',
      sources: [
        ['Udry et al. 2003', 'https://www.aanda.org/articles/aa/pdf/2003/31/aa3256.pdf'],
      ],
    },
  };

  const state = {
    payload: null,
    planets: [],
    startYear: 1991,
    endYear: new Date().getUTCFullYear(),
    year: 1991,
    countMode: 'count',
    activeRegions: new Set(),
    solarSystem: true,
    hiddenMethods: new Set(),
    methods: [],
    methodTotals: new Map(),
    pointCache: [],
    search: '',
    playing: false,
    playTimer: null,
    pinnedTooltip: false,
    hoveredPoint: null,
  };

  const context = els.canvas.getContext('2d');
  const number = new Intl.NumberFormat('en-US');

  const escapeHTML = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const isFinitePositive = value => Number.isFinite(value) && value > 0;

  function formatNumber(value, digits = 3) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 10000) return number.format(Math.round(value));
    if (Math.abs(value) >= 1000) return number.format(Math.round(value));
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, '');
    if (Math.abs(value) >= 1) return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return value.toPrecision(digits).replace(/0+$/, '').replace(/\.$/, '');
  }

  function currentTheme() {
    const light = document.documentElement.dataset.theme === 'light';
    return light ? {
      bg: '#ffffff', grid: '#d6e1e9', gridMinor: '#e8eff4', text: '#20364a', muted: '#607487',
      plotBorder: '#bfcdd8', regionNeptune: 'rgba(242,184,75,.13)', regionNeptuneLine: '#b77d13',
      regionValley: 'rgba(169,134,255,.13)', regionValleyLine: '#7559c7',
      regionGiant: 'rgba(110,216,255,.10)', regionGiantLine: '#147c9e',
      regionHotJupiter: 'rgba(255,113,133,.10)', regionHotJupiterLine: '#b84255', solar: '#27384a', newEdge: '#0b1726',
    } : {
      bg: '#07111f', grid: '#29445c', gridMinor: '#193047', text: '#edf7ff', muted: '#96aabd',
      plotBorder: '#39566e', regionNeptune: 'rgba(242,184,75,.105)', regionNeptuneLine: '#f2b84b',
      regionValley: 'rgba(169,134,255,.11)', regionValleyLine: '#b49cff',
      regionGiant: 'rgba(110,216,255,.085)', regionGiantLine: '#6ed8ff',
      regionHotJupiter: 'rgba(255,113,133,.085)', regionHotJupiterLine: '#ff8ca0', solar: '#f0f5f8', newEdge: '#ffffff',
    };
  }

  function setLoading(message, error = false) {
    if (!els.loading) return;
    els.loading.hidden = false;
    els.loading.textContent = message;
    els.loading.style.color = error ? '#ff8b99' : '';
  }

  function hideLoading() {
    if (els.loading) els.loading.hidden = true;
  }

  function stopPlayback() {
    state.playing = false;
    window.clearInterval(state.playTimer);
    state.playTimer = null;
    if (els.play) {
      els.play.innerHTML = '<span aria-hidden="true">▶</span> Play';
      els.play.setAttribute('aria-label', 'Play discovery timeline');
      els.play.title = 'Play timeline';
    }
  }

  function startPlayback() {
    if (state.playing) return stopPlayback();
    if (state.year >= state.endYear) setYear(state.startYear);
    state.playing = true;
    if (els.play) {
      els.play.innerHTML = '<span aria-hidden="true">Ⅱ</span> Pause';
      els.play.setAttribute('aria-label', 'Pause discovery timeline');
      els.play.title = 'Pause timeline';
    }
    state.playTimer = window.setInterval(() => {
      if (state.year >= state.endYear) {
        stopPlayback();
        return;
      }
      setYear(state.year + 1);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1150 : 780);
  }

  function setYear(year, { stop = false } = {}) {
    if (!state.payload) return;
    state.year = Math.max(state.startYear, Math.min(state.endYear, Number(year)));
    if (els.year) els.year.textContent = state.year;
    if (els.yearRange) els.yearRange.value = state.year;
    if (els.previous) els.previous.disabled = state.year <= state.startYear;
    if (els.next) els.next.disabled = state.year >= state.endYear;
    if (stop) stopPlayback();
    updateCounters();
    updateMilestone();
    draw();
  }

  function updateMilestone() {
    if (!els.milestone) return;
    const matches = MILESTONES.filter(item => item.year === state.year);
    if (!matches.length) {
      els.milestone.classList.remove('visible');
      els.milestone.innerHTML = '';
      return;
    }
    const item = matches[0];
    els.milestone.innerHTML = `<strong>★ ${escapeHTML(state.year)} milestone · ${escapeHTML(item.name)}</strong> ${escapeHTML(item.detail)} <a href="${item.source}" target="_blank" rel="noopener">Discovery paper ↗</a>`;
    els.milestone.classList.add('visible');
  }

  function cumulativePlanets() {
    return state.planets.filter(planet => Number.isFinite(planet.year) && planet.year <= state.year);
  }

  function updateCounters() {
    if (!state.payload) return;
    const cumulative = cumulativePlanets();
    const cumulativeTotal = cumulative.length;
    const newThisYear = cumulative.filter(planet => planet.year === state.year).length;
    const counts = new Map();
    cumulative.forEach(planet => counts.set(planet.method, (counts.get(planet.method) || 0) + 1));

    if (state.countMode === 'share') {
      const progress = state.payload.totalConfirmed ? cumulativeTotal / state.payload.totalConfirmed * 100 : 0;
      els.totalValue.textContent = `${progress.toFixed(progress < 1 ? 2 : 1)}%`;
      els.totalNote.textContent = `of today's ${number.format(state.payload.totalConfirmed)}-planet catalog known by ${state.year}`;
    } else {
      els.totalValue.textContent = number.format(cumulativeTotal);
      els.totalNote.textContent = `confirmed by ${state.year}`;
    }
    els.newNote.innerHTML = `<strong>+${number.format(newThisYear)}</strong> first reported in ${state.year}`;

    els.methodList.innerHTML = '';
    state.methods.forEach(method => {
      const count = counts.get(method) || 0;
      const share = cumulativeTotal ? count / cumulativeTotal * 100 : 0;
      const value = state.countMode === 'share'
        ? `${share.toFixed(share < 1 && share > 0 ? 1 : 0)}%`
        : number.format(count);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `exo-method-row${state.hiddenMethods.has(method) ? ' filtered' : ''}`;
      button.style.setProperty('--method-color', METHOD_COLORS[method] || METHOD_COLORS.Other);
      button.style.setProperty('--method-share', `${Math.min(100, share)}%`);
      button.setAttribute('aria-pressed', state.hiddenMethods.has(method) ? 'false' : 'true');
      button.title = state.hiddenMethods.has(method) ? `Show ${method}` : `Hide ${method}`;
      button.innerHTML = `<span class="exo-method-dot" aria-hidden="true"></span><span class="exo-method-name">${escapeHTML(method)}</span><span class="exo-method-value">${value}</span>`;
      button.addEventListener('click', () => {
        if (state.hiddenMethods.has(method)) state.hiddenMethods.delete(method);
        else state.hiddenMethods.add(method);
        updateCounters();
        draw();
      });
      els.methodList.appendChild(button);
    });
  }

  function updateRegionAvailability() {
    els.regionButtons.forEach(button => {
      const active = state.activeRegions.has(button.dataset.exoRegion);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function describeRegion(key) {
    const region = REGIONS[key];
    if (!region || !els.regionInfo) return;
    const citations = region.sources
      .map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener">${escapeHTML(label)} ↗</a>`)
      .join(' · ');
    els.regionInfo.innerHTML = `<span><strong>${escapeHTML(region.title)}.</strong> ${region.html}</span><span>${citations}</span>`;
  }

  function resizeCanvas() {
    const rect = els.chartShell.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(420, Math.round(rect.height));
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);
    if (els.canvas.width !== targetWidth || els.canvas.height !== targetHeight) {
      els.canvas.width = targetWidth;
      els.canvas.height = targetHeight;
    }
    els.canvas.style.width = `${width}px`;
    els.canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr };
  }

  function starPath(ctx, x, y, outer = 7.5, inner = 3.4) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function draw() {
    if (!state.payload) return;
    const { width, height } = resizeCanvas();
    const theme = currentTheme();
    const small = width < 590;
    const margin = { left: small ? 51 : 64, right: small ? 14 : 22, top: 24, bottom: small ? 54 : 59 };
    const plot = {
      left: margin.left,
      right: width - margin.right,
      top: margin.top,
      bottom: height - margin.bottom,
    };
    plot.width = plot.right - plot.left;
    plot.height = plot.bottom - plot.top;

    context.clearRect(0, 0, width, height);
    context.fillStyle = theme.bg;
    context.fillRect(0, 0, width, height);

    const xMin = .1;
    const xMax = 1e6;
    const xLogMin = Math.log10(xMin);
    const xLogMax = Math.log10(xMax);
    const mapX = value => plot.left + (Math.log10(value) - xLogMin) / (xLogMax - xLogMin) * plot.width;

    const yMin = 0;
    const yMax = 26;
    const mapY = value => plot.bottom - (value - yMin) / (yMax - yMin) * plot.height;

    // Plot frame and grid.
    context.lineWidth = 1;
    const xTicks = [.1, 1, 10, 100, 1000, 10000, 100000, 1000000];
    context.font = `${small ? 10 : 11}px Inter, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    xTicks.forEach(tick => {
      const x = mapX(tick);
      context.strokeStyle = theme.grid;
      context.beginPath(); context.moveTo(x, plot.top); context.lineTo(x, plot.bottom); context.stroke();
      context.fillStyle = theme.muted;
      const label = tick >= 1000000 ? '10⁶' : tick >= 1000 ? `${tick / 1000}k` : String(tick);
      context.fillText(label, x, plot.bottom + 9);
    });

    context.textAlign = 'right';
    context.textBaseline = 'middle';
    const yTicks = [0, 5, 10, 15, 20, 25];
    yTicks.forEach(tick => {
      const y = mapY(tick);
      context.strokeStyle = theme.grid;
      context.beginPath(); context.moveTo(plot.left, y); context.lineTo(plot.right, y); context.stroke();
      context.fillStyle = theme.muted;
      const label = tick >= 10000 ? '10k' : tick >= 1000 ? '1k' : String(tick);
      context.fillText(label, plot.left - 9, y);
    });

    context.strokeStyle = theme.plotBorder;
    context.strokeRect(plot.left, plot.top, plot.width, plot.height);

    // Scientific-region overlays sit behind the planet points.
    if (state.activeRegions.has('neptune')) {
      const logPeriods = [];
      for (let i = 0; i <= 60; i += 1) logPeriods.push(-.45 + i / 60 * 1.45); // ~0.35–10 d
      const upper = logPeriods.map(lp => {
        const period = 10 ** lp;
        const value = 10 ** (-.31 * lp + 1.19);
        return [mapX(period), mapY(value)];
      });
      const lower = logPeriods.map(lp => {
        const period = 10 ** lp;
        const value = 10 ** (.68 * lp);
        return [mapX(period), mapY(value)];
      }).reverse();
      context.save();
      context.beginPath(); context.rect(plot.left, plot.top, plot.width, plot.height); context.clip();
      context.beginPath();
      [...upper, ...lower].forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
      context.closePath();
      context.fillStyle = theme.regionNeptune; context.fill();
      context.strokeStyle = theme.regionNeptuneLine; context.lineWidth = 1.2; context.setLineDash([5, 4]); context.stroke();
      context.setLineDash([]);
      context.fillStyle = theme.regionNeptuneLine;
      context.font = `600 ${small ? 9 : 10}px Inter, system-ui, sans-serif`;
      context.textAlign = 'left'; context.textBaseline = 'top';
      context.fillText('Hot Neptune desert', mapX(.45) + 4, Math.max(plot.top + 5, mapY(13)));
      context.restore();
    }

    if (state.activeRegions.has('valley')) {
      const periods = [];
      for (let i = 0; i <= 70; i += 1) periods.push(10 ** (-.15 + i / 70 * 2.25)); // ~0.7–126 d
      const upper = periods.map(period => [mapX(period), mapY(1.9 * (period / 10) ** -.09 + .16)]);
      const lower = periods.slice().reverse().map(period => [mapX(period), mapY(1.9 * (period / 10) ** -.09 - .16)]);
      context.beginPath();
      [...upper, ...lower].forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
      context.closePath();
      context.fillStyle = theme.regionValley; context.fill();
      context.strokeStyle = theme.regionValleyLine; context.lineWidth = 1; context.setLineDash([4, 4]); context.stroke();
      context.setLineDash([]);
      context.fillStyle = theme.regionValleyLine;
      context.font = `600 ${small ? 9 : 10}px Inter, system-ui, sans-serif`;
      context.textAlign = 'left'; context.textBaseline = 'bottom';
      context.fillText('Radius valley', mapX(12), mapY(2.25));
    }

    // The giant-planet overlays intentionally emphasize approximate domains,
    // not hard population cuts: the historical "period valley" is selection-
    // and mass-dependent and the hot-Jupiter pile-up has a soft boundary.
    const drawRegionBox = (x1, x2, y1, y2, fill, stroke, label) => {
      const left = mapX(x1), right = mapX(x2), top = mapY(y2), bottom = mapY(y1);
      context.save();
      context.beginPath(); context.rect(plot.left, plot.top, plot.width, plot.height); context.clip();
      context.fillStyle = fill; context.fillRect(left, top, right - left, bottom - top);
      context.strokeStyle = stroke; context.lineWidth = 1.1; context.setLineDash([5, 4]);
      context.strokeRect(left, top, right - left, bottom - top); context.setLineDash([]);
      context.fillStyle = stroke; context.font = `600 ${small ? 9 : 10}px Inter, system-ui, sans-serif`;
      context.textAlign = 'left'; context.textBaseline = 'top'; context.fillText(label, left + 5, top + 5);
      context.restore();
    };
    if (state.activeRegions.has('giantvalley')) {
      drawRegionBox(10, 100, 8, 18, theme.regionGiant, theme.regionGiantLine, 'Giant-planet period valley');
    }
    if (state.activeRegions.has('hotjupiter')) {
      drawRegionBox(2, 5, 8, 18, theme.regionHotJupiter, theme.regionHotJupiterLine, 'Hot-Jupiter pile-up');
    }

    // Solar System reference points preserve the useful reference from Carl's
    // original script while making them visually distinct from exoplanets.
    const query = state.search;
    const points = [];
    if (state.solarSystem) {
      SOLAR_SYSTEM.forEach(planet => {
        const value = planet.radius;
        if (!isFinitePositive(planet.period) || !isFinitePositive(value)) return;
        const x = mapX(planet.period), y = mapY(value), r = 4;
        context.save();
        context.translate(x, y); context.rotate(Math.PI / 4);
        context.strokeStyle = theme.solar; context.lineWidth = 1.25;
        context.strokeRect(-r, -r, r * 2, r * 2);
        context.restore();
        const matchesSearch = !query || planet.name.toLowerCase().includes(query);
        points.push({ x, y, planet: { ...planet, solar: true }, matchesSearch });
      });
    }

    const milestoneNames = new Set(MILESTONES.filter(item => item.year <= state.year).map(item => item.name));
    state.planets.forEach(planet => {
      if (!Number.isFinite(planet.year) || planet.year > state.year) return;
      if (state.hiddenMethods.has(planet.method)) return;
      const value = planet.plotRadius;
      if (!isFinitePositive(planet.period) || !isFinitePositive(value)) return;
      if (planet.period < xMin || planet.period > xMax || value <= yMin || value > yMax) return;
      const x = mapX(planet.period), y = mapY(value);
      const matchesSearch = !query || planet.name.toLowerCase().includes(query) || (planet.host || '').toLowerCase().includes(query);
      context.globalAlpha = query && !matchesSearch ? .12 : (planet.year === state.year ? .96 : .68);
      const color = METHOD_COLORS[planet.method] || METHOD_COLORS.Other;
      const pointRadius = matchesSearch && query ? 4.2 : 2.65;
      context.beginPath(); context.arc(x, y, pointRadius, 0, Math.PI * 2);
      if (planet.radiusInferred) {
        context.strokeStyle = color; context.lineWidth = 1.15; context.stroke();
      } else {
        context.fillStyle = color; context.fill();
      }
      if (planet.year === state.year) {
        context.globalAlpha = query && !matchesSearch ? .16 : .92;
        context.strokeStyle = theme.newEdge; context.lineWidth = .8;
        context.beginPath(); context.arc(x, y, planet.radiusInferred ? 4.05 : 3.65, 0, Math.PI * 2); context.stroke();
      }
      points.push({ x, y, planet, matchesSearch });
    });
    context.globalAlpha = 1;

    // Milestones sit above the point cloud.
    points.forEach(point => {
      if (!milestoneNames.has(point.planet.name)) return;
      starPath(context, point.x, point.y, 7.2, 3.1);
      context.fillStyle = '#ffe37a'; context.fill();
      context.strokeStyle = '#27364a'; context.lineWidth = .7; context.stroke();
    });

    state.pointCache = points;

    // Axis titles are drawn last for crisp text.
    context.fillStyle = theme.text;
    context.font = `600 ${small ? 11 : 12}px Inter, system-ui, sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'bottom';
    context.fillText('Orbital period (days)', plot.left + plot.width / 2, height - 5);
    context.save();
    context.translate(small ? 13 : 17, plot.top + plot.height / 2); context.rotate(-Math.PI / 2);
    context.fillText('Planet radius / radius-equivalent (R⊕)', 0, 0);
    context.restore();

    if (query && els.searchStatus) {
      const matches = points.filter(point => point.matchesSearch).length;
      els.searchStatus.textContent = `${number.format(matches)} visible match${matches === 1 ? '' : 'es'}`;
    } else if (els.searchStatus) {
      const visible = points.filter(point => !point.planet.solar).length;
      els.searchStatus.textContent = `${number.format(visible)} plotted`;
    }
  }

  function nearestPoint(x, y) {
    let nearest = null;
    let best = 12 * 12;
    state.pointCache.forEach(point => {
      const dx = point.x - x, dy = point.y - y;
      const distance = dx * dx + dy * dy;
      if (distance < best) {
        nearest = point;
        best = distance;
      }
    });
    return nearest;
  }

  function tooltipRows(planet) {
    if (planet.solar) {
      const solarRows = [
        ['Radius', `${formatNumber(planet.radius)} R⊕`],
        ['Mass', `${formatNumber(planet.mass)} M⊕`],
        ['Orbital period', `${formatNumber(planet.period)} d`],
        ['Class', planet.kind],
        ['Reference', 'Solar System'],
      ];
      return solarRows.map(([label, value]) => `<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd>`).join('');
    }
    const period = planet.periodDerived ? `${formatNumber(planet.period)} (derived)` : formatNumber(planet.period);
    const rows = [
      ['Radius', Number.isFinite(planet.radius) ? `${formatNumber(planet.radius)} R⊕` : '—'],
      ['Plot radius', Number.isFinite(planet.plotRadius) ? `${formatNumber(planet.plotRadius)} R⊕${planet.radiusInferred ? ' (CK17 inferred)' : ' (measured)'}` : '—'],
      ['Mass', Number.isFinite(planet.mass) ? `${formatNumber(planet.mass)} M⊕` : '—'],
      ['Period', Number.isFinite(planet.period) ? `${period} d` : '—'],
      ['Equil. temp.', Number.isFinite(planet.teq) ? `${formatNumber(planet.teq)} K` : '—'],
      ['Method', planet.method || '—'],
      ['Facility', planet.facility || planet.locale || '—'],
      ['Telescope', planet.telescope || '—'],
      ['Instrument', planet.instrument || '—'],
      ['Distance', Number.isFinite(planet.distance) ? `${formatNumber(planet.distance)} pc` : '—'],
    ];
    return rows.map(([label, value]) => `<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd>`).join('');
  }

  function showTooltip(point, { pinned = false } = {}) {
    if (!point || !els.tooltip) return hideTooltip();
    state.hoveredPoint = point;
    state.pinnedTooltip = pinned;
    const planet = point.planet;
    const detailURL = planet.solar
      ? `https://science.nasa.gov/${encodeURIComponent(planet.name.toLowerCase())}/`
      : `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(planet.name)}`;
    const detailLabel = planet.solar ? 'NASA Solar System profile ↗' : 'NASA Exoplanet Archive ↗';
    els.tooltip.innerHTML = `
      <div class="exo-tooltip-head"><span class="exo-tooltip-name">${escapeHTML(planet.name)}</span><span class="exo-tooltip-year">${planet.solar ? 'Solar System' : escapeHTML(planet.year)}</span></div>
      <dl class="exo-tooltip-grid">${tooltipRows(planet)}</dl>
      <a class="exo-tooltip-link" href="${detailURL}" target="_blank" rel="noopener">${detailLabel}</a>`;
    els.tooltip.hidden = false;

    const shellWidth = els.chartShell.clientWidth;
    const shellHeight = els.chartShell.clientHeight;
    const tooltipWidth = Math.min(286, shellWidth - 24);
    const tooltipHeight = els.tooltip.offsetHeight || 250;
    let left = point.x + 14;
    if (left + tooltipWidth > shellWidth - 8) left = point.x - tooltipWidth - 14;
    left = Math.max(8, Math.min(shellWidth - tooltipWidth - 8, left));
    let top = point.y - 12;
    if (top + tooltipHeight > shellHeight - 8) top = shellHeight - tooltipHeight - 8;
    top = Math.max(8, top);
    els.tooltip.style.left = `${left}px`;
    els.tooltip.style.top = `${top}px`;
  }

  function hideTooltip(force = false) {
    if (!els.tooltip || (state.pinnedTooltip && !force)) return;
    state.hoveredPoint = null;
    state.pinnedTooltip = false;
    els.tooltip.hidden = true;
  }

  function initialise(payload) {
    state.payload = payload;
    state.planets = payload.planets || [];
    state.startYear = payload.startYear || 1991;
    state.endYear = payload.endYear || new Date().getUTCFullYear();
    state.year = state.startYear;

    state.planets.forEach(planet => {
      if (!planet.method) planet.method = 'Other';
      state.methodTotals.set(planet.method, (state.methodTotals.get(planet.method) || 0) + 1);
    });
    state.methods = [...state.methodTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([method]) => method);

    els.yearRange.min = state.startYear;
    els.yearRange.max = state.endYear;
    els.yearRange.value = state.startYear;
    els.year.textContent = state.startYear;
    if (els.previous) els.previous.disabled = true;
    if (els.next) els.next.disabled = state.startYear >= state.endYear;

    const generated = payload.generatedUTC ? new Date(payload.generatedUTC) : null;
    const dateLabel = generated && !Number.isNaN(generated.getTime())
      ? generated.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      : 'current build';
    if (els.updateLine) {
      els.updateLine.innerHTML = `Data refreshed ${escapeHTML(dateLabel)} · ${number.format(payload.totalConfirmed)} confirmed planets · <a href="${payload.sourceURL}" target="_blank" rel="noopener">NASA Exoplanet Archive ↗</a>`;
    }

    updateRegionAvailability();
    updateCounters();
    updateMilestone();
    draw();
    hideLoading();
  }

  els.previous?.addEventListener('click', () => setYear(state.year - 1, { stop: true }));
  els.next?.addEventListener('click', () => setYear(state.year + 1, { stop: true }));
  els.play?.addEventListener('click', startPlayback);
  els.yearRange?.addEventListener('input', event => setYear(event.target.value, { stop: true }));

  els.search?.addEventListener('input', event => {
    state.search = event.target.value.trim().toLowerCase();
    hideTooltip(true);
    draw();
  });

  els.countButtons.forEach(button => button.addEventListener('click', () => {
    state.countMode = button.dataset.countMode;
    els.countButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updateCounters();
  }));

  els.regionButtons.forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.exoRegion;
    const region = REGIONS[key];
    if (!region) return;
    if (state.activeRegions.has(key)) state.activeRegions.delete(key);
    else state.activeRegions.add(key);
    describeRegion(key);
    updateRegionAvailability();
    draw();
  }));

  els.solarButton?.addEventListener('click', () => {
    state.solarSystem = !state.solarSystem;
    els.solarButton.classList.toggle('active', state.solarSystem);
    els.solarButton.setAttribute('aria-pressed', state.solarSystem ? 'true' : 'false');
    draw();
  });

  els.canvas.addEventListener('pointermove', event => {
    if (state.pinnedTooltip) return;
    const point = nearestPoint(event.offsetX, event.offsetY);
    if (point) showTooltip(point);
    else hideTooltip();
  }, { passive: true });

  els.canvas.addEventListener('pointerleave', () => {
    if (!state.pinnedTooltip) hideTooltip();
  });

  els.canvas.addEventListener('click', event => {
    const point = nearestPoint(event.offsetX, event.offsetY);
    if (point) showTooltip(point, { pinned: true });
    else hideTooltip(true);
  });

  els.canvas.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setYear(state.year - 1, { stop: true }); }
    if (event.key === 'ArrowRight') { event.preventDefault(); setYear(state.year + 1, { stop: true }); }
    if (event.key === ' ') { event.preventDefault(); startPlayback(); }
    if (event.key === 'Escape') hideTooltip(true);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideTooltip(true);
  });

  const resizeObserver = new ResizeObserver(() => {
    window.requestAnimationFrame(draw);
  });
  resizeObserver.observe(els.chartShell);

  new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.attributeName === 'data-theme')) draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  setLoading('Loading the confirmed-planet census …');
  fetch('exoplanets/data/exoplanets.json', { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(initialise)
    .catch(error => {
      console.error('Exoplanet explorer failed to load:', error);
      setLoading('The exoplanet census could not be loaded. Please refresh the page.', true);
    });
})();
