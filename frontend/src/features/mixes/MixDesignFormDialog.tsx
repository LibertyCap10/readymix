/**
 * MixDesignFormDialog — MUI Dialog for creating / editing a mix design.
 *
 * Sections:
 *   1. Basic fields — code, name, PSI, slump range, description, yield, cost
 *   2. Applications — multi-select checkboxes for pour types
 *   3. Ingredients — dynamic list with Autocomplete + quantity + unit
 *   4. Admixtures — dynamic list with Autocomplete + dosage + unit
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid2,
  TextField,
  Autocomplete,
  Typography,
  Box,
  IconButton,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type {
  MixDesign,
  MixDesignDraft,
  PourType,
  IngredientOption,
  AdmixtureOption,
} from '@/types/domain';

const POUR_TYPES: Array<{ value: PourType; label: string }> = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'slab', label: 'Slab' },
  { value: 'wall', label: 'Wall' },
  { value: 'driveway', label: 'Driveway' },
  { value: 'sidewalk', label: 'Sidewalk' },
  { value: 'column', label: 'Column' },
  { value: 'footing', label: 'Footing' },
  { value: 'grade_beam', label: 'Grade Beam' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface IngredientRow {
  ingredientId: string;
  name: string;
  quantity: string;
  unit: string;
}

interface AdmixtureRow {
  admixtureId: string;
  name: string;
  dosage: string;
  unit: string;
}

interface FormState {
  code: string;
  name: string;
  psi: string;
  slumpMin: string;
  slumpMax: string;
  description: string;
  yieldPerBatch: string;
  costPerYard: string;
  applications: PourType[];
  ingredients: IngredientRow[];
  admixtures: AdmixtureRow[];
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  psi: '',
  slumpMin: '3',
  slumpMax: '6',
  description: '',
  yieldPerBatch: '9.0',
  costPerYard: '',
  applications: [],
  ingredients: [{ ingredientId: '', name: '', quantity: '', unit: 'lbs' }],
  admixtures: [],
};

interface FormErrors {
  code?: string;
  name?: string;
  psi?: string;
  slump?: string;
  ingredients?: string;
}

function validate(form: FormState, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!isEdit && !form.code.trim()) errors.code = 'Code is required.';
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (!form.psi || Number(form.psi) <= 0) errors.psi = 'PSI must be greater than 0.';
  if (Number(form.slumpMin) >= Number(form.slumpMax)) errors.slump = 'Slump min must be less than max.';
  const validIngredients = form.ingredients.filter(i => i.ingredientId && Number(i.quantity) > 0);
  if (validIngredients.length === 0) errors.ingredients = 'At least one ingredient is required.';
  return errors;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface MixDesignFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: MixDesignDraft) => Promise<unknown>;
  editMix?: MixDesign | null;
  ingredientOptions: IngredientOption[];
  admixtureOptions: AdmixtureOption[];
}

export function MixDesignFormDialog({
  open,
  onClose,
  onSubmit,
  editMix,
  ingredientOptions,
  admixtureOptions,
}: MixDesignFormDialogProps) {
  const isEdit = !!editMix;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    if (editMix) {
      setForm({
        code: editMix.code,
        name: editMix.name,
        psi: String(editMix.psi),
        slumpMin: String(editMix.slumpMin),
        slumpMax: String(editMix.slumpMax),
        description: editMix.description ?? '',
        yieldPerBatch: editMix.yieldPerBatch != null ? String(editMix.yieldPerBatch) : '',
        costPerYard: editMix.costPerYard != null ? String(editMix.costPerYard) : '',
        applications: editMix.applications ?? [],
        ingredients: editMix.ingredients.length > 0
          ? editMix.ingredients.map(i => ({
              ingredientId: i.ingredientId,
              name: i.name,
              quantity: String(i.quantity),
              unit: i.unit,
            }))
          : [{ ingredientId: '', name: '', quantity: '', unit: 'lbs' }],
        admixtures: editMix.admixtures.map(a => ({
          admixtureId: a.admixtureId,
          name: a.name,
          dosage: String(a.dosage),
          unit: a.unit,
        })),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setApiError(null);
  }, [open, editMix]);

  const updateField = (field: keyof FormState, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleApplication = (pt: PourType) => {
    setForm(prev => ({
      ...prev,
      applications: prev.applications.includes(pt)
        ? prev.applications.filter(a => a !== pt)
        : [...prev.applications, pt],
    }));
  };

  // Ingredient row management
  const addIngredientRow = () =>
    setForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { ingredientId: '', name: '', quantity: '', unit: 'lbs' }],
    }));

  const removeIngredientRow = (idx: number) =>
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));

  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) =>
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    }));

  // Admixture row management
  const addAdmixtureRow = () =>
    setForm(prev => ({
      ...prev,
      admixtures: [...prev.admixtures, { admixtureId: '', name: '', dosage: '', unit: 'oz' }],
    }));

  const removeAdmixtureRow = (idx: number) =>
    setForm(prev => ({
      ...prev,
      admixtures: prev.admixtures.filter((_, i) => i !== idx),
    }));

  const updateAdmixture = (idx: number, field: keyof AdmixtureRow, value: string) =>
    setForm(prev => ({
      ...prev,
      admixtures: prev.admixtures.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    }));

  const handleSubmit = async () => {
    const errs = validate(form, isEdit);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setApiError(null);

    try {
      const draft: MixDesignDraft = {
        code: form.code.trim(),
        name: form.name.trim(),
        psi: Number(form.psi),
        slumpMin: Number(form.slumpMin),
        slumpMax: Number(form.slumpMax),
        description: form.description.trim(),
        yieldPerBatch: form.yieldPerBatch ? Number(form.yieldPerBatch) : '',
        costPerYard: form.costPerYard ? Number(form.costPerYard) : '',
        applications: form.applications,
        ingredients: form.ingredients
          .filter(i => i.ingredientId && Number(i.quantity) > 0)
          .map(i => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity), unit: i.unit })),
        admixtures: form.admixtures
          .filter(a => a.admixtureId && Number(a.dosage) > 0)
          .map(a => ({ admixtureId: a.admixtureId, dosage: Number(a.dosage), unit: a.unit })),
      };
      await onSubmit(draft);
      onClose();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? 'Failed to save mix design';
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Mix Design' : 'New Mix Design'}</DialogTitle>
      <DialogContent dividers>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

        {/* ── Basic Fields ───────────────────────────────────────────── */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Basic Information
        </Typography>
        <Grid2 container spacing={2}>
          <Grid2 size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Code"
              fullWidth
              size="small"
              value={form.code}
              onChange={e => updateField('code', e.target.value)}
              error={!!errors.code}
              helperText={errors.code}
              disabled={isEdit}
            />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 8 }}>
            <TextField
              label="Name"
              fullWidth
              size="small"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
            />
          </Grid2>
          <Grid2 size={{ xs: 6, sm: 3 }}>
            <TextField
              label="PSI Rating"
              fullWidth
              size="small"
              type="number"
              value={form.psi}
              onChange={e => updateField('psi', e.target.value)}
              error={!!errors.psi}
              helperText={errors.psi}
            />
          </Grid2>
          <Grid2 size={{ xs: 3, sm: 2 }}>
            <TextField
              label="Slump Min"
              fullWidth
              size="small"
              type="number"
              value={form.slumpMin}
              onChange={e => updateField('slumpMin', e.target.value)}
              error={!!errors.slump}
            />
          </Grid2>
          <Grid2 size={{ xs: 3, sm: 2 }}>
            <TextField
              label="Slump Max"
              fullWidth
              size="small"
              type="number"
              value={form.slumpMax}
              onChange={e => updateField('slumpMax', e.target.value)}
              error={!!errors.slump}
              helperText={errors.slump}
            />
          </Grid2>
          <Grid2 size={{ xs: 6, sm: 2.5 }}>
            <TextField
              label="Yield / Batch"
              fullWidth
              size="small"
              type="number"
              value={form.yieldPerBatch}
              onChange={e => updateField('yieldPerBatch', e.target.value)}
              slotProps={{ htmlInput: { step: 0.5 } }}
            />
          </Grid2>
          <Grid2 size={{ xs: 6, sm: 2.5 }}>
            <TextField
              label="Cost / Yard ($)"
              fullWidth
              size="small"
              type="number"
              value={form.costPerYard}
              onChange={e => updateField('costPerYard', e.target.value)}
              slotProps={{ htmlInput: { step: 0.01 } }}
            />
          </Grid2>
          <Grid2 size={12}>
            <TextField
              label="Description"
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={4}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
            />
          </Grid2>
        </Grid2>

        {/* ── Applications ────────────────────────────────────────────── */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Recommended Applications
        </Typography>
        <FormGroup row>
          {POUR_TYPES.map(pt => (
            <FormControlLabel
              key={pt.value}
              control={
                <Checkbox
                  size="small"
                  checked={form.applications.includes(pt.value)}
                  onChange={() => toggleApplication(pt.value)}
                />
              }
              label={<Typography variant="body2">{pt.label}</Typography>}
              sx={{ mr: 2 }}
            />
          ))}
        </FormGroup>

        {/* ── Ingredients ─────────────────────────────────────────────── */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Ingredients (per yd{'\u00b3'})
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addIngredientRow}>
            Add
          </Button>
        </Box>
        {errors.ingredients && (
          <Alert severity="error" sx={{ mb: 1 }}>{errors.ingredients}</Alert>
        )}
        {form.ingredients.map((row, idx) => (
          <Grid2 container spacing={1} key={idx} sx={{ mb: 1, alignItems: 'center' }}>
            <Grid2 size={{ xs: 12, sm: 5 }}>
              <Autocomplete
                size="small"
                options={ingredientOptions}
                getOptionLabel={o => o.name}
                value={ingredientOptions.find(o => o.ingredientId === row.ingredientId) ?? null}
                onChange={(_, opt) => {
                  if (opt) {
                    const updated = [...form.ingredients];
                    updated[idx] = { ...updated[idx], ingredientId: opt.ingredientId, name: opt.name, unit: opt.unit };
                    setForm(prev => ({ ...prev, ingredients: updated }));
                  }
                }}
                renderInput={params => <TextField {...params} label="Ingredient" />}
              />
            </Grid2>
            <Grid2 size={{ xs: 5, sm: 3 }}>
              <TextField
                label="Quantity"
                fullWidth
                size="small"
                type="number"
                value={row.quantity}
                onChange={e => updateIngredient(idx, 'quantity', e.target.value)}
              />
            </Grid2>
            <Grid2 size={{ xs: 5, sm: 3 }}>
              <TextField
                label="Unit"
                fullWidth
                size="small"
                value={row.unit}
                onChange={e => updateIngredient(idx, 'unit', e.target.value)}
              />
            </Grid2>
            <Grid2 size={{ xs: 2, sm: 1 }}>
              <IconButton
                size="small"
                onClick={() => removeIngredientRow(idx)}
                disabled={form.ingredients.length <= 1}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Grid2>
          </Grid2>
        ))}

        {/* ── Admixtures ──────────────────────────────────────────────── */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Admixtures
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addAdmixtureRow}>
            Add
          </Button>
        </Box>
        {form.admixtures.map((row, idx) => (
          <Grid2 container spacing={1} key={idx} sx={{ mb: 1, alignItems: 'center' }}>
            <Grid2 size={{ xs: 12, sm: 5 }}>
              <Autocomplete
                size="small"
                options={admixtureOptions}
                getOptionLabel={o => `${o.name} (${o.type.replace(/_/g, ' ')})`}
                value={admixtureOptions.find(o => o.admixtureId === row.admixtureId) ?? null}
                onChange={(_, opt) => {
                  if (opt) {
                    const updated = [...form.admixtures];
                    updated[idx] = { ...updated[idx], admixtureId: opt.admixtureId, name: opt.name, unit: opt.unit };
                    setForm(prev => ({ ...prev, admixtures: updated }));
                  }
                }}
                renderInput={params => <TextField {...params} label="Admixture" />}
              />
            </Grid2>
            <Grid2 size={{ xs: 5, sm: 3 }}>
              <TextField
                label="Dosage"
                fullWidth
                size="small"
                type="number"
                value={row.dosage}
                onChange={e => updateAdmixture(idx, 'dosage', e.target.value)}
              />
            </Grid2>
            <Grid2 size={{ xs: 5, sm: 3 }}>
              <TextField
                label="Unit"
                fullWidth
                size="small"
                value={row.unit}
                onChange={e => updateAdmixture(idx, 'unit', e.target.value)}
              />
            </Grid2>
            <Grid2 size={{ xs: 2, sm: 1 }}>
              <IconButton size="small" onClick={() => removeAdmixtureRow(idx)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Grid2>
          </Grid2>
        ))}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
