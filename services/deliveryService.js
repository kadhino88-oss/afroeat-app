import { apiGet, apiPut } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

const DELIVERY_VISIBLE_STATUSES = [
'Confirmée',
'En préparation',
'En livraison',
'Livrée',
];

const DELIVERY_MUTABLE_STATUSES = ['En préparation', 'En livraison'];

const normalizeString = (value, fallback = '') => {
const normalized = String(value ?? '').trim();
return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
const parsed = Number(value);
return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBoolean = (value, fallback = false) => {
if (typeof value === 'boolean') return value;

if (typeof value === 'string') {
const normalized = value.trim().toLowerCase();
if (normalized === 'true') return true;
if (normalized === 'false') return false;
}

if (typeof value === 'number') {
if (value === 1) return true;
if (value === 0) return false;
}

return fallback;
};

const normalizeArrayResponse = (data) => {
if (Array.isArray(data)) return data;
if (Array.isArray(data?.orders)) return data.orders;
if (Array.isArray(data?.items)) return data.items;
if (Array.isArray(data?.data)) return data.data;
return [];
};

const normalizeObjectResponse = (data) => {
if (data?.order && typeof data.order === 'object' && !Array.isArray(data.order)) {
return data.order;
}

if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
return data.data;
}

if (data && typeof data === 'object' && !Array.isArray(data)) {
return data;
}

return null;
};

const normalizeLatLngNumber = (value) => {
const parsed = Number(value);
return Number.isFinite(parsed) ? parsed : null;
};

const toLatLng = (value) => {
if (!value || typeof value !== 'object') {
return null;
}

const lat = normalizeLatLngNumber(
value?.lat ??
value?.latitude ??
value?.coords?.latitude ??
value?.location?.latitude ??
value?.location?.lat ??
value?.position?.latitude
);

const lng = normalizeLatLngNumber(
value?.lng ??
value?.longitude ??
value?.coords?.longitude ??
value?.location?.longitude ??
value?.location?.lng ??
value?.position?.longitude
);

if (lat === null || lng === null) {
return null;
}

return { lat, lng };
};

const resolveReferenceId = (value) => {
if (typeof value === 'string' || typeof value === 'number') {
return String(value).trim();
}

if (value && typeof value === 'object' && !Array.isArray(value)) {
const nestedId = value._id ?? value.id;
if (typeof nestedId === 'string' || typeof nestedId === 'number') {
return String(nestedId).trim();
}
}

return '';
};

const normalizeOrderItem = (item = {}) => {
const itemId =
resolveReferenceId(item?._id) ||
resolveReferenceId(item?.id) ||
resolveReferenceId(item?.menuItem);
const menuItemId =
resolveReferenceId(item?.menuItem) ||
resolveReferenceId(item?._id) ||
resolveReferenceId(item?.id);

return {
...item,
_id: itemId || null,
id: itemId || null,
menuItem: menuItemId || null,
name: normalizeString(
item?.name || item?.menuItem?.name || item?.title,
'Article'
),
quantity: Math.max(0, normalizeNumber(item?.quantity, 0)),
price: normalizeNumber(item?.price, 0),
image: normalizeString(item?.image || item?.menuItem?.image),
};
};
};

