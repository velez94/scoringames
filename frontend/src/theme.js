// Athleon Forge Color Palette
export const colors = {
  // Primary Colors
  steelGray: '#6B7C93',
  copper: '#B87333',
  fireOrange: '#FF5722',
  deepBlack: '#212121',
  pureWhite: '#FFFFFF',
  
  // Semantic Colors
  primary: '#FF5722',      // Fire Orange - main actions
  secondary: '#B87333',    // Copper - secondary actions
  background: '#F5F5F5',   // Light gray background
  surface: '#FFFFFF',      // White cards/surfaces
  text: {
    primary: '#212121',    // Deep Black
    secondary: '#6B7C93',  // Steel Gray
    disabled: '#9E9E9E',
  },
  
  // Status Colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  
  // Gradients
  gradient: {
    forge: 'linear-gradient(135deg, #B87333 0%, #FF5722 100%)',
    steel: 'linear-gradient(135deg, #6B7C93 0%, #212121 100%)',
  }
};

export const theme = {
  colors,
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 3px rgba(33, 33, 33, 0.12)',
    md: '0 4px 6px rgba(33, 33, 33, 0.16)',
    lg: '0 10px 20px rgba(33, 33, 33, 0.19)',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '24px',
      xxl: '32px',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
};

export default theme;
