import { Box, Grid2, Skeleton, Stack } from '@mui/material';

export function SkeletonGrid({ rows = 5 }: { rows?: number }) {
  return (
    <Stack spacing={0.5} sx={{ p: 2 }}>
      <Skeleton variant="rectangular" height={44} animation="wave" sx={{ borderRadius: 1 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={48} animation="wave" sx={{ borderRadius: 1 }} />
      ))}
    </Stack>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={120} animation="wave" />
      ))}
    </Stack>
  );
}

export function SkeletonKpi() {
  return (
    <Grid2 container spacing={2}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Grid2 size={{ xs: 6, md: 3 }} key={i}>
          <Skeleton variant="rounded" height={110} animation="wave" />
        </Grid2>
      ))}
    </Grid2>
  );
}

export function SkeletonChart({ height = 308 }: { height?: number }) {
  return (
    <Box sx={{ p: 2 }}>
      <Skeleton variant="text" width={140} animation="wave" sx={{ mb: 1 }} />
      <Skeleton variant="rounded" height={height} animation="wave" />
    </Box>
  );
}
