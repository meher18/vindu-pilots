import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getISTDateString } from '@/utils/dateUtils';
import { router } from 'expo-router';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  const processScanMutation = useMutation({
    mutationFn: async (qrData: string) => {
      let parsed;
      try {
        parsed = JSON.parse(qrData);
      } catch (e) {
        throw new Error("Invalid QR code. Please ask the vendor to regenerate.");
      }

      if (!parsed.pickup_secret) {
        throw new Error("This QR code is obsolete. Please ask the vendor to generate a new secure QR code.");
      }

      const { error: rpcError, data: count } = await supabase.rpc('secure_driver_claim_batch', {
        p_secret: parsed.pickup_secret
      });

      if (rpcError) throw rpcError;
      return count as number;
    },
    onSuccess: (count) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessMessage(`✅ Pickup Confirmed! ${count} deliveries marked as picked up.`);
      queryClient.invalidateQueries({ queryKey: ['myDeliveries'] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message, [{ text: 'OK', onPress: () => setScanned(false) }]);
    }
  });

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    processScanMutation.mutate(data);
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        <View style={styles.overlay}>
          <Text style={styles.instructionText}>Point at vendor&apos;s QR code</Text>
          
          <View style={styles.reticleContainer}>
            <View style={[styles.reticleCorner, styles.topLeft]} />
            <View style={[styles.reticleCorner, styles.topRight]} />
            <View style={[styles.reticleCorner, styles.bottomLeft]} />
            <View style={[styles.reticleCorner, styles.bottomRight]} />
          </View>
        </View>

        {successMessage && (
          <View style={styles.successOverlay}>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back to Route</Text>
            </TouchableOpacity>
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  instructionText: { color: '#F8FAFC', fontSize: 16, position: 'absolute', top: 100, fontWeight: '600' },
  reticleContainer: { width: 250, height: 250, position: 'relative' },
  reticleCorner: { position: 'absolute', width: 40, height: 40, borderColor: '#3B82F6' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  permissionText: { color: '#F8FAFC', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 8, alignSelf: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16, 185, 129, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successText: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  backButton: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#10B981', fontWeight: 'bold', fontSize: 16 },
});
