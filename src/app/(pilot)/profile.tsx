import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getISTDateString } from '@/utils/dateUtils';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, role')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['pilot_stats', user?.id],
    queryFn: async () => {
      const today = getISTDateString();
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, date, status')
        .eq('driver_id', user?.id)
        .eq('status', 'delivered');
        
      if (error) throw error;
      
      return {
        total: data.length,
        today: data.filter(d => d.date === today).length
      };
    },
    enabled: !!user?.id,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        {isLoadingProfile ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.full_name?.charAt(0) || 'P'}
              </Text>
            </View>
            <Text style={styles.name}>{profile?.full_name || 'Unknown Pilot'}</Text>
            <Text style={styles.phone}>{profile?.phone || 'No phone number'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{profile?.role || 'Pilot'}</Text>
            </View>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {isLoadingStats ? '-' : stats?.total || 0}
            </Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {isLoadingStats ? '-' : stats?.today || 0}
            </Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Vindu Pilots v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#1E293B', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { fontSize: 32, color: '#F8FAFC', fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 4 },
  phone: { fontSize: 14, color: '#94A3B8', marginBottom: 12 },
  roleBadge: { backgroundColor: 'rgba(59, 130, 246, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  statBox: { flex: 1, backgroundColor: '#1E293B', padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#334155' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#10B981', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#94A3B8', textTransform: 'uppercase' },
  spacer: { flex: 1 },
  signOutButton: { backgroundColor: '#EF4444', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  signOutText: { color: '#F8FAFC', fontWeight: 'bold', fontSize: 16 },
  version: { color: '#94A3B8', textAlign: 'center', fontSize: 12, marginBottom: 8 },
});
