import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonIcon from '@mui/icons-material/Person';
import PlaceIcon from '@mui/icons-material/Place';
import { StatusChip } from '../StatusChip';
import type { Truck } from '@/types/domain';

interface TruckCardProps {
  truck: Truck;
  onClick?: (truck: Truck) => void;
}

export default function TruckCard({ truck, onClick }: TruckCardProps) {
  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick
          ? { boxShadow: 3, transform: 'translateY(-1px)', transition: 'all 0.15s' }
          : undefined,
      }}
      onClick={() => onClick?.(truck)}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        {/* Header: truck number + status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShippingIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>
              Truck {truck.truckNumber}
            </Typography>
          </Box>
          <StatusChip status={truck.currentStatus} variant="truck" />
        </Box>

        {/* Driver */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <PersonIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
          <Typography variant="body2" color="text.secondary">
            {truck.driver.name}
          </Typography>
        </Box>

        {/* Current job site (if active) */}
        {truck.currentJobSite && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <PlaceIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
            <Typography variant="body2" color="text.secondary" noWrap>
              {truck.currentJobSite}
            </Typography>
          </Box>
        )}

        {/* Footer: capacity + loads today */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {truck.capacity} yd&sup3; &middot; {truck.type.replace('_', ' ')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {truck.loadsToday} load{truck.loadsToday !== 1 ? 's' : ''} today
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
