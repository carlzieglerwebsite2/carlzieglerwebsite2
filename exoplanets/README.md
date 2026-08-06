# The Growing Exoplanet Census

This directory contains the reproducible data/plot pipeline for the interactive exoplanet timeline at [carlziegler.space](https://carlziegler.space/#exoplanet-explorer).

The explorer is intentionally built with the same no-build-stack approach as the rest of the site. The browser visualization is a native Canvas component (`assets/js/exoplanet-explorer.js`) and the static figures are produced with Python/Matplotlib.

## What the explorer does

- Steps from 1991 through the current year, with autoplay and keyboard controls.
- Switches between radius–period and mass–period space instead of mixing unlike quantities on one axis.
- Shows a hover/tap card for every plotted planet with radius, mass, period, equilibrium temperature, discovery method, facility, telescope, instrument, distance, and a direct NASA Exoplanet Archive link.
- Searches by planet or host name.
- Filters the point cloud by discovery method.
- Shows cumulative discovery-method counts or shares at every year.
- Marks selected milestones including 51 Peg b, HD 209458 b, Kepler-10 b, Proxima Cen b, TRAPPIST-1 e, and TOI-700 d.
- Adds optional Solar System reference points.
- Adds optional empirical guides for the hot Neptune desert and radius valley, with short explanations and literature links in the interface.
- Automatically adopts the dark or light theme selected for the rest of carlziegler.space.

## Data source

The generator queries the [NASA Exoplanet Archive Planetary Systems (PS) table](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html) with the condition

```sql
default_flag = 1
```

This matters because the full PS table contains one row per planet per literature reference. The default flag gives the Archive-selected, self-consistent default parameter set for each confirmed planet. The generated browser JSON therefore contains one row per confirmed planet.

If a default solution has no orbital period but does contain semimajor axis and stellar mass, the generator retains the fallback in Carl's original plotting script and derives an approximate period from Kepler's third law. The browser marks such a period as `derived` in the tooltip.

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

Each ZIP contains one PNG per year from 1991 through the current UTC year plus a short README. Every PNG has a radius–period panel and a mass–period panel, flags discoveries from that frame year with a contrasting edge, marks selected milestones, includes Solar System references, and carries a small lower-left credit:

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
