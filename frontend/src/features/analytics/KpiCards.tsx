import { Grid2, Paper, Typography, Box } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

interface Props {
  totalVolume: number;
  avgCycleTime: number;
  benchmarkMinutes: number;
  onTimePct: number;
  utilizationPct: number;
}

interface KpiDef {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}

export function KpiCards({ totalVolume, avgCycleTime, benchmarkMinutes, onTimePct, utilizationPct }: Props) {
  const cycleColor = avgCycleTime <= benchmarkMinutes ? '#2E7D32' : '#D84315';
  const onTimeColor = onTimePct >= 90 ? '#2E7D32' : onTimePct >= 75 ? '#F57F17' : '#D84315';

  const kpis: KpiDef[] = [
    {
      label: 'Total Volume',
      value: `${totalVolume.toFixed(1)}`,
      subtitle: 'yd\u00B3 delivered',
      icon: <TrendingUpIcon />,
      color: '#37474F',
    },
    {
      label: 'On-Time Rate',
      value: `${onTimePct.toFixed(0)}%`,
      subtitle: 'within 15 min of requested',
      icon: <CheckCircleIcon />,
      color: onTimeColor,
    },
    {
      label: 'Avg Cycle Time',
      value: `${avgCycleTime.toFixed(0)} min`,
      subtitle: `${benchmarkMinutes} min target`,
      icon: <TimerIcon />,
      color: cycleColor,
    },
    {
      label: 'Fleet Utilization',
      value: `${utilizationPct}%`,
      subtitle: 'trucks productive',
      icon: <LocalShippingIcon />,
      color: '#FF6D00',
    },
  ];

  return (
    <Grid2 container spacing={2}>
      {kpis.map((kpi) => (
        <Grid2 size={{ xs: 6, md: 3 }} key={kpi.label}>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              borderLeft: '4px solid',
              borderLeftColor: kpi.color,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ color: kpi.color }}>{kpi.icon}</Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                {kpi.label}
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight={700} sx={{ color: kpi.color }}>
              {kpi.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {kpi.subtitle}
            </Typography>
          </Paper>
        </Grid2>
      ))}
    </Grid2>
  );
}
