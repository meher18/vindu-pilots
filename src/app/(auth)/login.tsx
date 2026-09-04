import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function PilotLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');

  async function handleAuth() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          Alert.alert('Missing Name', 'Please enter your full name.');
          setLoading(false);
          return;
        }
        const { data: { session }, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              requested_role: 'driver',
              full_name: fullName.trim(),
            },
          },
        });
        if (error) Alert.alert('Sign Up Failed', error.message);
        else if (!session) Alert.alert('Check Your Inbox ✈️', 'We sent a confirmation link to your email. Click it to activate your Pilot account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) Alert.alert('Login Failed', error.message);
      }
    } catch {
      Alert.alert('Network Error', 'Could not connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Text style={styles.logoEmoji}>✈️</Text>
            </View>
            <Text style={styles.logoText}>Vindu Pilots</Text>
            <Text style={styles.tagline}>Your delivery mission,{'\n'}starts here.</Text>
          </View>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isSignUp ? 'Join the Fleet' : 'Welcome Back, Pilot'}</Text>
            <Text style={styles.cardSub}>{isSignUp ? 'Create your pilot account to start delivering.' : 'Sign in to see your route for today.'}</Text>

            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="As on your ID"
                  placeholderTextColor="#64748B"
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#64748B"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleAuth}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.primaryBtnText}>{isSignUp ? 'Create Pilot Account' : 'Sign In →'}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchWrap} onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={styles.switchText}>
                {isSignUp ? 'Already in the fleet? ' : 'New pilot? '}
                <Text style={styles.switchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>Vindu Pilots · For authorized delivery partners only</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },

  hero: { alignItems: 'center', marginBottom: 36 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, shadowColor: '#3B82F6', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  logoEmoji: { fontSize: 38 },
  logoText: { fontSize: 32, fontWeight: '900', color: '#F8FAFC', letterSpacing: -1 },
  tagline: { fontSize: 16, color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 24 },

  card: {
    backgroundColor: '#1E293B', borderRadius: 28, padding: 28,
    borderWidth: 1, borderColor: '#334155',
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  cardSub: { fontSize: 14, color: '#94A3B8', marginBottom: 28, lineHeight: 20 },

  inputGroup: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#0F172A', borderWidth: 1.5, borderColor: '#334155',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#F8FAFC',
  },

  primaryBtn: {
    backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#3B82F6', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  switchWrap: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 14, color: '#64748B' },
  switchLink: { color: '#60A5FA', fontWeight: '700' },

  footer: { fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 28 },
});

