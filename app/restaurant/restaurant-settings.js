import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getMyRestaurant, updateRestaurant } from '../../services/restaurantService';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const SettingRow = ({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  rightNode,
  onPress,
  danger = false,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        danger && styles.settingRowDanger,
        pressed && styles.settingRowPressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <View style={styles.settingTextWrap}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        )}
      </View>

      <View style={styles.settingRight}>
        {rightNode || <Ionicons name="chevron-forward" size={18} color="#606D5D" />}
      </View>
    </Pressable>
  );
};

export default function RestaurantSettingsScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const logout = auth.logout;
  const token = auth.token;

  const [restaurantId, setRestaurantId] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [acceptOrders, setAcceptOrders] = useState(true);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [preparationMode, setPreparationMode] = useState(true);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadSettings = async () => {
        if (!token) {
          if (active) setLoadingSettings(false);
          return;
        }
        try {
          const restaurant = await getMyRestaurant(token);
          if (!active) return;
          setRestaurantId(restaurant._id);
          setAcceptOrders(restaurant.isOpen !== false);
          setAutoAcceptOrders(restaurant.autoAcceptOrders === true);
          setNotificationsEnabled(restaurant.notificationsEnabled !== false);
          setPreparationMode(restaurant.preparationMode !== false);
        } catch (error) {
          if (active) {
            setRestaurantId(null);
            Alert.alert(t('common.error'), error?.message || t('restaurant.settings.errorSaveBody'));
          }
        } finally {
          if (active) setLoadingSettings(false);
        }
      };
      loadSettings();
      return () => { active = false; };
    }, [token, t])
  );

  const restaurantName = useMemo(() => {
    return normalizeText(user?.restaurantName || user?.name, t('restaurant.settings.restaurantFallback'));
  }, [user, t]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/restaurant/RestaurantDashboard');
  }, []);

  const handleSimpleInfo = useCallback((title, message) => {
    Alert.alert(title, message);
  }, []);

  const handleSaveCriticalPreferences = useCallback(async () => {
    if (!token || !restaurantId) {
      Alert.alert(t('common.error'), t('restaurant.settings.errorSaveBody'));
      return;
    }

    try {
      setBusy(true);
      const updated = await updateRestaurant(
        restaurantId,
        {
          isOpen: acceptOrders,
          autoAcceptOrders,
          notificationsEnabled,
          preparationMode,
        },
        token
      );
      setAcceptOrders(updated.isOpen !== false);
      setAutoAcceptOrders(updated.autoAcceptOrders === true);
      setNotificationsEnabled(updated.notificationsEnabled !== false);
      setPreparationMode(updated.preparationMode !== false);
      Alert.alert(
        t('restaurant.settings.successTitle'),
        t('restaurant.settings.successBody')
      );
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error?.message || t('restaurant.settings.errorSaveBody')
      );
    } finally {
      setBusy(false);
    }
  }, [token, restaurantId, acceptOrders, autoAcceptOrders, notificationsEnabled, preparationMode, t]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('restaurant.settings.logoutTitle'),
      t('restaurant.settings.logoutBody'),
      [
        { text: t('restaurant.settings.cancelButton'), style: 'cancel' },
        {
          text: t('restaurant.settings.logoutTitle'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (typeof logout === 'function') {
                await logout();
              }
              router.replace('/auth/role');
            } catch (error) {
              Alert.alert(
                t('common.error'),
                error?.message || t('restaurant.settings.logoutErrorBody')
              );
            }
          },
        },
      ]
    );
  }, [logout, t]);

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#0D1C11" />
          </Pressable>

          <Pressable
            style={styles.saveButton}
            onPress={handleSaveCriticalPreferences}
            disabled={busy || loadingSettings || !restaurantId}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#0D1C11" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#0D1C11" />
                <Text style={styles.saveButtonText}>{t('restaurant.settings.saveButton')}</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('restaurant.settings.eyebrow')}</Text>
          <Text style={styles.title}>{t('restaurant.settings.title')}</Text>
          <Text style={styles.subtitle}>
            {t('restaurant.settings.subtitle')}
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>{restaurantName}</Text>
            <Text style={styles.heroText}>
              {t('restaurant.settings.heroText')}
            </Text>
          </View>

          <View style={styles.heroBadge}>
            <Ionicons name="settings-outline" size={16} color="#084424" />
            <Text style={styles.heroBadgeText}>{t('restaurant.settings.heroBadge')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.settings.sectionExploitation')}</Text>

          <SettingRow
            icon="receipt-outline"
            iconColor="#084424"
            iconBg="#E3F0E8"
            title={t('restaurant.settings.acceptOrdersTitle')}
            subtitle={t('restaurant.settings.acceptOrdersSubtitle')}
            rightNode={
              <Switch
                value={acceptOrders}
                onValueChange={setAcceptOrders}
                trackColor={{ false: '#E3DECF', true: '#007E4B' }}
                thumbColor={acceptOrders ? '#084424' : '#F2ECE0'}
              />
            }
          />

          <SettingRow
            icon="flash-outline"
            iconColor="#C8331A"
            iconBg="#F3E7CA"
            title={t('restaurant.settings.autoAcceptTitle')}
            subtitle={t('restaurant.settings.autoAcceptSubtitle')}
            rightNode={
              <Switch
                value={autoAcceptOrders}
                onValueChange={setAutoAcceptOrders}
                trackColor={{ false: '#E3DECF', true: '#F3E7CA' }}
                thumbColor={autoAcceptOrders ? '#C8331A' : '#F2ECE0'}
              />
            }
          />

          <SettingRow
            icon="restaurant-outline"
            iconColor="#084424"
            iconBg="#F2ECE0"
            title={t('restaurant.settings.prepModeTitle')}
            subtitle={t('restaurant.settings.prepModeSubtitle')}
            rightNode={
              <Switch
                value={preparationMode}
                onValueChange={setPreparationMode}
                trackColor={{ false: '#E3DECF', true: '#E3F0E8' }}
                thumbColor={preparationMode ? '#084424' : '#F2ECE0'}
              />
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.settings.sectionNotifications')}</Text>

          <SettingRow
            icon="notifications-outline"
            iconColor="#084424"
            iconBg="#E3F0E8"
            title={t('restaurant.settings.opNotifTitle')}
            subtitle={t('restaurant.settings.opNotifSubtitle')}
            rightNode={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E3DECF', true: '#E3F0E8' }}
                thumbColor={notificationsEnabled ? '#084424' : '#F2ECE0'}
              />
            }
          />

          <SettingRow
            icon="mail-outline"
            iconColor="#084424"
            iconBg="#F2ECE0"
            title={t('restaurant.settings.contactPrefTitle')}
            subtitle={t('restaurant.settings.contactPrefSubtitle')}
            onPress={() => router.push('/restaurant/restaurant-profile')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.settings.sectionBusinessConfig')}</Text>

          <SettingRow
            icon="time-outline"
            iconColor="#301904"
            iconBg="#F3E7CA"
            title={t('restaurant.settings.hoursTitle')}
            subtitle={t('restaurant.settings.hoursSubtitle')}
            onPress={() =>
              handleSimpleInfo(
                t('restaurant.settings.hoursInfoTitle'),
                t('restaurant.settings.hoursInfoBody')
              )
            }
          />

          <SettingRow
            icon="car-outline"
            iconColor="#C8331A"
            iconBg="#F3E7CA"
            title={t('restaurant.settings.deliveryZonesTitle')}
            subtitle={t('restaurant.settings.deliveryZonesSubtitle')}
            onPress={() => router.push('/restaurant/delivery-settings')}
          />

          <SettingRow
            icon="card-outline"
            iconColor="#084424"
            iconBg="#E3F0E8"
            title={t('restaurant.settings.paymentTitle')}
            subtitle={t('restaurant.settings.paymentSubtitle')}
            onPress={() =>
              handleSimpleInfo(
                t('restaurant.settings.paymentInfoTitle'),
                t('restaurant.settings.paymentInfoBody')
              )
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.settings.sectionAccount')}</Text>

          <SettingRow
            icon="person-circle-outline"
            iconColor="#084424"
            iconBg="#F2ECE0"
            title={t('restaurant.settings.profileTitle')}
            subtitle={t('restaurant.settings.profileSubtitle')}
            onPress={() => router.push('/restaurant/restaurant-profile')}
          />

          <SettingRow
            icon="shield-checkmark-outline"
            iconColor="#084424"
            iconBg="#E3F0E8"
            title={t('restaurant.settings.securityTitle')}
            subtitle={t('restaurant.settings.securitySubtitle')}
            onPress={() => router.push('/change-password')}
          />

          <SettingRow
            icon="log-out-outline"
            iconColor="#C8331A"
            iconBg="#F8E1DD"
            title={t('restaurant.settings.logoutTitle')}
            subtitle={t('restaurant.settings.logoutRowSubtitle')}
            onPress={handleLogout}
            danger
          />
        </View>
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 60,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  saveButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#EAB02F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  saveButtonText: {
    marginLeft: 8,
    color: '#0D1C11',
    fontWeight: '900',
    fontSize: 13,
  },

  header: {
    marginBottom: 18,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#084424',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },

  subtitle: {
    color: '#606D5D',
    fontSize: 14,
    lineHeight: 21,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    elevation: 2,
  },

  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },

  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },

  heroText: {
    color: '#606D5D',
    fontSize: 14,
    lineHeight: 21,
  },

  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E3F0E8',
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroBadgeText: {
    marginLeft: 6,
    color: '#084424',
    fontSize: 12,
    fontWeight: '900',
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 12,
  },

  settingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },

  settingRowDanger: {
    borderWidth: 1,
    borderColor: '#F8E1DD',
  },

  settingRowPressed: {
    opacity: 0.9,
  },

  settingIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  settingTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  settingTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 4,
  },

  settingTitleDanger: {
    color: '#C8331A',
  },

  settingSubtitle: {
    fontSize: 13,
    color: '#606D5D',
    lineHeight: 18,
  },

  settingRight: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});