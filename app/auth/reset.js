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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/api';

export default function ResetScreen() {
  const { t } = useTranslation();
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
        ? t('auth.reset.timeoutError')
        : err?.message || t('auth.reset.networkError');
      setServerStatus({ ok: false, msg });
    } finally {
      setTesting(false);
    }
  }, []);

  const handleClearSession = useCallback(async () => {
    Alert.alert(
      t('auth.reset.clearAlertTitle'),
      t('auth.reset.clearAlertBody'),
      [
        { text: t('auth.reset.cancel'), style: 'cancel' },
        {
          text: t('auth.reset.confirmClear'),
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
                t('auth.reset.successTitle'),
                t('auth.reset.successBody'),
                [{ text: t('auth.validation.ok'), onPress: () => router.replace('/auth/role') }]
              );
            } catch {
              Alert.alert(t('common.error'), t('auth.reset.clearErrorBody'));
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
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.topTitle}>{t('auth.reset.topTitle')}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* IP Config */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="wifi-outline" size={20} color="#245EA8" />
            <Text style={styles.cardTitle}>{t('auth.reset.networkConfigTitle')}</Text>
          </View>
          <Text style={styles.label}>{t('auth.reset.detectedUrlLabel')}</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{API_BASE_URL}</Text>
          </View>
          <Text style={styles.hint}>
            {t('auth.reset.hintPart1')}{' '}
            <Text style={styles.bold}>constants/api.js</Text> {t('auth.reset.hintPart2')}{' '}
            <Text style={styles.bold}>LOCAL_IP</Text>.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
            onPress={handleTestServer}
            disabled={testing}
          >
            {testing
              ? <ActivityIndicator size="small" color="#245EA8" />
              : <Text style={styles.btnSecondaryText}>{t('auth.reset.testServerButton')}</Text>}
          </Pressable>

          {serverStatus && (
            <View style={[styles.statusBox, serverStatus.ok ? styles.statusOk : styles.statusErr]}>
              <Ionicons
                name={serverStatus.ok ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={serverStatus.ok ? '#084424' : '#C8331A'}
              />
              <Text style={[styles.statusText, serverStatus.ok ? styles.statusTextOk : styles.statusTextErr]}>
                {serverStatus.ok
                  ? t('auth.reset.serverOk', { code: serverStatus.code })
                  : t('auth.reset.serverError', { msg: serverStatus.msg })}
              </Text>
            </View>
          )}
        </View>

        {/* Reset Session */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="refresh-circle-outline" size={20} color="#C8331A" />
            <Text style={styles.cardTitle}>{t('auth.reset.resetSessionTitle')}</Text>
          </View>
          <Text style={styles.hint}>{t('auth.reset.resetHint')}</Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.pressed, clearing && styles.btnDisabled]}
            onPress={handleClearSession}
            disabled={clearing}
          >
            {clearing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnDangerText}>{t('auth.reset.clearButton')}</Text>}
          </Pressable>
        </View>

        {/* Instructions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="help-circle-outline" size={20} color="#8A6500" />
            <Text style={styles.cardTitle}>{t('auth.reset.checklistTitle')}</Text>
          </View>
          {t('auth.reset.checklist', { returnObjects: true }).map((item, i) => (
            <View key={i} style={styles.checkRow}>
              <Ionicons name="checkmark-outline" size={16} color="#EAB02F" />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EC' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#FBF6EC',
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
  statusTextOk: { color: '#084424' },
  statusTextErr: { color: '#C8331A' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  checkText: { fontSize: 13, color: '#555', lineHeight: 20, flex: 1 },
});
