/**
 * =========================================================
 * RESET SESSION SCREEN — AFROEAT
 * Accessible via /auth/reset
 * Permet de purger toutes les données locales et de
 * repartir de zéro sans désinstaller l'app.
 * =========================================================
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

export default function ResetScreen() {
  const auth = useAuth() || {};
  const clearAllLocalAppData = auth.clearAllLocalAppData;

  const [testing, setTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);
  const [clearing, setClearing] = useState(false);

  const handleTestServer = useCallback(async () => {
    setTesting(true);
    setServerStatus(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${API_BASE_URL}/restaurants`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setServerStatus({ ok: true, code: response.status });
    } catch (err) {
      const msg = err?.name === 'AbortError'
        ? 'Timeout — serveur injoignable après 5s'
        : err?.message || 'Erreur réseau';
      setServerStatus({ ok: false, msg });
    } finally {
      setTesting(false);
    }
  }, []);

  const handleClearSession = useCallback(async () => {
    Alert.alert(
      'Effacer toutes les données',
      'Cela supprime le compte local, le panier et le token. Tu devras te reconnecter.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              if (typeof clearAllLocalAppData === 'function') {
                await clearAllLocalAppData();
              } else {
                await AsyncStorage.clear();
              }
              Alert.alert(
                '✅ Session effacée',
                'Données supprimées. Crée un nouveau compte ou connecte-toi.',
                [{ text: 'OK', onPress: () => router.replace('/auth/role') }]
              );
            } catch {
              Alert.alert('Erreur', 'Impossible d\'effacer les données.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  }, [clearAllLocalAppData]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.topTitle}>Diagnostic & Reset</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* IP Config */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="wifi-outline" size={20} color="#245EA8" />
            <Text style={styles.cardTitle}>Configuration réseau</Text>
          </View>
          <Text style={styles.label}>URL backend détectée :</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{API_BASE_URL}</Text>
          </View>
          <Text style={styles.hint}>
            Si cette URL ne correspond pas à l'adresse de ton serveur, ouvre{' '}
            <Text style={styles.bold}>constants/api.js</Text> et corrige{' '}
            <Text style={styles.bold}>LOCAL_IP</Text>.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
            onPress={handleTestServer}
            disabled={testing}
          >
            {testing
              ? <ActivityIndicator size="small" color="#245EA8" />
              : <Text style={styles.btnSecondaryText}>🔌 Tester la connexion serveur</Text>}
          </Pressable>

          {serverStatus && (
            <View style={[styles.statusBox, serverStatus.ok ? styles.statusOk : styles.statusErr]}>
              <Ionicons
                name={serverStatus.ok ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={serverStatus.ok ? '#1F6F43' : '#B63B3B'}
              />
              <Text style={[styles.statusText, serverStatus.ok ? styles.statusTextOk : styles.statusTextErr]}>
                {serverStatus.ok
                  ? `✅ Serveur accessible (HTTP ${serverStatus.code})`
                  : `❌ ${serverStatus.msg}`}
              </Text>
            </View>
          )}
        </View>

        {/* Reset Session */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="refresh-circle-outline" size={20} color="#D96C2D" />
            <Text style={styles.cardTitle}>Réinitialiser la session</Text>
          </View>
          <Text style={styles.hint}>
            Si tu as un compte bloqué, un token périmé, ou un message
            "compte non actif", efface les données locales pour repartir de zéro.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.pressed, clearing && styles.btnDisabled]}
            onPress={handleClearSession}
            disabled={clearing}
          >
            {clearing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnDangerText}>🗑️ Effacer toutes les données locales</Text>}
          </Pressable>
        </View>

        {/* Instructions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="help-circle-outline" size={20} color="#8A6500" />
            <Text style={styles.cardTitle}>Checklist de démarrage</Text>
          </View>
          {[
            'Le backend Node.js est démarré (npm start)',
            'Le téléphone et l\'ordi sont sur le même Wi-Fi',
            'L\'IP dans constants/api.js correspond à ton ordi',
            'Le port 5000 est bien celui du backend',
            'La base de données (MongoDB) est démarrée',
          ].map((item, i) => (
            <View key={i} style={styles.checkRow}>
              <Ionicons name="checkmark-outline" size={16} color="#D4A017" />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#FFF8F0',
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EDE5D8',
  },
  topTitle: { fontSize: 17, fontWeight: '900', color: '#111' },
  pressed: { opacity: 0.75 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: '#F2E9DD',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#111' },
  label: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 6 },
  codeBox: {
    backgroundColor: '#F5F0EB', borderRadius: 10, padding: 12, marginBottom: 10,
  },
  codeText: { fontSize: 13, fontFamily: 'monospace', color: '#333' },
  hint: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 14 },
  bold: { fontWeight: '800', color: '#333' },
  btn: {
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondary: { backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#C5D9F5' },
  btnSecondaryText: { fontSize: 14, fontWeight: '800', color: '#245EA8' },
  btnDanger: { backgroundColor: '#D93025', marginTop: 4 },
  btnDangerText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginTop: 12,
  },
  statusOk: { backgroundColor: '#EDFAF1' },
  statusErr: { backgroundColor: '#FDEAEA' },
  statusText: { fontSize: 13, fontWeight: '700', flex: 1 },
  statusTextOk: { color: '#1F6F43' },
  statusTextErr: { color: '#B63B3B' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  checkText: { fontSize: 13, color: '#555', lineHeight: 20, flex: 1 },
});
