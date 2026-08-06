#!/usr/bin/env python3
"""Build the exoplanet timeline data and downloadable yearly plot archives.

The source is the NASA Exoplanet Archive Planetary Systems (PS) table.  Only
the Archive-designated default parameter set is used (default_flag = 1), which
gives one self-consistent row per confirmed planet.

Running this file refreshes three website deliverables:

  exoplanets/data/exoplanets.json
  downloads/exoplanet_plots_dark.zip
  downloads/exoplanet_plots_light.zip

The two ZIP files contain one two-panel PNG for every year from START_YEAR
through the current UTC year.  A small Carl Ziegler / carlziegler.space credit
is included in the lower-left corner of every downloadable figure.
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
        "background": "#07111f",
        "panel": "#0b1726",
        "grid": "#27425a",
        "text": "#edf7ff",
        "muted": "#9db0c4",
        "solar": "#f3f7fb",
        "new_edge": "#ffffff",
    },
    "light": {
        "background": "#f5f8fb",
        "panel": "#ffffff",
        "grid": "#d7e1ea",
        "text": "#132739",
        "muted": "#5c7286",
        "solar": "#1a2633",
        "new_edge": "#101820",
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
    ax.grid(which="major", color=theme["grid"], alpha=0.58, linewidth=0.7)
    ax.grid(which="minor", color=theme["grid"], alpha=0.16, linewidth=0.45)


def plot_solar_system(ax: plt.Axes, field: str, theme: dict[str, str]) -> None:
    value_index = 2 if field == "radius" else 3
    x = [planet[1] for planet in SOLAR_SYSTEM]
    y = [planet[value_index] for planet in SOLAR_SYSTEM]
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
    field: str,
    year: int,
    theme: dict[str, str],
) -> None:
    column = "pl_rade" if field == "radius" else "pl_bmasse"
    valid = data["period_best"].gt(0) & data[column].gt(0)
    subset = data.loc[valid].copy()
    old = subset[subset["disc_year_filled"] < year]
    new = subset[subset["disc_year_filled"] == year]

    # Draw in method groups so identical colors are batched efficiently.
    for method, group in old.groupby("discoverymethod", dropna=False):
        ax.scatter(
            group["period_best"],
            group[column],
            s=11,
            color=method_color(method),
            alpha=0.72,
            linewidths=0,
            rasterized=True,
            zorder=2,
        )
    for method, group in new.groupby("discoverymethod", dropna=False):
        ax.scatter(
            group["period_best"],
            group[column],
            s=20,
            color=method_color(method),
            alpha=0.98,
            edgecolors=theme["new_edge"],
            linewidths=0.45,
            rasterized=True,
            zorder=3,
        )


def annotate_milestones(ax: plt.Axes, data: pd.DataFrame, field: str, year: int, theme: dict[str, str]) -> None:
    column = "pl_rade" if field == "radius" else "pl_bmasse"
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
        fig, (ax_radius, ax_mass) = plt.subplots(2, 1, figsize=(13.5, 10.2), sharex=True)
        fig.subplots_adjust(left=0.09, right=0.965, top=0.89, bottom=0.10, hspace=0.16)
        fig.suptitle(f"The growing exoplanet census · {year}", fontsize=21, fontweight="bold", y=0.965)
        fig.text(
            0.5,
            0.922,
            f"{count:,} confirmed planets by this year · +{new_count:,} discovered in {year}",
            ha="center",
            color=theme["muted"],
            fontsize=10.5,
        )

        for ax, field in ((ax_radius, "radius"), (ax_mass, "mass")):
            style_axis(ax, theme)
            plot_population(ax, through_year, field, year, theme)
            plot_solar_system(ax, field, theme)
            annotate_milestones(ax, through_year, field, year, theme)
            ax.set_xscale("log")
            # Span ultra-short-period planets through most directly imaged
            # systems (including HR 8799) without letting a handful of
            # extremely wide companions compress the entire plot.
            ax.set_xlim(0.1, 1_000_000)

        ax_radius.set_ylim(0, 26)
        ax_radius.set_ylabel(r"Planet radius (R$_\oplus$)", fontsize=12)
        ax_radius.set_title("Radius–period space", loc="left", fontsize=12, pad=8)

        ax_mass.set_yscale("log")
        ax_mass.set_ylim(0.03, 30000)
        ax_mass.set_ylabel(r"Planet mass (M$_\oplus$)", fontsize=12)
        ax_mass.set_xlabel("Orbital period (days)", fontsize=12)
        ax_mass.set_title("Mass–period space", loc="left", fontsize=12, pad=8)

        fig.text(0.012, 0.018, "© Carl Ziegler · carlziegler.space", fontsize=8.2, color=theme["muted"], ha="left")
        fig.text(
            0.988,
            0.018,
            "Data: NASA Exoplanet Archive · outlined circles = Solar System · white-edged points = new this year",
            fontsize=7.8,
            color=theme["muted"],
            ha="right",
        )
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
                "Each image has a radius–period panel and a mass–period panel.\n"
                "White-edged points were discovered in the frame year; outlined diamonds are Solar System planets.\n\n"
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
