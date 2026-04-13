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
import CircleIcon from '@mui/icons-material/Circle';
import type { MixDesign, PourType } from '@/types/domain';

const POUR_TYPE_LABELS: Record<PourType, string> = {
  foundation: 'Foundation',
  slab: 'Slab',
  wall: 'Wall',
  driveway: 'Driveway',
  sidewalk: 'Sidewalk',
  column: 'Column',
  footing: 'Footing',
  grade_beam: 'Grade Beam',
};

interface MobileMixListProps {
  mixDesigns: MixDesign[];
  onMixClick: (mix: MixDesign) => void;
}

export function MobileMixList({ mixDesigns, onMixClick }: MobileMixListProps) {
  if (!mixDesigns.length) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">No mix designs available for this plant.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      {mixDesigns.map(mix => (
        <Card key={mix.mixDesignId} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardActionArea onClick={() => onMixClick(mix)}>
            <CardContent sx={{ pb: '12px !important' }}>

              {/* Row 1: Code + active indicator */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {mix.code}
                </Typography>
                <CircleIcon sx={{ fontSize: 10, color: mix.isActive ? 'success.main' : 'text.disabled' }} />
              </Box>

              {/* Row 2: Name */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                {mix.name}
              </Typography>

              <Divider sx={{ my: 0.75 }} />

              {/* Row 3: Key specs */}
              <Typography variant="caption" color="text.secondary">
                {mix.psi.toLocaleString()} PSI
                {' \u00b7 '}Slump {mix.slumpMin}-{mix.slumpMax}"
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
