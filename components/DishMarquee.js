import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Marquee from './Marquee';
import { BrandFonts } from '../constants/brand';

// Noms de plats : des noms propres, identiques dans toutes les langues.
const DISHES = [
  'Mafé', 'Yassa', 'Thiéboudienne', 'Poulet DG', 'Jollof Rice', 'Fufu', 'Injera',
  'Attiéké', 'Ndolé', 'Poulet braisé', 'Alloco', 'Tajine', 'Egusi', 'Bissap',
];
const DIAMOND_COLORS = ['#C8331A', '#EAB02F', '#084424'];
const DIAMONDS = Array.from({ length: 28 }, (_, index) => index);

/** Frise de losanges colorés + bandeau de plats qui défilent (deux sens, deux vitesses). */
export default function DishMarquee() {
  return (
    <View style={styles.wrap}>
      <Marquee
        items={DIAMONDS}
        gap={14}
        speed={22}
        style={styles.frieze}
        renderItem={(index) => (
          <View style={[styles.diamond, { backgroundColor: DIAMOND_COLORS[index % DIAMOND_COLORS.length] }]} />
        )}
      />
      <Marquee
        items={DISHES}
        gap={10}
        speed={34}
        style={styles.dishes}
        renderItem={(dish) => (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{dish}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 6, width: '100%', maxWidth: '100%', overflow: 'hidden', alignSelf: 'stretch' },
  frieze: { height: 18, justifyContent: 'center' },
  diamond: { width: 9, height: 9, transform: [{ rotate: '45deg' }], borderRadius: 1.5 },
  dishes: { marginTop: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#F3E7CA',
    borderWidth: 1,
    borderColor: '#E3DECF',
  },
  chipText: { fontFamily: BrandFonts.displaySemi, fontSize: 15, color: '#084424' },
});
