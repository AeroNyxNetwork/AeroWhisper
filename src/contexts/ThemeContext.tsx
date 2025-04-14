// src/contexts/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorMode } from '@chakra-ui/react';
import { extendTheme, ThemeConfig } from '@chakra-ui/react';

interface AppearanceSettings {
  colorMode: 'light' | 'dark' | 'system';
  primaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
  messageDensity: 'compact' | 'comfortable' | 'spacious';
  fontFamily: 'inter' | 'roboto' | 'system';
  messageAlignment: 'default' | 'left' | 'right';
  enableAnimations: boolean;
  messageCornerStyle: 'rounded' | 'bubbles' | 'angular';
  emojiStyle: 'native' | 'twitter' | 'apple' | 'google';
}

interface ThemeContextType {
  appearance: AppearanceSettings;
  updateAppearance: (settings: Partial<AppearanceSettings>) => void;
  resetAppearance: () => void;
  theme: any; // Actual Chakra UI theme object
}

const defaultAppearance: AppearanceSettings = {
  colorMode: 'system',
  primaryColor: 'purple',
  fontSize: 'medium',
  messageDensity: 'comfortable',
  fontFamily: 'inter',
  messageAlignment: 'default',
  enableAnimations: true,
  messageCornerStyle: 'rounded',
  emojiStyle: 'native',
};

const ThemeContext = createContext<ThemeContextType>({
  appearance: defaultAppearance,
  updateAppearance: () => {},
  resetAppearance: () => {},
  theme: {},
});

