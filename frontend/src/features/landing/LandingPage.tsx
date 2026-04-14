import { useRef, useEffect, useState } from 'react';
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
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PeopleIcon from '@mui/icons-material/People';
import CloudIcon from '@mui/icons-material/Cloud';
import HubIcon from '@mui/icons-material/Hub';
import StorageIcon from '@mui/icons-material/Storage';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DemoMap from './DemoMap';
import Logo from '../../components/Logo';

/* ── Scroll-reveal hook ─────────────────────────────────────────────── */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

/* ── Data ────────────────────────────────────────────────────────────── */

const features = [
  {
    icon: <ViewListIcon sx={{ fontSize: 48 }} />,
    title: 'Orders & Dispatch',
    desc: 'AG Grid-powered order management. Create, assign, and track deliveries through the full lifecycle — from pending to complete.',
  },
  {
    icon: <LocalShippingIcon sx={{ fontSize: 48 }} />,
    title: 'Fleet Management',
    desc: 'Real-time truck status, cycle time trends, and utilization charts. Live updates every 10 seconds via EventBridge.',
  },
  {
    icon: <MapIcon sx={{ fontSize: 48 }} />,
    title: 'Dispatch Map',
    desc: 'Interactive Mapbox map with plant markers, animated truck positions, route visualization, and one-click dispatch.',
  },
  {
    icon: <ScienceIcon sx={{ fontSize: 48 }} />,
    title: 'Mix Designs',
    desc: 'Full concrete recipe catalog — ingredients, admixtures, PSI ratings, and application types. Search, filter, version.',
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 48 }} />,
    title: 'Analytics',
    desc: 'Volume trends, customer scorecards, and driver leaderboards powered by Aurora PostgreSQL window functions.',
  },
];

const archNodes = [
  { icon: <PeopleIcon sx={{ fontSize: 32 }} />, label: 'Users', sub: 'Browser / Mobile' },
  { icon: <CloudIcon sx={{ fontSize: 32 }} />, label: 'CloudFront + S3', sub: 'CDN & Static Hosting' },
  { icon: <HubIcon sx={{ fontSize: 32 }} />, label: 'API Gateway', sub: 'REST API' },
  { icon: <Box sx={{ fontSize: 11, fontWeight: 700, color: 'secondary.light' }}>λ</Box>, label: '4 Lambda Functions', sub: 'Orders · Fleet · Analytics · Ticker' },
  { icon: <StorageIcon sx={{ fontSize: 32 }} />, label: 'DynamoDB + Aurora', sub: 'Hot Data · Relational' },
];

const scalabilityStats = [
  { value: '4', label: 'Lambda Functions' },
  { value: '3', label: 'DynamoDB Tables' },
  { value: '1 min', label: 'Lifecycle Tick' },
  { value: '0', label: 'Servers to Manage' },
];

/* ── Section wrapper ────────────────────────────────────────────────── */

