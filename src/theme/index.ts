import { extendTheme, ThemeConfig } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

// Color mode config
const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

// Primary color and accents
const colors = {
  brand: {
    50: '#f2e6ff',
    100: '#d4b8ff',
    200: '#b68aff',
    300: '#985cff',
    400: '#7a2eff',
    500: '#6c00ff', // Primary
    600: '#5500cc',
    700: '#400099',
    800: '#2a0066',
    900: '#150033',
  },
  purple: {
    50: '#f4eaff',
    100: '#dac1fc',
    200: '#c098f8',
    300: '#a76ff5',
    400: '#8e46f1',
    500: '#751dd8', // Primary
    600: '#5c15ab',
    700: '#430e7f',
    800: '#2b0953',
    900: '#140328',
  },
};

// Font configurations
const fonts = {
  heading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

// Global styles
const styles = {
  global: (props: any) => ({
    body: {
      bg: mode('gray.50', 'gray.900')(props),
      color: mode('gray.800', 'whiteAlpha.900')(props),
      transitionProperty: 'background-color',
      transitionDuration: 'normal',
      lineHeight: 'base',
    },
    '*::placeholder': {
      color: mode('gray.400', 'whiteAlpha.400')(props),
    },
    '*, *::before, &::after': {
      borderColor: mode('gray.200', 'whiteAlpha.300')(props),
      wordWrap: 'break-word',
    },
  }),
};

// Component style overrides
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'medium',
      borderRadius: 'md',
    },
    defaultProps: {
      colorScheme: 'purple',
    },
  },
  Modal: {
    baseStyle: (props: any) => ({
      dialog: {
        bg: mode('white', 'gray.800')(props),
        boxShadow: 'xl',
        borderRadius: 'xl',
      },
    }),
  },
  Card: {
    baseStyle: (props: any) => ({
      container: {
        bg: mode('white', 'gray.800')(props),
        p: 6,
        borderRadius: 'lg',
        boxShadow: mode('md', 'dark-lg')(props),
      },
    }),
    variants: {
      elevated: (props: any) => ({
        container: {
          boxShadow: mode('lg', 'dark-lg')(props),
          _hover: {
            boxShadow: mode('xl', 'dark-xl')(props),
          },
        },
      }),
    },
  },
};

// Extended theme
const theme = extendTheme({
  config,
  colors,
  fonts,
  styles,
  components,
});

export default theme;
