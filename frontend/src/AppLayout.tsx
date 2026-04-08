import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { PlantSelector } from './components/PlantSelector';
import { usePlant } from './context/PlantContext';

const navItems = [
  { label: 'Dispatch', path: '/dispatch' },
  { label: 'Fleet', path: '/fleet' },
  { label: 'Analytics', path: '/analytics' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedPlant, setSelectedPlant, allPlants } = usePlant();

  const currentTab = navItems.findIndex((item) => location.pathname.startsWith(item.path));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 1, whiteSpace: 'nowrap' }}>
            ReadyMix
          </Typography>

          <Tabs
            value={currentTab === -1 ? 0 : currentTab}
            onChange={(_e, idx) => navigate(navItems[idx].path)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ flexGrow: 1 }}
          >
            {navItems.map((item) => (
              <Tab key={item.path} label={item.label} sx={{ color: 'rgba(255,255,255,0.8)', '&.Mui-selected': { color: '#fff' } }} />
            ))}
          </Tabs>

          <PlantSelector
            plants={allPlants}
            selectedPlant={selectedPlant}
            onPlantChange={setSelectedPlant}
          />
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'background.default' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
