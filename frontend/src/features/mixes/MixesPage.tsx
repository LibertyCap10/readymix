/**
 * MixesPage — dedicated tab for browsing, creating, and editing mix designs.
 *
 * Layout:
 *   ┌─ PageHeader ─────────────────────────────────────────────┐
 *   │  "Mix Designs" · plant · count · [Show inactive] [+ New] │
 *   │  [Application chips: All | Driveway | Sidewalk | ...]     │
 *   ├───────────────────────────────────────────────────────────┤
 *   │  AG Grid (desktop) / Card list (mobile)                  │
 *   └──────────────────────────────────────────────────────────┘
 */

import { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ScienceIcon from '@mui/icons-material/Science';
import { usePlant } from '@/context/PlantContext';
import { useMixDesigns } from '@/hooks/useMixDesigns';
import { MixDesignGrid } from './MixDesignGrid';
import { MobileMixList } from './MobileMixList';
import { MixDesignDetailDrawer } from './MixDesignDetailDrawer';
import { MixDesignFormDialog } from './MixDesignFormDialog';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonGrid, SkeletonCards } from '@/components/SkeletonLoader';
import type { MixDesign, MixDesignDraft, PourType } from '@/types/domain';

// ─── Filter chip config ──────────────────────────────────────────────────────

const APPLICATION_CHIPS: Array<{ value: PourType; label: string }> = [
  { value: 'driveway', label: 'Driveway' },
  { value: 'sidewalk', label: 'Sidewalk' },
  { value: 'slab', label: 'Slab' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'wall', label: 'Wall' },
  { value: 'column', label: 'Column' },
  { value: 'footing', label: 'Footing' },
  { value: 'grade_beam', label: 'Grade Beam' },
];

// Softer colors for pour type chips when active
const POUR_TYPE_COLORS: Record<PourType, { bg: string; text: string }> = {
  driveway: { bg: '#E3F2FD', text: '#1565C0' },
  sidewalk: { bg: '#E8F5E9', text: '#2E7D32' },
  slab: { bg: '#FFF3E0', text: '#E65100' },
  foundation: { bg: '#EDE7F6', text: '#4527A0' },
  wall: { bg: '#E0F2F1', text: '#00695C' },
  column: { bg: '#FCE4EC', text: '#AD1457' },
  footing: { bg: '#E8EAF6', text: '#283593' },
  grade_beam: { bg: '#FFF8E1', text: '#F57F17' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function MixesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedPlant } = usePlant();

  const {
    mixDesigns,
    loading,
    error,
    filters,
    setFilters,
    ingredientOptions,
    admixtureOptions,
    createMixDesign,
    updateMixDesign,
    toggleActive,
    getMixDesignDetail,
  } = useMixDesigns();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMix, setSelectedMix] = useState<MixDesign | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editMix, setEditMix] = useState<MixDesign | null>(null);

  const handleRowClick = useCallback((mix: MixDesign) => {
    setSelectedMix(mix);
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedMix(null);
  }, []);

  const handleNewMix = useCallback(() => {
    setEditMix(null);
    setFormOpen(true);
  }, []);

  const handleEditMix = useCallback((mix: MixDesign) => {
    setEditMix(mix);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(async (draft: MixDesignDraft) => {
    if (editMix) {
      await updateMixDesign(editMix.code, draft);
    } else {
      await createMixDesign(draft);
    }
  }, [editMix, createMixDesign, updateMixDesign]);

  const handleApplicationFilter = useCallback(
    (pt: PourType) => {
      setFilters({ pourType: filters.pourType === pt ? undefined : pt });
    },
    [filters.pourType, setFilters],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Page header / toolbar ──────────────────────────────────── */}
      <PageHeader
        title="Mix Designs"
        subtitle={`${selectedPlant.name} \u00b7 ${mixDesigns.length} design${mixDesigns.length !== 1 ? 's' : ''}`}
        rightContent={
          <>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={filters.includeInactive}
                  onChange={(_, checked) => setFilters({ includeInactive: checked })}
                />
              }
              label={<Typography variant="caption">Show inactive</Typography>}
              sx={{ mr: 0 }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleNewMix}
            >
              New Mix
            </Button>
          </>
        }
        bottomContent={
          <Box
            sx={{
              display: 'flex',
              gap: 0.75,
              flexWrap: 'wrap',
            }}
          >
            <Chip
              label="All"
              size="small"
              onClick={() => setFilters({ pourType: undefined })}
              sx={{
                cursor: 'pointer',
                fontWeight: !filters.pourType ? 700 : 400,
                bgcolor: !filters.pourType ? 'primary.main' : 'transparent',
                color: !filters.pourType ? 'primary.contrastText' : 'text.secondary',
                border: '1px solid',
                borderColor: !filters.pourType ? 'primary.main' : 'divider',
                '&:hover': { bgcolor: !filters.pourType ? 'primary.main' : 'action.hover' },
              }}
            />
            {APPLICATION_CHIPS.map(chip => {
              const isActive = filters.pourType === chip.value;
              const colors = POUR_TYPE_COLORS[chip.value];
              return (
                <Chip
                  key={chip.value}
                  label={chip.label}
                  size="small"
                  onClick={() => handleApplicationFilter(chip.value)}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: isActive ? 700 : 400,
                    bgcolor: isActive ? colors.bg : 'transparent',
                    color: isActive ? colors.text : 'text.secondary',
                    border: '1px solid',
                    borderColor: isActive ? colors.text : 'divider',
                    '&:hover': { bgcolor: colors.bg },
                  }}
                />
              );
            })}
          </Box>
        }
      />

      {/* ── Error banner ──────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* ── Content area ──────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          isMobile ? <SkeletonCards count={4} /> : <SkeletonGrid rows={6} />
        ) : mixDesigns.length === 0 ? (
          <EmptyState
            icon={ScienceIcon}
            title="No mix designs found"
            description={filters.pourType ? `No designs matching "${filters.pourType}" application.` : 'No mix designs available for this plant.'}
            action={
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleNewMix}>
                New Mix
              </Button>
            }
          />
        ) : isMobile ? (
          <MobileMixList mixDesigns={mixDesigns} onMixClick={handleRowClick} />
        ) : (
          <Box sx={{ height: '100%', p: 2 }}>
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', height: '100%' }}
            >
              <MixDesignGrid mixDesigns={mixDesigns} onRowClick={handleRowClick} />
            </Paper>
          </Box>
        )}
      </Box>

      {/* ── Detail Drawer ──────────────────────────────────────────── */}
      <MixDesignDetailDrawer
        mix={selectedMix}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        onEdit={handleEditMix}
        getMixDesignDetail={getMixDesignDetail}
        toggleActive={toggleActive}
      />

      {/* ── Form Dialog ───────────────────────────────────────────── */}
      <MixDesignFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        editMix={editMix}
        ingredientOptions={ingredientOptions}
        admixtureOptions={admixtureOptions}
      />
    </Box>
  );
}
