const normalizeSearch = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
    .trim();

const SEARCH_STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'd',
  'de',
  'des',
  'du',
  'en',
  'et',
  'la',
  'le',
  'les',
  'un',
  'une',
]);

const CATEGORY_SEARCH_ALIASES = {
  restaurant: 'restaurant resto cuisine food',
  'african-fast-food':
    'fast food fastfood restauration rapide snack street food sandwich',
  'african-grocery':
    'epicerie epiceries grocery groceries magasin supermarche alimentation courses produits',
  'african-salon':
    'salon afro coiffure coiffeur coiffeuse cheveux hairdresser hair salon barber beauty beaute',
  'african-business':
    'commerce commercant boutique boutiques store shop magasin',
};

const getPublicPlaceLabel = (place, translate) => {
  if (typeof translate !== 'function') return '';

  const labelKey =
    place?.category === 'african-fast-food'
      ? 'publicPlace.fastFood'
      : place?.category === 'african-grocery'
        ? 'publicPlace.grocery'
        : place?.category === 'african-salon'
          ? 'publicPlace.salon'
          : place?.category === 'restaurant'
            ? 'publicPlace.restaurant'
            : 'publicPlace.business';

  return translate(labelKey);
};

export const matchesAfricanPlaceSearch = (place, query, translate) => {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const searchableText = normalizeSearch(
    [
      place?.name,
      place?.cuisine,
      place?.address,
      place?.city,
      place?.country,
      place?.brand,
      place?.operator,
      place?.shop,
      place?.origin,
      place?.description,
      place?.category?.replace(/-/g, ' '),
      place?.phone,
      place?.website,
      place?.menuUrl,
      getPublicPlaceLabel(place, translate),
      CATEGORY_SEARCH_ALIASES[place?.category],
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (searchableText.includes(normalizedQuery)) return true;

  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter((word) => word && !SEARCH_STOP_WORDS.has(word));

  return (
    queryWords.length > 1 &&
    queryWords.every((word) => searchableText.includes(word))
  );
};
