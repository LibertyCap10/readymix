import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Grid from '@mui/material/Grid2';
import ViewListIcon from '@mui/icons-material/ViewList';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MapIcon from '@mui/icons-material/Map';
import ScienceIcon from '@mui/icons-material/Science';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';

const features = [
  {
    icon: <ViewListIcon sx={{ fontSize: 48 }} />,
    title: 'Orders & Dispatch Board',
    description:
      'Real-time order management with AG Grid. Create, assign, and track concrete deliveries through every lifecycle stage.',
  },
  {
    icon: <LocalShippingIcon sx={{ fontSize: 48 }} />,
    title: 'Fleet Management',
    description:
      'Monitor truck status, cycle times, and utilization with live updates every 10 seconds powered by EventBridge.',
  },
  {
    icon: <MapIcon sx={{ fontSize: 48 }} />,
    title: 'Dispatch Map',
    description:
      'Interactive Mapbox map showing plant locations, active deliveries, and route assignments in real time.',
  },
  {
    icon: <ScienceIcon sx={{ fontSize: 48 }} />,
    title: 'Mix Designs',
    description:
      'Browse and manage concrete mix formulas with detailed ingredient specs, PSI ratings, and application types.',
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 48 }} />,
    title: 'Analytics Dashboard',
    description:
      'Volume trends, customer scorecards, and driver leaderboards powered by Aurora PostgreSQL aggregations.',
  },
];

const archStages = [
  {
    title: 'Frontend',
    subtitle: 'React 18 + Vite',
    chips: ['MUI 6', 'Mapbox GL', 'AG Grid'],
  },
  {
    title: 'API Layer',
    subtitle: 'API Gateway + Lambda',
    chips: ['AWS SAM', 'Node.js 20'],
  },
  {
    title: 'Data Layer',
    subtitle: 'DynamoDB + Aurora',
    chips: ['EventBridge', 'CloudFront', 'S3'],
  },
];

const techStack = [
  'React 18',
  'MUI 6',
  'Vite',
  'Mapbox GL JS',
  'AG Grid',
  'AWS Lambda',
  'API Gateway',
  'DynamoDB',
  'Aurora PostgreSQL',
  'EventBridge',
  'CloudFront',
  'S3',
  'AWS SAM',
];

export default function LandingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="sticky">
        <Toolbar sx={{ minHeight: { xs: 48, md: 64 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', md: '1.25rem' } }}>
            ReadyMix
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            color="inherit"
            size={isMobile ? 'small' : 'medium'}
            onClick={() => navigate('/orders')}
          >
            Launch App
          </Button>
        </Toolbar>
      </AppBar>

      {/* Hero */}
      <Box
        sx={{
          bgcolor: 'primary.dark',
          color: 'white',
          textAlign: 'center',
          py: { xs: 8, md: 12 },
          px: 3,
        }}
      >
        <Typography
          variant={isMobile ? 'h4' : 'h3'}
          sx={{ fontWeight: 800, mb: 2 }}
        >
          Concrete Dispatch, Simplified.
        </Typography>
        <Typography
          variant={isMobile ? 'body1' : 'h6'}
          sx={{
            color: 'rgba(255,255,255,0.7)',
            maxWidth: 600,
            mx: 'auto',
            fontWeight: 400,
            lineHeight: 1.6,
          }}
        >
          Real-time fleet tracking, order management, and dispatch optimization
          for ready-mix concrete operations — built entirely on AWS serverless.
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          onClick={() => navigate('/orders')}
          sx={{ mt: 4, px: 4, py: 1.5, fontSize: '1.1rem' }}
        >
          View Live Demo &rarr;
        </Button>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 600, mb: 5 }}>
          What You Can Do
        </Typography>
        <Grid container spacing={3} justifyContent="center">
          {features.map((f) => (
            <Grid key={f.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  height: '100%',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{ color: 'secondary.main', mb: 2 }}>{f.icon}</Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {f.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {f.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Architecture */}
      <Box sx={{ bgcolor: 'primary.dark', color: 'white', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md">
          <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 600, mb: 5 }}>
            Built on AWS
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {archStages.map((stage, i) => (
              <Box
                key={stage.title}
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 2,
                    textAlign: 'center',
                    minWidth: 180,
                  }}
                >
                  <Typography variant="overline" sx={{ color: 'secondary.light', letterSpacing: 1.5 }}>
                    {stage.title}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
                    {stage.subtitle}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.5 }}>
                    {stage.chips.map((c) => (
                      <Chip
                        key={c}
                        label={c}
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'white' }}
                      />
                    ))}
                  </Box>
                </Paper>
                {i < archStages.length - 1 && (
                  <ArrowRightAltIcon
                    sx={{
                      fontSize: 32,
                      color: 'secondary.main',
                      transform: { xs: 'rotate(90deg)', md: 'none' },
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Tech Stack */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 }, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
          Tech Stack
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.5 }}>
          {techStack.map((t) => (
            <Chip key={t} label={t} variant="outlined" sx={{ fontWeight: 500, fontSize: '0.875rem' }} />
          ))}
        </Box>
      </Container>

      {/* Footer CTA */}
      <Box sx={{ bgcolor: 'secondary.main', py: { xs: 5, md: 6 }, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
          Ready to see it in action?
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/orders')}
          sx={{
            mt: 3,
            bgcolor: 'white',
            color: 'secondary.main',
            px: 4,
            py: 1.5,
            fontWeight: 600,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
          }}
        >
          View Live Demo &rarr;
        </Button>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: 'primary.main', color: 'rgba(255,255,255,0.6)', py: 2, textAlign: 'center' }}>
        <Typography variant="body2">
          ReadyMix &mdash; A serverless concrete dispatch demo
        </Typography>
      </Box>
    </Box>
  );
}
