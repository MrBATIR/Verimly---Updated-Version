import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DARK_COLORS, SIZES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export default function StudyDetailModal({
  visible,
  onClose,
  study,
  onEdit,
  onDelete,
}) {
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);
  
  if (!study) return null;

  // Çalışma türü ismi
  const getStudyTypeLabel = (type) => {
    const types = {
      test: '📝 Test/Soru Çözümü',
      topic: '📖 Konu Çalışması',
      video: '🎥 Video İzleme',
      lecture: '👨‍🏫 Ders Dinleme',
      reading: '📚 Kitap Okuma',
      other: '✏️ Diğer',
    };
    return types[type] || types.test;
  };

  // Hesaplamalar
  const totalQuestions = (study.correct || 0) + (study.wrong || 0) + (study.empty || 0);
  const netScore = totalQuestions > 0 
    ? ((study.correct || 0) - (study.wrong || 0) / 4).toFixed(2) 
    : 0;
  
  const accuracyRate = totalQuestions > 0 
    ? (((study.correct || 0) / totalQuestions) * 100).toFixed(1) 
    : 0;
  
  const questionsPerMinute = study.duration > 0 && totalQuestions > 0
    ? (totalQuestions / study.duration).toFixed(2)
    : 0;
  
  const timePerQuestion = totalQuestions > 0 && study.duration > 0
    ? (study.duration / totalQuestions).toFixed(1)
    : 0;

  // Odaklanma seviyesi açıklaması
  const getFocusDescription = (level) => {
    if (level >= 9) return 'Zirve Konsantrasyon';
    if (level >= 8) return 'Mükemmel';
    if (level >= 7) return 'Çok İyi';
    if (level >= 6) return 'İyi';
    if (level >= 5) return 'Orta';
    if (level >= 4) return 'Az Dağınık';
    if (level >= 3) return 'Oldukça Dağınık';
    if (level >= 2) return 'Dağınık';
    return 'Çok Dağınık';
  };

  const getFocusColor = (level) => {
    if (level >= 8) return colors.success;
    if (level >= 5) return colors.warning;
    return colors.error;
  };

  // Tarih formatlama
  const formatFullDate = () => {
    const date = new Date(study.fullDate || study.study_date || study.created_at);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // İlerleme barı component'i
  const ProgressBar = ({ value, color, maxValue = 100 }) => {
    const percentage = Math.min((value / maxValue) * 100, 100);
    return (
      <View style={styles.progressBarContainer}>
        <View 
          style={[
            styles.progressBarFill, 
            { width: `${percentage}%`, backgroundColor: color }
          ]} 
        />
      </View>
    );
  };

  const handleDelete = () => {
    // Confirmation modal'ı parent component'te handle edilecek
    // Burada sadece onDelete callback'ini çağırıyoruz
    onDelete && onDelete();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="book" size={24} color={colors.primary} />
              <Text style={styles.modalTitle} numberOfLines={1}>
                {study.subject}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            {/* Çalışma Bilgileri */}
            <View style={styles.section}>
              <View style={styles.infoRow}>
                <Ionicons name="clipboard" size={20} color={colors.primary} />
                <Text style={styles.infoText}>{getStudyTypeLabel(study.study_type || study.studyType || 'test')}</Text>
              </View>
              {study.topic && (
                <View style={styles.infoRow}>
                  <Ionicons name="bookmark" size={20} color={colors.secondary} />
                  <Text style={styles.infoText}>{study.topic}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <Text style={styles.infoText}>{formatFullDate()}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time" size={20} color={colors.primary} />
                <Text style={styles.infoText}>{study.duration} dakika</Text>
              </View>
            </View>

            {/* Soru İstatistikleri */}
            {totalQuestions > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Soru İstatistikleri</Text>
                
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Ionicons name="checkmark-circle" size={32} color={colors.success} />
                    <Text style={styles.statValue}>{study.correct || 0}</Text>
                    <Text style={styles.statLabel}>Doğru</Text>
                  </View>
                  
                  <View style={styles.statBox}>
                    <Ionicons name="close-circle" size={32} color={colors.error} />
                    <Text style={styles.statValue}>{study.wrong || 0}</Text>
                    <Text style={styles.statLabel}>Yanlış</Text>
                  </View>
                  
                  <View style={styles.statBox}>
                    <Ionicons name="remove-circle" size={32} color={colors.textLight} />
                    <Text style={styles.statValue}>{study.empty || 0}</Text>
                    <Text style={styles.statLabel}>Boş</Text>
                  </View>
                  
                  <View style={[styles.statBox, styles.netBox]}>
                    <Text style={styles.netIcon}>🎯</Text>
                    <Text style={styles.netValue}>{netScore}</Text>
                    <Text style={styles.statLabel}>Net</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Performans Analizi */}
            {totalQuestions > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performans Analizi</Text>
                
                {/* Doğruluk Oranı */}
                <View style={styles.performanceItem}>
                  <View style={styles.performanceHeader}>
                    <Text style={styles.performanceLabel}>Doğruluk Oranı</Text>
                    <Text style={styles.performanceValue}>{accuracyRate}%</Text>
                  </View>
                  <ProgressBar value={accuracyRate} color={colors.success} />
                </View>

                {/* Soru Başına Süre */}
                <View style={styles.performanceItem}>
                  <View style={styles.performanceHeader}>
                    <Text style={styles.performanceLabel}>Soru Başına Süre</Text>
                    <Text style={styles.performanceValue}>{timePerQuestion} dk</Text>
                  </View>
                  <View style={styles.infoChip}>
                    <Ionicons name="speedometer" size={16} color={colors.secondary} />
                    <Text style={styles.infoChipText}>
                      {questionsPerMinute} soru/dakika
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Odaklanma Seviyesi */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Odaklanma Seviyesi</Text>
              
              <View style={styles.focusContainer}>
                <View style={styles.focusHeader}>
                  <Ionicons 
                    name="flame" 
                    size={32} 
                    color={getFocusColor(study.focusLevel || study.focus_level || 5)} 
                  />
                  <View style={styles.focusInfo}>
                    <Text style={styles.focusScore}>
                      {study.focusLevel || study.focus_level || 5}/10
                    </Text>
                    <Text style={styles.focusDescription}>
                      {getFocusDescription(study.focusLevel || study.focus_level || 5)}
                    </Text>
                  </View>
                </View>
                <ProgressBar 
                  value={study.focusLevel || study.focus_level || 5} 
                  color={getFocusColor(study.focusLevel || study.focus_level || 5)}
                  maxValue={10}
                />
              </View>
            </View>

            {/* Notlar */}
            {study.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notlar</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{study.notes}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {onEdit && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.editButton]}
                onPress={() => {
                  onEdit();
                  onClose();
                }}
              >
                <Ionicons name="pencil" size={20} color={colors.surface} />
                <Text style={styles.actionButtonText}>Düzenle</Text>
              </TouchableOpacity>
            )}
            
            {onDelete && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <Ionicons name="trash" size={20} color={colors.surface} />
                <Text style={styles.actionButtonText}>Sil</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 8000,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: SIZES.radius * 2,
    borderTopRightRadius: SIZES.radius * 2,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalTitle: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: SIZES.padding,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoText: {
    fontSize: SIZES.body,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: (width - SIZES.padding * 2 - 36) / 4,
    backgroundColor: colors.background,
    borderRadius: SIZES.radius,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  netBox: {
    backgroundColor: colors.primary + '15',
  },
  statValue: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  netIcon: {
    fontSize: 32,
  },
  netValue: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
  },
  performanceItem: {
    marginBottom: 16,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceLabel: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  performanceValue: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  infoChipText: {
    fontSize: SIZES.tiny,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  focusContainer: {
    backgroundColor: colors.background,
    borderRadius: SIZES.radius,
    padding: 16,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  focusInfo: {
    flex: 1,
  },
  focusScore: {
    fontSize: SIZES.h3,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  focusDescription: {
    fontSize: SIZES.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notesBox: {
    backgroundColor: colors.background,
    borderRadius: SIZES.radius,
    padding: 16,
  },
  notesText: {
    fontSize: SIZES.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.surface,
  },
});

