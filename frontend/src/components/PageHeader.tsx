import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
}

export function PageHeader({ title, subtitle, rightContent, bottomContent }: PageHeaderProps) {
  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        pt: 1.5,
        pb: bottomContent ? 0 : 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, md: 2 },
          flexWrap: 'wrap',
          mb: bottomContent ? 1 : 0,
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        {rightContent && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            {rightContent}
          </Box>
        )}
      </Box>
      {bottomContent && (
        <Box sx={{ pb: 1 }}>
          {bottomContent}
        </Box>
      )}
    </Box>
  );
}
