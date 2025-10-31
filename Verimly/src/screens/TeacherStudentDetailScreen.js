import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { DARK_COLORS, COLORS } from '../constants/theme';
import { Container, Card } from '../components';
import { supabase } from '../lib/supabase';
import Svg, { Circle, Path } from 'react-native-svg';

// Gerçek dairesel pasta grafik komponenti
const PieChart = ({ data, size = 200, styles }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) {
    return (
      <View style={[styles.emptyChart, { width: size, height: size }]}>
        <Text style={styles.emptyChartText}>Veri Yok</Text>
      </View>
    );
  }
  
  const radius = size / 2 - 10;
  const centerX = size / 2;
  const centerY = size / 2;
  
  let currentAngle = -90; // -90 derece ile başla (12 o'clock pozisyonu)
  
  const createArcPath = (startAngle, endAngle) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", centerX, centerY,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };
  
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };
  
  return (
    <View style={[styles.pieChartContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const angle = (item.value / total) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle += angle;
          
          
          // Tek ders %100 ise tam daire çiz
          if (data.length === 1 && percentage === 100) {
            return (
              <Circle
                key={index}
                cx={centerX}
                cy={centerY}
                r={radius}
                fill={item.color}
                stroke={styles.colors?.border || '#000'}
                strokeWidth={1}
              />
            );
          }
          
          return (
            <Path
              key={index}
              d={createArcPath(startAngle, endAngle)}
              fill={item.color}
              stroke={styles.colors?.border || '#000'}
              strokeWidth={1}
            />
          );
        })}
      </Svg>
      
    </View>
  );
};

