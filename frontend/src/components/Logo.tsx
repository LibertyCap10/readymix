import { Box, Typography } from '@mui/material';

interface LogoProps {
  onClick?: () => void;
  /** 'light' renders white on transparent; 'dark' renders primary colors */
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
}

export default function Logo({ onClick, variant = 'light', size = 'md' }: LogoProps) {
  const isLight = variant === 'light';
  const fontSize = size === 'sm' ? '1rem' : '1.25rem';

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          fontSize,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          color: isLight ? 'white' : 'primary.main',
          textShadow: isLight ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        Ready
        <Box
          component="span"
          sx={{ color: isLight ? 'secondary.light' : 'secondary.main' }}
        >
          Mix
        </Box>
      </Typography>
    </Box>
  );
}
