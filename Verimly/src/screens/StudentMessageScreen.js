import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Container, Card, AdBanner } from '../components';
import { getMessages, markMessageAsRead, markAllMessagesAsRead } from '../lib/messageApi';
import { supabase } from '../lib/supabase';

const StudentMessageScreen = ({ route }) => {
  const isDemo = route?.params?.isDemo || false;
  
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState({});
  const [expandedMessages, setExpandedMessages] = useState({});
  const [showOldMessages, setShowOldMessages] = useState(false);

  useEffect(() => {
    if (isDemo) {
      loadDemoMessages();
    } else {
      loadMessages();
      
      // Gerçek zamanlı güncelleme için interval
      const interval = setInterval(async () => {
        try {
          const result = await getMessages();
          if (result.success) {
            // Mesaj sayısı veya okunma durumu değiştiyse güncelle
            const currentMessages = messages;
            const newMessages = result.data;
            
            // Mesaj sayısı farklıysa güncelle
            if (currentMessages.length !== newMessages.length) {
              setMessages(newMessages);
              const senderIds = [...new Set(newMessages.map(msg => msg.sender_id))];
              await loadTeachersInfo(senderIds);
              return;
            }
            
            // Okunma durumu değiştiyse güncelle
            const hasReadStatusChanged = currentMessages.some(currentMsg => {
              const newMsg = newMessages.find(nm => nm.id === currentMsg.id);
              return newMsg && newMsg.is_read !== currentMsg.is_read;
            });
            
            if (hasReadStatusChanged) {
              setMessages(newMessages);
            }
          }
        } catch (error) {
          // Sessizce hata yok say
        }
      }, 2000); // 2 saniyede bir kontrol et

      return () => clearInterval(interval);
    }
  }, [isDemo, messages.length]);

  // Ekran odaklandığında mesajları yeniden yükle
  useFocusEffect(
    React.useCallback(() => {
      if (!isDemo) {
        loadMessages();
      }
    }, [isDemo])
  );

  const loadDemoMessages = () => {
    const demoMessages = [
      {
        id: 1,
        sender_id: 'demo-teacher-1',
        content: 'Merhaba! Bugünkü matematik dersinde çok başarılıydın. Türev konusunu çok iyi anladığını görüyorum. Devam et!',
        created_at: new Date().toISOString(),
        is_read: true,
        message_count: 1,
        latest_message_date: new Date().toISOString(),
      },
      {
        id: 2,
        sender_id: 'demo-teacher-2',
        content: 'Fizik ödevini çok güzel yapmışsın. Enerji konusunda daha fazla pratik yapmanı öneriyorum.',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        is_read: true,
        message_count: 1,
        latest_message_date: new Date(Date.now() - 86400000).toISOString(),
      }
    ];
    
    setMessages(demoMessages);
    
    const demoTeachers = {
      'demo-teacher-1': { name: 'Osman Batır', email: 'osman@demo.com' },
      'demo-teacher-2': { name: 'Ayşe Yılmaz', email: 'ayse@demo.com' }
    };
    
    setTeachers(demoTeachers);
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const result = await getMessages();
      if (result.success) {
        setMessages(result.data);
        const senderIds = [...new Set(result.data.map(msg => msg.sender_id))];
        await loadTeachersInfo(senderIds);
      }
    } catch (error) {
      console.error('Mesajlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeachersInfo = async (senderIds) => {
    try {
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('user_id, name, email')
        .in('user_id', senderIds);

      if (teachersError || !teachersData || teachersData.length === 0) {
        const { data: teacherProfiles, error: userProfilesError } = await supabase
          .from('user_profiles')
          .select('user_id, name, email')
          .in('user_id', senderIds);

        if (userProfilesError || !teacherProfiles) {
          return;
        }

        const teacherMap = {};
        teacherProfiles?.forEach(profile => {
          if (!profile.name || profile.name.trim() === '' || profile.name.startsWith('Kullanıcı')) {
            teacherMap[profile.user_id] = {
              name: `Öğretmen ${profile.user_id.substring(0, 8)}`,
              email: profile.email || ''
            };
          } else {
            teacherMap[profile.user_id] = {
              name: profile.name,
              email: profile.email || ''
            };
          }
        });
        setTeachers(teacherMap);
        return;
      }

      const teacherMap = {};
      teachersData?.forEach(teacher => {
        const fullName = teacher.name || 'Bilinmeyen Öğretmen';
        teacherMap[teacher.user_id] = {
          name: fullName,
          email: teacher.email || ''
        };
      });

      setTeachers(teacherMap);
    } catch (error) {
      console.error('Öğretmen bilgileri yüklenirken hata:', error);
      const teacherMap = {};
      senderIds.forEach(id => {
        teacherMap[id] = {
          name: `Öğretmen ${id.substring(0, 8)}`,
          email: ''
        };
      });
      setTeachers(teacherMap);
    }
  };

  const groupMessages = (messages) => {
    // Tüm mesajları öğretmen bazında gruplandır
    const groupedByTeacher = {};
    
    messages.forEach(msg => {
      const teacherId = msg.sender_id;
      if (!groupedByTeacher[teacherId]) {
        groupedByTeacher[teacherId] = {
          teacherId,
          messages: [],
          hasUnread: false
        };
      }
      groupedByTeacher[teacherId].messages.push(msg);
      if (!msg.is_read) {
        groupedByTeacher[teacherId].hasUnread = true;
      }
    });
    
    // Her öğretmen için mesajları tarihe göre sırala (en yeni üstte)
    Object.values(groupedByTeacher).forEach(group => {
      group.messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    });
    
    return Object.values(groupedByTeacher);
  };

  const renderTeacherMessageGroup = (group) => {
    const teacherInfo = teachers[group.teacherId];
    const teacherName = teacherInfo?.name?.trim() || `Öğretmen ${group.teacherId.substring(0, 8)}`;
    const latestMessage = group.messages[0];
    const isExpanded = expandedMessages[group.teacherId] || false;
    
    return (
      <View key={group.teacherId} style={styles.teacherMessageGroup}>
        <TouchableOpacity 
          style={styles.teacherMessageHeader}
          onPress={async () => {
            setExpandedMessages(prev => ({
              ...prev,
              [group.teacherId]: !isExpanded
            }));
            
            // Eğer kart açılıyorsa ve okunmamış mesajlar varsa, onları okunmuş olarak işaretle
            if (!isExpanded && group.hasUnread && !isDemo) {
              const unreadMessages = group.messages.filter(msg => !msg.is_read);
              for (const msg of unreadMessages) {
                const result = await markMessageAsRead(msg.id);
                if (result.success) {
                  setMessages(prev => prev.map(m => 
                    m.id === msg.id ? { ...m, is_read: true } : m
                  ));
                }
              }
            }
          }}
        >
          <View style={styles.teacherMessageHeaderContent}>
            <View style={styles.teacherMessageAvatar}>
              <Text style={styles.teacherMessageAvatarText}>
                {teacherName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.teacherMessageInfo}>
              <View style={styles.teacherMessageTitleRow}>
                <Text style={styles.teacherMessageTitle}>{teacherName}</Text>
                {group.hasUnread && (
                  <View style={styles.teacherMessageNewBadge}>
                    <Text style={styles.teacherMessageNewText}>YENİ</Text>
                  </View>
                )}
              </View>
              <Text style={styles.teacherMessageSubtitle}>
                {group.messages.length} mesaj • {new Date(latestMessage.created_at).toLocaleDateString('tr-TR')}
              </Text>
            </View>
            <View style={styles.teacherMessageArrow}>
              <Text style={styles.teacherMessageExpandIcon}>
                {isExpanded ? '▼' : '▶'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.teacherMessageContent}>
            {group.messages.map((msg, index) => (
              <View key={msg.id} style={styles.teacherMessageItem}>
                <View style={styles.teacherMessageTime}>
                  <Text style={styles.teacherMessageTimeText}>
                    {new Date(msg.created_at).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={[
                  styles.teacherMessageBubble,
                  !msg.is_read && styles.teacherMessageBubbleNew
                ]}>
                  <Text style={styles.teacherMessageText}>{msg.content}</Text>
                  {!msg.is_read && (
                    <View style={styles.teacherMessageItemNewBadge}>
                      <Text style={styles.teacherMessageItemNewText}>YENİ</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderSingleMessage = (item) => {
    const teacherInfo = teachers[item.sender_id];
    const senderName = teacherInfo?.name?.trim() || `Öğretmen ${item.sender_id.substring(0, 8)}`;
    const isExpanded = expandedMessages[item.id] || false;
    
    return (
      <View key={item.id} style={styles.testMessageCard}>
        <TouchableOpacity 
          style={styles.testCardHeader}
          onPress={async () => {
            if (isDemo) {
              const isCurrentlyExpanded = expandedMessages[item.id] || false;
              setExpandedMessages(prev => ({
                ...prev,
                [item.id]: !isCurrentlyExpanded
              }));
              return;
            }
            
            const isCurrentlyExpanded = expandedMessages[item.id] || false;
            setExpandedMessages(prev => ({
              ...prev,
              [item.id]: !isCurrentlyExpanded
            }));
            
            if (!item.is_read) {
              const result = await markMessageAsRead(item.id);
              if (result.success) {
                setMessages(prev => prev.map(msg => 
                  msg.id === item.id ? { ...msg, is_read: true } : msg
                ));
              }
            }
          }}
        >
          <View style={styles.testCardContent}>
            <View style={styles.testAvatar}>
              <Text style={styles.testAvatarText}>
                {senderName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.testMessageInfo}>
              <View style={styles.testMessageHeader}>
                <Text style={styles.testTeacherName}>
                  {senderName}
                </Text>
                {!item.is_read && (
                  <View style={styles.testNewBadge}>
                    <Text style={styles.testNewText}>YENİ</Text>
                  </View>
                )}
              </View>
              <Text style={styles.testMessageTime}>
                {new Date(item.created_at).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.testArrow}>
              <Text style={styles.testExpandIcon}>
                {isExpanded ? '▼' : '▶'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.testMessageContent}>
            <Text style={styles.testMessageText}>{item.content}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <Container>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
        </View>
      </Container>
    );
  }

  const teacherGroups = groupMessages(messages);

  return (
    <Container>
      <View style={styles.container}>
        <Text style={styles.title}>Öğretmen Mesajları</Text>
        
        {/* Mesajlar En Üst Banner Reklam */}
        <AdBanner 
          style={styles.messagesBanner}
          screenName="studentMessage"
        />
        
        <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
          {teacherGroups.map(group => renderTeacherMessageGroup(group))}
          
          {messages.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>
                Öğretmeninizden mesaj geldiğinde burada görünecek
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  messagesList: {
    flex: 1,
  },
  newMessagesSection: {
    marginBottom: 20,
  },
  oldMessagesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modern minimal tasarım stilleri
  testMessageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testCardHeader: {
    padding: 16,
  },
  testCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  testAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testMessageInfo: {
    flex: 1,
  },
  testMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  testTeacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  testNewBadge: {
    backgroundColor: '#ff0000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  testNewText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  testMessageTime: {
    fontSize: 14,
    color: '#666',
  },
  testArrow: {
    marginLeft: 8,
  },
  testExpandIcon: {
    fontSize: 16,
    color: '#999',
  },
  testMessageContent: {
    padding: 16,
    paddingTop: 0,
  },
  testMessageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Öğretmen mesaj grubu stilleri
  teacherMessageGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teacherMessageHeader: {
    padding: 16,
  },
  teacherMessageHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teacherMessageAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherMessageAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  teacherMessageInfo: {
    flex: 1,
  },
  teacherMessageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  teacherMessageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  teacherMessageNewBadge: {
    backgroundColor: '#ff0000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  teacherMessageNewText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teacherMessageSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  teacherMessageArrow: {
    marginLeft: 8,
  },
  teacherMessageExpandIcon: {
    fontSize: 16,
    color: '#999',
  },
  teacherMessageContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  teacherMessageItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  teacherMessageTime: {
    width: 60,
    marginRight: 12,
    marginTop: 2,
  },
  teacherMessageTimeText: {
    fontSize: 12,
    color: '#999',
  },
  teacherMessageBubble: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    position: 'relative',
  },
  teacherMessageBubbleNew: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  teacherMessageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  teacherMessageItemNewBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff0000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  teacherMessageItemNewText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  messagesBanner: {
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 8,
    overflow: 'hidden',
    height: 60,
  },
});

export default StudentMessageScreen;