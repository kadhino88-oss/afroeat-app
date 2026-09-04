/**
 * =========================================================
 * APP MAP VIEW — NATIF (iOS / Android)
 * components/AppMapView.js
 *
 * react-native-maps est un module natif : il n'a pas d'equivalent
 * web (memes symptomes que Stripe, voir AppStripeProvider.js).
 * Ce wrapper isole son import pour que Metro utilise a la place
 * AppMapView.web.js (fallback visuel) quand on build pour le web,
 * sans casser le bundle. map.js et OrderTracking.js importent la
 * carte depuis ce fichier plutot que directement depuis
 * 'react-native-maps'.
 * =========================================================
 */
export { default } from 'react-native-maps';
export { Marker, Callout, Polyline } from 'react-native-maps';
