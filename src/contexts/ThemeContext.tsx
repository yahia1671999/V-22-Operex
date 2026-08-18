import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  applyBranding: (branding: any) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });

  const applyBranding = (branding: any) => {
    if (!branding) return;
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty('--primary', branding.primaryColor);
    }
    if (branding.secondaryColor) {
      root.style.setProperty('--secondary', branding.secondaryColor);
    }
    if (branding.sidebarColor) {
      root.style.setProperty('--sidebar', branding.sidebarColor);
    }
    if (branding.buttonColor) {
      root.style.setProperty('--button-primary', branding.buttonColor);
    }
  };

  useEffect(() => {
    const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<any> => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
      } catch (err) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(url, retries - 1, delay * 1.5);
        }
        throw err;
      }
    };

    // Fetch public branding once on boot to avoid default blue-color-flashing
    fetchWithRetry('/api/system-settings/public')
      .then(data => {
        if (data) {
          applyBranding(data);
          // Set system default theme if user hasn't toggled override
          if (data.darkModeEnabled !== undefined && data.darkModeEnabled !== null && !localStorage.getItem('theme')) {
            setTheme(data.darkModeEnabled ? 'dark' : 'light');
          }
        }
      })
      .catch(err => console.warn('Failed to pre-fetch public settings after retries', err));
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const html = document.documentElement;
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      (metaThemeColor as HTMLMetaElement).name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    if (theme === 'dark') {
      html.classList.add('dark');
      (metaThemeColor as HTMLMetaElement).content = '#0f172a'; // slate-900
    } else {
      html.classList.remove('dark');
      (metaThemeColor as HTMLMetaElement).content = '#f8fafc'; // slate-50
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, applyBranding }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
