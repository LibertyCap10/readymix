/**
 * FleetPage — the fleet management dashboard.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Header: plant name · truck count · live countdown   │
 *   ├────────────┬─────────────┬───────────────────────────┤
 *   │ Fleet      │ Cycle Time  │ Fleet Utilization         │
 *   │ Status     │ (7-day avg) │ (donut, this week)        │
 *   │ (bar)      │ (line)      │                           │
 *   ├────────────┴─────────────┴───────────────────────────┤
 *   │ Truck Roster (AG Grid)                               │
 *   └──────────────────────────────────────────────────────┘
 *
 * Live ticker: truck statuses update every 10s via useFleetTicker.
 * A countdown badge shows "Next update in Xs" so users know it's live.
 */

import { Alert, Box, CircularProgress, Grid2, Paper, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CircleIcon from '@mui/icons-material/Circle';
import { usePlant } from '@/context/PlantContext';
import { useFleet } from '@/hooks/useFleet';
import { useAnalytics } from '@/hooks/useAnalytics';
import { FleetStatusChart } from './FleetStatusChart';
import { CycleTimeChart } from './CycleTimeChart';
import { UtilizationChart } from './UtilizationChart';
import { TruckRoster } from './TruckRoster';

// ─── Chart card wrapper ───────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}

function ChartCard({ title, subtitle, children, height = 260 }: ChartCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        height: height + 48, // header + chart
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FleetPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedPlant } = usePlant();
  const { trucks, statusCounts, secondsUntilNext, loading: fleetLoading, error: fleetError } = useFleet();
  const { cycleTimePoints, utilizationSegments, utilizationPct, loading: analyticsLoading } = useAnalytics();
  const loading = fleetLoading || analyticsLoading;

  const activeTrucks = trucks.filter((t) => t.currentStatus !== 'maintenance').length;
  const maintenanceTrucks = trucks.filter((t) => t.currentStatus === 'maintenance').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <Box
        sx={{
          px: { xs: 1.5, md: 2.5 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, md: 2 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          {selectedPlant.name}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {trucks.length} trucks · {activeTrucks} active
          {maintenanceTrucks > 0 ? ` · ${maintenanceTrucks} in maintenance` : ''}
        </Typography>

        {/* Live update countdown badge */}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <CircleIcon sx={{ fontSize: 8, color: 'success.main', animation: 'pulse 2s infinite' }} />
          <Typography variant="caption" color="text.secondary">
            Live · next update in {secondsUntilNext}s
          </Typography>
        </Box>
      </Box>

      {/* ── Error banner ───────────────────────────────────────────── */}
      {fleetError && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {fleetError}
        </Alert>
      )}

      {/* ── Scrollable content ────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* ── Charts row ────────────────────────────────────────────── */}
        <Grid2 container spacing={2} sx={{ mb: 2 }}>
          <Grid2 size={{ xs: 12, md: 4 }}>
            <ChartCard
              title="Fleet Status"
              subtitle="Current truck assignments"
              height={isMobile ? 180 : 260}
            >
              <FleetStatusChart statusCounts={statusCounts} />
            </ChartCard>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <ChartCard
              title="Avg Cycle Time"
              subtitle="Last 7 days · 90 min target"
              height={isMobile ? 180 : 260}
            >
              <CycleTimeChart data={cycleTimePoints} />
            </ChartCard>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <ChartCard
              title="Fleet Utilization"
              subtitle="This week"
              height={isMobile ? 180 : 260}
            >
              <UtilizationChart
                segments={utilizationSegments}
                utilizationPct={utilizationPct}
              />
            </ChartCard>
          </Grid2>
        </Grid2>

        {/* ── Truck Roster ──────────────────────────────────────────── */}
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700}>Truck Roster</Typography>
          </Box>
          <Box sx={{ height: isMobile ? 240 : 320 }}>
            <TruckRoster trucks={trucks} />
          </Box>
        </Paper>

      </Box>
    </Box>
  );
}
