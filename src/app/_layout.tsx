import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { registerForPushNotifications } from '@/lib/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 2 },
  },
});

export default function RootLayout() {
  const { setUser, setLoading, user, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

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
        registerForPushNotifications(userId).catch(() => {});
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

