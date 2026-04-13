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

import { useState, useEffect, useRef } from 'react';
import {
  CircularProgress,
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
import type { Order } from '@/types/domain';
import { validateOrder, type ValidationErrors } from './orderValidation';
import type { NewOrderDraft } from '@/hooks/useOrders';
import { api } from '@/api/client';
import { usePlant } from '@/context/PlantContext';

interface ApiMixDesign {
  mixDesignId: string;
  name: string;
  code: string;
  psi: number;
  slumpMin: number;
  slumpMax: number;
}

interface SearchCustomer {
  id: string;
  name: string;
  accountNumber: string;
  city: string;
  state: string;
}

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
  const { selectedPlant } = usePlant();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // ── Fetch mix designs from API ─────────────────────────────────────────
  const [mixDesigns, setMixDesigns] = useState<ApiMixDesign[]>([]);

  useEffect(() => {
    api.get<{ mixDesigns: ApiMixDesign[] }>('/mix-designs', { plantId: selectedPlant.plantId })
      .then((data) => setMixDesigns(data.mixDesigns))
      .catch(() => setMixDesigns([]));
  }, [selectedPlant.plantId]);

  // ── Debounced customer search ──────────────────────────────────────────
  const [customerInput, setCustomerInput] = useState('');
  const [customerOptions, setCustomerOptions] = useState<SearchCustomer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchCustomer | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset form and load initial customers when dialog opens
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setSubmitted(false);
      setCustomerInput('');
      setSelectedCustomer(null);
      // Fetch all customers for initial dropdown
      api.get<{ customers: SearchCustomer[] }>('/customers/search')
        .then((data) => setCustomerOptions(data.customers))
        .catch(() => setCustomerOptions([]));
    }
  }, [open]);

  // Debounced search as user types
  useEffect(() => {
    if (!open) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const params: Record<string, string> = {};
        if (customerInput.length > 0) params.q = customerInput;
        const data = await api.get<{ customers: SearchCustomer[] }>('/customers/search', params);
        setCustomerOptions(data.customers);
      } catch {
        setCustomerOptions([]);
      } finally {
        setCustomerLoading(false);
      }
    }, customerInput.length === 0 ? 0 : 300);

    return () => clearTimeout(debounceRef.current);
  }, [customerInput, open]);

  // Re-validate on change once the user has already tried to submit
  useEffect(() => {
    if (submitted) {
      setErrors(validateOrder(buildDraft(form)));
    }
  }, [form, submitted]);

  // Fetch job sites when a customer is selected
  const [jobSites, setJobSites] = useState<Array<{ siteId: string; name: string; address: string; city: string; state: string }>>([]);

  useEffect(() => {
    if (!form.customerId) {
      setJobSites([]);
      return;
    }
    api.get<{ jobSites: Array<{ siteId: string; name: string; address: string; city: string; state: string }> }>(
      `/customers/${form.customerId}/job-sites`
    )
      .then((data) => setJobSites(data.jobSites))
      .catch(() => setJobSites([]));
  }, [form.customerId]);

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

          {/* ── Customer (debounced API typeahead) ────────────────── */}
          <Grid2 size={12}>
            <Autocomplete
              options={customerOptions}
              getOptionLabel={(c) => c.name}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              filterOptions={(x) => x}
              value={selectedCustomer}
              loading={customerLoading}
              inputValue={customerInput}
              onInputChange={(_, value) => setCustomerInput(value)}
              noOptionsText={customerInput.length > 0 ? 'No customers found' : 'Start typing to search...'}
              onChange={(_, c) => {
                setSelectedCustomer(c);
                setForm((prev) => ({
                  ...prev,
                  customerId: c?.id ?? '',
                  customerName: c?.name ?? '',
                  jobSiteId: '',
                  jobSiteName: '',
                  jobSiteAddress: '',
                }));
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.accountNumber} · {option.city}, {option.state}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Customer *"
                  placeholder="Start typing to search..."
                  error={!!errors.customerId}
                  helperText={errors.customerId}
                  size="small"
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {customerLoading ? <CircularProgress color="inherit" size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
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
