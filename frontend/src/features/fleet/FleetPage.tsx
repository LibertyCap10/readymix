/**
 * FleetPage — the fleet management dashboard.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Header: plant name · truck count · live countdown   │
 *   ├────────────┬─────────────┬───────────────────────────┤
 *   │ Fleet      │ Cycle Time  │ Fleet Utilization         │
 *   │ Status     │ (7-day avg) │ (donut, this week)        │
 *   ├────────────┴─────────────┴───────────────────────────┤
 *   │ Truck Roster (AG Grid)                               │
 *   └──────────────────────────────────────────────────────┘
 *
 * Mobile: charts scroll horizontally. Live ticker: 10s via useFleetTicker.
 */

import { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Grid2,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CircleIcon from '@mui/icons-material/Circle';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { usePlant } from '@/context/PlantContext';
import { useFleet } from '@/hooks/useFleet';
import { useAnalytics } from '@/hooks/useAnalytics';
import { FleetStatusChart } from './FleetStatusChart';
import { CycleTimeChart } from './CycleTimeChart';
import { UtilizationChart } from './UtilizationChart';
import { TruckRoster } from './TruckRoster';
import { ChartCard } from '@/components/ChartCard';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonChart, SkeletonGrid } from '@/components/SkeletonLoader';

// ─── Component ────────────────────────────────────────────────────────────────

export function FleetPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedPlant } = usePlant();
  const { trucks, statusCounts, secondsUntilNext, loading: fleetLoading, error: fleetError } = useFleet();
  const { cycleTimePoints, utilizationSegments, utilizationPct, loading: analyticsLoading } = useAnalytics();
  const loading = fleetLoading || analyticsLoading;
  const [rosterFilter, setRosterFilter] = useState('');

  const activeTrucks = trucks.filter((t) => t.currentStatus !== 'maintenance').length;
  const maintenanceTrucks = trucks.filter((t) => t.currentStatus === 'maintenance').length;

  const liveBadge = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        bgcolor: 'success.main',
        color: '#fff',
        px: 1.5,
        py: 0.25,
        borderRadius: 99,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      <CircleIcon
        sx={{
          fontSize: 6,
          animation: 'livePulse 2s infinite',
          '@keyframes livePulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.3 },
          },
        }}
      />
      Live · {secondsUntilNext}s
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <PageHeader
        title={selectedPlant.name}
        subtitle={`${trucks.length} trucks · ${activeTrucks} active${maintenanceTrucks > 0 ? ` · ${maintenanceTrucks} maintenance` : ''}`}
        rightContent={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {statusCounts.available > 0 && (
              <Chip label={`${statusCounts.available} available`} size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600, fontSize: '0.7rem' }} />
            )}
            {statusCounts.in_transit > 0 && (
              <Chip label={`${statusCounts.in_transit} in transit`} size="small" sx={{ bgcolor: '#E8EAF6', color: '#283593', fontWeight: 600, fontSize: '0.7rem' }} />
            )}
            {liveBadge}
          </Box>
        }
      />

      {/* ── Error banner ───────────────────────────────────────────── */}
      {fleetError && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {fleetError}
        </Alert>
      )}

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              {[1, 2, 3].map(i => (
                <Box key={i} sx={{ flex: 1, minWidth: isMobile ? 280 : 'auto' }}>
                  <SkeletonChart height={isMobile ? 180 : 260} />
                </Box>
              ))}
            </Box>
            <SkeletonGrid rows={4} />
          </>
        ) : (
          <>
            {/* ── Charts row ──────────────────────────────────────── */}
            {isMobile ? (
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  pb: 1,
                  mb: 2,
                  '&::-webkit-scrollbar': { display: 'none' },
                }}
              >
                <Box sx={{ minWidth: 280, flex: '0 0 280px' }}>
                  <ChartCard title="Fleet Status" subtitle="Current truck assignments" height={180}
                    badge={liveBadge}>
                    <FleetStatusChart statusCounts={statusCounts} />
                  </ChartCard>
                </Box>
                <Box sx={{ minWidth: 280, flex: '0 0 280px' }}>
                  <ChartCard title="Avg Cycle Time" subtitle="Last 7 days · 90 min target" height={180}>
                    <CycleTimeChart data={cycleTimePoints} />
                  </ChartCard>
                </Box>
                <Box sx={{ minWidth: 280, flex: '0 0 280px' }}>
                  <ChartCard title="Fleet Utilization" subtitle="This week" height={180}>
                    <UtilizationChart segments={utilizationSegments} utilizationPct={utilizationPct} />
                  </ChartCard>
                </Box>
              </Box>
            ) : (
              <Grid2 container spacing={2} sx={{ mb: 2 }}>
                <Grid2 size={{ xs: 12, md: 4 }}>
                  <ChartCard title="Fleet Status" subtitle="Current truck assignments" height={260}
                    badge={liveBadge}>
                    <FleetStatusChart statusCounts={statusCounts} />
                  </ChartCard>
                </Grid2>
                <Grid2 size={{ xs: 12, md: 4 }}>
                  <ChartCard title="Avg Cycle Time" subtitle="Last 7 days · 90 min target" height={260}>
                    <CycleTimeChart data={cycleTimePoints} />
                  </ChartCard>
                </Grid2>
                <Grid2 size={{ xs: 12, md: 4 }}>
                  <ChartCard title="Fleet Utilization" subtitle="This week" height={260}>
                    <UtilizationChart segments={utilizationSegments} utilizationPct={utilizationPct} />
                  </ChartCard>
                </Grid2>
              </Grid2>
            )}

            {/* ── Truck Roster ──────────────────────────────────────── */}
            <Paper
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" fontWeight={700}>Truck Roster</Typography>
                <TextField
                  size="small"
                  placeholder="Search trucks..."
                  value={rosterFilter}
                  onChange={(e) => setRosterFilter(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: { xs: 160, sm: 220 } }}
                />
              </Box>
              <Box sx={{ height: isMobile ? 240 : 320 }}>
                <TruckRoster trucks={trucks} quickFilterText={rosterFilter} />
              </Box>
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}
