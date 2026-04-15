import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Tab,
  Tabs,
  Toolbar,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ViewListIcon from '@mui/icons-material/ViewList';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScienceIcon from '@mui/icons-material/Science';
import MapIcon from '@mui/icons-material/Map';
import { PlantSelector } from './components/PlantSelector';
import { LiveClock } from './components/LiveClock';
import { usePlant } from './context/PlantContext';
import Logo from './components/Logo';

const navItems = [
  { label: 'Mixes', path: '/mixes', icon: <ScienceIcon /> },
  { label: 'Fleet', path: '/fleet', icon: <LocalShippingIcon /> },
  { label: 'Orders', path: '/orders', icon: <ViewListIcon /> },
  { label: 'Dispatch', path: '/dispatch', icon: <MapIcon /> },
  { label: 'Analytics', path: '/analytics', icon: <BarChartIcon /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { selectedPlant, setSelectedPlant, allPlants } = usePlant();

  const currentTab = navItems.findIndex((item) => location.pathname.startsWith(item.path));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1, minHeight: { xs: 48, md: 64 } }}>
          <Logo
            onClick={() => navigate('/')}
            size={isMobile ? 'sm' : 'md'}
          />

          {/* Desktop: tabs in header */}
          {!isMobile && (
            <Tabs
              value={currentTab === -1 ? 0 : currentTab}
              onChange={(_e, idx) => navigate(navItems[idx].path)}
              textColor="inherit"
              indicatorColor="secondary"
              sx={{ flexGrow: 1, ml: 1 }}
            >
              {navItems.map((item) => (
                <Tab key={item.path} label={item.label} sx={{ color: 'rgba(255,255,255,0.8)', '&.Mui-selected': { color: '#fff' } }} />
              ))}
            </Tabs>
          )}

          {/* Mobile: spacer to push plant selector right */}
          {isMobile && <Box sx={{ flexGrow: 1 }} />}

          <LiveClock />

          <PlantSelector
            plants={allPlants}
            selectedPlant={selectedPlant}
            onPlantChange={setSelectedPlant}
          />
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflow: 'hidden',
          backgroundColor: 'background.default',
          pb: isMobile ? '64px' : 0, // space for bottom nav
        }}
      >
        <Outlet />
      </Box>

      {/* Mobile: bottom navigation */}
      {isMobile && (
        <BottomNavigation
          value={currentTab === -1 ? 0 : currentTab}
          onChange={(_e, idx) => navigate(navItems[idx].path)}
          showLabels
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            zIndex: theme.zIndex.appBar,
            borderTop: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
            bgcolor: 'background.paper',
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
              sx={{ '&.Mui-selected': { color: 'secondary.main' } }}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}