const normalizeOrder = (order = {}) => {
const deliveryLocation = order?.deliveryLocation || null;
const restaurant =
order?.restaurant && typeof order.restaurant === 'object'
? order.restaurant
: null;

const customer =
order?.user && typeof order.user === 'object'
? order.user
: null;

const deliveryPerson =
order?.deliveryPerson && typeof order.deliveryPerson === 'object'
? order.deliveryPerson
: null;

const items = Array.isArray(order?.items)
? order.items.map(normalizeOrderItem)
: [];

return {
...order,
_id: order?._id || order?.id || '',
id: order?.id || order?._id || '',
status: normalizeString(order?.status, 'En attente'),
paymentStatus: normalizeString(order?.paymentStatus, 'Non payé'),
currency: normalizeString(order?.currency, 'EUR'),
totalPrice: normalizeNumber(order?.totalPrice, 0),
deliveryAddress: normalizeString(order?.deliveryAddress),
notes: normalizeString(order?.notes),
createdAt: order?.createdAt || null,
updatedAt: order?.updatedAt || null,

restaurant,
restaurantName: normalizeString(
restaurant?.name || order?.restaurantName,
'Restaurant Afroeat'
),

user: customer,
customerName: normalizeString(
customer?.name || order?.customerName,
'Client Afroeat'
),

deliveryPerson,
driverName: normalizeString(
deliveryPerson?.name || order?.driverName,
''
),

items,

itemCount: items.reduce((sum, item) => {
return sum + Math.max(0, normalizeNumber(item?.quantity, 0));
}, 0),

driverLocation:
toLatLng(order?.driverLocation) ||
toLatLng(deliveryLocation) ||
toLatLng(order?.tracking?.driverLocation) ||
null,

customerLocation:
toLatLng(order?.customerLocation) ||
toLatLng(order?.customerAddressLocation) ||
toLatLng(order?.deliveryAddressLocation) ||
null,

estimatedDeliveryTime: normalizeString(
order?.estimatedDeliveryTime ||
order?.etaLabel ||
order?.eta
),

isPaid: normalizeBoolean(order?.isPaid, false),
};
};

const sortOrdersByRecentFirst = (orders = []) => {
return [...orders].sort((a, b) => {
const aDate = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
const bDate = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
return bDate - aDate;
});
};

const ensureToken = (token) => {
if (!normalizeString(token)) {
throw new Error('Session invalide. Reconnecte-toi.');
}
};

const ensureOrderId = (orderId) => {
if (!normalizeString(orderId)) {
throw new Error('ID de commande manquant.');
}
};

export const getAssignedOrders = async (token) => {
ensureToken(token);

const preferredEndpoint =
API_ENDPOINTS?.delivery?.assignedOrders || API_ENDPOINTS?.orders?.deliveryOrders;

const data = await apiGet(preferredEndpoint, token);
const orders = normalizeArrayResponse(data).map(normalizeOrder);

const filteredOrders = orders.filter((order) =>
DELIVERY_VISIBLE_STATUSES.includes(order?.status)
);

return sortOrdersByRecentFirst(filteredOrders);
};

export const getDeliveryOrderById = async (orderId, token) => {
ensureToken(token);
ensureOrderId(orderId);

const deliveryOrderEndpoint =
typeof API_ENDPOINTS?.delivery?.byOrderId === 'function'
? API_ENDPOINTS.delivery.byOrderId(orderId)
: null;

let data = null;

try {
if (deliveryOrderEndpoint) {
data = await apiGet(deliveryOrderEndpoint, token);
}
} catch (error) {
data = await apiGet(API_ENDPOINTS.orders.byId(orderId), token);
}

if (!data) {
data = await apiGet(API_ENDPOINTS.orders.byId(orderId), token);
}

const order = normalizeObjectResponse(data);

if (!order) {
throw new Error('Commande introuvable.');
}

return normalizeOrder(order);
};

export const updateDeliveryStatus = async (orderId, status, token) => {
ensureToken(token);
ensureOrderId(orderId);

const normalizedStatus = normalizeString(status);

if (!normalizedStatus) {
throw new Error('Statut invalide.');
}

const endpoint =
typeof API_ENDPOINTS?.delivery?.orderStatus === 'function'
? API_ENDPOINTS.delivery.orderStatus(orderId)
: API_ENDPOINTS.orders.updateStatus(orderId);

let data = null;

try {
data = await apiPut(endpoint, { status: normalizedStatus }, token);
} catch (error) {
data = await apiPut(
API_ENDPOINTS.orders.updateStatus(orderId),
{ status: normalizedStatus },
token
);
}

const updatedOrder = normalizeObjectResponse(data);

return normalizeOrder(
updatedOrder || {
_id: orderId,
status: normalizedStatus,
}
);
};

