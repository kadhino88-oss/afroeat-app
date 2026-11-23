'use strict';

// Pure guard logic for app/restaurant/_layout.js (testable in node).

const PUBLIC_RESTAURANT_SCREENS = ['[id]'];
const ADMIN_MENU_SCREENS = ['MenuScreen', 'AddMenuItem', 'EditMenuItem', '[id]'];

const isAdminRole = (role) =>
  ['admin', 'administrator', 'superadmin', 'super-admin'].includes(role);
const isDriverRole = (role) => ['livreur', 'driver', 'delivery'].includes(role);

// Returns where to send the visitor, or null when the screen may render.
// `screen` is segments[1] of /restaurant/<screen>.
const getRestaurantAreaRedirect = ({ hasSession, role, screen }) => {
  const isPublic = !screen || PUBLIC_RESTAURANT_SCREENS.includes(screen);
  const currentRole = String(role || '').trim().toLowerCase();

  if (!hasSession) return isPublic ? null : 'login';
  if (currentRole === 'restaurant') return null;
  if (isAdminRole(currentRole)) return ADMIN_MENU_SCREENS.includes(screen) ? null : 'admin';
  if (isDriverRole(currentRole)) return 'livraison';
  return isPublic ? null : 'home';
};

module.exports = { getRestaurantAreaRedirect, PUBLIC_RESTAURANT_SCREENS, ADMIN_MENU_SCREENS };
