import { Box, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

interface EmptyStateProps {
  icon?: SvgIconComponent;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Box sx={{ py: 8, textAlign: 'center', maxWidth: 320, mx: 'auto' }}>
      {Icon && (
        <Icon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
      )}
      <Typography variant="body1" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 2.5 : 0 }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
