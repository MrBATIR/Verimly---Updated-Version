import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, DARK_COLORS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Ana container componenti - Tüm ekranlar için kullanılır
 * @param {Object} props
 * @param {React.ReactNode} props.children - İçerik
 * @param {Object} props.style - Ek stil
 * @param {boolean} props.safe - SafeAreaView kullanılsın mı
 */
export default function Container({ children, style, safe = true }) {
  const ContainerComponent = safe ? SafeAreaView : View;
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  
  return (
    <ContainerComponent style={[createStyles(colors).container, style]} edges={['top', 'left', 'right', 'bottom']}>
      {children}
    </ContainerComponent>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