export const updateDriverLocation = async (orderId, coords, token) => {
ensureToken(token);
ensureOrderId(orderId);

const safeCoords = toLatLng(coords);

if (!safeCoords) {
throw new Error('Coordonnées GPS invalides.');
}

const deliveryLocationEndpoint = API_ENDPOINTS?.delivery?.updateLocation;
const orderDriverLocationEndpoint =
typeof API_ENDPOINTS?.orders?.driverLocation === 'function'
? API_ENDPOINTS.orders.driverLocation(orderId)
: null;

let data = null;

const payloads = [
{
latitude: safeCoords.lat,
longitude: safeCoords.lng,
},
{
lat: safeCoords.lat,
lng: safeCoords.lng,
},
{
driverLocation: {
latitude: safeCoords.lat,
longitude: safeCoords.lng,
},
},
];

const tryRequests = async () => {
if (deliveryLocationEndpoint) {
for (const payload of payloads) {
try {
return await apiPut(deliveryLocationEndpoint, payload, token);
} catch (error) {
// continue
}
}
}

if (orderDriverLocationEndpoint) {
for (const payload of payloads) {
try {
return await apiPut(orderDriverLocationEndpoint, payload, token);
} catch (error) {
// continue
}
}
}

const fallbackEndpoint =
typeof API_ENDPOINTS?.orders?.track === 'function'
? API_ENDPOINTS.orders.track(orderId)
: `/orders/${orderId}/tracking`;

for (const payload of payloads) {
try {
return await apiPut(fallbackEndpoint, payload, token);
} catch (error) {
// continue
}
}

throw new Error('Impossible de synchroniser la position GPS.');
};

data = await tryRequests();

const updatedOrder = normalizeObjectResponse(data);

return normalizeOrder(
updatedOrder || {
_id: orderId,
driverLocation: safeCoords,
deliveryLocation: safeCoords,
updatedAt: new Date().toISOString(),
}
);
};

export const getDeliveryStats = (orders = []) => {
const safeOrders = Array.isArray(orders) ? orders : [];

return {
total: safeOrders.length,
confirmed: safeOrders.filter((order) => order?.status === 'Confirmée').length,
preparing: safeOrders.filter((order) => order?.status === 'En préparation').length,
delivering: safeOrders.filter((order) => order?.status === 'En livraison').length,
delivered: safeOrders.filter((order) => order?.status === 'Livrée').length,
};
};

export const getNextDeliveryStatus = (currentStatus) => {
const normalizedStatus = normalizeString(currentStatus);

if (normalizedStatus === 'Confirmée') return 'En préparation';
if (normalizedStatus === 'En préparation') return 'En livraison';
if (normalizedStatus === 'En livraison') return 'Livrée';

return null;
};

export const canDriverUpdateStatus = (status) => {
const normalizedStatus = normalizeString(status);
return DELIVERY_MUTABLE_STATUSES.includes(normalizedStatus);

};

export const calculateDistanceKm = (fromCoords, toCoords) => {
const from = toLatLng(fromCoords);
const to = toLatLng(toCoords);

if (!from || !to) {
return null;
}

const toRad = (deg) => (deg * Math.PI) / 180;
const earthRadiusKm = 6371;

const dLat = toRad(to.lat - from.lat);
const dLng = toRad(to.lng - from.lng);

const a =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(toRad(from.lat)) *
Math.cos(toRad(to.lat)) *
Math.sin(dLng / 2) *
Math.sin(dLng / 2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
const distance = earthRadiusKm * c;

return Number(distance.toFixed(1));
};

export const calculateETA = (distanceKm, averageSpeedKmH = 28) => {
const distance = normalizeNumber(distanceKm, NaN);
const speed = normalizeNumber(averageSpeedKmH, NaN);

if (!Number.isFinite(distance) || distance < 0) {
return null;
}

if (!Number.isFinite(speed) || speed <= 0) {
return null;
}

const minutes = Math.max(1, Math.round((distance / speed) * 60));
return minutes;
};

export const formatEtaLabel = (etaMinutes) => {
const minutes = normalizeNumber(etaMinutes, NaN);

if (!Number.isFinite(minutes) || minutes <= 0) {
return 'ETA indisponible';
}

if (minutes < 60) {
return `${minutes} min`;
}

const hours = Math.floor(minutes / 60);
const remainingMinutes = minutes % 60;

if (remainingMinutes === 0) {
return `${hours} h`;
}

return `${hours} h ${remainingMinutes} min`;
};