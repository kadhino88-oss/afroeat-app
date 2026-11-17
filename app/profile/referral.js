import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../services/apiClient';

/** Parrainage : code personnel à partager et récompenses obtenues. */
export default function ReferralScreen() {
  const { t } = useTranslation();
  const { token } = useAuth() || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet('/users/me/referral', token)
      .then((res) => active && setData(res?.referral || null))
      .catch((e) => active && setError(e?.message || t('referral.error')));
    return () => {
      active = false;
    };
  }, [token, t]);

  const message = data ? t('referral.shareMessage', { code: data.code, percent: data.friendPercent }) : '';

  const share = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (navigator.share) {
          await navigator.share({ text: message });
          return;
        }
        await navigator.clipboard?.writeText(message);
        setCopied(true);
        return;
      }
      await Share.share({ message });
    } catch {
      // Partage annulé par l'utilisateur.
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} style={styles.back}>
        <Ionicons name="arrow-back" size={21} color="#0D1C11" />
      </Pressable>
      <Text style={styles.title}>{t('referral.title')}</Text>

      {!data && !error ? <ActivityIndicator color="#084424" style={{ marginTop: 30 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data ? (
        <>
          <Text style={styles.text}>
            {t('referral.explain', { friend: data.friendPercent, reward: data.rewardPercent })}
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{t('referral.yourCode')}</Text>
            <Text style={styles.code} selectable>{data.code}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={share} style={styles.button}>
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>{copied ? t('referral.copied') : t('referral.share')}</Text>
          </Pressable>

          <Text style={styles.stat}>{t('referral.friends', { count: data.friendsCount })}</Text>

          {data.rewards?.length ? (
            <View style={styles.rewards}>
              <Text style={styles.rewardsTitle}>{t('referral.rewardsTitle')}</Text>
              {data.rewards.map((reward) => (
                <View key={reward.code} style={styles.reward}>
                  <Text style={styles.rewardCode} selectable>{reward.code}</Text>
                  <Text style={styles.rewardText}>
                    {t('referral.rewardLine', {
                      percent: reward.percent,
                      date: reward.expiresAt ? new Date(reward.expiresAt).toLocaleDateString() : '—',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center', gap: 14 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E7DFCF' },
  title: { fontSize: 28, fontWeight: '900', color: '#0D1C11' },
  text: { color: '#3D473B', fontSize: 15, lineHeight: 22 },
  error: { color: '#C8331A', fontWeight: '700' },
  codeBox: { padding: 20, borderRadius: 20, backgroundColor: '#0D1C11', alignItems: 'center', gap: 6 },
  codeLabel: { color: '#B9C4B6', fontWeight: '700', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  code: { color: '#EAB02F', fontSize: 30, fontWeight: '900', letterSpacing: 2 },
  button: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#084424', borderRadius: 14, paddingVertical: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  stat: { color: '#0D1C11', fontWeight: '800', textAlign: 'center' },
  rewards: { gap: 8 },
  rewardsTitle: { color: '#0D1C11', fontWeight: '900', fontSize: 17 },
  reward: { padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DFCF', gap: 4 },
  rewardCode: { color: '#084424', fontWeight: '900', fontSize: 18 },
  rewardText: { color: '#606D5D' },
});
