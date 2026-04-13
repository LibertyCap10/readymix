/**
 * MapView — the Mapbox GL map with plant, truck, and job site markers,
 * route lines, and interactive popups.
 */

import { useState, useCallback, useMemo } from 'react';
import Map, { Marker, Popup, Source, Layer, type ViewStateChangeEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, Typography, Button, IconButton } from '@mui/material';
import FactoryIcon from '@mui/icons-material/Factory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PlaceIcon from '@mui/icons-material/Place';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { StatusChip } from '@/components/StatusChip';
import { orderStatusColors, truckStatusColors } from '@/theme/statusColors';
import type { Order, Truck, Plant } from '@/types/domain';
import type { OrderStatus, TruckStatus } from '@/theme/statusColors';
import type { RouteData } from './useMapRoutes';
import type { FeatureCollection, LineString } from 'geojson';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '') as string;

interface MapViewProps {
  plant: Plant;
  orders: Order[];
  trucks: Truck[];
  routes: Record<string, RouteData>;
  selectedTicket: string | null;
  onOrderSelect: (order: Order) => void;
  onTruckSelect: (truck: Truck) => void;
  onAssignTruck: (order: Order) => void;
  onUpdateStatus: (ticketNumber: string, status: OrderStatus) => void;
  sidePanelHidden?: boolean;
  onToggleSidePanel?: () => void;
}

// ─── Route GeoJSON builder ──────────────────────────────────────────────────

function buildRouteGeoJSON(
  routes: Record<string, RouteData>,
  orders: Order[],
): FeatureCollection<LineString> {
  const features = Object.entries(routes)
    .map(([ticketNumber, route]) => {
      const order = orders.find(o => o.ticketNumber === ticketNumber);
      if (!order) return null;
      return {
        type: 'Feature' as const,
        properties: {
          ticketNumber,
          status: order.status,
          color: order.status === 'in_transit' ? '#283593' : '#1565C0',
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: route.coordinates,
        },
      };
    })
    .filter(Boolean) as FeatureCollection<LineString>['features'];

  return { type: 'FeatureCollection', features };
}

