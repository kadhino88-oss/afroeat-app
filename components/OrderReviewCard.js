import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../services/apiClient';
import { API_ENDPOINTS } from '../constants/api';
import StarRating from './StarRating';

/** Avis après livraison : note du commerce, du livreur (s'il y en a un) et commentaire. */
export default function OrderReviewCard({ orderId, token, hasCourier }) {
  const { t } = useTranslation();
  const [existing, setExisting] = useState(undefined);
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [courierRating, setCourierRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!orderId) return undefined;
    apiGet(API_ENDPOINTS.orders.review(orderId), token)
      .then((data) => active && setExisting(data?.review || null))
      .catch(() => active && setExisting(null));
    return () => {
      active = false;
    };
  }, [orderId, token]);

  const submit = async () => {
    if (!restaurantRating) {
      setError(t('review.pickRating'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await apiPost(
        API_ENDPOINTS.orders.review(orderId),
        {
          restaurantRating,
          ...(hasCourier && courierRating ? { courierRating } : {}),
          comment: comment.trim(),
        },
        token
      );
      setExisting(data?.review || { restaurantRating, courierRating, comment });
    } catch (e) {
      setError(e?.message || t('review.error'));
    } finally {
      setBusy(false);
    }
  };

  if (existing === undefined) return null;

  if (existing) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('review.thanks')}</Text>
        <StarRating value={existing.restaurantRating} size={20} />
        {existing.comment ? <Text style={styles.comment}>« {existing.comment} »</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('review.title')}</Text>
      <Text style={styles.label}>{t('review.restaurant')}</Text>
      <StarRating value={restaurantRating} onChange={setRestaurantRating} label={t('review.restaurant')} />
      {hasCourier ? (
        <>
          <Text style={styles.label}>{t('review.courier')}</Text>
          <StarRating value={courierRating} onChange={setCourierRating} label={t('review.courier')} />
        </>
      ) : null}
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder={t('review.commentPlaceholder')}
        placeholderTextColor="#8A9387"
        multiline
        maxLength={500}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.button, busy && { opacity: 0.6 }]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('review.submit')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DFCF', gap: 8 },
  title: { color: '#0D1C11', fontWeight: '900', fontSize: 17 },
  label: { color: '#606D5D', fontWeight: '700', marginTop: 6 },
  input: { minHeight: 70, borderWidth: 1, borderColor: '#E7DFCF', borderRadius: 12, padding: 12, color: '#0D1C11', textAlignVertical: 'top', marginTop: 6 },
  comment: { color: '#0D1C11', fontStyle: 'italic', lineHeight: 20 },
  error: { color: '#C8331A', fontWeight: '700' },
  button: { marginTop: 6, backgroundColor: '#084424', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '900' },
});
