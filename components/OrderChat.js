import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../services/apiClient';

const POLL_MS = 8000;
const ROLE_ICON = { client: 'person-outline', livreur: 'bicycle-outline', restaurant: 'storefront-outline', admin: 'shield-outline' };

/** Discussion de la commande entre le client, le livreur et le commerce (actualisée toutes les 8 s). */
export default function OrderChat({ orderId, token }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(true);
  const [me, setMe] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const seenRef = useRef(0);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!orderId || !token) return;
    try {
      const data = await apiGet(`/orders/${orderId}/messages`, token);
      const list = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(list);
      setOpen(data?.open !== false);
      setMe(String(data?.me || ''));
      setUnread(Math.max(0, list.filter((m) => String(m.sender) !== String(data?.me)).length - seenRef.current));
    } catch {
      // Nouvel essai au prochain passage.
    }
  }, [orderId, token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const toggle = () => {
    setExpanded((value) => !value);
    seenRef.current = messages.filter((m) => String(m.sender) !== me).length;
    setUnread(0);
  };

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    setError('');
    try {
      await apiPost(`/orders/${orderId}/messages`, { text: value }, token);
      setText('');
      await load();
    } catch (e) {
      setError(e?.message || t('chat.error'));
    } finally {
      setSending(false);
    }
  };

  if (!open && messages.length === 0) return null;

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={toggle} style={styles.header}>
        <Ionicons name="chatbubbles-outline" size={19} color="#084424" />
        <Text style={styles.title}>{t('chat.title')}</Text>
        {unread > 0 && !expanded ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        ) : null}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#606D5D" />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {messages.length === 0 ? <Text style={styles.empty}>{t('chat.empty')}</Text> : null}
          {messages.map((m) => {
            const mine = String(m.sender) === me;
            return (
              <View key={m._id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {!mine ? (
                  <View style={styles.author}>
                    <Ionicons name={ROLE_ICON[m.senderRole] || 'person-outline'} size={12} color="#606D5D" />
                    <Text style={styles.authorText}>
                      {m.senderName || ''} · {t(`chat.role_${m.senderRole}`)}
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.text, mine && styles.textMine]}>{m.text}</Text>
              </View>
            );
          })}
          {open ? (
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t('chat.placeholder')}
                placeholderTextColor="#8A9387"
                maxLength={500}
                style={styles.input}
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <Pressable accessibilityRole="button" accessibilityLabel={t('chat.send')} disabled={sending} onPress={send} style={styles.send}>
                {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
              </Pressable>
            </View>
          ) : (
            <Text style={styles.empty}>{t('chat.closed')}</Text>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DFCF', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  title: { flex: 1, color: '#0D1C11', fontWeight: '900', fontSize: 16 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#C8331A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  empty: { color: '#606D5D', textAlign: 'center', paddingVertical: 8 },
  bubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#084424' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#F2ECE0' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorText: { color: '#606D5D', fontSize: 11, fontWeight: '700' },
  text: { color: '#0D1C11', lineHeight: 19 },
  textMine: { color: '#FFFFFF' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  input: { flex: 1, borderWidth: 1, borderColor: '#E7DFCF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0D1C11' },
  send: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#084424', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#C8331A', fontWeight: '700' },
});
