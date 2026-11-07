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
        {rightNode || <Ionicons name="chevron-forward" size={18} color="#8A8A8A" />}
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={styles.saveButton}
            onPress={handleSaveCriticalPreferences}
            disabled={busy || loadingSettings || !restaurantId}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#111111" />
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
            <Ionicons name="settings-outline" size={16} color="#1F6F43" />
            <Text style={styles.heroBadgeText}>{t('restaurant.settings.heroBadge')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.settings.sectionExploitation')}</Text>

          <SettingRow
            icon="receipt-outline"
            iconColor="#1F6F43"
            iconBg="#E8F5ED"
            title={t('restaurant.settings.acceptOrdersTitle')}
            subtitle={t('restaurant.settings.acceptOrdersSubtitle')}
            rightNode={
              <Switch
                value={acceptOrders}
                onValueChange={setAcceptOrders}
                trackColor={{ false: '#D8D8D8', true: '#BFE3CB' }}
                thumbColor={acceptOrders ? '#1F6F43' : '#F5F5F5'}
              />
            }
          />

          <SettingRow
            icon="flash-outline"
            iconColor="#D96C2D"
            iconBg="#FFF0E8"
            title={t('restaurant.settings.autoAcceptTitle')}
            subtitle={t('restaurant.settings.autoAcceptSubtitle')}
            rightNode={
              <Switch
                value={autoAcceptOrders}
                onValueChange={setAutoAcceptOrders}
                trackColor={{ false: '#D8D8D8', true: '#F5D0BA' }}
                thumbColor={autoAcceptOrders ? '#D96C2D' : '#F5F5F5'}
              />
            }
          />

          <SettingRow
            icon="restaurant-outline"
            iconColor="#245EA8"
            iconBg="#EAF3FF"
            title={t('restaurant.settings.prepModeTitle')}
            subtitle={t('restaurant.settings.prepModeSubtitle')}
            rightNode={
              <Switch
                value={preparationMode}
                onValueChange={setPreparationMode}
                trackColor={{ false: '#D8D8D8', true: '#C7DCF8' }}
                thumbColor={preparationMode ? '#245EA8' : '#F5F5F5'}
              />
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.settings.sectionNotifications')}</Text>

          <SettingRow
            icon="notifications-outline"
            iconColor="#7C3AED"
            iconBg="#F3E8FF"
            title={t('restaurant.settings.opNotifTitle')}
            subtitle={t('restaurant.settings.opNotifSubtitle')}
            rightNode={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#D8D8D8', true: '#D9C6FA' }}
                thumbColor={notificationsEnabled ? '#7C3AED' : '#F5F5F5'}
              />
            }
          />

          <SettingRow
            icon="mail-outline"
            iconColor="#245EA8"
            iconBg="#EAF3FF"
            title={t('restaurant.settings.contactPrefTitle')}
            subtitle={t('restaurant.settings.contactPrefSubtitle')}
            onPress={() =>
              handleSimpleInfo(
                t('restaurant.settings.contactInfoTitle'),
                t('restaurant.settings.contactInfoBody')
              )
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.settings.sectionBusinessConfig')}</Text>

          <SettingRow
            icon="time-outline"
            iconColor="#8A6500"
            iconBg="#FFF3D8"
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
            iconColor="#D96C2D"
            iconBg="#FFF0E8"
            title={t('restaurant.settings.deliveryZonesTitle')}
            subtitle={t('restaurant.settings.deliveryZonesSubtitle')}
            onPress={() =>
              handleSimpleInfo(
                t('restaurant.settings.deliveryInfoTitle'),
                t('restaurant.settings.deliveryInfoBody')
              )
            }
          />

          <SettingRow
            icon="card-outline"
            iconColor="#1F6F43"
            iconBg="#E8F5ED"
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
            iconColor="#245EA8"
            iconBg="#EAF3FF"
            title={t('restaurant.settings.profileTitle')}
            subtitle={t('restaurant.settings.profileSubtitle')}
            onPress={() => router.push('/restaurant/restaurant-profile')}
          />

          <SettingRow
            icon="shield-checkmark-outline"
            iconColor="#1F6F43"
            iconBg="#E8F5ED"
            title={t('restaurant.settings.securityTitle')}
            subtitle={t('restaurant.settings.securitySubtitle')}
            onPress={() =>
              handleSimpleInfo(
                t('restaurant.settings.securityTitle'),
                t('restaurant.settings.securityInfoBody')
              )
            }
          />

          <SettingRow
            icon="log-out-outline"
            iconColor="#B83232"
            iconBg="#FDECEC"
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
    backgroundColor: '#FFF8F0',
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
    backgroundColor: '#D4A017',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  saveButtonText: {
    marginLeft: 8,
    color: '#111111',
    fontWeight: '900',
    fontSize: 13,
  },

  header: {
    marginBottom: 18,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F6F43',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 8,
  },

  subtitle: {
    color: '#6B655E',
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
    color: '#111111',
    marginBottom: 8,
  },

  heroText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },

  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E8F5ED',
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroBadgeText: {
    marginLeft: 6,
    color: '#1F6F43',
    fontSize: 12,
    fontWeight: '900',
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
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
    borderColor: '#F5D0D0',
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
    color: '#111111',
    marginBottom: 4,
  },

  settingTitleDanger: {
    color: '#B83232',
  },

  settingSubtitle: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },

  settingRight: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});