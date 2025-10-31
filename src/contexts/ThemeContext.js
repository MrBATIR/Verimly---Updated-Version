import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('system');
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Tema ayarlarını AsyncStorage'dan yükle
  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      const savedThemeMode = await AsyncStorage.getItem('themeMode');
      
      if (savedThemeMode) {
        setThemeMode(savedThemeMode);
        updateTheme(savedThemeMode);
      } else {
        // İlk kez açılıyorsa varsayılan olarak açık tema kullan
        setThemeMode('light');
        setIsDark(false);
      }
    } catch (error) {
      console.error('Tema ayarları yüklenirken hata:', error);
      // Hata durumunda varsayılan olarak açık tema kullan
      setThemeMode('light');
      setIsDark(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTheme = (mode) => {
    const shouldBeDark = mode === 'dark';
    setIsDark(shouldBeDark);
  };

  useEffect(() => {
    if (!isLoading) {
      updateTheme(themeMode);
    }
  }, [themeMode, isLoading]);

  const toggleTheme = async (mode) => {
    try {
      setThemeMode(mode);
      updateTheme(mode); // Hemen tema güncelle
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Tema ayarı kaydedilirken hata:', error);
    }
  };

  const value = {
    themeMode,
    isDark,
    toggleTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
