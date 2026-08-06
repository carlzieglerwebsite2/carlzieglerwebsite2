#!/usr/bin/env python3
"""Build the exoplanet timeline data and downloadable yearly plot archives.

The source is the NASA Exoplanet Archive Planetary Systems (PS) table.  Only
the Archive-designated default parameter set is used (default_flag = 1), which
gives one self-consistent row per confirmed planet.

Running this file refreshes three website deliverables:

  exoplanets/data/exoplanets.json
  downloads/exoplanet_plots_dark.zip
  downloads/exoplanet_plots_light.zip

The two ZIP files contain one period-versus-radius-equivalent PNG for every
year from START_YEAR through the current UTC year.  Measured radii are used
where available; otherwise a measured mass is mapped to an approximate radius
with the Chen & Kipping (2017) piecewise mass-radius relation.  A small Carl
Ziegler / carlziegler.space credit is included in the lower-left corner.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import tempfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


START_YEAR = 1991
NASA_TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
ARCHIVE_OVERVIEW = "https://exoplanetarchive.ipac.caltech.edu/overview/"

# Restrict the query to the fields used by either the explorer or the figures.
# default_flag = 1 is important: the PS table otherwise has one row per
# planet/reference, not one row per planet.
PS_COLUMNS = [
    "pl_name",
    "hostname",
    "disc_year",
    "discoverymethod",
    "disc_locale",
    "disc_facility",
    "disc_telescope",
    "disc_instrument",
    "pl_orbper",
    "pl_rade",
    "pl_bmasse",
    "pl_eqt",
    "pl_orbsmax",
    "st_mass",
    "sy_dist",
    "pl_pubdate",
    "rowupdate",
    "default_flag",
]

# A shared discovery-method palette is used by the static figures and mirrored
# in assets/js/exoplanet-explorer.js.  Colors are chosen to remain distinct on
# both the dark and light themes.
METHOD_COLORS = {
    "Transit": "#4fd6a2",
    "Radial Velocity": "#4aa8ff",
    "Microlensing": "#f2b84b",
    "Imaging": "#ff7185",
    "Transit Timing Variations": "#a986ff",
    "Eclipse Timing Variations": "#ef8de1",
    "Orbital Brightness Modulation": "#5cd6df",
    "Pulsar Timing": "#d46bff",
    "Astrometry": "#ff9559",
    "Pulsation Timing Variations": "#c9d55b",
    "Disk Kinematics": "#9ba8b8",
}
OTHER_COLOR = "#8e9cab"

# The static downloadable figures intentionally retain the visual language of
# Carl's attached plot.py rather than the website UI palette.
STATIC_GROUP_COLORS = {
    "Pulsar Timing": "magenta",
    "Radial Velocity": "dodgerblue",
    "Transit": "lightgreen",
    "Imaging": "red",
    "Microlensing": "#ff9900",
    "Other": "lightslategray",
}


def static_method_group(method: object) -> str:
    name = str(method or "").strip()
    if name in {"Pulsar Timing", "Pulsation Timing Variations"}:
        return "Pulsar Timing"
    if name in {"Radial Velocity", "Astrometry", "Disk Kinematics"}:
        return "Radial Velocity"
    if name in {"Transit", "Transit Timing Variations", "Eclipse Timing Variations", "Orbital Brightness Modulation"}:
        return "Transit"
    if name == "Imaging":
        return "Imaging"
    if name == "Microlensing":
        return "Microlensing"
    return "Other"


def static_method_color(method: object) -> str:
    return STATIC_GROUP_COLORS[static_method_group(method)]

# Chen & Kipping (2017), ApJ 834, 17 ("Forecaster").  Their deterministic
# broken-power-law mean is used only as a display fallback for planets that
# have a mass but no radius in the Archive default solution.  The relation is
# intrinsically probabilistic, so these values are *radius-equivalents*, not
# measurements.  We use the planetary Terran/Neptunian/Jovian regimes; the
# stellar regime is irrelevant to the confirmed-planet plot.
# https://doi.org/10.3847/1538-4357/834/1/17
CK_LOG_C0 = 0.00346
CK_SLOPES = (0.2790, 0.589, -0.044)
CK_LOG_MASS_BREAKS = (0.309, 2.119)  # ~2.04 and ~131.6 M_earth


def chen_kipping_radius(mass_earth: float | np.ndarray) -> float | np.ndarray:
    """Return the CK17 median/mean-relation radius in Earth radii.

    The published model is linear in log10(M)–log10(R) with continuity at the
    fitted population transitions.  This deterministic center line is useful
    for visualization but intentionally does not represent the intrinsic
    scatter of the probabilistic Forecaster model.
    """
    masses = np.asarray(mass_earth, dtype=float)
    log_m = np.log10(masses)
    c1 = CK_LOG_C0
    c2 = c1 + CK_LOG_MASS_BREAKS[0] * (CK_SLOPES[0] - CK_SLOPES[1])
    c3 = c2 + CK_LOG_MASS_BREAKS[1] * (CK_SLOPES[1] - CK_SLOPES[2])
    log_r = np.select(
        [log_m < CK_LOG_MASS_BREAKS[0], log_m < CK_LOG_MASS_BREAKS[1]],
        [c1 + CK_SLOPES[0] * log_m, c2 + CK_SLOPES[1] * log_m],
        default=c3 + CK_SLOPES[2] * log_m,
    )
    radius = np.power(10.0, log_r)
    return float(radius) if np.ndim(mass_earth) == 0 else radius

SOLAR_SYSTEM = [
    ("Mercury", 87.97, 0.383, 0.0553),
    ("Venus", 224.70, 0.949, 0.815),
    ("Earth", 365.26, 1.000, 1.000),
    ("Mars", 686.98, 0.532, 0.107),
    ("Jupiter", 4332.59, 11.21, 317.83),
    ("Saturn", 10759.2, 9.45, 95.16),
    ("Uranus", 30688.5, 4.01, 14.54),
    ("Neptune", 60182.0, 3.88, 17.15),
]

# These callouts are intentionally selective.  The year is the event year used
# for the explorer, which can differ from a later publication date.
MILESTONES = {
    "PSR B1257+12 c": (1992, "First confirmed exoplanetary system"),
    "51 Peg b": (1995, "First planet around a Sun-like star"),
    "HD 209458 b": (1999, "First exoplanet observed to transit"),
    "HR 8799 b": (2008, "Landmark directly imaged multiplanet system"),
    "Kepler-10 b": (2011, "First rocky planet confirmed by Kepler"),
    "Proxima Cen b": (2016, "Planet around the nearest star to the Sun"),
    "TRAPPIST-1 e": (2017, "Seven Earth-size worlds revealed at TRAPPIST-1"),
    "TOI-700 d": (2020, "First Earth-size habitable-zone planet from TESS"),
}

THEMES = {
    "dark": {
        "background": "#000000",
        "panel": "#000000",
        "grid": "#555555",
        "text": "#ffffff",
        "muted": "#aaaaaa",
        "solar": "#ffffff",
        "new_edge": "#ffffff",
    },
    "light": {
        "background": "#ffffff",
        "panel": "#ffffff",
        "grid": "#777777",
        "text": "#000000",
        "muted": "#555555",
        "solar": "#000000",
        "new_edge": "#000000",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=START_YEAR)
    parser.add_argument(
        "--end-year",
        type=int,
        default=datetime.now(timezone.utc).year,
        help="last discovery year to render (default: current UTC year)",
    )
    parser.add_argument("--dpi", type=int, default=150)
    parser.add_argument(
        "--site-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="root of the carlziegler.space checkout",
    )
    parser.add_argument(
        "--csv",
        type=Path,
        help="optional local PS CSV for offline/reproducible regeneration",
    )
    parser.add_argument(
        "--skip-static",
        action="store_true",
        help="refresh browser JSON but do not render/replace the PNG archives",
    )
    return parser.parse_args()


def tap_url() -> str:
    query = f"select {','.join(PS_COLUMNS)} from ps where default_flag=1"
    return f"{NASA_TAP}?query={quote_plus(query)}&format=csv"


def fetch_archive(retries: int = 3) -> pd.DataFrame:
    """Download one default row per confirmed planet from the Archive."""
    url = tap_url()
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = Request(
                url,
                headers={"User-Agent": "carlziegler.space exoplanet timeline/1.0"},
            )
            with urlopen(request, timeout=120) as response:
                return pd.read_csv(io.BytesIO(response.read()))
        except Exception as error:  # network retry path
            last_error = error
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"NASA Exoplanet Archive download failed: {last_error}")


def clean_text(value: object) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text if text else None


def finite_or_none(value: object, digits: int = 6) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return round(number, digits)


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    missing = set(PS_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"Input is missing PS columns: {sorted(missing)}")

    data = df.copy()
    numeric = [
        "disc_year",
        "pl_orbper",
        "pl_rade",
        "pl_bmasse",
        "pl_eqt",
        "pl_orbsmax",
        "st_mass",
        "sy_dist",
        "default_flag",
    ]
    for column in numeric:
        data[column] = pd.to_numeric(data[column], errors="coerce")

    # The WHERE clause should already guarantee this.  Keep the check so a
    # locally supplied CSV cannot silently duplicate planets.
    data = data[data["default_flag"] == 1].copy()
    if data["pl_name"].duplicated().any():
        duplicates = data.loc[data["pl_name"].duplicated(), "pl_name"].tolist()
        raise ValueError(f"Default PS input contains duplicate planets: {duplicates[:5]}")

    data["disc_year_filled"] = data["disc_year"]
    pubdate = pd.to_datetime(data["pl_pubdate"], errors="coerce")
    rowupdate = pd.to_datetime(data["rowupdate"], errors="coerce")
    data.loc[data["disc_year_filled"].isna(), "disc_year_filled"] = pubdate.dt.year
    data.loc[data["disc_year_filled"].isna(), "disc_year_filled"] = rowupdate.dt.year

    # Preserve the attached script's physically motivated fallback: if a
    # period is absent but semimajor axis and stellar mass are available,
    # infer P from Kepler's third law and mark it as derived for the tooltip.
    data["period_best"] = data["pl_orbper"]
    data["period_derived"] = False
    missing_period = (
        data["period_best"].isna()
        & data["pl_orbsmax"].gt(0)
        & data["st_mass"].gt(0)
    )
    data.loc[missing_period, "period_best"] = (
        np.sqrt(data.loc[missing_period, "pl_orbsmax"] ** 3 / data.loc[missing_period, "st_mass"])
        * 365.25
    )
    data.loc[missing_period, "period_derived"] = True

    # Put the population onto one display axis.  A measured radius always wins.
    # Only radius-missing planets with a positive measured mass get a CK17
    # radius-equivalent; no radius is ever inferred from another inferred value.
    data["radius_equiv"] = data["pl_rade"]
    data["radius_inferred"] = False
    infer_radius = data["radius_equiv"].isna() & data["pl_bmasse"].gt(0)
    data.loc[infer_radius, "radius_equiv"] = chen_kipping_radius(data.loc[infer_radius, "pl_bmasse"].to_numpy())
    data.loc[infer_radius, "radius_inferred"] = True

    # Do not clamp discovery years to --end-year.  That option controls which
    # static frames are rendered; it should never rewrite the source timeline.
    # Ignore only genuinely future discovery years beyond the present UTC year.
    current_year = datetime.now(timezone.utc).year
    future_year = data["disc_year_filled"].gt(current_year)
    data.loc[future_year, "disc_year_filled"] = np.nan

    return data.sort_values(["disc_year_filled", "pl_name"], na_position="last").reset_index(drop=True)


def write_browser_json(data: pd.DataFrame, path: Path, end_year: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    planets: list[dict[str, object]] = []
    for row in data.itertuples(index=False):
        year = finite_or_none(row.disc_year_filled, 0)
        planets.append(
            {
                "name": clean_text(row.pl_name),
                "host": clean_text(row.hostname),
                "year": int(year) if year is not None else None,
                "method": clean_text(row.discoverymethod) or "Other",
                "period": finite_or_none(row.period_best),
                "periodDerived": bool(row.period_derived),
                "radius": finite_or_none(row.pl_rade),
                "plotRadius": finite_or_none(row.radius_equiv),
                "radiusInferred": bool(row.radius_inferred),
                "mass": finite_or_none(row.pl_bmasse),
                "teq": finite_or_none(row.pl_eqt, 1),
                "distance": finite_or_none(row.sy_dist, 3),
                "locale": clean_text(row.disc_locale),
                "facility": clean_text(row.disc_facility),
                "telescope": clean_text(row.disc_telescope),
                "instrument": clean_text(row.disc_instrument),
            }
        )

    now = datetime.now(timezone.utc)
    payload = {
        "generatedUTC": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": "NASA Exoplanet Archive Planetary Systems (PS), default_flag=1",
        "sourceURL": "https://exoplanetarchive.ipac.caltech.edu/",
        "queryDocumentation": "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html",
        "startYear": START_YEAR,
        "endYear": end_year,
        "totalConfirmed": len(planets),
        "radiusModel": {
            "name": "Chen & Kipping (2017) Forecaster broken power law",
            "doi": "https://doi.org/10.3847/1538-4357/834/1/17",
            "usage": "Measured radius where available; mass-derived radius-equivalent only when radius is absent",
        },
        "planets": planets,
    }
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def method_color(method: object) -> str:
    return METHOD_COLORS.get(str(method), OTHER_COLOR)


def style_axis(ax: plt.Axes, theme: dict[str, str]) -> None:
    ax.set_facecolor(theme["panel"])
    ax.tick_params(colors=theme["muted"], labelsize=10)
    for spine in ax.spines.values():
        spine.set_color(theme["grid"])
    ax.grid(False)


def plot_solar_system(ax: plt.Axes, theme: dict[str, str]) -> None:
    x = [planet[1] for planet in SOLAR_SYSTEM]
    y = [planet[2] for planet in SOLAR_SYSTEM]
    ax.scatter(
        x,
        y,
        s=24,
        marker="D",
        facecolors="none",
        edgecolors=theme["solar"],
        linewidths=1.0,
        alpha=0.9,
        zorder=4,
        label="Solar System",
    )


def plot_population(
    ax: plt.Axes,
    data: pd.DataFrame,
    year: int,
    theme: dict[str, str],
) -> None:
    column = "radius_equiv"
    valid = data["period_best"].gt(0) & data[column].gt(0)
    subset = data.loc[valid].copy()
    old = subset[subset["disc_year_filled"] < year]
    new = subset[subset["disc_year_filled"] == year]

    # Draw in method groups so identical colors are batched efficiently.
    for method, group in old.groupby("discoverymethod", dropna=False):
        measured = group[~group["radius_inferred"]]
        inferred = group[group["radius_inferred"]]
        if not measured.empty:
            ax.scatter(
                measured["period_best"], measured[column], s=20,
                color=static_method_color(method), alpha=1, linewidths=0,
                rasterized=True, zorder=2,
            )
        if not inferred.empty:
            ax.scatter(
                inferred["period_best"], inferred[column], s=20,
                facecolors="none", edgecolors=static_method_color(method), alpha=1,
                linewidths=0.8, rasterized=True, zorder=2,
            )
    for method, group in new.groupby("discoverymethod", dropna=False):
        measured = group[~group["radius_inferred"]]
        inferred = group[group["radius_inferred"]]
        if not measured.empty:
            ax.scatter(measured["period_best"], measured[column], s=32,
                       color=static_method_color(method), alpha=1, edgecolors=theme["new_edge"],
                       linewidths=0.65, rasterized=True, zorder=3)
        if not inferred.empty:
            ax.scatter(inferred["period_best"], inferred[column], s=32,
                       facecolors="none", edgecolors=static_method_color(method), alpha=1,
                       linewidths=1.15, rasterized=True, zorder=3)


def annotate_milestones(ax: plt.Axes, data: pd.DataFrame, year: int, theme: dict[str, str]) -> None:
    column = "radius_equiv"
    for name, (event_year, label) in MILESTONES.items():
        if event_year > year:
            continue
        row = data[data["pl_name"] == name]
        if row.empty:
            continue
        x = row.iloc[0]["period_best"]
        y = row.iloc[0][column]
        if not (np.isfinite(x) and np.isfinite(y) and x > 0 and y > 0):
            continue
        ax.scatter([x], [y], marker="*", s=95, color="#ffe37a", edgecolor="#152131", linewidth=0.7, zorder=6)
        # Label only when the planet first appears and on the final frame.  This
        # keeps intermediate yearly plots readable while preserving the story.
        if year in (event_year, datetime.now(timezone.utc).year):
            ax.annotate(
                name,
                xy=(x, y),
                xytext=(7, 7),
                textcoords="offset points",
                fontsize=7.5,
                color=theme["text"],
                bbox={"boxstyle": "round,pad=0.22", "fc": theme["panel"], "ec": theme["grid"], "alpha": 0.9},
                zorder=7,
            )


def render_year(data: pd.DataFrame, year: int, theme_name: str, output: Path, dpi: int) -> None:
    theme = THEMES[theme_name]
    through_year = data[data["disc_year_filled"].le(year)].copy()
    count = len(through_year)
    new_count = int(data["disc_year_filled"].eq(year).sum())

    with plt.rc_context({
        "font.family": "DejaVu Sans",
        "axes.labelcolor": theme["text"],
        "axes.titlecolor": theme["text"],
        "text.color": theme["text"],
        "figure.facecolor": theme["background"],
        "savefig.facecolor": theme["background"],
    }):
        # Deliberately return to the large, sparse aesthetic of Carl's original
        # plot.py: one canvas, log period, linear radius, in-plot method labels.
        fig, ax = plt.subplots(figsize=(20, 14))
        fig.subplots_adjust(left=0.10, right=0.955, top=0.955, bottom=0.105)
        style_axis(ax, theme)
        plot_population(ax, through_year, year, theme)
        plot_solar_system(ax, theme)
        annotate_milestones(ax, through_year, year, theme)
        ax.set_xscale("log")
        ax.set_xlim(0.3, 100_000)
        ax.set_ylim(0, 26)
        ax.set_xlabel("Orbital Period (days)", fontsize=28, labelpad=12)
        ax.set_ylabel(r"Planetary Radius / Radius-equivalent (R$_\oplus$)", fontsize=28, labelpad=12)
        ax.tick_params(labelsize=22)

        label_x = 2000
        labels = [
            (8.0, "Solar System", theme["solar"]),
            (7.0, "Pulsar Timing", STATIC_GROUP_COLORS["Pulsar Timing"]),
            (6.0, "Radial Velocity", STATIC_GROUP_COLORS["Radial Velocity"]),
            (5.0, "Transit", STATIC_GROUP_COLORS["Transit"]),
            (4.0, "Direct Imaging", STATIC_GROUP_COLORS["Imaging"]),
            (3.0, "Microlensing", STATIC_GROUP_COLORS["Microlensing"]),
        ]
        for y, label, color in labels:
            ax.text(label_x, y, label, fontsize=25, color=color)
        ax.text(19_000, 1.05, str(year), fontsize=34, color=theme["text"], fontweight="bold")
        ax.text(0.985, 0.985, f"{count:,} confirmed · +{new_count:,} in {year}", transform=ax.transAxes,
                ha="right", va="top", fontsize=14, color=theme["muted"])
        ax.text(0.012, 0.018, "© Carl Ziegler · carlziegler.space", transform=ax.transAxes,
                fontsize=10, color=theme["muted"], ha="left", va="bottom")
        ax.text(0.012, 0.045,
                "Filled = measured radius · open = CK17 radius-equivalent inferred from measured mass",
                transform=ax.transAxes, fontsize=9.3, color=theme["muted"], ha="left", va="bottom")
        fig.savefig(output, dpi=dpi, bbox_inches="tight", pad_inches=0.15)
        plt.close(fig)


def archive_plots(data: pd.DataFrame, site_root: Path, start_year: int, end_year: int, dpi: int) -> None:
    downloads = site_root / "downloads"
    downloads.mkdir(parents=True, exist_ok=True)

    # Work outside the repository tree so GitHub only needs the compact ZIPs.
    with tempfile.TemporaryDirectory(prefix="cz-exoplanet-plots-") as temp_name:
        temp = Path(temp_name)
        for theme_name in ("dark", "light"):
            plot_dir = temp / theme_name
            plot_dir.mkdir()
            for year in range(start_year, end_year + 1):
                print(f"render {theme_name:5s} {year}")
                render_year(
                    data,
                    year,
                    theme_name,
                    plot_dir / f"{year}_exoplanets_{theme_name}.png",
                    dpi,
                )

            readme = plot_dir / "README.txt"
            readme.write_text(
                "Carl Ziegler — The Growing Exoplanet Census\n"
                f"Static {theme_name} figures, {start_year}–{end_year}\n\n"
                "Data: NASA Exoplanet Archive Planetary Systems table, default_flag=1.\n"
                "Each image contains one period-versus-radius-equivalent plot.\n"
                "Measured radii are filled points. If radius is absent but mass is measured, an open point uses the\n"
                "Chen & Kipping (2017) Forecaster broken-power-law center as an approximate radius-equivalent.\n"
                "That conversion has intrinsic scatter and is for population visualization, not a radius measurement.\n"
                "White-edged filled points were discovered in the frame year; outlined diamonds are Solar System planets.\n\n"
                "Interactive version: https://carlziegler.space/#exoplanet-explorer\n"
                "Plotting code: https://github.com/carlzieglerwebsite2/carlzieglerwebsite2/tree/master/exoplanets\n",
                encoding="utf-8",
            )

            destination = downloads / f"exoplanet_plots_{theme_name}.zip"
            with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
                for source in sorted(plot_dir.iterdir()):
                    archive.write(source, arcname=source.name)
            print(f"wrote {destination} ({destination.stat().st_size / 1_000_000:.1f} MB)")


def main() -> None:
    args = parse_args()
    site_root = args.site_root.resolve()
    if args.end_year < args.start_year:
        raise SystemExit("--end-year must be >= --start-year")

    if args.csv:
        raw = pd.read_csv(args.csv)
        source_description = str(args.csv)
    else:
        print("Downloading current confirmed-planet data from the NASA Exoplanet Archive …")
        raw = fetch_archive()
        source_description = "NASA Exoplanet Archive"

    data = prepare(raw)
    print(f"Loaded {len(data):,} confirmed planets from {source_description}")
    print(f"Discovery years: {int(data.disc_year_filled.min())}–{int(data.disc_year_filled.max())}")
    print("Discovery-method counts:")
    print(data["discoverymethod"].fillna("Other").value_counts().to_string())

    json_path = site_root / "exoplanets" / "data" / "exoplanets.json"
    # --end-year controls the downloadable frame range only.  The live browser
    # explorer should always expose the complete catalog through the current
    # year even when someone builds a historical subset of static figures.
    write_browser_json(data, json_path, datetime.now(timezone.utc).year)
    print(f"wrote {json_path} ({json_path.stat().st_size / 1_000_000:.2f} MB)")

    if not args.skip_static:
        archive_plots(data, site_root, args.start_year, args.end_year, args.dpi)


if __name__ == "__main__":
    main()
