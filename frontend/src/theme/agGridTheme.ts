import { themeQuartz } from 'ag-grid-community';

export const agGridTheme = themeQuartz.withParams({
  accentColor: '#FF6D00',                // Safety orange — selection highlight
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontSize: 13,
  headerBackgroundColor: '#37474F',      // Slate gray header (matches MUI primary)
  headerTextColor: '#ffffff',
  headerFontWeight: 600,
  selectedRowBackgroundColor: '#E3F2FD', // MUI blue-50 — clear but not distracting
  oddRowBackgroundColor: '#FAFAFA',      // Subtle alternating rows
  rowHoverColor: 'rgba(255, 109, 0, 0.04)', // Warm orange tint on hover
});
