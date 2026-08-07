# The Growing Exoplanet Census

This directory contains the reproducible data/plot pipeline for the interactive exoplanet timeline at [carlziegler.space](https://carlziegler.space/#exoplanet-explorer).

The explorer is intentionally built with the same no-build-stack approach as the rest of the site. The browser visualization is a native Canvas component (`assets/js/exoplanet-explorer.js`) and the static figures are produced with Python/Matplotlib.

## What the explorer does

- Opens at 1991 with large previous/next-year controls, plus secondary autoplay, slider, and keyboard controls.
- Uses one period-versus-radius-equivalent plot so the transit and RV populations can be viewed together. A measured radius is always preferred; when radius is absent but mass is measured, the point uses the piecewise Chen & Kipping (2017) Forecaster mass–radius relation and is explicitly drawn as inferred/open.
- Shows a hover/tap card for every plotted planet with radius, mass, period, equilibrium temperature, discovery method, facility, telescope, instrument, distance, and a direct NASA Exoplanet Archive link.
- Searches by planet or host name.
- Filters the point cloud by discovery method.
- Shows cumulative discovery-method counts or shares at every year.
- Marks selected milestones including 51 Peg b, HD 209458 b, Kepler-10 b, Proxima Cen b, TRAPPIST-1 e, and TOI-700 d. The star is shown only in the milestone year; later frames return the planet to its ordinary discovery-method symbol.
- Adds optional Solar System reference points with hover/tap radius, mass, period, planet class, and NASA Solar System links.
- Adds optional guides for the hot Neptune desert, radius valley, giant-planet period valley, and hot-Jupiter pile-up, with explanations and literature links in the interface.
- Automatically adopts the dark or light theme selected for the rest of carlziegler.space.

## Data source

The generator queries the [NASA Exoplanet Archive Planetary Systems (PS) table](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html) with the condition

```sql
default_flag = 1
```

This matters because the full PS table contains one row per planet per literature reference. The default flag gives the Archive-selected, self-consistent default parameter set for each confirmed planet. The generated browser JSON therefore contains one row per confirmed planet.

If a default solution has no orbital period but does contain semimajor axis and stellar mass, the generator retains the fallback in Carl's original plotting script and derives an approximate period from Kepler's third law. The browser marks such a period as `derived` in the tooltip.

For the single plotted y-axis, measured `pl_rade` is used wherever the Archive provides it. If that value is absent but `pl_bmasse` is present, the generator evaluates the deterministic center of the broken power law from [Chen & Kipping (2017)](https://doi.org/10.3847/1538-4357/834/1/17). The Terran, Neptunian, and Jovian branches have different slopes and are joined continuously at the fitted population transitions. Forecaster is intrinsically probabilistic: this center-line conversion has real astrophysical scatter and is used only to place an otherwise radius-less planet approximately on the combined demographic plot. It is not recorded or presented as a measured radius.

## Refreshing the data and downloads

From the repository root:

```bash
python3 exoplanets/generate_exoplanet_timeline.py
```

Dependencies are `numpy`, `pandas`, and `matplotlib`. The script refreshes:

```text
exoplanets/data/exoplanets.json
downloads/exoplanet_plots_dark.zip
downloads/exoplanet_plots_light.zip
```

Each ZIP contains one PNG per year from 1991 through the current UTC year plus a short README. Every PNG follows the large single-panel aesthetic of Carl's original `plot.py`, groups methods with the original magenta/dodger-blue/light-green/red/orange palette, distinguishes measured radii (filled) from mass-derived radius-equivalents (open), flags discoveries from that frame year, includes Solar System references, and carries a small lower-right credit below the horizontal axis. The same footer states that the open circles use the Chen & Kipping (2017) radius-equivalent conversion and are approximate rather than measured radii.

`© Carl Ziegler · carlziegler.space`

To refresh only the browser data without rebuilding the PNG archives:

```bash
python3 exoplanets/generate_exoplanet_timeline.py --skip-static
```

For an offline/reproducible build, pass a previously downloaded PS CSV containing the columns listed in `PS_COLUMNS`:

```bash
python3 exoplanets/generate_exoplanet_timeline.py --csv path/to/ps.csv
```

## Population-feature overlays

The overlays are visual guides, not universal classification boundaries.

### Hot Neptune desert

The classic guide follows the log-linear boundaries from [Mazeh, Holczer & Faigler (2016)](https://arxiv.org/abs/1602.07843). The interface also points to [Owen & Lai (2018)](https://arxiv.org/abs/1807.00012) for a physical picture combining atmospheric loss at the lower-mass edge with high-eccentricity migration/tidal effects at the giant-planet edge. The exact desert boundary has evolved as the observed sample has grown.

### Radius valley

The guide follows the negative period dependence measured by [Van Eylen et al. (2018)](https://arxiv.org/abs/1710.05398), `R ∝ P^-0.09`, centered near the familiar ~2 Earth-radius deficit. The displayed band width/normalization is deliberately approximate; the interface describes atmospheric loss as a leading explanation and notes that formation history and host-star properties also matter.

### Giant-planet period valley and hot-Jupiter pile-up

The explorer shades a deliberately broad 10–100 day region at giant-planet radii to point out the classic period valley discussed by [Udry et al. (2003)](https://www.aanda.org/articles/aa/pdf/2003/31/aa3256.pdf), between the few-day hot-Jupiter concentration and longer-period giants. The interface treats migration history as an interpretation rather than a settled one-to-one cause and links the later [Santerne et al. (2016)](https://www.aanda.org/articles/aa/full_html/2016/03/aa27329-15/aa27329-15.html) Kepler giant-planet demographics as additional context. A separate 2–5 day guide makes the hot-Jupiter pile-up visually explicit. Both are population guides, not classification boundaries.

## Website files

```text
index.html                              # section markup and download buttons
assets/css/exoplanet-explorer.css      # responsive dark/light component styles
assets/js/exoplanet-explorer.js        # Canvas plot and all interaction
exoplanets/data/exoplanets.json        # generated browser dataset
exoplanets/generate_exoplanet_timeline.py
downloads/exoplanet_plots_dark.zip
downloads/exoplanet_plots_light.zip
```

No third-party JavaScript or remote plotting library is loaded by the visitor.