// ─── Status action helpers ──────────────────────────────────────────────────

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'dispatched',
  dispatched: 'in_transit',
  in_transit: 'pouring',
  pouring: 'returning',
  returning: 'complete',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function MapView({
  plant,
  orders,
  trucks,
  routes,
  selectedTicket,
  onOrderSelect,
  onTruckSelect,
  onAssignTruck,
  onUpdateStatus,
  sidePanelHidden,
  onToggleSidePanel,
}: MapViewProps) {
  const [viewState, setViewState] = useState({
    longitude: plant.longitude,
    latitude: plant.latitude,
    zoom: 11,
  });
  const [popupOrder, setPopupOrder] = useState<Order | null>(null);
  const [popupTruck, setPopupTruck] = useState<Truck | null>(null);

  const handleMove = useCallback((e: ViewStateChangeEvent) => {
    setViewState(e.viewState);
  }, []);

  const routeGeoJSON = useMemo(
    () => buildRouteGeoJSON(routes, orders),
    [routes, orders],
  );

  const handleOrderClick = useCallback((order: Order) => {
    setPopupTruck(null);
    setPopupOrder(order);
    onOrderSelect(order);
  }, [onOrderSelect]);

  const handleTruckClick = useCallback((truck: Truck) => {
    setPopupOrder(null);
    setPopupTruck(truck);
    onTruckSelect(truck);
  }, [onTruckSelect]);

  if (!MAPBOX_TOKEN) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: 'grey.100' }}>
        <Typography color="text.secondary">
          Set VITE_MAPBOX_TOKEN in .env.local to enable the map.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      <Map
        {...viewState}
        onMove={handleMove}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {/* ── Route lines ──────────────────────────────────────────── */}
        <Source id="routes" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-lines"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 4,
              'line-opacity': 0.7,
            }}
          />
        </Source>

        {/* ── Plant marker ──────────────────────────────────────────── */}
        <Marker longitude={plant.longitude} latitude={plant.latitude} anchor="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: '#37474F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <FactoryIcon sx={{ color: 'white', fontSize: 18 }} />
          </Box>
        </Marker>

        {/* ── Truck markers ─────────────────────────────────────────── */}
        {trucks.map(truck => {
          const color = truckStatusColors[truck.currentStatus as TruckStatus]?.text ?? '#666';
          return (
            <Marker
              key={truck.truckId}
              longitude={truck.longitude!}
              latitude={truck.latitude!}
              anchor="center"
              onClick={(e: { originalEvent: MouseEvent }) => { e.originalEvent.stopPropagation(); handleTruckClick(truck); }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  bgcolor: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  animation: truck.currentStatus === 'in_transit' ? 'pulse 2s infinite' : undefined,
                  '@keyframes pulse': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.15)' },
                  },
                }}
              >
                <LocalShippingIcon sx={{ color: 'white', fontSize: 16 }} />
              </Box>
            </Marker>
          );
        })}

        {/* ── Job site markers ──────────────────────────────────────── */}
        {orders.map(order => {
          if (order.jobSiteLatitude == null || order.jobSiteLongitude == null) return null;
          const color = orderStatusColors[order.status as OrderStatus]?.text ?? '#666';
          const isSelected = order.ticketNumber === selectedTicket;
          return (
            <Marker
              key={order.ticketNumber}
              longitude={order.jobSiteLongitude}
              latitude={order.jobSiteLatitude}
              anchor="bottom"
              onClick={(e: { originalEvent: MouseEvent }) => { e.originalEvent.stopPropagation(); handleOrderClick(order); }}
            >
              <Box sx={{ cursor: 'pointer', textAlign: 'center' }}>
                <PlaceIcon
                  sx={{
                    fontSize: isSelected ? 36 : 28,
                    color,
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                    transition: 'font-size 0.2s',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: '#fff',
                    bgcolor: color,
                    borderRadius: 0.5,
                    px: 0.5,
                    mt: -0.5,
                    lineHeight: 1.4,
                  }}
                >
                  {order.ticketNumber.replace('TKT-2026-', '')}
                </Typography>
              </Box>
            </Marker>
          );
        })}

        {/* ── Order popup ───────────────────────────────────────────── */}
        {popupOrder && popupOrder.jobSiteLatitude != null && popupOrder.jobSiteLongitude != null && (
          <Popup
            longitude={popupOrder.jobSiteLongitude}
            latitude={popupOrder.jobSiteLatitude}
            anchor="top"
            onClose={() => setPopupOrder(null)}
            closeButton
            closeOnClick={false}
            maxWidth="280px"
          >
            <Box sx={{ p: 0.5, minWidth: 220 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>{popupOrder.ticketNumber}</Typography>
                <StatusChip status={popupOrder.status} variant="order" />
              </Box>
              <Typography variant="caption" display="block" color="text.secondary">
                {popupOrder.customerName}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {popupOrder.jobSiteName}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                {popupOrder.mixDesignName} -- {popupOrder.volume} yd{'\u00b3'}
              </Typography>

              {/* Route info */}
              {routes[popupOrder.ticketNumber] && (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                  {(routes[popupOrder.ticketNumber].distance / 1609.34).toFixed(1)} mi
                  {' -- '}
                  {Math.round(routes[popupOrder.ticketNumber].duration / 60)} min drive
                </Typography>
              )}

              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {popupOrder.status === 'pending' && (
                  <Button size="small" variant="contained" onClick={() => onAssignTruck(popupOrder)}>
                    Assign Truck
                  </Button>
                )}
                {NEXT_STATUS[popupOrder.status] && popupOrder.status !== 'pending' && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onUpdateStatus(popupOrder.ticketNumber, NEXT_STATUS[popupOrder.status]!)}
                  >
                    {orderStatusColors[NEXT_STATUS[popupOrder.status]!]?.label ?? 'Next'}
                  </Button>
                )}
                {!['complete', 'cancelled'].includes(popupOrder.status) && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => onUpdateStatus(popupOrder.ticketNumber, 'cancelled')}
                  >
                    Cancel
                  </Button>
                )}
              </Box>
            </Box>
          </Popup>
        )}

        {/* ── Truck popup ───────────────────────────────────────────── */}
        {popupTruck && popupTruck.latitude != null && popupTruck.longitude != null && (
          <Popup
            longitude={popupTruck.longitude}
            latitude={popupTruck.latitude}
            anchor="top"
            onClose={() => setPopupTruck(null)}
            closeButton
            closeOnClick={false}
            maxWidth="260px"
          >
            <Box sx={{ p: 0.5, minWidth: 200 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>Truck {popupTruck.truckNumber}</Typography>
                <StatusChip status={popupTruck.currentStatus} variant="truck" />
              </Box>
              <Typography variant="caption" display="block" color="text.secondary">
                {popupTruck.driver.name}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {popupTruck.capacity} yd{'\u00b3'} capacity -- {popupTruck.loadsToday} loads today
              </Typography>
              {popupTruck.currentJobSite && (
                <Typography variant="caption" display="block" color="text.secondary">
                  At: {popupTruck.currentJobSite}
                </Typography>
              )}
            </Box>
          </Popup>
        )}
      </Map>

      {/* ── Side panel toggle (when hidden) ──────────────────────── */}
      {sidePanelHidden && onToggleSidePanel && (
        <IconButton
          onClick={onToggleSidePanel}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': { bgcolor: 'grey.100' },
          }}
        >
          <MenuOpenIcon />
        </IconButton>
      )}
    </Box>
  );
}
