# One Hit Wonders

This directory is the consolidated One Hit Wonders TESS single-transit survey site served from:

<https://carlziegler.space/onehitwonders/>

It replaces the survey's former standalone GitHub Pages deployment. The new version keeps the original survey narrative, figures, animations, team credits, and September 2019 telescope-installation journal while removing the old jQuery/HTML5UP dependency stack and modernizing the layout, accessibility, responsive behavior, and navigation.

The site is deliberately self-contained and requires no build step:

- `index.html` — survey landing page
- `blog.html` — preserved installation field journal
- `assets/onehitwonders.css` — responsive visual system
- `assets/onehitwonders.js` — small reduced-motion-aware reveal behavior
- `images/` — only the original survey media used by these pages

No separate `CNAME` belongs in this directory: GitHub Pages uses the root repository's `CNAME` (`carlziegler.space`) and serves this project as a path within that same site.
