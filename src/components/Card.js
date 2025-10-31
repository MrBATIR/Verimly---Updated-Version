import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, DARK_COLORS, SIZES, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable Card componenti
 * @param {Object} props
 * @param {React.ReactNode} props.children - İçerik
 * @param {Object} props.style - Ek stil
 * @param {function} props.onPress - Tıklanabilir mi
 */
export default function Card({ children, style, onPress }) {
  const Component = onPress ? TouchableOpacity : View;
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  
  return (
    <Component
      style={[createStyles(colors).card, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </Component>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.small,
  },
});

