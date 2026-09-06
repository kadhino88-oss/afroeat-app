import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { apiPut } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const normalizeBooleanFromParam = (value, fallback = false) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const CATEGORY_OPTIONS = [
  'Entrées',
  'Plats principaux',
  'Desserts',
  'Boissons',
  'Snacks',
  'Autres',
];

const CATEGORY_SLUG_BY_LABEL = {
  'Entrées': 'starters',
  'Plats principaux': 'mainCourses',
  'Desserts': 'desserts',
  'Boissons': 'drinks',
  'Snacks': 'snacks',
  'Autres': 'other',
};

export default function EditMenuItem() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const role = normalizeRole(auth.role || user?.role);
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);

  const params = useLocalSearchParams();

  const itemId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [name, setName] = useState(normalizeText(params?.name));
  const [description, setDescription] = useState(normalizeText(params?.description));
  const [price, setPrice] = useState(normalizeText(params?.price));
  const [category, setCategory] = useState(
    normalizeText(params?.category, 'Plats principaux')
  );
  const [cuisine, setCuisine] = useState(
    normalizeText(params?.cuisine, 'Africaine')
  );
  const [image, setImage] = useState(normalizeText(params?.image));
  const [available, setAvailable] = useState(
    normalizeBooleanFromParam(params?.available, true)
  );
  const [isPopular, setIsPopular] = useState(
    normalizeBooleanFromParam(params?.isPopular, false)
  );
  const [isRecommended, setIsRecommended] = useState(
    normalizeBooleanFromParam(params?.isRecommended, false)
  );
  const [submitting, setSubmitting] = useState(false);

  const canAccess = isAuthenticated && role === 'restaurant';

  const resolvedPrice = useMemo(() => {
    const parsed = Number(price);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [price]);

  const toggleField = useCallback((key) => {
    if (key === 'available') setAvailable((prev) => !prev);
    if (key === 'popular') setIsPopular((prev) => !prev);
    if (key === 'recommended') setIsRecommended((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!token || !itemId) {
      Alert.alert(t('common.error'), t('restaurant.editMenuItem.errorInvalidDishBody'));
      return;
    }

    if (!normalizeText(name)) {
      Alert.alert(t('common.error'), t('restaurant.addMenuItem.errorNameRequired'));
      return;
    }

    if (resolvedPrice <= 0) {
      Alert.alert(t('common.error'), t('restaurant.addMenuItem.errorPriceInvalid'));
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: normalizeText(name),
        description: normalizeText(description),
        price: resolvedPrice,
        category: normalizeText(category, 'Plats principaux'),
        cuisine: normalizeText(cuisine, 'Africaine'),
        image: normalizeText(image),
        available,
        isPopular,
        isRecommended,
      };

      await apiPut(API_ENDPOINTS.menu.update(itemId), payload, token);

      Alert.alert(t('restaurant.settings.successTitle'), t('restaurant.editMenuItem.successBody'));
      router.replace('/restaurant/MenuScreen');
    } catch (error) {
      console.log('Erreur modification plat :', error);
      Alert.alert(
        t('common.error'),
        error?.message || t('restaurant.editMenuItem.errorEditBody')
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    token,
    itemId,
    name,
    description,
    resolvedPrice,
    category,
    cuisine,
    image,
    available,
    isPopular,
    isRecommended,
    t,
  ]);

  if (!canAccess) {
    return <Redirect href="/auth/login?role=restaurant" />;
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('restaurant.settings.eyebrow')}</Text>
          <Text style={styles.title}>{t('restaurant.editMenuItem.title')}</Text>
          <Text style={styles.subtitle}>
            {t('restaurant.editMenuItem.subtitle')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('restaurant.addMenuItem.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('restaurant.addMenuItem.namePlaceholder')}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>{t('restaurant.addMenuItem.descriptionLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('restaurant.addMenuItem.descriptionPlaceholder')}
            placeholderTextColor="#999"
            multiline
          />

          <Text style={styles.label}>{t('restaurant.addMenuItem.priceLabel')}</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder={t('restaurant.addMenuItem.pricePlaceholder')}
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>{t('restaurant.profile.cuisineLabel')}</Text>
          <TextInput
            style={styles.input}
            value={cuisine}
            onChangeText={setCuisine}
            placeholder={t('restaurant.addMenuItem.cuisinePlaceholder')}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>{t('restaurant.addMenuItem.imageLabel')}</Text>
          <TextInput
            style={styles.input}
            value={image}
            onChangeText={setImage}
            placeholder="https://..."
            placeholderTextColor="#999"
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('restaurant.addMenuItem.categoryLabel')}</Text>
          <View style={styles.chipsRow}>
            {CATEGORY_OPTIONS.map((item) => {
              const active = category === item;
              const slug = CATEGORY_SLUG_BY_LABEL[item] || 'other';

              return (
                <Pressable
                  key={item}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(item)}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {t(`restaurant.addMenuItem.categories.${slug}`, item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t('restaurant.editMenuItem.optionsLabel')}</Text>

          <Pressable style={styles.toggleRow} onPress={() => toggleField('available')}>
            <Text style={styles.toggleLabel}>{t('restaurant.menuScreen.availableBadge')}</Text>
            <Ionicons
              name={available ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={available ? '#1F6F43' : '#999'}
            />
          </Pressable>

          <Pressable style={styles.toggleRow} onPress={() => toggleField('popular')}>
            <Text style={styles.toggleLabel}>{t('restaurant.menuScreen.popularBadge')}</Text>
            <Ionicons
              name={isPopular ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isPopular ? '#1F6F43' : '#999'}
            />
          </Pressable>

          <Pressable
            style={styles.toggleRow}
            onPress={() => toggleField('recommended')}
          >
            <Text style={styles.toggleLabel}>{t('restaurant.menuScreen.recommendedBadge')}</Text>
            <Ionicons
              name={isRecommended ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isRecommended ? '#1F6F43' : '#999'}
            />
          </Pressable>

          <Pressable
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#111111" />
                <Text style={styles.primaryButtonText}>{t('restaurant.editMenuItem.saveButton')}</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },

  header: { marginBottom: 18 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F6F43',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#555',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111',
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#F3ECE4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 10,
  },
  chipActive: {
    backgroundColor: '#1E1E1E',
  },
  chipText: {
    color: '#555',
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  toggleRow: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: '#111',
    fontWeight: '700',
    fontSize: 14,
  },

  primaryButton: {
    minHeight: 50,
    backgroundColor: '#D4A017',
    borderRadius: 14,
    marginTop: 22,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    color: '#111111',
    fontWeight: '900',
    marginLeft: 8,
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});