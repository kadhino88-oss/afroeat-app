import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '../context/CartContext';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getBadgeValue = (value) => {
  const count = Math.max(0, normalizeNumber(value, 0));
  if (count > 99) return '99+';
  return String(count);
};

export default function HomeHeader({
  userName = 'Bonjour',
  locationText = 'Livraison à domicile',
  notificationCount = 0,
  avatarUri = '',
}) {
  const router = useRouter();
  const cart = useCart() || {};

  const getTotalItems =
    typeof cart.getTotalItems === 'function' ? cart.getTotalItems : null;

  const safeCartCount = useMemo(() => {
    return Math.max(0, normalizeNumber(getTotalItems ? getTotalItems() : 0, 0));
  }, [getTotalItems]);

  const safeNotificationCount = useMemo(() => {
    return Math.max(0, normalizeNumber(notificationCount, 0));
  }, [notificationCount]);

  const safeUserName = useMemo(() => {
    return normalizeText(userName, 'Bonjour');
  }, [userName]);

  const safeLocationText = useMemo(() => {
    return normalizeText(locationText, 'Livraison à domicile');
  }, [locationText]);

  const safeAvatarUri = useMemo(() => {
    return normalizeText(avatarUri);
  }, [avatarUri]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.topGlow} />

      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../app/assets/images/icon.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>AFROEAT</Text>
            <Text style={styles.brandTagline}>Premium African Delivery</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.85}
          >
            <Ionicons name="notifications-outline" size={20} color="#181818" />
            {safeNotificationCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {getBadgeValue(safeNotificationCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/cart')}
            activeOpacity={0.85}
          >
            <Ionicons name="basket-outline" size={20} color="#181818" />
            {safeCartCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {getBadgeValue(safeCartCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/profile')}
            activeOpacity={0.85}
          >
            {safeAvatarUri ? (
              <Image source={{ uri: safeAvatarUri }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-outline" size={20} color="#181818" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.locationCard}
        activeOpacity={0.9}
        onPress={() => router.push('/map')}
      >
        <View style={styles.locationIconWrap}>
          <Ionicons name="location-sharp" size={17} color="#D4A017" />
        </View>

        <View style={styles.locationContent}>
          <Text style={styles.locationLabel}>Livrer à</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {safeLocationText}
          </Text>
        </View>

        <View style={styles.locationChevronWrap}>
          <Ionicons name="chevron-down" size={16} color="#555555" />
        </View>
      </TouchableOpacity>

      <View style={styles.bottom}>
        <Text style={styles.greeting}>{safeUserName}</Text>
        <Text style={styles.subtitle}>
          Qu’est-ce qu’on mange aujourd’hui ?
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFF8F0',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 18,
    position: 'relative',
  },

  topGlow: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,160,23,0.10)',
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },

  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1E5D6',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  logo: {
    width: '100%',
    height: '100%',
  },

  brandTextWrap: {
    marginLeft: 12,
    flex: 1,
  },

  brandName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.3,
  },

  brandTagline: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#8A7F72',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#EEE4D8',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    position: 'relative',
  },

  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3D8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#F1E1A6',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  avatar: {
    width: '100%',
    height: '100%',
  },

  badge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EEE4D8',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  locationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF7E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  locationContent: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },

  locationLabel: {
    fontSize: 11,
    color: '#8A7F72',
    fontWeight: '700',
    marginBottom: 2,
  },

  locationValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '900',
  },

  locationChevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8F5F1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottom: {
    marginTop: 16,
  },

  greeting: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
  },

  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6F675F',
    fontWeight: '600',
    lineHeight: 21,
  },
});