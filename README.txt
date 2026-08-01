# Carl Ziegler — Academic and Research Website

A static, single-page academic website for Carl A. Ziegler, Ph.D., exoplanet astronomer, Associate Professor of Astronomy, and Director of the SFA Observatory at Stephen F. Austin State University.

Live site: https://carlziegler.space/

## What is included

- Research, publications, teaching, outreach, observatory work, and scientific software
- Interactive transit-dilution model with physically calculated flux dilution and radius correction
- Planet visualization that transitions from rocky to Neptune-like to Jupiter-like as radius changes
- Main-sequence companion approximation that changes stellar size, color, mass label, and flux contribution with contrast
- Rotating speckle-imaging targets that keep the seeing-limited blur, Fourier peaks, reconstructed companion, and measured properties physically synchronized
- Four-case exoplanet candidate-screening challenge combining transit morphology, centroid motion, speckle imaging, color information, and Gaia diagnostics
- Interactive binary-suppression population model with a logarithmic separation explorer and a 100-system cohort experiment
- Resettable Gravitas black-hole merger demonstration with continuously accelerated inspiral motion
- Responsive navigation, dark/light appearance modes, reduced-motion support, and accessible controls
- Full and condensed CVs, dissertation, research figures, observatory photographs, and the astronaut crew

## Deploying on GitHub Pages

This site has no build step and no external JavaScript dependencies.

1. Copy every file and folder in this directory to the root of the GitHub Pages repository.
2. Keep `index.html`, `CNAME`, `assets/`, `images/`, and the PDF files at the repository root.
3. Commit and push to the branch configured for GitHub Pages.
4. The included `CNAME` keeps the custom domain set to `carlziegler.space`.

## Main files

```text
.
├── index.html                 # Complete page, styles, and interactive JavaScript
├── CNAME                     # GitHub Pages custom domain
├── CV_condensed.pdf
├── carlziegler_CV.pdf
├── carlziegler_thesis_small.pdf
├── assets/css/parallax-stars.css
└── images/                    # Headshots, research figures, outreach, and crew images
```

## Scientific assumptions in the transit model

The model assumes a Sun-like primary with radius 1 R☉ = 109.1 R⊕. For a companion contrast Δmag, the exact flux ratio used in the dilution calculation is

`f = 10^(-0.4 Δmag)`.

The observed depth and primary-host radius correction are

`δ_obs = δ_true / (1 + f)` and `R_true / R_observed = sqrt(1 + f)`.

Companion mass, radius, spectral class, and color are illustrative main-sequence proxies based on the luminosity relation L ∝ M⁴. Planet display size is perceptually scaled so small rocky planets remain visible; the numerical transit depth uses the physical radius ratio.

## Local preview

Open `index.html` directly, or run any static server from this directory, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.
