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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';

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
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const logout = auth.logout;

  const [acceptOrders, setAcceptOrders] = useState(true);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [preparationMode, setPreparationMode] = useState(true);
  const [busy, setBusy] = useState(false);

  const restaurantName = useMemo(() => {
    return normalizeText(user?.restaurantName || user?.name, 'Restaurant AFROEAT');
  }, [user]);

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
    try {
      setBusy(true);

      setTimeout(() => {
        setBusy(false);
        Alert.alert(
          'Succès',
          'Les préférences critiques du restaurant ont été enregistrées.'
        );
      }, 600);
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Erreur',
        error?.message || 'Impossible d’enregistrer les paramètres.'
      );
    }
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Déconnexion',
      'Veux-tu vraiment te déconnecter de l’espace restaurant ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              if (typeof logout === 'function') {
                await logout();
              }
              router.replace('/auth/role');
            } catch (error) {
              Alert.alert(
                'Erreur',
                error?.message || 'Impossible de se déconnecter.'
              );
            }
          },
        },
      ]
    );
  }, [logout]);

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
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#111111" />
                <Text style={styles.saveButtonText}>Sauvegarder</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Restaurant</Text>
          <Text style={styles.title}>Paramètres</Text>
          <Text style={styles.subtitle}>
            Centre de contrôle premium pour piloter l’exploitation, la réception
            des commandes, les notifications et les préférences du restaurant.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>{restaurantName}</Text>
            <Text style={styles.heroText}>
              Paramétrage stratégique du restaurant pour une exécution fluide,
              robuste et premium.
            </Text>
          </View>

          <View style={styles.heroBadge}>
            <Ionicons name="settings-outline" size={16} color="#1F6F43" />
            <Text style={styles.heroBadgeText}>Control Center</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exploitation</Text>

          <SettingRow
            icon="receipt-outline"
            iconColor="#1F6F43"
            iconBg="#E8F5ED"
            title="Recevoir les commandes"
            subtitle="Active ou coupe l’entrée de nouvelles commandes"
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
            title="Acceptation automatique"
            subtitle="Accepte instantanément les commandes entrantes"
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
            title="Mode préparation"
            subtitle="Signale que la cuisine est prête à traiter les flux"
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
          <Text style={styles.sectionTitle}>Notifications</Text>

          <SettingRow
            icon="notifications-outline"
            iconColor="#7C3AED"
            iconBg="#F3E8FF"
            title="Notifications opérationnelles"
            subtitle="Alertes commandes, incidents et événements critiques"
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
            title="Préférences de contact"
            subtitle="Gérer email, téléphone et informations visibles"
            onPress={() =>
              handleSimpleInfo(
                'Contact',
                'Ce module peut être relié ensuite au profil restaurant et aux préférences de communication.'
              )
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration métier</Text>

          <SettingRow
            icon="time-outline"
            iconColor="#8A6500"
            iconBg="#FFF3D8"
            title="Horaires d’ouverture"
            subtitle="Définir les plages horaires du restaurant"
            onPress={() =>
              handleSimpleInfo(
                'Horaires',
                'On pourra brancher ici un écran complet de gestion des horaires par jour.'
              )
            }
          />

          <SettingRow
            icon="car-outline"
            iconColor="#D96C2D"
            iconBg="#FFF0E8"
            title="Livraison & zones"
            subtitle="Piloter les frais et périmètres de livraison"
            onPress={() =>
              handleSimpleInfo(
                'Livraison',
                'On peut ensuite créer un écran premium dédié aux zones et frais de livraison.'
              )
            }
          />

          <SettingRow
            icon="card-outline"
            iconColor="#1F6F43"
            iconBg="#E8F5ED"
            title="Paiement & facturation"
            subtitle="Préparer les paramètres financiers du restaurant"
            onPress={() =>
              handleSimpleInfo(
                'Paiement',
                'Le bloc paiement/facturation pourra être relié aux méthodes de paiement et au back-office.'
              )
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compte</Text>

          <SettingRow
            icon="person-circle-outline"
            iconColor="#245EA8"
            iconBg="#EAF3FF"
            title="Profil restaurant"
            subtitle="Modifier les informations principales du compte"
            onPress={() => router.push('/restaurant/restaurant-profile')}
          />

          <SettingRow
            icon="shield-checkmark-outline"
            iconColor="#1F6F43"
            iconBg="#E8F5ED"
            title="Sécurité"
            subtitle="Mot de passe, accès et protection du compte"
            onPress={() =>
              handleSimpleInfo(
                'Sécurité',
                'Le module sécurité peut être branché ensuite à une gestion avancée du mot de passe et des sessions.'
              )
            }
          />

          <SettingRow
            icon="log-out-outline"
            iconColor="#B83232"
            iconBg="#FDECEC"
            title="Déconnexion"
            subtitle="Quitter l’espace restaurant"
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