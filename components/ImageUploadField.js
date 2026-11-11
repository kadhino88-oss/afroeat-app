import React, { useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { pickAndUploadImage } from '../services/imageUploadService';

export default function ImageUploadField({ value, onChange, aspect = [4, 3] }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const url = await pickAndUploadImage(token, { aspect });
      if (url) onChange(url);
    } catch (e) {
      const code = e?.code;
      setError(
        code === 'PERMISSION'
          ? t('imageUpload.permissionError')
          : code === 'TOO_LARGE'
          ? t('imageUpload.tooLargeError')
          : t('imageUpload.uploadError')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {value ? (
        <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Ionicons name="image-outline" size={34} color="#606D5D" />
          <Text style={styles.placeholderText}>{t('imageUpload.noPhoto')}</Text>
        </View>
      )}

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={choose} disabled={busy} accessibilityRole="button">
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{value ? t('imageUpload.change') : t('imageUpload.choose')}</Text>
          )}
        </Pressable>
        {!!value && !busy && (
          <Pressable style={styles.remove} onPress={() => onChange('')} accessibilityRole="button">
            <Text style={styles.removeText}>{t('imageUpload.remove')}</Text>
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', aspectRatio: 4 / 3, maxHeight: 220, borderRadius: 14, backgroundColor: '#F2ECE0' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderText: { color: '#606D5D', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  button: { backgroundColor: '#084424', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18, minWidth: 150, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  remove: { paddingVertical: 11, paddingHorizontal: 14 },
  removeText: { color: '#C8331A', fontWeight: '800' },
  error: { color: '#C8331A', marginTop: 8, fontSize: 13 },
});
