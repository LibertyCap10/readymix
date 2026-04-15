import { Box, Typography } from '@mui/material';

interface SectionHeaderProps {
  children: React.ReactNode;
  sx?: object;
}

export function SectionHeader({ children, sx }: SectionHeaderProps) {
  return (
    <Box sx={{ mt: 4, mb: 2, ...sx }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ fontSize: '0.7rem', display: 'block', mb: 0.25 }}
      >
        {children}
      </Typography>
      <Box sx={{ width: 24, height: 2, bgcolor: 'secondary.main', borderRadius: 1 }} />
    </Box>
  );
}
