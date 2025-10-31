import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

/**
 * Swipeable Row Component - Sola kaydırınca silme/düzenleme butonları
 * @param {Object} props
 * @param {React.ReactNode} props.children - İçerik
 * @param {function} props.onEdit - Düzenle fonksiyonu
 * @param {function} props.onDelete - Sil fonksiyonu
 */
export default function SwipeableRow({ children, onEdit, onDelete }) {
  const swipeableRef = useRef(null);

  const renderRightActions = (progress, dragX) => {
    return (
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => {
            swipeableRef.current?.close();
            onEdit?.();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={22} color={COLORS.surface} />
          <Text style={styles.actionText}>Düzenle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete?.();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color={COLORS.surface} />
          <Text style={styles.actionText}>Sil</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  rightActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingHorizontal: 10,
  },
  editButton: {
    backgroundColor: COLORS.primary,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderTopRightRadius: SIZES.radius,
    borderBottomRightRadius: SIZES.radius,
  },
  actionText: {
    color: COLORS.surface,
    fontSize: SIZES.tiny,
    fontWeight: '600',
    marginTop: 4,
  },
});



