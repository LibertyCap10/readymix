/**
 * MobileMixList — card-based mix design list for mobile viewports.
 */

import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { POUR_TYPE_LABELS } from '@/types/domain';
import type { MixDesign } from '@/types/domain';

interface MobileMixListProps {
  mixDesigns: MixDesign[];
  onMixClick: (mix: MixDesign) => void;
}

export function MobileMixList({ mixDesigns, onMixClick }: MobileMixListProps) {
  if (!mixDesigns.length) return null;

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {mixDesigns.map(mix => (
        <Card
          key={mix.mixDesignId}
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '3px solid',
            borderLeftColor: mix.isActive ? 'success.main' : 'text.disabled',
          }}
        >
          <CardActionArea
            onClick={() => onMixClick(mix)}
            sx={{
              transition: 'transform 0.1s ease',
              '&:active': { transform: 'scale(0.99)' },
            }}
          >
            <CardContent sx={{ pb: '12px !important' }}>

              {/* Row 1: Code + PSI badge */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {mix.code}
                </Typography>
                <Chip
                  label={`${mix.psi.toLocaleString()} PSI`}
                  size="small"
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 11,
                    height: 22,
                  }}
                />
              </Box>

              {/* Row 2: Name */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                {mix.name}
              </Typography>

              <Divider sx={{ my: 0.75 }} />

              {/* Row 3: Key specs */}
              <Typography variant="caption" color="text.secondary">
                Slump {mix.slumpMin}-{mix.slumpMax}"
                {mix.costPerYard != null && ` \u00b7 $${Number(mix.costPerYard).toFixed(2)}/yd`}
              </Typography>

              {/* Row 4: Application chips */}
              {mix.applications.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                  {mix.applications.map(pt => (
                    <Chip
                      key={pt}
                      label={POUR_TYPE_LABELS[pt] ?? pt}
                      size="small"
                      sx={{ fontSize: 10, height: 20 }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
}
