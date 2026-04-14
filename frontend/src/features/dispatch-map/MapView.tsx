/**
 * MapView — the Mapbox GL map with plant, truck, and job site markers,
 * route lines, and interactive popups.
 *
 * Route visibility is controlled by showAllRoutes + selectedTicket:
 *  - showAllRoutes=false, no selection → no routes
 *  - showAllRoutes=false, order selected → only that route (prominent)
 *  - showAllRoutes=true → all routes, selected one highlighted
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Marker, Popup, Source, Layer, type ViewStateChangeEvent, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, Typography, Button, IconButton } from '@mui/material';
import FactoryIcon from '@mui/icons-material/Factory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PlaceIcon from '@mui/icons-material/Place';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { StatusChip } from '@/components/StatusChip';
import { MapLegend } from './MapLegend';
import { PlantPopup } from './PlantPopup';
import { useTimeline, formatEta, phaseLabel, phaseEtaLabel } from '@/features/timeline/TimelineContext';
import { orderStatusColors, truckStatusColors } from '@/theme/statusColors';
import type { Order, Truck, Plant } from '@/types/domain';
import type { OrderStatus, TruckStatus } from '@/theme/statusColors';
import type { RouteData } from './useMapRoutes';
import type { FeatureCollection, LineString } from 'geojson';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '') as string;

interface MapViewProps {
  plant: Plant;
  orders: Order[];
  allOrders: Order[];
  trucks: Truck[];
  routes: Record<string, RouteData>;
  selectedTicket: string | null;
  showAllRoutes: boolean;
  showTrucks: boolean;
  onOrderSelect: (order: Order) => void;
  onTruckSelect: (truck: Truck) => void;
  onAssignTruck: (order: Order) => void;
  onUpdateStatus: (ticketNumber: string, status: OrderStatus) => void;
  isToday?: boolean;
  isPastDate?: boolean;
  sidePanelHidden?: boolean;
  onToggleSidePanel?: () => void;
}

// ─── Route GeoJSON builder ──────────────────────────────────────────────────

function buildRouteGeoJSON(
  routes: Record<string, RouteData>,
  orders: Order[],
  visibleTickets: string[],
  selectedTicket: string | null,
): FeatureCollection<LineString> {
  const ticketSet = new Set(visibleTickets);

  const features = Object.entries(routes)
    .filter(([ticketNumber]) => ticketSet.has(ticketNumber))
    .map(([ticketNumber, route]) => {
      const order = orders.find(o => o.ticketNumber === ticketNumber);
      const isSelected = ticketNumber === selectedTicket;
      return {
        type: 'Feature' as const,
        properties: {
          ticketNumber,
          status: order?.status ?? 'dispatched',
          isSelected,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: route.coordinates,
        },
      };
    });

  return { type: 'FeatureCollection', features };
}

// ─── Status action helpers ──────────────────────────────────────────────────

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'scheduled',
  scheduled: 'dispatched',
  dispatched: 'in_transit',
  in_transit: 'pouring',
  pouring: 'returning',
  returning: 'complete',
};

// ─── Component ──────────────────────────────────────────────────────────────

const AT_PLANT_STATUSES = new Set(['available', 'scheduled', 'loading', 'maintenance']);

export function MapView({
  plant,
  orders,
  allOrders,
  trucks,
  routes,
  selectedTicket,
  showAllRoutes,
  showTrucks,
  onOrderSelect,
  onTruckSelect,
  onAssignTruck,
  onUpdateStatus,
  isToday = true,
  isPastDate = false,
  sidePanelHidden,
  onToggleSidePanel,
}: MapViewProps) {
  const simulation = useTimeline();
  const mapRef = useRef<MapRef>(null);

  const [viewState, setViewState] = useState({
    longitude: plant.longitude,
    latitude: plant.latitude,
    zoom: 11,
  });
  const [popupOrder, setPopupOrder] = useState<Order | null>(null);
  const [popupTruck, setPopupTruck] = useState<Truck | null>(null);
  const [popupPlant, setPopupPlant] = useState(false);

  // Trucks physically at the plant (including those in loading phase)
  const trucksAtPlant = useMemo(
    () => trucks.filter(t => {
      if (!AT_PLANT_STATUSES.has(t.currentStatus)) return false;
      const entry = simulation.getEntryByTruck(t.truckId);
      // No simulation entry → at plant. Loading phase → physically at plant.
      return !entry || entry.phase === 'loading';
    }),
    [trucks, simulation],
  );

  const trucksAtPlantIds = useMemo(
    () => new Set(trucksAtPlant.map(t => t.truckId)),
    [trucksAtPlant],
  );

  // Resize map when side panel is toggled so it fills the available space
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 50);
    return () => clearTimeout(t);
  }, [sidePanelHidden]);

  const handleMove = useCallback((e: ViewStateChangeEvent) => {
    setViewState(e.viewState);
  }, []);

  const handleMapClick = useCallback(() => {
    setPopupOrder(null);
    setPopupTruck(null);
    setPopupPlant(false);
  }, []);

  // Determine which route tickets to render
  const visibleRouteTickets = useMemo(() => {
    if (showAllRoutes) return Object.keys(routes);
    if (selectedTicket && routes[selectedTicket]) return [selectedTicket];
    return [];
  }, [showAllRoutes, selectedTicket, routes]);

  const routeGeoJSON = useMemo(
    () => buildRouteGeoJSON(routes, orders, visibleRouteTickets, selectedTicket),
    [routes, orders, visibleRouteTickets, selectedTicket],
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
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onClick={handleMapClick}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {/* ── Route lines ──────────────────────────────────────────── */}
        <Source id="routes" type="geojson" data={routeGeoJSON}>
          {/* Shadow layer for selected route — wider, translucent */}
          <Layer
            id="route-lines-shadow"
            type="line"
            filter={['==', ['get', 'isSelected'], true]}
            paint={{
              'line-color': '#1565C0',
              'line-width': 10,
              'line-opacity': 0.2,
            }}
          />
          {/* Main route lines — data-driven styling */}
          <Layer
            id="route-lines"
            type="line"
            paint={{
              'line-color': ['case',
                ['get', 'isSelected'], '#1565C0',
                '#90A4AE',
              ],
              'line-width': ['case',
                ['get', 'isSelected'], 5,
                3,
              ],
              'line-opacity': ['case',
                ['get', 'isSelected'], 0.9,
                0.45,
              ],
            }}
          />
        </Source>

        {/* ── Plant marker ──────────────────────────────────────────── */}
        <Marker longitude={plant.longitude} latitude={plant.latitude} anchor="center">
          <Box
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setPopupPlant(true);
              setPopupOrder(null);
              setPopupTruck(null);
            }}
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: isPastDate ? '#9E9E9E' : '#37474F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              position: 'relative',
              opacity: isPastDate ? 0.7 : 1,
            }}
          >
            <FactoryIcon sx={{ color: 'white', fontSize: 18 }} />
            {trucksAtPlant.length > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  bgcolor: isPastDate ? '#9E9E9E' : '#2E7D32',
                  color: 'white',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid white',
                }}
              >
                {trucksAtPlant.length}
              </Box>
            )}
          </Box>
        </Marker>

        {/* ── Truck markers (excludes trucks at plant) ────────────────── */}
        {showTrucks && trucks.filter(t => !trucksAtPlantIds.has(t.truckId)).map((truck, idx) => {
          const simPos = simulation.getTruckPosition(truck.truckId);
          const simStatus = simulation.getTruckStatus(truck.truckId) as TruckStatus | null;

          // Determine position: simulated > available-at-plant > API fallback
          let lng: number;
          let lat: number;
          if (simPos) {
            lng = simPos.lng;
            lat = simPos.lat;
          } else if (truck.currentStatus === 'available') {
            // Cluster available trucks around the plant in a small circle
            const angle = (idx / trucks.length) * 2 * Math.PI;
            const offsetRadius = 0.003; // ~300m spread
            lng = plant.longitude + Math.cos(angle) * offsetRadius;
            lat = plant.latitude + Math.sin(angle) * offsetRadius;
          } else if (truck.longitude != null && truck.latitude != null) {
            lng = truck.longitude;
            lat = truck.latitude;
          } else {
            return null; // No position available
          }

          const effectiveStatus = simStatus ?? truck.currentStatus;
          const color = isPastDate ? '#9E9E9E' : (truckStatusColors[effectiveStatus as TruckStatus]?.text ?? '#666');
          const isMoving = isToday && (effectiveStatus === 'in_transit' || effectiveStatus === 'returning');
          const simEntry = simulation.getEntryByTruck(truck.truckId);
          const etaSeconds = simEntry ? simulation.getEtaSeconds(simEntry) : 0;
          const showEta = isToday && simEntry && simEntry.phase !== 'complete';

          return (
            <Marker
              key={truck.truckId}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={(e: { originalEvent: MouseEvent }) => { e.originalEvent.stopPropagation(); handleTruckClick(truck); }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* ETA label above truck */}
                {showEta && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: '#fff',
                      bgcolor: 'rgba(0,0,0,0.75)',
                      borderRadius: 0.5,
                      px: 0.5,
                      py: 0.1,
                      mb: 0.3,
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isMoving ? `ETA ${formatEta(etaSeconds)}` : `${formatEta(etaSeconds)}`}
                  </Typography>
                )}
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
                    transition: 'background-color 0.3s',
                    animation: isMoving ? 'pulse 2s infinite' : undefined,
                    '@keyframes pulse': {
                      '0%, 100%': { transform: 'scale(1)' },
                      '50%': { transform: 'scale(1.15)' },
                    },
                  }}
                >
                  <LocalShippingIcon sx={{ color: 'white', fontSize: 16 }} />
                </Box>
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
        {popupOrder && popupOrder.jobSiteLatitude != null && popupOrder.jobSiteLongitude != null && (() => {
          const orderEntry = simulation.getEntryByTicket(popupOrder.ticketNumber);
          const orderEta = orderEntry ? simulation.getEtaSeconds(orderEntry) : 0;

          return (
            <Popup
              longitude={popupOrder.jobSiteLongitude}
              latitude={popupOrder.jobSiteLatitude}
              anchor="top"
              onClose={() => setPopupOrder(null)}
              closeButton
              closeOnClick={false}
              maxWidth="300px"
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
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
                  {popupOrder.mixDesignName} -- {popupOrder.volume} yd{'\u00b3'}
                </Typography>

                {/* Route info */}
                {routes[popupOrder.ticketNumber] && (
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
                    {(routes[popupOrder.ticketNumber].distance / 1609.34).toFixed(1)} mi
                    {' -- '}
                    {Math.round(routes[popupOrder.ticketNumber].duration / 60)} min drive
                  </Typography>
                )}

                {/* Assigned truck info + live simulation status */}
                {popupOrder.assignedTruckNumber && (
                  <Box sx={{ p: 0.5, bgcolor: 'grey.50', borderRadius: 1, mb: 0.5 }}>
                    <Typography variant="caption" display="block" fontWeight={600} color="text.primary">
                      Truck {popupOrder.assignedTruckNumber} -- {popupOrder.driverName}
                    </Typography>
                    {orderEntry && (
                      <Typography variant="caption" display="block" fontWeight={600} sx={{ color: 'primary.main' }}>
                        {phaseEtaLabel(orderEntry.phase, orderEta)}
                      </Typography>
                    )}
                    {!orderEntry && popupOrder.status !== 'pending' && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {phaseLabel(popupOrder.status === 'dispatched' ? 'loading' : popupOrder.status === 'in_transit' ? 'in_transit_outbound' : popupOrder.status)}
                      </Typography>
                    )}
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {popupOrder.status === 'pending' && (
                    <Button size="small" variant="contained" onClick={() => onAssignTruck(popupOrder)}>
                      Assign Truck
                    </Button>
                  )}
                  {NEXT_STATUS[popupOrder.status] && !['pending', 'scheduled'].includes(popupOrder.status) && (
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
          );
        })()}

        {/* ── Truck popup ───────────────────────────────────────────── */}
        {popupTruck && (simulation.getTruckPosition(popupTruck.truckId) ?? (popupTruck.latitude != null && popupTruck.longitude != null ? { lng: popupTruck.longitude, lat: popupTruck.latitude } : null)) && (() => {
          const pos = simulation.getTruckPosition(popupTruck.truckId);
          const popupLng = pos?.lng ?? popupTruck.longitude!;
          const popupLat = pos?.lat ?? popupTruck.latitude!;
          const truckEntry = simulation.getEntryByTruck(popupTruck.truckId);
          const truckEta = truckEntry ? simulation.getEtaSeconds(truckEntry) : 0;
          const effectiveTruckStatus = (simulation.getTruckStatus(popupTruck.truckId) ?? popupTruck.currentStatus) as TruckStatus;
          const linkedOrder = truckEntry ? orders.find(o => o.ticketNumber === truckEntry.ticketNumber) : null;
          const routeInfo = truckEntry ? routes[truckEntry.ticketNumber] : null;

          return (
            <Popup
              longitude={popupLng}
              latitude={popupLat}
              anchor="top"
              onClose={() => setPopupTruck(null)}
              closeButton
              closeOnClick={false}
              maxWidth="300px"
            >
              <Box sx={{ p: 0.5, minWidth: 220 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Truck {popupTruck.truckNumber}</Typography>
                  <StatusChip status={effectiveTruckStatus} variant="truck" />
                </Box>
                <Typography variant="caption" display="block" color="text.secondary">
                  {popupTruck.driver.name}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  {popupTruck.capacity} yd{'\u00b3'} capacity -- {popupTruck.loadsToday} loads today
                </Typography>

                {/* Simulation-driven phase & ETA */}
                {truckEntry && (
                  <Box sx={{ mt: 0.5, p: 0.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" display="block" fontWeight={600} color="text.primary">
                      {phaseEtaLabel(truckEntry.phase, truckEta)}
                    </Typography>
                    {routeInfo && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {(routeInfo.distance / 1609.34).toFixed(1)} mi -- {Math.round(routeInfo.duration / 60)} min drive
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Linked order info */}
                {linkedOrder && (
                  <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" display="block" fontWeight={600} color="text.primary">
                      {linkedOrder.ticketNumber}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {linkedOrder.customerName} -- {linkedOrder.jobSiteName}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {linkedOrder.mixDesignName} -- {linkedOrder.volume} yd{'\u00b3'}
                    </Typography>
                  </Box>
                )}

                {/* Fallback for non-simulated trucks */}
                {!truckEntry && popupTruck.currentJobSite && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    At: {popupTruck.currentJobSite}
                  </Typography>
                )}
              </Box>
            </Popup>
          );
        })()}

        {/* ── Plant popup ──────────────────────────────────────────── */}
        {popupPlant && (
          <PlantPopup
            plant={plant}
            trucks={trucks}
            orders={allOrders}
            onClose={() => setPopupPlant(false)}
            onAssignTruck={onAssignTruck}
            isToday={isToday}
            isPastDate={isPastDate}
          />
        )}
      </Map>

      {/* ── Map legend ──────────────────────────────────────────── */}
      <MapLegend />

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
