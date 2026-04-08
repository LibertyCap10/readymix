/**
 * NewOrderDialog — MUI Dialog for creating a new delivery ticket.
 *
 * Field summary:
 *   Customer (Autocomplete typeahead)
 *   Job Site  (Select, filtered by chosen customer)
 *   Mix Design (Select)
 *   Volume    (number input, 0.5–12 yd³)
 *   Slump     (number input, 2–10")
 *   Pour Type (Select)
 *   Requested Time (DateTimePicker)
 *   Hot Load  (Switch)
 *   Notes     (optional textarea)
 *
 * Validation runs on submit via validateOrder() from orderValidation.ts.
 * Phase 6: the createOrder call will be swapped to an API POST; the form
 *           logic itself doesn't change.
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
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { customers, mixDesigns } from '@/mocks';
import type { Order } from '@/mocks/types';
import { validateOrder, type ValidationErrors } from './orderValidation';
import type { NewOrderDraft } from '@/hooks/useOrders';

const POUR_TYPES: Array<{ value: Order['pourType']; label: string }> = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'slab',       label: 'Slab' },
  { value: 'wall',       label: 'Wall' },
  { value: 'driveway',   label: 'Driveway' },
  { value: 'sidewalk',   label: 'Sidewalk' },
  { value: 'column',     label: 'Column' },
  { value: 'footing',    label: 'Footing' },
  { value: 'grade_beam', label: 'Grade Beam' },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  customerId: string;
  customerName: string;
  jobSiteId: string;
  jobSiteName: string;
  jobSiteAddress: string;
  mixDesignId: string;
  mixDesignName: string;
  psi: number;
  volume: string;       // kept as string while typing
  slump: string;
  pourType: Order['pourType'] | '';
  requestedTime: Dayjs | null;
  isHotLoad: boolean;
  notes: string;
}

const EMPTY_FORM: FormState = {
  customerId: '',
  customerName: '',
  jobSiteId: '',
  jobSiteName: '',
  jobSiteAddress: '',
  mixDesignId: '',
  mixDesignName: '',
  psi: 0,
  volume: '',
  slump: '',
  pourType: '',
  requestedTime: null,
  isHotLoad: false,
  notes: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface NewOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: NewOrderDraft) => void;
}

export function NewOrderDialog({ open, onClose, onSubmit }: NewOrderDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setSubmitted(false);
    }
  }, [open]);

  // Re-validate on change once the user has already tried to submit
  useEffect(() => {
    if (submitted) {
      setErrors(validateOrder(buildDraft(form)));
    }
  }, [form, submitted]);

  const selectedCustomer = customers.find((c) => c.customerId === form.customerId) ?? null;
  const jobSites = selectedCustomer?.jobSites ?? [];

  function buildDraft(f: FormState): Partial<NewOrderDraft> {
    return {
      customerId: f.customerId || undefined,
      customerName: f.customerName || undefined,
      jobSiteId: f.jobSiteId || undefined,
      jobSiteName: f.jobSiteName || undefined,
      jobSiteAddress: f.jobSiteAddress || undefined,
      mixDesignId: f.mixDesignId || undefined,
      mixDesignName: f.mixDesignName || undefined,
      psi: f.psi || undefined,
      volume: f.volume ? parseFloat(f.volume) : undefined,
      slump: f.slump ? parseFloat(f.slump) : undefined,
      pourType: (f.pourType as Order['pourType']) || undefined,
      requestedTime: f.requestedTime?.toISOString() ?? undefined,
      isHotLoad: f.isHotLoad,
      notes: f.notes || undefined,
    };
  }

  function handleSubmit() {
    setSubmitted(true);
    const draft = buildDraft(form);
    const validationErrors = validateOrder(draft);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    onSubmit(draft as NewOrderDraft);
    onClose();
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New Delivery Order</DialogTitle>

      <DialogContent dividers>
        <Grid2 container spacing={2}>

          {/* ── Customer ──────────────────────────────────────────── */}
          <Grid2 size={12}>
            <Autocomplete
              options={customers}
              getOptionLabel={(c) => c.name}
              value={selectedCustomer}
              onChange={(_, c) => {
                setForm((prev) => ({
                  ...prev,
                  customerId: c?.customerId ?? '',
                  customerName: c?.name ?? '',
                  // Reset job site when customer changes
                  jobSiteId: '',
                  jobSiteName: '',
                  jobSiteAddress: '',
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Customer *"
                  error={!!errors.customerId}
                  helperText={errors.customerId}
                  size="small"
                />
              )}
            />
          </Grid2>

          {/* ── Job Site ───────────────────────────────────────────── */}
          <Grid2 size={12}>
            <TextField
              select
              fullWidth
              size="small"
              label="Job Site *"
              value={form.jobSiteId}
              onChange={(e) => {
                const site = jobSites.find((s) => s.siteId === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  jobSiteId: site?.siteId ?? '',
                  jobSiteName: site?.name ?? '',
                  jobSiteAddress: site ? `${site.address}, ${site.city}, ${site.state}` : '',
                }));
              }}
              disabled={!form.customerId}
              error={!!errors.jobSiteId}
              helperText={errors.jobSiteId ?? (!form.customerId ? 'Select a customer first' : '')}
            >
              {jobSites.map((site) => (
                <MenuItem key={site.siteId} value={site.siteId}>
                  <Box>
                    <Typography variant="body2">{site.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {site.address}, {site.city}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Grid2>

          {/* ── Mix Design ─────────────────────────────────────────── */}
          <Grid2 size={12}>
            <TextField
              select
              fullWidth
              size="small"
              label="Mix Design *"
              value={form.mixDesignId}
              onChange={(e) => {
                const mix = mixDesigns.find((m) => m.mixDesignId === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  mixDesignId: mix?.mixDesignId ?? '',
                  mixDesignName: mix?.name ?? '',
                  psi: mix?.psi ?? 0,
                  // Pre-fill slump midpoint
                  slump: mix ? String((mix.slumpMin + mix.slumpMax) / 2) : prev.slump,
                }));
              }}
              error={!!errors.mixDesignId}
              helperText={errors.mixDesignId}
            >
              {mixDesigns.map((mix) => (
                <MenuItem key={mix.mixDesignId} value={mix.mixDesignId}>
                  <Box>
                    <Typography variant="body2">{mix.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {mix.psi} PSI · Slump {mix.slumpMin}–{mix.slumpMax}"
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Grid2>

          {/* ── Volume & Slump ─────────────────────────────────────── */}
          <Grid2 size={6}>
            <TextField
              fullWidth
              size="small"
              label="Volume (yd³) *"
              type="number"
              inputProps={{ min: 0.5, max: 12, step: 0.5 }}
              value={form.volume}
              onChange={(e) => set('volume', e.target.value)}
              error={!!errors.volume}
              helperText={errors.volume ?? '0.5 – 12 yd³'}
            />
          </Grid2>
          <Grid2 size={6}>
            <TextField
              fullWidth
              size="small"
              label='Slump (") *'
              type="number"
              inputProps={{ min: 2, max: 10, step: 0.5 }}
              value={form.slump}
              onChange={(e) => set('slump', e.target.value)}
              error={!!errors.slump}
              helperText={errors.slump ?? '2 – 10"'}
            />
          </Grid2>

          {/* ── Pour Type ──────────────────────────────────────────── */}
          <Grid2 size={12}>
            <TextField
              select
              fullWidth
              size="small"
              label="Pour Type *"
              value={form.pourType}
              onChange={(e) => set('pourType', e.target.value as Order['pourType'])}
              error={!!errors.pourType}
              helperText={errors.pourType}
            >
              {POUR_TYPES.map((pt) => (
                <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>
              ))}
            </TextField>
          </Grid2>

          {/* ── Requested Time ─────────────────────────────────────── */}
          <Grid2 size={12}>
            <DateTimePicker
              label="Requested Delivery Time *"
              value={form.requestedTime}
              onChange={(dt) => set('requestedTime', dt)}
              minDateTime={dayjs().subtract(5, 'minute')}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  error: !!errors.requestedTime,
                  helperText: errors.requestedTime,
                },
              }}
            />
          </Grid2>

          {/* ── Hot Load ───────────────────────────────────────────── */}
          <Grid2 size={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isHotLoad}
                  onChange={(e) => set('isHotLoad', e.target.checked)}
                  color="error"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Hot Load</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Priority dispatch — concrete has tight placement window
                  </Typography>
                </Box>
              }
            />
          </Grid2>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <Grid2 size={12}>
            <TextField
              fullWidth
              size="small"
              label="Driver Notes (optional)"
              multiline
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Gate code, site contact, special instructions…"
            />
          </Grid2>

          {/* ── Submission error summary ───────────────────────────── */}
          {submitted && Object.keys(errors).length > 0 && (
            <Grid2 size={12}>
              <Alert severity="error" variant="outlined">
                Please fix the errors above before submitting.
              </Alert>
            </Grid2>
          )}

        </Grid2>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="secondary">
          Create Order
        </Button>
      </DialogActions>
    </Dialog>
  );
}
