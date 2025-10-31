import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { COLORS, DARK_COLORS, SIZES, SHADOWS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable Button componenti
 * @param {Object} props
 * @param {string} props.title - Buton metni
 * @param {function} props.onPress - Tıklama fonksiyonu
 * @param {string} props.variant - Buton tipi: 'primary', 'secondary', 'outline', 'ghost'
 * @param {boolean} props.disabled - Pasif mi
 * @param {boolean} props.loading - Yükleniyor mu
 * @param {Object} props.style - Ek stil
 */
export default function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  disabled = false,
  loading = false,
  style,
  icon,
}) {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondary;
      case 'outline':
        return styles.outline;
      case 'ghost':
        return styles.ghost;
      default:
        return styles.primary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
      case 'ghost':
        return styles.textOutline;
      default:
        return styles.text;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.surface} />
      ) : (
        <>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[styles.buttonText, getTextStyle()]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (colors) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: SIZES.radius,
    minHeight: 50,
  },
  primary: {
    backgroundColor: colors.primary,
    ...SHADOWS.small,
  },
  secondary: {
    backgroundColor: colors.secondary,
    ...SHADOWS.small,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  text: {
    color: colors.surface,
  },
  textOutline: {
    color: colors.primary,
  },
  icon: {
    marginRight: 8,
  },
});

