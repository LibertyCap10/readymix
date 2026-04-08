import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import FactoryIcon from '@mui/icons-material/Factory';
import InputAdornment from '@mui/material/InputAdornment';
import type { Plant } from '../../mocks/types';

interface PlantSelectorProps {
  plants: Plant[];
  selectedPlant: Plant;
  onPlantChange: (plant: Plant) => void;
}

export default function PlantSelector({ plants, selectedPlant, onPlantChange }: PlantSelectorProps) {
  return (
    <Autocomplete
      value={selectedPlant}
      options={plants}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.plantId === value.plantId}
      onChange={(_event, newValue) => {
        if (newValue) {
          onPlantChange(newValue);
        }
      }}
      disableClearable
      size="small"
      sx={{ width: 280 }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Select plant"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <FactoryIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255,255,255,0.12)',
              color: 'inherit',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
            },
            '& .MuiInputAdornment-root': { color: 'inherit' },
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.plantId}>
          <div>
            <div style={{ fontWeight: 500 }}>{option.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>
              {option.city}, {option.state}
            </div>
          </div>
        </li>
      )}
    />
  );
}
