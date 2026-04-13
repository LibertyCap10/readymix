/**
 * AnalyticsPage — reporting dashboard powered by Aurora PostgreSQL.
 *
 * Layout:
 *   ┌─ Header + Range Toggle ─────────────────────────────────┐
 *   ├─ KPI Cards (4 across) ──────────────────────────────────┤
 *   ├─ Volume Chart ────────┬── Cycle Time Chart ─────────────┤
 *   ├─ Customer Scorecard (AG Grid) ──────────────────────────┤
 *   └─ Driver Leaderboard (AG Grid) ──────────────────────────┘
 */

import {
  Alert,
  Box,
  CircularProgress,
  Grid2,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { usePlant } from '@/context/PlantContext';
import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard';
import { CycleTimeChart } from '@/features/fleet/CycleTimeChart';
import { VolumeChart } from './VolumeChart';
import { KpiCards } from './KpiCards';
import { CustomerTable } from './CustomerTable';
import { DriverTable } from './DriverTable';

// Chart card wrapper (matches FleetPage pattern)
function ChartCard({ title, subtitle, children, height = 280 }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        height: height + 48,
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

// Section header
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="h6" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>
      {children}
    </Typography>
  );
}

export function AnalyticsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedPlant } = usePlant();
  const {
    volume,
    cycleTimes,
    benchmarkMinutes,
    utilizationPct,
    customers,
    drivers,
    loading,
    error,
    range,
    setRange,
  } = useAnalyticsDashboard();

  // Derive KPI values
  const totalVolume = volume.reduce((sum, d) => sum + d.volumeYards, 0);
  const avgCycleTime = cycleTimes.length > 0
    ? cycleTimes.reduce((sum, d) => sum + d.avgMinutes, 0) / cycleTimes.length
    : 0;
  const avgOnTime = customers.length > 0
    ? customers.reduce((sum, c) => sum + c.onTimePct, 0) / customers.length
    : 0;

  // Map cycle times to the format CycleTimeChart expects
  const cycleTimePoints = cycleTimes.map((d) => ({
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    avgMinutes: d.avgMinutes,
  }));

  const handleRangeChange = (_: unknown, newRange: string | null) => {
    if (newRange) setRange(newRange);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
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
        <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight={700}>
          Analytics
        </Typography>
        {!isMobile && (
          <Typography variant="body2" color="text.secondary">
            {selectedPlant.name}
          </Typography>
        )}
        <Box sx={{ ml: 'auto' }}>
          <ToggleButtonGroup
            value={range}
            exclusive
            onChange={handleRangeChange}
            size="small"
          >
            <ToggleButton value="7d">{isMobile ? '7d' : '7 days'}</ToggleButton>
            <ToggleButton value="14d">{isMobile ? '14d' : '14 days'}</ToggleButton>
            <ToggleButton value="30d">{isMobile ? '30d' : '30 days'}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, md: 2 } }}>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* KPI Summary */}
            <KpiCards
              totalVolume={totalVolume}
              avgCycleTime={avgCycleTime}
              benchmarkMinutes={benchmarkMinutes}
              onTimePct={avgOnTime}
              utilizationPct={utilizationPct}
            />

            {/* Trend Charts */}
            <Grid2 container spacing={2} sx={{ mt: 1 }}>
              <Grid2 size={{ xs: 12, md: 6 }}>
                <ChartCard
                  title="Delivery Volume"
                  subtitle={`Last ${range.replace('d', ' days')}`}
                  height={isMobile ? 200 : 280}
                >
                  <VolumeChart data={volume} />
                </ChartCard>
              </Grid2>
              <Grid2 size={{ xs: 12, md: 6 }}>
                <ChartCard
                  title="Average Cycle Time"
                  subtitle={`${benchmarkMinutes} min target`}
                  height={isMobile ? 200 : 280}
                >
                  <CycleTimeChart data={cycleTimePoints} />
                </ChartCard>
              </Grid2>
            </Grid2>

            {/* Customer Scorecard */}
            <SectionHeader>Customer Scorecard</SectionHeader>
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}
            >
              <Box sx={{ minWidth: isMobile ? 600 : 'auto' }}>
                <CustomerTable data={customers} />
              </Box>
            </Paper>

            {/* Driver Leaderboard */}
            <SectionHeader>Driver Leaderboard</SectionHeader>
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'auto', WebkitOverflowScrolling: 'touch', mb: 2 }}
            >
              <Box sx={{ minWidth: isMobile ? 500 : 'auto' }}>
                <DriverTable data={drivers} />
              </Box>
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}
