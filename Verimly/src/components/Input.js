import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { COLORS, DARK_COLORS, SIZES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Reusable Input componenti
 * @param {Object} props
 * @param {string} props.label - Input etiketi
 * @param {string} props.value - Input değeri
 * @param {function} props.onChangeText - Değişim fonksiyonu
 * @param {string} props.placeholder - Placeholder
 * @param {boolean} props.secureTextEntry - Şifre inputu mu
 * @param {string} props.error - Hata mesajı
 * @param {Object} props.style - Ek stil
 */
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  style,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  leftIcon,
  rightIcon,
  autoComplete = 'on',
  autoCapitalize = 'sentences',
  autoCorrect = true,
}) {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            multiline && styles.multiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: SIZES.small,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: SIZES.body,
    color: colors.textPrimary,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: SIZES.tiny,
    color: colors.error,
    marginTop: 4,
  },
  leftIcon: {
    marginLeft: 12,
  },
  rightIcon: {
    marginRight: 12,
  },
});

