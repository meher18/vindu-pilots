import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 2 },
  },
});

function usePushNotifications(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    async function registerForPushNotificationsAsync() {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;
        try {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'your-project-id';
          const token = await Notifications.getExpoPushTokenAsync({ projectId });
          await supabase.from('profiles').update({ expo_push_token: token.data }).eq('id', userId);
        } catch (error) {
          console.error('Push notification error:', error);
        }
      }
    }
    registerForPushNotificationsAsync();
  }, [userId]);
}

export default function RootLayout() {
  const { setUser, setLoading, user, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications(user?.id);

  const verifyDriver = async (userId: string, retries = 5): Promise<void> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data?.role === 'driver') {
        setLoading(false);
        return;
      } else if (!data) {
        throw new Error('Profile not ready');
      } else {
        // Wrong role — sign them out
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
      }
    } catch (err: any) {
      if (retries > 0) {
        setTimeout(() => verifyDriver(userId, retries - 1), 1000);
        return;
      }
      await supabase.auth.signOut();
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) verifyDriver(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) verifyDriver(session.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    else if (user && inAuth) router.replace('/(pilot)');
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  );
}

