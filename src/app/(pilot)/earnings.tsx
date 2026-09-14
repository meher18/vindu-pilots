import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getISTDateString } from '@/utils/dateUtils';

export default function EarningsDashboard() {
  const user = useAuthStore(state => state.user);
  
  const fetchEarnings = async () => {
    if (!user?.id) return [];
    const { data, error } = await supabase
      .from('driver_ledger')
      .select('id, gross_amount, penalty_amount, net_amount, status, created_at, transaction_date')
      .eq('driver_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(60);

    if (error) throw error;
    return data;
  };

  const { data: ledger = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['earnings', user?.id],
    queryFn: fetchEarnings,
    enabled: !!user?.id,
  });

  const todayStr = getISTDateString();
  const now = new Date();
  const weekAgo = getISTDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const thisMonthStr = todayStr.substring(0, 7);

  const stats = ledger.reduce((acc, row) => {
    const net = row.net_amount || 0;
    if (row.transaction_date === todayStr) acc.today += net;
    if (row.transaction_date >= weekAgo) acc.thisWeek += net;
    if (row.transaction_date.startsWith(thisMonthStr)) acc.thisMonth += net;
    if (row.status === 'pending') acc.pending += net;
    return acc;
  }, { today: 0, thisWeek: 0, thisMonth: 0, pending: 0 });

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionRow}>
        <Text style={styles.transactionDate}>{new Date(item.transaction_date).toLocaleDateString()}</Text>
        <View style={[styles.badge, item.status === 'paid' ? styles.badgePaid : styles.badgePending]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.transactionRow}>
        <Text style={styles.amountLabel}>Gross:</Text>
        <Text style={styles.amountValue}>₹{item.gross_amount}</Text>
      </View>
      {item.penalty_amount > 0 && (
        <View style={styles.transactionRow}>
          <Text style={styles.amountLabel}>Penalty:</Text>
          <Text style={[styles.amountValue, { color: '#EF4444' }]}>-₹{item.penalty_amount}</Text>
        </View>
      )}
      <View style={[styles.transactionRow, styles.netRow]}>
        <Text style={styles.netLabel}>Net Amount:</Text>
        <Text style={styles.netValue}>₹{item.net_amount}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
        <Text style={styles.headerSubtitle}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>₹{stats.today.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statValue}>₹{stats.thisWeek.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>This Month</Text>
          <Text style={styles.statValue}>₹{stats.thisMonth.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>₹{stats.pending.toFixed(2)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      
      <FlatList
        data={ledger}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#F8FAFC" />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>Complete your first delivery to see earnings here.</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  headerSubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  statCard: { width: '45%', backgroundColor: '#1E293B', margin: '2.5%', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  statLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#F8FAFC', fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', marginHorizontal: 16, marginVertical: 12 },
  listContent: { paddingBottom: 24, paddingHorizontal: 16 },
  transactionCard: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  transactionDate: { color: '#F8FAFC', fontWeight: '500' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgePaid: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  badgePending: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  badgeText: { color: '#F8FAFC', fontSize: 10, textTransform: 'uppercase', fontWeight: 'bold' },
  amountLabel: { color: '#94A3B8', fontSize: 14 },
  amountValue: { color: '#F8FAFC', fontSize: 14 },
  netRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155', marginBottom: 0 },
  netLabel: { color: '#F8FAFC', fontWeight: 'bold' },
  netValue: { color: '#10B981', fontWeight: 'bold', fontSize: 16 },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40 },
});
