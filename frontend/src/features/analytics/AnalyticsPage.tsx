/**
 * AnalyticsPage — reporting dashboard powered by Aurora PostgreSQL.
 *
 * Layout:
 *   ┌─ PageHeader + Range Toggle ─────────────────────────────┐
 *   ├─ KPI Cards (4 across) ──────────────────────────────────┤
 *   ├─ Volume Chart ────────┬── Cycle Time Chart ─────────────┤
 *   ├─ Customer Scorecard (AG Grid) ──────────────────────────┤
 *   └─ Driver Leaderboard (AG Grid) ──────────────────────────┘
 */

import {
  Alert,
  Box,
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
import { ChartCard } from '@/components/ChartCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { SkeletonKpi, SkeletonChart, SkeletonGrid } from '@/components/SkeletonLoader';

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
      <PageHeader
        title="Analytics"
        subtitle={!isMobile ? selectedPlant.name : undefined}
        rightContent={
          <ToggleButtonGroup
            value={range}
            exclusive
            onChange={handleRangeChange}
            size="small"
            sx={{
              bgcolor: 'grey.100',
              borderRadius: 99,
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '99px !important',
                px: 2,
                py: 0.5,
                fontSize: '0.8rem',
                fontWeight: 600,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: '#fff',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              },
            }}
          >
            <ToggleButton value="7d">{isMobile ? '7d' : '7 days'}</ToggleButton>
            <ToggleButton value="14d">{isMobile ? '14d' : '14 days'}</ToggleButton>
            <ToggleButton value="30d">{isMobile ? '30d' : '30 days'}</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, md: 2.5 } }}>

        {loading ? (
          <>
            <SkeletonKpi />
            <Box sx={{ mt: 2 }}>
              <Grid2 container spacing={2}>
                <Grid2 size={{ xs: 12, md: 6 }}><SkeletonChart height={isMobile ? 200 : 280} /></Grid2>
                <Grid2 size={{ xs: 12, md: 6 }}><SkeletonChart height={isMobile ? 200 : 280} /></Grid2>
              </Grid2>
            </Box>
            <Box sx={{ mt: 3 }}><SkeletonGrid rows={5} /></Box>
            <Box sx={{ mt: 3 }}><SkeletonGrid rows={5} /></Box>
          </>
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
            <Grid2 container spacing={2} sx={{ mt: 1.5 }}>
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
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700}>Customer Scorecard</Typography>
              </Box>
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
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700}>Driver Leaderboard</Typography>
              </Box>
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