export const useAppTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colorMode, setColorMode } = useColorMode();
  const [appearance, setAppearance] = useState<AppearanceSettings>(defaultAppearance);
  const [theme, setTheme] = useState(generateTheme(defaultAppearance));

  // Load saved settings on mount
  useEffect(() => {
    const loadAppearanceSettings = () => {
      try {
        const savedSettings = localStorage.getItem('aero-appearance-settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings) as AppearanceSettings;
          setAppearance(parsedSettings);
          
          // Apply color mode
          if (parsedSettings.colorMode === 'system') {
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setColorMode(systemPrefersDark ? 'dark' : 'light');
          } else {
            setColorMode(parsedSettings.colorMode);
          }
        }
      } catch (error) {
        console.error('Failed to load appearance settings:', error);
        // If there's an error, reset to defaults
        setAppearance(defaultAppearance);
      }
    };

    loadAppearanceSettings();
    
    // Listen for system color scheme changes if using system preference
    if (appearance.colorMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setColorMode(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [setColorMode, appearance.colorMode]);
  
  // Generate theme when appearance changes
  useEffect(() => {
    const newTheme = generateTheme(appearance);
    setTheme(newTheme);
  }, [appearance]);

  // Update appearance settings
  const updateAppearance = (newSettings: Partial<AppearanceSettings>) => {
    const updatedSettings = { ...appearance, ...newSettings };
    setAppearance(updatedSettings);
    
    // Update color mode if it changed
    if (newSettings.colorMode && newSettings.colorMode !== appearance.colorMode) {
      if (newSettings.colorMode === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setColorMode(systemPrefersDark ? 'dark' : 'light');
      } else {
        setColorMode(newSettings.colorMode);
      }
    }
    
    // Save to localStorage
    localStorage.setItem('aero-appearance-settings', JSON.stringify(updatedSettings));
  };

  // Reset to defaults
  const resetAppearance = () => {
    setAppearance(defaultAppearance);
    localStorage.removeItem('aero-appearance-settings');
    
    // Reset color mode
    if (defaultAppearance.colorMode === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setColorMode(systemPrefersDark ? 'dark' : 'light');
    } else {
      setColorMode(defaultAppearance.colorMode);
    }
  };

  return (
    <ThemeContext.Provider value={{ appearance, updateAppearance, resetAppearance, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Generate a Chakra UI theme based on appearance settings
function generateTheme(settings: AppearanceSettings) {
  // Base font size based on preference
  const fontSizes = {
    xs: settings.fontSize === 'small' ? '0.65rem' : settings.fontSize === 'large' ? '0.8rem' : '0.75rem',
    sm: settings.fontSize === 'small' ? '0.8rem' : settings.fontSize === 'large' ? '0.95rem' : '0.875rem',
    md: settings.fontSize === 'small' ? '0.9rem' : settings.fontSize === 'large' ? '1.1rem' : '1rem',
    lg: settings.fontSize === 'small' ? '1.05rem' : settings.fontSize === 'large' ? '1.25rem' : '1.125rem',
    xl: settings.fontSize === 'small' ? '1.15rem' : settings.fontSize === 'large' ? '1.4rem' : '1.25rem',
    '2xl': settings.fontSize === 'small' ? '1.4rem' : settings.fontSize === 'large' ? '1.65rem' : '1.5rem',
    '3xl': settings.fontSize === 'small' ? '1.65rem' : settings.fontSize === 'large' ? '2.1rem' : '1.875rem',
    '4xl': settings.fontSize === 'small' ? '1.9rem' : settings.fontSize === 'large' ? '2.5rem' : '2.25rem',
    '5xl': settings.fontSize === 'small' ? '2.5rem' : settings.fontSize === 'large' ? '3.2rem' : '3rem',
    '6xl': settings.fontSize === 'small' ? '3rem' : settings.fontSize === 'large' ? '4.2rem' : '3.75rem',
  };

  // Font family based on preference
  const fontFamily = settings.fontFamily === 'roboto' 
    ? "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    : settings.fontFamily === 'system'
    ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  // Create the theme config
  const config: ThemeConfig = {
    initialColorMode: settings.colorMode === 'system' ? 'light' : settings.colorMode,
    useSystemColorMode: settings.colorMode === 'system',
  };

  // Spacing based on message density
  const space = {
    px: '1px',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: settings.messageDensity === 'compact' ? '0.4rem' : settings.messageDensity === 'spacious' ? '0.6rem' : '0.5rem',
    2.5: '0.625rem',
    3: settings.messageDensity === 'compact' ? '0.6rem' : settings.messageDensity === 'spacious' ? '1rem' : '0.75rem',
    3.5: '0.875rem',
    4: settings.messageDensity === 'compact' ? '0.8rem' : settings.messageDensity === 'spacious' ? '1.25rem' : '1rem',
    5: settings.messageDensity === 'compact' ? '1rem' : settings.messageDensity === 'spacious' ? '1.5rem' : '1.25rem',
    6: settings.messageDensity === 'compact' ? '1.2rem' : settings.messageDensity === 'spacious' ? '1.75rem' : '1.5rem',
    7: '1.75rem',
    8: settings.messageDensity === 'compact' ? '1.6rem' : settings.messageDensity === 'spacious' ? '2.5rem' : '2rem',
    9: '2.25rem',
    10: settings.messageDensity === 'compact' ? '2rem' : settings.messageDensity === 'spacious' ? '3rem' : '2.5rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    44: '11rem',
    48: '12rem',
    52: '13rem',
    56: '14rem',
    60: '15rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
  };

  // Components styles based on preferences
  const components = {
    Button: {
      baseStyle: {
        fontWeight: 'medium',
        borderRadius: 'md',
      },
      defaultProps: {
        colorScheme: settings.primaryColor,
      },
    },
    // Message component styling based on corner style and density
    Box: {
      variants: {
        message: {
          borderRadius: settings.messageCornerStyle === 'angular' ? 'md' : 
                       settings.messageCornerStyle === 'bubbles' ? 'full' : 'lg',
          padding: settings.messageDensity === 'compact' ? 2 : 
                  settings.messageDensity === 'spacious' ? 4 : 3,
        },
      },
    },
  };

  // Generate and return the theme
  return extendTheme({
    config,
    fonts: {
      heading: fontFamily,
      body: fontFamily,
    },
    fontSizes,
    space,
    components,
    styles: {
      global: (props: any) => ({
        // Apply global style overrides here
        'html, body': {
          fontSize: settings.fontSize === 'small' ? '14px' : settings.fontSize === 'large' ? '18px' : '16px',
          transition: settings.enableAnimations ? 'all 0.2s ease-out' : 'none',
        },
        // Animation overrides
        '.animate': {
          transition: settings.enableAnimations ? 'all 0.2s ease-out' : 'none',
        },
        '.no-animations': {
          transition: 'none !important',
          animation: 'none !important',
        },
      }),
    },
  });
}
