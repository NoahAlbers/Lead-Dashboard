"use client";

// A small static map of where the lead actually is.
//
// No map library and no new dependencies: at a fixed zoom, a lat/lng maps to a
// tile grid with a bit of arithmetic, so we lay out a few OpenStreetMap tiles
// ourselves, slide them so the point lands dead centre, and draw our own
// marker on top. Nothing pans or zooms; clicking the card hands the location
// off to Google Maps in satellite view, which is what anyone actually wants
// once they have seen roughly where the business sits.

import { ExternalLink, MapPin } from "lucide-react";

// Zoom 9 shows the town plus the counties around it, which is usually enough
// for a state line to show up. Drawing the 256px tiles a little smaller widens
// that view further without stepping all the way out to zoom 8, where town
// names start dropping off the map.
const ZOOM = 9;
const TILE_PX = 200;
const COLS = 3;
const ROWS = 3;
const MAP_HEIGHT = 176;

interface LocationMapProps {
  lat: number;
  lng: number;
  address?: string | null;
  label?: string | null;
}

/** Web mercator tile coordinates, fractional so we know where inside the tile
 * the point falls. */
function project(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clampedLat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
    n,
  };
}

export function LocationMap({ lat, lng, address, label }: LocationMapProps) {
  // Bad or missing coordinates should just mean no card, not a broken one.
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const { x, y, n } = project(lat, lng, ZOOM);
  const originX = Math.floor(x) - Math.floor(COLS / 2);
  const originY = Math.floor(y) - Math.floor(ROWS / 2);

  // Where the point sits inside the tile grid, in drawn pixels. The grid is
  // then nudged so that spot lines up with the middle of the card.
  const pointX = (x - originX) * TILE_PX;
  const pointY = (y - originY) * TILE_PX;

  const tiles: Array<{ key: string; url: string; left: number; top: number }> = [];
  for (let row = 0; row < ROWS; row++) {
    const ty = originY + row;
    // Off the top or bottom of the world: no tile exists, leave the gap.
    if (ty < 0 || ty >= n) continue;
    for (let col = 0; col < COLS; col++) {
      const tx = ((originX + col) % n + n) % n;
      tiles.push({
        key: `${tx}-${ty}`,
        url: `https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`,
        left: col * TILE_PX,
        top: row * TILE_PX,
      });
    }
  }

  // Google's documented Maps URL form. zoom 16 lands close enough to see the
  // building and its lot, which is the point of switching to satellite.
  const googleMapsUrl =
    "https://www.google.com/maps/@?api=1&map_action=map" +
    `&center=${encodeURIComponent(`${lat},${lng}`)}&zoom=16&basemap=satellite`;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Google Maps"
        className="group relative block w-full overflow-hidden bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ height: MAP_HEIGHT }}
      >
        <div
          className="absolute [filter:saturate(0.7)_contrast(0.92)_brightness(1.03)] dark:[filter:invert(0.92)_hue-rotate(180deg)_saturate(0.6)_brightness(1.05)]"
          style={{
            left: "50%",
            top: "50%",
            marginLeft: -pointX,
            marginTop: -pointY,
            width: COLS * TILE_PX,
            height: ROWS * TILE_PX,
          }}
        >
          {tiles.map((tile) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              draggable={false}
              width={TILE_PX}
              height={TILE_PX}
              className="absolute select-none"
              style={{ left: tile.left, top: tile.top, width: TILE_PX, height: TILE_PX }}
              // A tile that will not load should read as empty map, not as a
              // broken image icon.
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ))}
        </div>

        {/* Softens the tiles into the card and keeps the marker readable. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-card/25" />

        {/* The marker, sitting exactly where the tiles were centred. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20" />
          <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-primary-foreground shadow" />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-full border bg-card/95 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
            Open in Google Maps
            <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </div>
      </a>

      <div className="px-2.5 py-2 space-y-1">
        {label && <p className="text-xs font-medium leading-snug truncate">{label}</p>}
        {address && (
          <p className="flex items-start gap-1 text-[11px] text-muted-foreground leading-snug">
            <MapPin className="h-3 w-3 shrink-0 mt-px" />
            <span>{address}</span>
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            &copy; OpenStreetMap
          </a>
        </p>
      </div>
    </div>
  );
}
