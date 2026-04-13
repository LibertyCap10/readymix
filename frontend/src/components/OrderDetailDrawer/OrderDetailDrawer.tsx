/**
 * OrderDetailDrawer — a right-side MUI Drawer showing full ticket detail.
 *
 * Sections (scrollable):
 *   1. Header — ticket #, hot load badge, close button
 *   2. Customer & Job Site — address, site contact, gate code
 *   3. Order Details — volume, slump, pour type, requested time
 *   4. Truck & Driver — only shown when assigned
 *   5. Mix Design — ingredients and admixtures
 *   6. Status Timeline — event log
 */

import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlaceIcon from '@mui/icons-material/Place';
import PersonIcon from '@mui/icons-material/Person';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import dayjs from 'dayjs';
import type { Order } from '@/types/domain';
import { POUR_TYPE_LABELS } from '@/types/domain';
import { StatusChip } from '@/components/StatusChip';
import { StatusTimeline } from './StatusTimeline';
import { api } from '@/api/client';

interface MixDesignDetail {
  name: string;
  psi: number;
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  admixtures: Array<{ name: string; type: string; dosage: number; unit: string }>;
}

interface OrderDetailDrawerProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ color: 'text.secondary', letterSpacing: 1.2, display: 'block', mb: 0.5 }}
    >
      {children}
    </Typography>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OrderDetailDrawer({ order, open, onClose }: OrderDetailDrawerProps) {
  const [mixDetail, setMixDetail] = useState<MixDesignDetail | null>(null);
  const [mixLoading, setMixLoading] = useState(false);

  useEffect(() => {
    if (!open || !order?.mixDesignId) {
      setMixDetail(null);
      return;
    }
    setMixLoading(true);
    api.get<MixDesignDetail>(`/mix-designs/${order.mixDesignId}`)
      .then(setMixDetail)
      .catch(() => setMixDetail(null))
      .finally(() => setMixLoading(false));
  }, [open, order?.mixDesignId]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // Keep it in the DOM when closed so content doesn't flash on re-open
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          borderRadius: '12px 0 0 12px',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
            {order?.ticketNumber ?? '—'}
          </Typography>
          {order?.isHotLoad && (
            <Chip
              icon={<LocalFireDepartmentIcon />}
              label="HOT LOAD"
              size="small"
              sx={{
                bgcolor: 'error.main',
                color: '#fff',
                fontWeight: 700,
                '& .MuiChip-icon': { color: '#fff' },
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {order && <StatusChip status={order.status} />}
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close detail panel"
            sx={{ color: 'primary.contrastText' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      {order ? (
        <Box sx={{ overflowY: 'auto', flex: 1, px: 2.5, py: 2 }}>

          {/* ── Customer & Job Site ─────────────────────────────────── */}
          <SectionHeader>Customer</SectionHeader>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" fontWeight={600}>{order.customerName}</Typography>
          </Stack>
          <Stack direction="row" alignItems="flex-start" spacing={1} mb={2}>
            <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
            <Box>
              <Typography variant="body2" fontWeight={500}>{order.jobSiteName}</Typography>
              <Typography variant="caption" color="text.secondary">{order.jobSiteAddress}</Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {/* ── Order Details ───────────────────────────────────────── */}
          <SectionHeader>Order Details</SectionHeader>
          <DetailRow label="Requested Time" value={dayjs(order.requestedTime).format('ddd, MMM D · h:mm A')} />
          <DetailRow label="Volume" value={`${order.volume} yd³`} />
          <DetailRow label="Slump" value={`${order.slump}"`} />
          <DetailRow label="Pour Type" value={POUR_TYPE_LABELS[order.pourType]} />
          <DetailRow label="Mix Design" value={`${order.mixDesignName} (${order.psi} PSI)`} />
          {order.notes && (
            <Box mt={1} p={1.5} bgcolor="grey.50" borderRadius={1}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Driver Notes
              </Typography>
              <Typography variant="body2">{order.notes}</Typography>
            </Box>
          )}

          {/* ── Truck & Driver ──────────────────────────────────────── */}
          {order.assignedTruckNumber && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <SectionHeader>Truck &amp; Driver</SectionHeader>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LocalShippingIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" fontWeight={600}>
                  Truck #{order.assignedTruckNumber}
                </Typography>
              </Stack>
              {order.driverName && (
                <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                  <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">{order.driverName}</Typography>
                </Stack>
              )}
            </>
          )}

          {/* ── Mix Design Ingredients ──────────────────────────────── */}
          <Divider sx={{ my: 1.5 }} />
          <SectionHeader>Mix Design — Ingredients</SectionHeader>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            {order.mixDesignName} · {order.psi} PSI · Slump {order.slump}"
          </Typography>
          {mixLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : mixDetail ? (
            <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              {mixDetail.ingredients.length > 0 && (
                <>
                  <Typography variant="caption" fontWeight={600} display="block" mb={0.5}>Ingredients (per yd³)</Typography>
                  {mixDetail.ingredients.map((ing) => (
                    <Typography key={ing.name} variant="caption" display="block" color="text.secondary">
                      {ing.name} — {ing.quantity} {ing.unit}
                    </Typography>
                  ))}
                </>
              )}
              {mixDetail.admixtures.length > 0 && (
                <>
                  <Typography variant="caption" fontWeight={600} display="block" mt={1} mb={0.5}>Admixtures</Typography>
                  {mixDetail.admixtures.map((adm) => (
                    <Typography key={adm.name} variant="caption" display="block" color="text.secondary">
                      {adm.name} ({adm.type.replace('_', ' ')}) — {adm.dosage} {adm.unit}
                    </Typography>
                  ))}
                </>
              )}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Ingredient details unavailable.
            </Typography>
          )}

          {/* ── Status Timeline ─────────────────────────────────────── */}
          <Divider sx={{ my: 1.5 }} />
          <SectionHeader>Status Timeline</SectionHeader>
          <StatusTimeline events={order.events} currentStatus={order.status} />

          {/* Bottom padding so last item isn't flush against edge */}
          <Box sx={{ pb: 3 }} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">No order selected.</Typography>
        </Box>
      )}
    </Drawer>
  );
}
