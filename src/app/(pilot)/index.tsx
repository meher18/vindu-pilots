import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Modal, TextInput, Linking, Alert, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export default function DeliveryHubScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchMyDeliveries = async () => {
    if (!user?.id) return [];
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id, status, otp_code, date, vendor_ready_at, qr_scanned_at, delivered_at,
        customer_subscriptions (
          quantity,
          customer_id,
          subscriptions (
            slot_name, diet_type,
            kitchens ( name, address )
          )
        )
      `)
      .eq('driver_id', user.id)
      .eq('date', today)
      .order('status', { ascending: true });

    if (error) throw error;
    
    // Fetch customer profiles to get phone numbers and delivery addresses
    const customerIds = [...new Set(data.map((d: any) => d.customer_subscriptions?.customer_id).filter(Boolean))];
    const profiles: Record<string, { phone?: string; delivery_address?: string }> = {};
    if (customerIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, phone, delivery_address')
        .in('id', customerIds);
      if (profileData) {
        profileData.forEach((p: any) => { profiles[p.id] = { phone: p.phone, delivery_address: p.delivery_address }; });
      }
    }

    return data.map((d: any) => ({
      ...d,
      customer_phone: profiles[d.customer_subscriptions?.customer_id]?.phone,
      customer_delivery_address: profiles[d.customer_subscriptions?.customer_id]?.delivery_address,
    }));
  };

  const fetchUnclaimedDeliveries = async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id, status, date,
        customer_subscriptions (
          quantity,
          subscriptions (
            slot_name, diet_type,
            kitchens ( name, address )
          )
        )
      `)
      .eq('date', today)
      .eq('status', 'vendor_ready')
      .is('driver_id', null);

    if (error) throw error;
    return data;
  };

  const { data: myDeliveries = [], isLoading: isLoadingMy, refetch: refetchMy, isRefetching: isRefetchingMy } = useQuery({
    queryKey: ['myDeliveries', today],
    queryFn: fetchMyDeliveries,
    enabled: !!user?.id,
  });

  const { data: unclaimedDeliveries = [], isLoading: isLoadingUnclaimed, refetch: refetchUnclaimed, isRefetching: isRefetchingUnclaimed } = useQuery({
    queryKey: ['unclaimedDeliveries', today],
    queryFn: fetchUnclaimedDeliveries,
  });

  const claimMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase.from('deliveries').update({ driver_id: user?.id }).eq('id', deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['myDeliveries'] });
      queryClient.invalidateQueries({ queryKey: ['unclaimedDeliveries'] });
    },
  });

  const markPickedUpMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase.from('deliveries').update({ 
        status: 'picked_up', 
        qr_scanned_at: new Date().toISOString() 
      }).eq('id', deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myDeliveries'] });
    },
  });

  const markDeliveredMutation = useMutation({
    mutationFn: async ({ deliveryId, otp }: { deliveryId: string, otp: string }) => {
      const delivery = myDeliveries.find(d => d.id === deliveryId);
      if (delivery?.otp_code !== otp) {
        throw new Error("Wrong OTP. Ask the customer to check their app.");
      }
      const { error } = await supabase.from('deliveries').update({ 
        status: 'delivered', 
        delivered_at: new Date().toISOString() 
      }).eq('id', deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['myDeliveries'] });
      setOtpModalVisible(false);
      setOtpInput('');
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message);
    }
  });

  const onRefresh = () => {
    refetchMy();
    refetchUnclaimed();
  };

  const handleClaim = (deliveryId: string) => {
    claimMutation.mutate(deliveryId);
  };

  const handleMarkDeliveredPress = (deliveryId: string) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        "Enter OTP",
        "Ask the customer for the OTP code",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", onPress: (otp) => otp && markDeliveredMutation.mutate({ deliveryId, otp }) }
        ],
        'plain-text'
      );
    } else {
      setSelectedDeliveryId(deliveryId);
      setOtpModalVisible(true);
    }
  };

  const renderMyDelivery = ({ item }: { item: any }) => {
    const isVendorReady = item.status === 'vendor_ready';
    const isPickedUp = item.status === 'picked_up';
    const isDelivered = item.status === 'delivered';
    const sub = item.customer_subscriptions?.subscriptions;
    const kitchen = sub?.kitchens;

    if (isDelivered) {
      return (
        <View style={[styles.card, styles.cardDelivered]}>
          <Text style={styles.deliveredText}>✅ Delivered at {new Date(item.delivered_at).toLocaleTimeString()}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, isVendorReady ? styles.cardReady : styles.cardEnRoute]}>
        <Text style={styles.cardStatus}>{isVendorReady ? "Ready for Pickup" : "En Route"}</Text>
        <Text style={styles.cardTitle}>{kitchen?.name || 'Unknown Kitchen'}</Text>
        <Text style={styles.cardSubtitle}>{kitchen?.address || 'Unknown Address'}</Text>
        <Text style={styles.cardSubtitle}>Slot: {sub?.slot_name} | Qty: {item.customer_subscriptions?.quantity}</Text>
        
        <View style={styles.cardActions}>
          {isVendorReady && (
            <>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => router.push('/scanner')}
              >
                <Text style={styles.actionButtonText}>Scan QR (Pickup)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { marginTop: 8 }]} 
                onPress={() => markPickedUpMutation.mutate(item.id)}
              >
                <Text style={styles.actionButtonText}>Manual Pickup (Fallback)</Text>
              </TouchableOpacity>
            </>
          )}
          {isPickedUp && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#1E40AF' }]}
                onPress={() => {
                  const address = item.customer_delivery_address;
                  if (address) {
                    const encoded = encodeURIComponent(address);
                    Linking.openURL(`https://maps.google.com/?q=${encoded}`);
                  } else {
                    Alert.alert('No Address', 'Customer delivery address is not set.');
                  }
                }}
              >
                <Text style={styles.actionButtonText}>🗺️ Navigate</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { marginTop: 8 }]} 
                onPress={() => {
                  if (item.customer_phone) Linking.openURL(`tel:${item.customer_phone}`);
                  else Alert.alert('Error', 'No phone number found for this customer.');
                }}
              >
                <Text style={styles.actionButtonText}>📞 Call Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.primaryButton, { marginTop: 8 }]} 
                onPress={() => handleMarkDeliveredPress(item.id)}
              >
                <Text style={styles.primaryButtonText}>✅ Mark Delivered</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderUnclaimed = ({ item }: { item: any }) => {
    const sub = item.customer_subscriptions?.subscriptions;
    const kitchen = sub?.kitchens;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{kitchen?.name || 'Unknown Kitchen'}</Text>
        <Text style={styles.cardSubtitle}>Slot: {sub?.slot_name}</Text>
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton, { marginTop: 12 }]} 
          onPress={() => handleClaim(item.id)}
          disabled={claimMutation.isPending}
        >
          <Text style={styles.primaryButtonText}>Claim This Run</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Today&apos;s Route</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{myDeliveries.length}</Text>
        </View>
      </View>

      <FlatList
        data={[...myDeliveries, ...(myDeliveries.length > 0 || unclaimedDeliveries.length > 0 ? [{ id: 'header_unclaimed' }] : []), ...unclaimedDeliveries]}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetchingMy || isRefetchingUnclaimed} onRefresh={onRefresh} tintColor="#F8FAFC" />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          (isLoadingMy || isLoadingUnclaimed) ? (
            <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>No deliveries available today.</Text>
          )
        }
        renderItem={({ item }) => {
          if (item.id === 'header_unclaimed') {
            return unclaimedDeliveries.length > 0 ? (
              <Text style={styles.sectionTitle}>Available Pickups</Text>
            ) : null;
          }
          if (item.driver_id === user?.id) {
            return renderMyDelivery({ item });
          }
          return renderUnclaimed({ item });
        }}
        ListHeaderComponent={myDeliveries.length > 0 ? <Text style={styles.sectionTitle}>My Deliveries</Text> : null}
      />

      <Modal visible={otpModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter OTP</Text>
            <Text style={styles.modalSubtitle}>Ask the customer for their OTP.</Text>
            <TextInput
              style={styles.modalInput}
              value={otpInput}
              onChangeText={setOtpInput}
              keyboardType="number-pad"
              placeholder="0000"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setOtpModalVisible(false)}>
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.primaryButton]} 
                onPress={() => {
                  if (selectedDeliveryId) markDeliveredMutation.mutate({ deliveryId: selectedDeliveryId, otp: otpInput });
                }}
              >
                <Text style={styles.primaryButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  headerDate: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  badge: { backgroundColor: '#3B82F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', marginVertical: 16, paddingHorizontal: 16 },
  listContent: { paddingBottom: 24 },
  card: { backgroundColor: '#1E293B', marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  cardReady: { borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  cardEnRoute: { borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  cardDelivered: { borderLeftWidth: 4, borderLeftColor: '#10B981', paddingVertical: 12 },
  cardStatus: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 4 },
  deliveredText: { color: '#10B981', fontWeight: '500' },
  cardActions: { marginTop: 12, gap: 8 },
  actionButton: { backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#F8FAFC', fontWeight: '500' },
  primaryButton: { backgroundColor: '#3B82F6' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1E293B', padding: 24, borderRadius: 12, width: '80%', borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 8 },
  modalSubtitle: { color: '#94A3B8', marginBottom: 16 },
  modalInput: { backgroundColor: '#0F172A', color: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', fontSize: 18, textAlign: 'center', marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalButton: { padding: 12, borderRadius: 8, minWidth: 80, alignItems: 'center' },
});
