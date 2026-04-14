/**
 * MapToolbar — compact filter bar for the dispatch map page.
 *
 * Desktop: single-row with date picker, status chips, search, toggles.
 * Mobile: two rows — date + filter button on top, scrollable chips below.
 */

import { useCallback } from 'react';
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TimelineIcon from '@mui/icons-material/Timeline';
import { orderStatusColors } from '@/theme/statusColors';
import type { OrderStatus } from '@/theme/statusColors';

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending',    label: 'Pending' },
  { value: 'scheduled',  label: 'Scheduled' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'pouring',    label: 'Pouring' },
  { value: 'returning',  label: 'Returning' },
  { value: 'complete',   label: 'Complete' },
  { value: 'cancelled',  label: 'Cancelled' },
];

interface MapToolbarProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  statusFilters: Set<OrderStatus>;
  onToggleStatus: (status: OrderStatus) => void;
  statusCounts: Record<OrderStatus, number>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hotLoadOnly: boolean;
  onHotLoadToggle: () => void;
  showTrucks: boolean;
  onTrucksToggle: () => void;
  showAllRoutes: boolean;
  onRoutesToggle: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

export function MapToolbar({
  selectedDate,
  onDateChange,
  statusFilters,
  onToggleStatus,
  statusCounts,
  searchQuery,
  onSearchChange,
  hotLoadOnly,
  onHotLoadToggle,
  showTrucks,
  onTrucksToggle,
  showAllRoutes,
  onRoutesToggle,
  isFiltered,
  onClearFilters,
  filteredCount,
  totalCount,
}: MapToolbarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDateChange = useCallback(
    (dt: Dayjs | null) => {
      if (dt?.isValid()) onDateChange(dt.format('YYYY-MM-DD'));
    },
    [onDateChange],
  );

  const handlePrevDay = useCallback(() => {
    onDateChange(dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD'));
  }, [selectedDate, onDateChange]);

  const handleNextDay = useCallback(() => {
    onDateChange(dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD'));
  }, [selectedDate, onDateChange]);

  return (
    <Paper
      elevation={0}
      sx={{
        px: { xs: 1, md: 2 },
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      {/* Row 1: Date picker, toggles, search */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton
            size="small"
            onClick={handlePrevDay}
            sx={{ width: 32, height: 32, border: '1px solid', borderColor: 'divider' }}
          >
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={handleDateChange}
            slotProps={{
              textField: {
                size: 'small',
                sx: { width: { xs: 130, sm: 160 } },
              },
            }}
          />
          <IconButton
            size="small"
            onClick={handleNextDay}
            sx={{ width: 32, height: 32, border: '1px solid', borderColor: 'divider' }}
          >
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Stack>

        {/* Order count summary */}
        {isFiltered && (
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
            {filteredCount} of {totalCount}
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Search */}
        {!isMobile && (
          <TextField
            size="small"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => onSearchChange('')} edge="end">
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
            sx={{ width: 200, '& .MuiOutlinedInput-root': { height: 32 } }}
          />
        )}

        {/* Toggle buttons */}
        <Tooltip title={hotLoadOnly ? 'Showing hot loads only' : 'Show hot loads only'}>
          <IconButton
            size="small"
            onClick={onHotLoadToggle}
            sx={{
              bgcolor: hotLoadOnly ? '#FFEBEE' : 'transparent',
              color: hotLoadOnly ? '#C62828' : 'text.secondary',
              border: '1px solid',
              borderColor: hotLoadOnly ? '#C62828' : 'divider',
              width: 32,
              height: 32,
            }}
          >
            <LocalFireDepartmentIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={showTrucks ? 'Hide trucks' : 'Show trucks'}>
          <IconButton
            size="small"
            onClick={onTrucksToggle}
            sx={{
              bgcolor: showTrucks ? 'primary.main' : 'transparent',
              color: showTrucks ? 'white' : 'text.secondary',
              border: '1px solid',
              borderColor: showTrucks ? 'primary.main' : 'divider',
              width: 32,
              height: 32,
              '&:hover': { bgcolor: showTrucks ? 'primary.dark' : 'action.hover' },
            }}
          >
            <LocalShippingIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={showAllRoutes ? 'Show selected route only' : 'Show all routes'}>
          <IconButton
            size="small"
            onClick={onRoutesToggle}
            sx={{
              bgcolor: showAllRoutes ? 'primary.main' : 'transparent',
              color: showAllRoutes ? 'white' : 'text.secondary',
              border: '1px solid',
              borderColor: showAllRoutes ? 'primary.main' : 'divider',
              width: 32,
              height: 32,
              '&:hover': { bgcolor: showAllRoutes ? 'primary.dark' : 'action.hover' },
            }}
          >
            <TimelineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {isFiltered && (
          <Tooltip title="Clear all filters">
            <IconButton size="small" onClick={onClearFilters} sx={{ width: 32, height: 32 }}>
              <ClearIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Row 2: Status filter chips — horizontally scrollable */}
      <Stack direction="row" spacing={0.5}>
        {/* Mobile search (inline) */}
        {isMobile && (
          <TextField
            size="small"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: 120, flexShrink: 0, '& .MuiOutlinedInput-root': { height: 28 } }}
          />
        )}

        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            overflowX: 'auto',
            pb: 0.25,
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {STATUS_OPTIONS.map(({ value, label }) => {
            const count = statusCounts[value] ?? 0;
            const isActive = statusFilters.has(value);
            const colors = orderStatusColors[value];

            return (
              <Chip
                key={value}
                label={`${label}${count > 0 ? ` (${count})` : ''}`}
                onClick={() => onToggleStatus(value)}
                size="small"
                sx={{
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: isActive ? 700 : 400,
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  height: { xs: 24, sm: 28 },
                  bgcolor: isActive ? (colors?.background ?? 'primary.main') : 'transparent',
                  color: isActive ? (colors?.text ?? 'primary.contrastText') : 'text.disabled',
                  border: '1px solid',
                  borderColor: isActive ? (colors?.text ?? 'primary.main') : 'divider',
                  opacity: isActive ? 1 : 0.6,
                  '&:hover': {
                    bgcolor: colors?.background ?? 'action.hover',
                    opacity: 1,
                  },
                }}
              />
            );
          })}
        </Box>
      </Stack>
    </Paper>
  );
}
