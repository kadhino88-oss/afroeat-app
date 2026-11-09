import { Platform, useWindowDimensions } from 'react-native';

/** Largeur maximale du contenu sur grand écran (web / tablette). */
export const MAX_CONTENT_WIDTH = 1200;

/** Nombre de colonnes selon la largeur : 1 (téléphone), 2 (tablette), 3 (ordinateur). */
export const getGridColumns = (width) => {
  if (width >= 1000) return 3;
  if (width >= 680) return 2;
  return 1;
};

/**
 * Colonnes de la grille de restaurants. Sur mobile natif, toujours 1 colonne
 * (le comportement du téléphone ne change pas).
 */
export default function useGridColumns() {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return 1;
  return getGridColumns(width);
}