const TeacherStudentDetailScreen = ({ route, navigation }) => {
  const { studentId, studentData, selectedDate, viewMode } = route.params;
  const { isDark } = useTheme();
  const colors = isDark ? DARK_COLORS : COLORS;
  const styles = createStyles(colors);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadStudentLogs();
    }, [studentId, selectedDate, viewMode])
  );

  const getDateRange = () => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    if (viewMode === 'daily') {
      // Sadece seçilen gün - Local time olarak
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      
      // Local time kullan, UTC değil
      start.setFullYear(year, month, day);
      start.setHours(0, 0, 0, 0);
      
      end.setFullYear(year, month, day);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'weekly') {
      // Seçili tarihten 6 gün öncesinden başlayarak 7 günlük aralık
      start.setDate(start.getDate() - 6); // 6 gün öncesi
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999); // Seçili tarih dahil
    } else if (viewMode === 'monthly') {
      // Ayın başından sonuna kadar
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0); // Ayın son günü
      end.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
  };

  const loadStudentLogs = async () => {
    try {
      setLoading(true);
      
      // Tarih aralığını hesapla
      const { startDate, endDate } = getDateRange();
      
      
      // Öğrencinin çalışma loglarını al
      const { data, error } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', studentId)
        .gte('study_date', startDate.toISOString())
        .lte('study_date', endDate.toISOString())
        .order('study_date', { ascending: false });

      if (error) throw error;


      // Client-side filtreleme
      const filteredData = (data || []).filter(log => {
        const logDate = new Date(log.study_date);
        const logDateOnly = logDate.toISOString().split('T')[0];
        const startDateOnly = startDate.toISOString().split('T')[0];
        const endDateOnly = endDate.toISOString().split('T')[0];
        
        return logDateOnly >= startDateOnly && logDateOnly <= endDateOnly;
      });

      setLogs(filteredData);
    } catch (error) {
      console.error('Error loading student logs:', error);
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}dk`;
    }
    return `${mins}dk`;
  };

  const getStudyTypeLabel = (type) => {
    const types = {
      'test': 'Test/Soru Çözümü',
      'video': 'Video İzleme',
      'reading': 'Konu Çalışması',
      'practice': 'Alıştırma'
    };
    return types[type] || type;
  };

  const getStudyTypeIcon = (type) => {
    const icons = {
      'test': 'school-outline',
      'video': 'play-circle-outline',
      'reading': 'book-outline',
      'practice': 'fitness-outline'
    };
    return icons[type] || 'book-outline';
  };

  // Test çözümü yapılan toplam soru sayısını hesapla
  const getTotalQuestions = () => {
    const testLogs = logs.filter(log => log.study_type === 'test');
    return testLogs.reduce((total, log) => {
      const correct = log.correct_answers || 0;
      const wrong = log.wrong_answers || 0;
      return total + correct + wrong; // Boş sayısını dahil etme
    }, 0);
  };

  // Haftalık verileri işle
  const getWeeklyData = () => {
    const weeklyData = [];
    const today = new Date();
    
    // Seçili tarihten 6 gün öncesinden başlayarak 7 günlük aralık oluştur
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 6); // 6 gün öncesi
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayLogs = logs.filter(log => {
        const logDate = new Date(log.study_date);
        return logDate.toDateString() === date.toDateString();
      });
      
      const totalDuration = dayLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
      const totalQuestions = dayLogs
        .filter(log => log.study_type === 'test')
        .reduce((sum, log) => sum + (log.correct_answers || 0) + (log.wrong_answers || 0), 0);
      
      weeklyData.push({
        date: date,
        dayName: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        duration: totalDuration,
        questions: totalQuestions,
        studyCount: dayLogs.length
      });
    }
    
    return weeklyData;
  };

  // Ders bazında süre analizi
  const getSubjectDurationAnalysis = () => {
    const subjectData = {};
    
    logs.forEach(log => {
      const subject = log.subject;
      if (!subjectData[subject]) {
        subjectData[subject] = {
          totalDuration: 0,
          studyTypes: {}
        };
      }
      
      subjectData[subject].totalDuration += log.duration || 0;
      
      const studyType = log.study_type === 'reading' ? 'Kitap Okuma' : 
                       log.study_type === 'video' ? 'Video İzleme' :
                       log.study_type === 'practice' ? 'Alıştırma' : 'Test/Soru Çözümü';
      
      if (!subjectData[subject].studyTypes[studyType]) {
        subjectData[subject].studyTypes[studyType] = 0;
      }
      subjectData[subject].studyTypes[studyType] += log.duration || 0;
    });
    
    return Object.entries(subjectData)
      .map(([subject, data]) => ({
        subject,
        totalDuration: data.totalDuration,
        studyTypes: data.studyTypes
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration);
  };

  // Ders bazında test analizi
  const getSubjectTestAnalysis = () => {
    const subjectData = {};
    
    logs.filter(log => log.study_type === 'test').forEach(log => {
      const subject = log.subject;
      if (!subjectData[subject]) {
        subjectData[subject] = {
          correct: 0,
          wrong: 0,
          total: 0
        };
      }
      
      subjectData[subject].correct += log.correct_answers || 0;
      subjectData[subject].wrong += log.wrong_answers || 0;
      subjectData[subject].total += (log.correct_answers || 0) + (log.wrong_answers || 0);
    });
    
    return Object.entries(subjectData)
      .map(([subject, data]) => ({
        subject,
        correct: data.correct,
        wrong: data.wrong,
        total: data.total
      }))
      .sort((a, b) => b.total - a.total);
  };

  // Ders renkleri için sabit palet
  const getSubjectColors = () => {
    const pieColors = [
      '#E74C3C', // Kırmızı
      '#3498DB', // Mavi
      '#2ECC71', // Yeşil
      '#F39C12', // Turuncu
      '#9B59B6', // Mor
      '#E67E22', // Turuncu-kırmızı
      '#1ABC9C', // Turkuaz
      '#34495E', // Koyu gri
      '#E91E63', // Pembe
      '#FF5722', // Koyu turuncu
      '#795548', // Kahverengi
      '#607D8B'  // Mavi-gri
    ];
    
    return pieColors;
  };

  // Tüm dersler için ortak renk ataması
  const getAllSubjects = () => {
    const durationSubjects = getSubjectDurationAnalysis().map(item => item.subject);
    const testSubjects = getSubjectTestAnalysis().map(item => item.subject);
    const allSubjects = [...new Set([...durationSubjects, ...testSubjects])];
    return allSubjects;
  };

  // Ders adına göre renk atama
  const getColorForSubject = (subjectName) => {
    const colors = getSubjectColors();
    const allSubjects = getAllSubjects();
    const subjectIndex = allSubjects.indexOf(subjectName);
    return colors[subjectIndex % colors.length];
  };

  // Dairesel grafik için süre verilerini hazırla
  const getDurationPieData = () => {
    const subjectData = getSubjectDurationAnalysis();
    
    return subjectData.map((item) => ({
      name: item.subject,
      value: item.totalDuration,
      color: getColorForSubject(item.subject),
      percentage: subjectData.length > 0 ? Math.round((item.totalDuration / subjectData.reduce((sum, s) => sum + s.totalDuration, 0)) * 100) : 0
    }));
  };

  // Dairesel grafik için test verilerini hazırla
  const getTestPieData = () => {
    const testData = getSubjectTestAnalysis();
    
    return testData.map((item) => ({
      name: item.subject,
      value: item.total,
      color: getColorForSubject(item.subject),
      percentage: testData.length > 0 ? Math.round((item.total / testData.reduce((sum, t) => sum + t.total, 0)) * 100) : 0
    }));
  };

  if (loading) {
    return (
      <Container>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{studentData.name}</Text>
            <Text style={styles.headerSubtitle}>{studentData.email}</Text>
          </View>
        </View>

        {/* Öğrenci Bilgileri */}
        <Card style={styles.studentInfoCard}>
          <View style={styles.studentInfo}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarEmoji}>
                {studentData.avatar || '👤'}
              </Text>
            </View>
            <View style={styles.studentDetails}>
              <Text style={styles.studentName}>{studentData.name}</Text>
              <Text style={styles.studentEmail}>{studentData.email}</Text>
            </View>
          </View>
          
          <View style={styles.studentStats}>
            <View style={styles.statItem}>
              <Ionicons name="book-outline" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{studentData.totalStudies}</Text>
              <Text style={styles.statLabel}>Çalışma</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={20} color={colors.success} />
              <Text style={styles.statValue}>{formatDuration(studentData.totalTime)}</Text>
              <Text style={styles.statLabel}>Süre</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="help-circle-outline" size={20} color={colors.warning} />
              <Text style={styles.statValue}>{studentData.totalQuestions || 0}</Text>
              <Text style={styles.statLabel}>Soru</Text>
            </View>
          </View>
        </Card>

        {/* Haftalık Grafik */}
        {viewMode === 'weekly' && (
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Haftalık Performans</Text>
              <TouchableOpacity 
                style={styles.detailButton}
                onPress={() => setShowDetailModal(true)}
              >
                <Text style={styles.detailButtonText}>Detaylı İncele</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.chartContainer}>
              {(() => {
                const weeklyData = getWeeklyData();
                // Tüm değerleri birleştir ve ortak maksimum bul
                const allDurations = weeklyData.map(day => day.duration);
                const allQuestions = weeklyData.map(day => day.questions);
                const allValues = [...allDurations, ...allQuestions];
                const globalMax = Math.max(...allValues, 1);
                const maxBarHeight = 80;
                
                return weeklyData.map((day, index) => {
                  const prevDay = index > 0 ? weeklyData[index - 1] : null;
                  const durationChange = prevDay ? day.duration - prevDay.duration : 0;
                  const questionsChange = prevDay ? day.questions - prevDay.questions : 0;
                  
                  return (
                    <View key={index} style={styles.chartDay}>
                      <View style={styles.chartBars}>
                        {/* Süre çubuğu */}
                        <View style={styles.durationBarContainer}>
                          {/* Süre sayısı - çubuğun üstünde */}
                          <View style={styles.valueContainer}>
                            <Text style={styles.durationNumberText}>
                              {day.duration > 0 ? `${day.duration}` : '0'}
                            </Text>
                            <Text style={styles.durationUnitText}>dk</Text>
                          </View>
                          <View 
                            style={[
                              styles.durationBar, 
                              { 
                                height: Math.max(4, (day.duration / globalMax) * maxBarHeight),
                                backgroundColor: colors.primary
                              }
                            ]} 
                          />
                        </View>
                        
                        {/* Soru çubuğu */}
                        <View style={styles.questionsBarContainer}>
                          {/* Soru sayısı - çubuğun üstünde */}
                          <View style={styles.valueContainer}>
                            <Text style={styles.questionsNumberText}>
                              {day.questions > 0 ? `${day.questions}` : '0'}
                            </Text>
                            <Text style={styles.questionsUnitText}>soru</Text>
                          </View>
                          <View 
                            style={[
                              styles.questionsBar, 
                              { 
                                height: Math.max(4, (day.questions / globalMax) * maxBarHeight),
                                backgroundColor: colors.warning
                              }
                            ]} 
                          />
                        </View>
                      </View>
                      
                      <Text style={styles.chartDayLabel}>{day.dayName}</Text>
                    </View>
                  );
                });
              })()}
            </View>
            
            {/* Grafik açıklaması */}
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>Süre (dk)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.warning }]} />
                <Text style={styles.legendText}>Soru</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Detaylı Analiz Modal */}
        <Modal
          visible={showDetailModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Haftalık Detaylı Analiz</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowDetailModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {/* Ders Bazında Süre Analizi - Dairesel Grafik */}
              <Card style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>Ders Bazında Çalışılan Süre</Text>
                <Text style={styles.analysisSubtitle}>Kitap okuma dahil tüm çalışma türleri</Text>
                
                 <View style={styles.chartContainer}>
                   <PieChart data={getDurationPieData()} size={200} styles={{...styles, colors}} />
                   <View style={styles.legendContainer}>
                     {getDurationPieData().map((item, index) => (
                       <View key={index} style={styles.legendRow}>
                         <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                         <View style={styles.legendContent}>
                           <Text style={styles.legendLabel}>{item.name}</Text>
                           <Text style={styles.legendDetails}>{item.percentage}% • {Math.round(item.value)} dk</Text>
                         </View>
                       </View>
                     ))}
                   </View>
                 </View>
              </Card>

              {/* Ders Bazında Test Analizi - Dairesel Grafik */}
              <Card style={styles.analysisCard}>
                <Text style={styles.analysisTitle}>Ders Bazında Test Sonuçları</Text>
                <Text style={styles.analysisSubtitle}>Doğru ve yanlış cevap sayıları</Text>
                
                 <View style={styles.chartContainer}>
                   <PieChart data={getTestPieData()} size={200} styles={{...styles, colors}} />
                   <View style={styles.legendContainer}>
                     {getTestPieData().map((item, index) => (
                       <View key={index} style={styles.legendRow}>
                         <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                         <View style={styles.legendContent}>
                           <Text style={styles.legendLabel}>{item.name}</Text>
                           <Text style={styles.legendDetails}>{item.percentage}% • {Math.round(item.value)} soru</Text>
                         </View>
                       </View>
                     ))}
                   </View>
                 </View>
              </Card>
            </ScrollView>
          </View>
        </Modal>

        {/* Çalışma Logları */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Çalışma Detayları</Text>
          
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color={colors.textLight} />
              <Text style={styles.emptyText}>Bu tarihte çalışma kaydı yok</Text>
            </View>
          ) : (
            logs.map((log) => (
              <Card key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logType}>
                    <Ionicons 
                      name={getStudyTypeIcon(log.study_type)} 
                      size={20} 
                      color={colors.primary} 
                    />
                    <Text style={styles.logTypeText}>
                      {getStudyTypeLabel(log.study_type)}
                    </Text>
                  </View>
                  <Text style={styles.logDate}>{formatDate(log.study_date)}</Text>
                </View>

                <View style={styles.logContent}>
                  <Text style={styles.logSubject}>{log.subject}</Text>
                  {log.topic && (
                    <Text style={styles.logTopic}>Konu: {log.topic}</Text>
                  )}
                  
                  <View style={styles.logStats}>
                    <View style={styles.logStatItem}>
                      <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.logStatText}>{formatDuration(log.duration)}</Text>
                    </View>
                    
                    <View style={styles.logStatItem}>
                      <Ionicons name="flame-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.logStatText}>Odak: {log.focus_level}/10</Text>
                    </View>
                  </View>

                  {log.study_type === 'test' && (
                    <View style={styles.questionStats}>
                      <View style={styles.questionItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.questionText}>Doğru: {log.correct_answers}</Text>
                      </View>
                      <View style={styles.questionItem}>
                        <Ionicons name="close-circle" size={16} color={colors.error} />
                        <Text style={styles.questionText}>Yanlış: {log.wrong_answers}</Text>
                      </View>
                      <View style={styles.questionItem}>
                        <Ionicons name="remove-circle" size={16} color={colors.textSecondary} />
                        <Text style={styles.questionText}>Boş: {log.empty_answers}</Text>
                      </View>
                    </View>
                  )}

                  {log.notes && (
                    <View style={styles.logNotes}>
                      <Text style={styles.logNotesText}>{log.notes}</Text>
                    </View>
                  )}
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </Container>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Alt boşluk ekle
    flexGrow: 1, // İçerik yeterince uzun değilse bile scroll yapabilir
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  studentInfoCard: {
    margin: 16,
    padding: 16,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentAvatarEmoji: {
    fontSize: 24,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  studentEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  studentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: '22%',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Grafik stilleri
  chartCard: {
    margin: 16,
    padding: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary + '20',
    borderRadius: 20,
  },
  detailButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    marginRight: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 100,
    marginBottom: 16,
    paddingBottom: 8,
  },
  chartDay: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 2,
  },
  durationNumberText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
  },
  durationUnitText: {
    fontSize: 7,
    fontWeight: '500',
    color: colors.primary,
    textAlign: 'center',
  },
  questionsNumberText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.warning,
    textAlign: 'center',
  },
  questionsUnitText: {
    fontSize: 6,
    fontWeight: '500',
    color: colors.warning,
    textAlign: 'center',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 60,
    marginBottom: 8,
    flex: 1,
  },
  durationBarContainer: {
    width: 12,
    minHeight: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginRight: 2,
    flex: 1,
  },
  durationBar: {
    width: 12,
    borderRadius: 6,
    minHeight: 4,
  },
  questionsBarContainer: {
    width: 12,
    minHeight: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginLeft: 2,
    flex: 1,
  },
  questionsBar: {
    width: 12,
    borderRadius: 6,
    minHeight: 4,
  },
  chartDayLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  chartChanges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 2,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chartDayValue: {
    fontSize: 9,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 1,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Modal stilleri
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  analysisCard: {
    marginBottom: 16,
    padding: 16,
  },
         analysisTitle: {
           fontSize: 18,
           fontWeight: 'bold',
           color: colors.textPrimary,
           marginBottom: 4,
           textAlign: 'center',
         },
         analysisSubtitle: {
           fontSize: 14,
           color: colors.textSecondary,
           marginBottom: 16,
           textAlign: 'center',
         },
  subjectItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subjectDuration: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  studyTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  studyTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 4,
    minWidth: 120,
  },
  studyTypeName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  studyTypeDuration: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  testItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  testTotal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  testStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  testStatItem: {
    alignItems: 'center',
  },
  testStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  testStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Dairesel grafik stilleri
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    position: 'relative',
  },
  pieLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieLabelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  piePercentageText: {
    fontSize: 8,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors.border,
  },
  emptyChartText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  legendContainer: {
    flex: 1,
    marginLeft: 20,
  },
         legendRow: {
           flexDirection: 'row',
           alignItems: 'center',
           marginBottom: 12,
           paddingVertical: 4,
         },
         legendDot: {
           width: 14,
           height: 14,
           borderRadius: 7,
           marginRight: 12,
           shadowColor: '#000',
           shadowOffset: { width: 0, height: 1 },
           shadowOpacity: 0.2,
           shadowRadius: 2,
           elevation: 2,
         },
         legendContent: {
           flex: 1,
         },
         legendLabel: {
           fontSize: 15,
           fontWeight: '600',
           color: colors.textPrimary,
           marginBottom: 2,
         },
         legendDetails: {
           fontSize: 13,
           color: colors.textSecondary,
           fontWeight: '500',
         },
  logsSection: {
    padding: 16,
    flex: 1, // ScrollView içinde düzgün çalışması için
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
    marginTop: 16,
    textAlign: 'center',
  },
  logCard: {
    marginBottom: 12,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 6,
  },
  logDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  logContent: {
    flex: 1,
  },
  logSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  logTopic: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  logStats: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  logStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  logStatText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  questionStats: {
    flexDirection: 'row',
    marginTop: 8,
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  questionText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  logNotes: {
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  logNotesText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default TeacherStudentDetailScreen;
