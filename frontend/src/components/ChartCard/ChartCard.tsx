import { Box, Paper, Typography } from '@mui/material';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
  accentColor?: string;
  badge?: React.ReactNode;
}

export function ChartCard({ title, subtitle, children, height = 260, accentColor = '#FF6D00', badge }: ChartCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 2,
        p: 2,
        height: height + 56,
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          borderColor: accentColor,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        },
      }}
    >
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
        {badge}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}
