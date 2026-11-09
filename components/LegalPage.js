import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Brand, BrandFonts } from '../constants/brand';

const CONTACT_EMAIL = process.env.EXPO_PUBLIC_CONTACT_EMAIL || '';

export default function LegalPage({ title, updated, sections }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      >
        <Text style={styles.back}>← Retour</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.updated}>Dernière mise à jour : {updated}</Text>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
      <View style={styles.section}>
        <Text style={styles.heading}>Contact</Text>
        <Text style={styles.paragraph}>
          {CONTACT_EMAIL
            ? `Pour toute question : ${CONTACT_EMAIL}.`
            : "Pour toute question, utilise la page Aide de l'application."}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 760, width: '100%', alignSelf: 'center' },
  back: { color: Brand.primary, fontSize: 15, marginBottom: 16 },
  title: { fontFamily: BrandFonts.display, fontSize: 30, color: Brand.foreground, marginBottom: 6 },
  updated: { color: Brand.mutedForeground, fontSize: 13, marginBottom: 20 },
  section: { marginBottom: 20 },
  heading: { fontFamily: BrandFonts.displaySemi, fontSize: 19, color: Brand.primary, marginBottom: 8 },
  paragraph: { color: Brand.foreground, fontSize: 15, lineHeight: 23, marginBottom: 8 },
});
