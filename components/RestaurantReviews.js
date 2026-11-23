import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../services/apiClient';
import { API_ENDPOINTS } from '../constants/api';
import StarRating from './StarRating';

/** Derniers avis clients publiés sur la fiche d'un commerce. */
export default function RestaurantReviews({ restaurantId }) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!restaurantId) return undefined;
    let active = true;
    apiGet(API_ENDPOINTS.restaurants.reviews(restaurantId))
      .then((data) => active && setReviews(Array.isArray(data?.reviews) ? data.reviews : []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [restaurantId]);

  if (!reviews.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('review.publicTitle', { count: reviews.length })}</Text>
      {reviews.slice(0, 5).map((review) => (
        <View key={review._id} style={styles.item}>
          <View style={styles.row}>
            <Text style={styles.author}>{review.authorName || t('review.customer')}</Text>
            <StarRating value={review.restaurantRating} size={14} />
          </View>
          {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  title: { color: '#0D1C11', fontWeight: '900', fontSize: 16 },
  item: { padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DFCF', gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { color: '#0D1C11', fontWeight: '800' },
  comment: { color: '#3D473B', lineHeight: 19 },
});
