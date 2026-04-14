import { useRef, useState, useEffect, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import type { FeatureCollection, LineString } from 'geojson';
import { Box, Typography } from '@mui/material';
import FactoryIcon from '@mui/icons-material/Factory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PlaceIcon from '@mui/icons-material/Place';
import {
  computeSegmentDistances,
  interpolateAlongRoute,
} from '../simulation/routeGeometry';

import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '') as string;

/* ── Demo data ─────────────────────────────────────────────────────── */

const PLANT = { lat: 30.267, lng: -97.743, name: 'Austin Branch Plant' };

const JOB_SITES = [
  { id: 'TKT-001', name: 'Round Rock Commercial', lat: 30.508, lng: -97.678, color: '#1565C0' },
  { id: 'TKT-002', name: 'Pflugerville Residential', lat: 30.445, lng: -97.62, color: '#283593' },
  { id: 'TKT-003', name: 'Bee Cave Foundation', lat: 30.308, lng: -97.94, color: '#D84315' },
  { id: 'TKT-004', name: 'Manor Slab Pour', lat: 30.35, lng: -97.55, color: '#2E7D32' },
];

// Rough road-following polylines from plant to each job site
const ROUTES: [number, number][][] = [
  // Plant → Round Rock (north on I-35)
  [[-97.743, 30.267], [-97.740, 30.310], [-97.725, 30.370], [-97.710, 30.430], [-97.695, 30.475], [-97.678, 30.508]],
  // Plant → Pflugerville (northeast on 290/130)
  [[-97.743, 30.267], [-97.720, 30.295], [-97.690, 30.335], [-97.660, 30.380], [-97.635, 30.415], [-97.62, 30.445]],
  // Plant → Bee Cave (west on 71/Hamilton Pool Rd)
  [[-97.743, 30.267], [-97.780, 30.270], [-97.820, 30.278], [-97.860, 30.290], [-97.900, 30.300], [-97.94, 30.308]],
  // Plant → Manor (east on 290)
  [[-97.743, 30.267], [-97.710, 30.275], [-97.670, 30.290], [-97.630, 30.310], [-97.585, 30.330], [-97.55, 30.35]],
];

// Pre-compute segment distances for each route
const ROUTE_SEGMENTS = ROUTES.map((coords) => ({
  coords,
  ...computeSegmentDistances(coords),
}));

const CYCLE_MS = 10_000; // 10 second round-trip cycle
const TRUCK_COLORS = ['#1565C0', '#283593', '#D84315', '#00695C'];

/* ── Route GeoJSON ─────────────────────────────────────────────────── */

const routeGeoJSON: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: ROUTES.map((coords, i) => ({
    type: 'Feature' as const,
    properties: { id: JOB_SITES[i].id },
    geometry: { type: 'LineString' as const, coordinates: coords },
  })),
};

const routeLayerStyle = {
  id: 'demo-routes',
  type: 'line' as const,
  paint: {
    'line-color': '#1565C0',
    'line-width': 3,
    'line-opacity': 0.5,
  },
};

const routeGlowStyle = {
  id: 'demo-routes-glow',
  type: 'line' as const,
  paint: {
    'line-color': '#1565C0',
    'line-width': 8,
    'line-opacity': 0.12,
  },
};

/* ── Component ─────────────────────────────────────────────────────── */

interface TruckPos {
  lng: number;
  lat: number;
  outbound: boolean;
}

export default function DemoMap() {
  const [trucks, setTrucks] = useState<TruckPos[]>(() =>
    JOB_SITES.map(() => ({ lng: PLANT.lng, lat: PLANT.lat, outbound: true })),
  );
  const rafRef = useRef(0);

  const animate = useCallback(() => {
    const now = Date.now();
    const next = JOB_SITES.map((_, i) => {
      const offset = i * (CYCLE_MS / JOB_SITES.length); // stagger
      const t = ((now + offset) % CYCLE_MS) / CYCLE_MS;
      const seg = ROUTE_SEGMENTS[i];

      // 0→0.45 outbound, 0.45→0.55 pause at site, 0.55→1.0 return
      let pos: { lng: number; lat: number };
      let outbound: boolean;

      if (t < 0.45) {
        const fraction = t / 0.45;
        pos = interpolateAlongRoute(seg.coords, seg.cumulative, seg.total, fraction);
        outbound = true;
      } else if (t < 0.55) {
        // Paused at job site
        const last = seg.coords[seg.coords.length - 1];
        pos = { lng: last[0], lat: last[1] };
        outbound = false;
      } else {
        const fraction = (t - 0.55) / 0.45;
        pos = interpolateAlongRoute(seg.coords, seg.cumulative, seg.total, 1 - fraction);
        outbound = false;
      }

      return { ...pos, outbound };
    });
    setTrucks(next);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  if (!MAPBOX_TOKEN) return null;

  return (
    <Map
      initialViewState={{ longitude: -97.72, latitude: 30.38, zoom: 10.2 }}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ width: '100%', height: '100%' }}
      interactive={false}
      attributionControl={false}
    >
      {/* Route lines */}
      <Source id="demo-routes" type="geojson" data={routeGeoJSON}>
        <Layer {...routeGlowStyle} />
        <Layer {...routeLayerStyle} />
      </Source>

      {/* Plant marker */}
      <Marker longitude={PLANT.lng} latitude={PLANT.lat} anchor="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            bgcolor: '#37474F',
            border: '3px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(255,109,0,0.4)',
          }}
        >
          <FactoryIcon sx={{ color: 'white', fontSize: 22 }} />
        </Box>
      </Marker>

      {/* Job site markers */}
      {JOB_SITES.map((site) => (
        <Marker key={site.id} longitude={site.lng} latitude={site.lat} anchor="bottom">
          <Box sx={{ textAlign: 'center' }}>
            <PlaceIcon sx={{ fontSize: 32, color: site.color, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                bgcolor: site.color,
                color: 'white',
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: '0.65rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                mt: -0.5,
              }}
            >
              {site.id}
            </Typography>
          </Box>
        </Marker>
      ))}

      {/* Animated truck markers */}
      {trucks.map((truck, i) => (
        <Marker key={i} longitude={truck.lng} latitude={truck.lat} anchor="center">
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: TRUCK_COLORS[i],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              boxShadow: '0 0 12px rgba(255,255,255,0.3)',
              animation: 'truckPulse 2s infinite',
              '@keyframes truckPulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.2)' },
              },
            }}
          >
            <LocalShippingIcon sx={{ color: 'white', fontSize: 14 }} />
          </Box>
        </Marker>
      ))}
    </Map>
  );
}
