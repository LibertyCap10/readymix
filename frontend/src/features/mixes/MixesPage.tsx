/**
 * MixesPage — dedicated tab for browsing, creating, and editing mix designs.
 *
 * Layout:
 *   ┌─ Toolbar ─────────────────────────────────────────────────────┐
 *   │  "Mix Designs" · plant · count · [Application chips] [+ New] │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │  AG Grid (desktop) / Card list (mobile)                      │
 *   └───────────────────────────────────────────────────────────────┘
 *   ┌─ MixDesignDetailDrawer (slides in on row click) ─────────────┐
 *   ┌─ MixDesignFormDialog (modal for create / edit) ──────────────┐
 */

import { useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { usePlant } from '@/context/PlantContext';
import { useMixDesigns } from '@/hooks/useMixDesigns';
import { MixDesignGrid } from './MixDesignGrid';
import { MobileMixList } from './MobileMixList';
import { MixDesignDetailDrawer } from './MixDesignDetailDrawer';
import { MixDesignFormDialog } from './MixDesignFormDialog';
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
      <Box
        sx={{
          px: { xs: 1.5, md: 2.5 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, md: 2 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          Mix Designs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedPlant.name} {'\u00b7'} {mixDesigns.length} design{mixDesigns.length !== 1 ? 's' : ''}
        </Typography>

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
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
        </Box>
      </Box>

      {/* ── Application filter chips ──────────────────────────────── */}
      <Box
        sx={{
          px: { xs: 1.5, md: 2.5 },
          py: 0.75,
          display: 'flex',
          gap: 0.75,
          flexWrap: 'wrap',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Chip
          label="All"
          size="small"
          variant={!filters.pourType ? 'filled' : 'outlined'}
          color={!filters.pourType ? 'primary' : 'default'}
          onClick={() => setFilters({ pourType: undefined })}
        />
        {APPLICATION_CHIPS.map(chip => (
          <Chip
            key={chip.value}
            label={chip.label}
            size="small"
            variant={filters.pourType === chip.value ? 'filled' : 'outlined'}
            color={filters.pourType === chip.value ? 'primary' : 'default'}
            onClick={() => handleApplicationFilter(chip.value)}
          />
        ))}
      </Box>

      {/* ── Error banner ──────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* ── Content area ──────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
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