function Section({
  children,
  sx,
  ...rest
}: { children: React.ReactNode; sx?: object } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Box
      component="section"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        scrollSnapAlign: 'start',
        position: 'relative',
        overflow: 'hidden',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const featuresReveal = useReveal();
  const archReveal = useReveal();

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Box
      sx={{
        scrollSnapType: 'y mandatory',
        overflowY: 'auto',
        height: '100vh',
      }}
    >
      {/* Sticky header — transparent until scrolled */}
      <AppBar
        position="fixed"
        elevation={scrolled ? 2 : 0}
        sx={{
          bgcolor: scrolled ? 'primary.main' : 'transparent',
          transition: 'background-color 0.3s, box-shadow 0.3s',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 48, md: 64 } }}>
          <Logo size={isMobile ? 'sm' : 'md'} />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            color="inherit"
            size={isMobile ? 'small' : 'medium'}
            onClick={() => navigate('/orders')}
            sx={{ borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}
          >
            Launch App
          </Button>
        </Toolbar>
      </AppBar>

      {/* ─── 1. HERO ─────────────────────────────────────────────────── */}
      <Section
        sx={{
          bgcolor: 'primary.dark',
          color: 'white',
          textAlign: 'center',
          px: 3,
          pt: 8,
        }}
      >
        <Box>
          <Typography
            variant={isMobile ? 'h3' : 'h2'}
            sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.02em' }}
          >
            Concrete Dispatch,
            <br />
            <Box component="span" sx={{ color: 'secondary.main' }}>Simplified.</Box>
          </Typography>
          <Typography
            variant={isMobile ? 'body1' : 'h6'}
            sx={{
              color: 'rgba(255,255,255,0.65)',
              maxWidth: 640,
              mx: 'auto',
              fontWeight: 400,
              lineHeight: 1.7,
              mb: 5,
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
            sx={{ px: 5, py: 1.5, fontSize: '1.1rem', fontWeight: 600, borderRadius: 2 }}
          >
            View Live Demo &rarr;
          </Button>
        </Box>

        {/* Scroll indicator */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'bounce 2s infinite',
            '@keyframes bounce': {
              '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
              '50%': { transform: 'translateX(-50%) translateY(8px)' },
            },
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <ArrowDownwardIcon />
        </Box>
      </Section>

      {/* ─── 2. DISPATCH MAP HERO ────────────────────────────────────── */}
      <Section sx={{ bgcolor: '#0a0a0a' }}>
        {/* Full-bleed map */}
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <DemoMap />
        </Box>

        {/* Gradient overlay for readability */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: isMobile
              ? 'linear-gradient(to top, rgba(0,0,0,0.85) 30%, transparent 70%)'
              : 'linear-gradient(to right, rgba(0,0,0,0.82) 35%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Text overlay */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            px: { xs: 3, md: 8 },
            py: { xs: 4, md: 0 },
            alignSelf: isMobile ? 'stretch' : 'flex-start',
            mt: isMobile ? 'auto' : 0,
            maxWidth: { md: 480 },
          }}
        >
          <Chip
            label="LIVE DEMO"
            size="small"
            sx={{
              bgcolor: 'secondary.main',
              color: 'white',
              fontWeight: 700,
              letterSpacing: 1,
              mb: 2,
            }}
          />
          <Typography
            variant={isMobile ? 'h4' : 'h3'}
            sx={{ color: 'white', fontWeight: 800, mb: 2, letterSpacing: '-0.02em' }}
          >
            Live Dispatch
            <br />
            Tracking
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, mb: 4, maxWidth: 400 }}
          >
            Watch trucks travel from the branch plant to job sites across
            the metro area. Routes, positions, and ETAs update in real time —
            powered by Mapbox GL and EventBridge.
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="large"
            onClick={() => navigate('/dispatch')}
            sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}
          >
            Explore the Map &rarr;
          </Button>
        </Box>
      </Section>

      {/* ─── 3. FEATURES ─────────────────────────────────────────────── */}
      <Section sx={{ bgcolor: 'background.default', py: { xs: 8, md: 0 } }}>
        <Container maxWidth="lg" ref={featuresReveal.ref}>
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 700,
              mb: 6,
              letterSpacing: '-0.02em',
              opacity: featuresReveal.visible ? 1 : 0,
              transform: featuresReveal.visible ? 'none' : 'translateY(30px)',
              transition: 'opacity 0.8s, transform 0.8s',
            }}
          >
            What You Can Do
          </Typography>
          <Grid container spacing={3} justifyContent="center">
            {features.map((f, i) => (
              <Grid key={f.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    p: 4,
                    textAlign: 'center',
                    height: '100%',
                    opacity: featuresReveal.visible ? 1 : 0,
                    transform: featuresReveal.visible ? 'none' : 'translateY(40px)',
                    transition: `opacity 0.6s ${i * 0.1}s, transform 0.6s ${i * 0.1}s`,
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-4px)',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                    },
                  }}
                >
                  <Box sx={{ color: 'secondary.main', mb: 2 }}>{f.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {f.desc}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Section>

      {/* ─── 4. ARCHITECTURE ─────────────────────────────────────────── */}
      <Section sx={{ bgcolor: 'primary.dark', color: 'white', py: { xs: 8, md: 0 } }}>
        <Container maxWidth="lg" ref={archReveal.ref}>
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 700,
              mb: 2,
              letterSpacing: '-0.02em',
              opacity: archReveal.visible ? 1 : 0,
              transform: archReveal.visible ? 'none' : 'translateY(30px)',
              transition: 'opacity 0.8s, transform 0.8s',
            }}
          >
            Built on AWS Serverless
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 400,
              mb: 6,
              maxWidth: 600,
              mx: 'auto',
              opacity: archReveal.visible ? 1 : 0,
              transition: 'opacity 1s 0.2s',
            }}
          >
            Zero servers. Infinite scale. Pay only for what you use.
          </Typography>

          {/* Architecture flow */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 1, md: 0 },
              mb: 8,
            }}
          >
            {archNodes.map((node, i) => (
              <Box
                key={node.label}
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: 'center',
                  gap: { xs: 1, md: 0 },
                  opacity: archReveal.visible ? 1 : 0,
                  transform: archReveal.visible ? 'none' : (isMobile ? 'translateY(20px)' : 'translateX(-20px)'),
                  transition: `opacity 0.5s ${0.3 + i * 0.15}s, transform 0.5s ${0.3 + i * 0.15}s`,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 2.5, md: 3 },
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 3,
                    textAlign: 'center',
                    minWidth: { xs: 200, md: 150 },
                    backdropFilter: 'blur(8px)',
                    transition: 'border-color 0.3s, background-color 0.3s',
                    '&:hover': {
                      borderColor: 'secondary.main',
                      bgcolor: 'rgba(255,109,0,0.08)',
                    },
                  }}
                >
                  <Box sx={{ color: 'secondary.light', mb: 1 }}>{node.icon}</Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'white', fontSize: '0.85rem' }}>
                    {node.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mt: 0.5 }}>
                    {node.sub}
                  </Typography>
                </Paper>

                {i < archNodes.length - 1 && (
                  <Box sx={{ mx: { md: 1.5 }, my: { xs: 0.5, md: 0 } }}>
                    {isMobile ? (
                      <ArrowDownwardIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
                    ) : (
                      <ArrowForwardIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          {/* EventBridge callout */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 8,
              opacity: archReveal.visible ? 1 : 0,
              transition: 'opacity 0.8s 1s',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                px: 3,
                py: 2,
                bgcolor: 'rgba(255,109,0,0.1)',
                border: '1px solid rgba(255,109,0,0.3)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <ScheduleIcon sx={{ color: 'secondary.main' }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'white' }}>
                  EventBridge Ticker
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Fires every 60 seconds to advance order lifecycle phases and update truck positions
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* Scalability stats */}
          <Grid container spacing={3} justifyContent="center">
            {scalabilityStats.map((stat, i) => (
              <Grid key={stat.label} size={{ xs: 6, sm: 3 }}>
                <Box
                  sx={{
                    textAlign: 'center',
                    opacity: archReveal.visible ? 1 : 0,
                    transform: archReveal.visible ? 'none' : 'translateY(20px)',
                    transition: `opacity 0.5s ${0.8 + i * 0.1}s, transform 0.5s ${0.8 + i * 0.1}s`,
                  }}
                >
                  <Typography
                    variant="h2"
                    sx={{ fontWeight: 800, color: 'secondary.main', lineHeight: 1 }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Section>

      {/* ─── 5. FINAL CTA ────────────────────────────────────────────── */}
      <Section
        sx={{
          bgcolor: 'secondary.main',
          color: 'white',
          textAlign: 'center',
          px: 3,
        }}
      >
        <Box>
          <Typography variant={isMobile ? 'h4' : 'h3'} sx={{ fontWeight: 800, mb: 2 }}>
            Ready to see it in action?
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 400, color: 'rgba(255,255,255,0.85)', mb: 5, maxWidth: 500, mx: 'auto' }}
          >
            Explore the live demo — create orders, dispatch trucks, and watch
            deliveries unfold on the map.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/orders')}
            sx={{
              bgcolor: 'white',
              color: 'secondary.main',
              px: 5,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 700,
              borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.92)' },
            }}
          >
            View Live Demo &rarr;
          </Button>
        </Box>

        {/* Footer text */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            opacity: 0.5,
          }}
        >
          <Logo size="sm" />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            &mdash; A serverless concrete dispatch demo
          </Typography>
        </Box>
      </Section>
    </Box>
  );
}
