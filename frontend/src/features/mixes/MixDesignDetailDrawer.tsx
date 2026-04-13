/**
 * MixDesignDetailDrawer — right-side drawer showing full mix design detail.
 *
 * Sections:
 *   1. Header — code, name, PSI badge, active indicator
 *   2. Overview — description, slump, yield, cost
 *   3. Applications — pour type chips
 *   4. Ingredients — table
 *   5. Admixtures — table
 *   6. Footer — Edit + Deactivate buttons
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
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CircleIcon from '@mui/icons-material/Circle';
import { POUR_TYPE_LABELS } from '@/types/domain';
import type { MixDesign } from '@/types/domain';
import type { UseMixDesignsReturn } from '@/hooks/useMixDesigns';

// ─── Sub-components ──────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────────

interface MixDesignDetailDrawerProps {
  mix: MixDesign | null;
  open: boolean;
  onClose: () => void;
  onEdit: (mix: MixDesign) => void;
  getMixDesignDetail: UseMixDesignsReturn['getMixDesignDetail'];
  toggleActive: UseMixDesignsReturn['toggleActive'];
}

export function MixDesignDetailDrawer({
  mix,
  open,
  onClose,
  onEdit,
  getMixDesignDetail,
  toggleActive,
}: MixDesignDetailDrawerProps) {
  const [detail, setDetail] = useState<MixDesign | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !mix?.code) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getMixDesignDetail(mix.code)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, mix?.code, getMixDesignDetail]);

  const handleToggleActive = async () => {
    if (!mix) return;
    await toggleActive(mix.code, !mix.isActive);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      {!mix ? null : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* ── Header ──────────────────────────────────────────────── */}
          <Box
            sx={{
              px: 2.5,
              py: 2,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {mix.code}
                </Typography>
                <CircleIcon sx={{ fontSize: 10, color: mix.isActive ? 'success.main' : 'text.disabled' }} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {mix.name}
              </Typography>
              <Chip
                label={`${mix.psi.toLocaleString()} PSI`}
                size="small"
                sx={{ mt: 0.75, fontWeight: 600, bgcolor: '#37474F', color: '#fff' }}
              />
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* ── Scrollable content ──────────────────────────────────── */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : detail ? (
              <>
                {/* Overview */}
                <SectionHeader>Overview</SectionHeader>
                {detail.description && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {detail.description}
                  </Typography>
                )}
                <DetailRow label="Slump Range" value={`${detail.slumpMin}-${detail.slumpMax}"`} />
                {detail.yieldPerBatch != null && (
                  <DetailRow label="Yield / Batch" value={`${detail.yieldPerBatch} yd\u00b3`} />
                )}
                {detail.costPerYard != null && (
                  <DetailRow label="Cost / Yard" value={`$${Number(detail.costPerYard).toFixed(2)}`} />
                )}

                {/* Applications */}
                {detail.applications.length > 0 && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <SectionHeader>Recommended Applications</SectionHeader>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
                      {detail.applications.map(pt => (
                        <Chip
                          key={pt}
                          label={POUR_TYPE_LABELS[pt] ?? pt}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </>
                )}

                {/* Ingredients */}
                <Divider sx={{ my: 1.5 }} />
                <SectionHeader>Ingredients (per yd\u00b3)</SectionHeader>
                <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  {detail.ingredients.length > 0 ? (
                    detail.ingredients.map(ing => (
                      <Typography key={ing.name} variant="caption" display="block" color="text.secondary">
                        {ing.name} -- {ing.quantity} {ing.unit}
                      </Typography>
                    ))
                  ) : (
                    <Typography variant="caption" color="text.secondary">No ingredients listed.</Typography>
                  )}
                </Box>

                {/* Admixtures */}
                {detail.admixtures.length > 0 && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <SectionHeader>Admixtures</SectionHeader>
                    <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      {detail.admixtures.map(adm => (
                        <Typography key={adm.name} variant="caption" display="block" color="text.secondary">
                          {adm.name} ({adm.type.replace(/_/g, ' ')}) -- {adm.dosage} {adm.unit}
                        </Typography>
                      ))}
                    </Box>
                  </>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Details unavailable.
              </Typography>
            )}
          </Box>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              gap: 1,
            }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => { onEdit(detail ?? mix); onClose(); }}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              size="small"
              color={mix.isActive ? 'error' : 'success'}
              onClick={handleToggleActive}
            >
              {mix.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
