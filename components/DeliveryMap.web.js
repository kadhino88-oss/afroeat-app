import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Carte de livraison (web) : tuiles OpenStreetMap (thème sombre), itinéraire routier (OSRM),
 * positions du livreur, du restaurant et du client. Aucune dépendance externe.
 */
const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const project = (lat, lng, zoom) => {
  const scale = TILE * 2 ** zoom;
  const s = Math.sin((clamp(lat, -85.0511, 85.0511) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
};
const unproject = (x, y, zoom) => {
  const scale = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: (x / scale) * 360 - 180 };
};

const STYLE_ID = 'afroeat-delivery-map-css';
const CSS = `
@keyframes afPulse{0%{transform:translate(-50%,-50%) scale(.6);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
@keyframes afDash{to{stroke-dashoffset:-48}}
.af-route{stroke-dasharray:14 10;animation:afDash 1.2s linear infinite}
.af-btn{cursor:pointer;border:1px solid rgba(120,255,190,.35);background:rgba(6,24,16,.82);color:#9dffd0;border-radius:10px;width:38px;height:38px;font:700 18px system-ui;backdrop-filter:blur(6px)}
.af-btn:hover{background:rgba(20,70,48,.9)}
`;

const Marker = ({ x, y, color, label, pulse, glyph }) =>
  React.createElement(
    'div',
    { style: { position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: pulse ? 5 : 4, pointerEvents: 'none' } },
    pulse &&
      React.createElement('div', {
        style: { position: 'absolute', left: 0, top: 0, width: 28, height: 28, borderRadius: 14, background: color, animation: 'afPulse 1.8s ease-out infinite' },
      }),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute', left: -15, top: -15, width: 30, height: 30, borderRadius: 15, background: '#06120C',
          border: `2px solid ${color}`, boxShadow: `0 0 14px ${color}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 14px system-ui',
        },
      },
      glyph
    ),
    label &&
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute', left: 20, top: -12, whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: 8, background: 'rgba(6,18,12,.88)',
            border: '1px solid rgba(255,255,255,.12)', color: '#E8FFF3', font: '600 12px system-ui',
          },
        },
        label
      )
  );

export default function DeliveryMap({ driver, pickup, dropoff, labels = {}, onRoute, style }) {
  const boxRef = useRef(null);
  const drag = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState(null); // { lat, lng, zoom } ; null = ajustement automatique
  const [fetchedRoute, setRoute] = useState(null);

  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => [driver, pickup, dropoff].filter(Boolean), [driver, pickup, dropoff]);
  const route = dropoff && points.length > 1 ? fetchedRoute : null;

  // Itinéraire : du livreur (ou du restaurant) vers le client, via le restaurant s'il est connu.
  const routeKey = [driver, pickup, dropoff].map((p) => (p ? `${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : '-')).join('|');
  useEffect(() => {
    const stops = [driver, pickup, dropoff].filter(Boolean);
    if (!dropoff || stops.length < 2) return undefined;
    const controller = new AbortController();
    const path = stops.map((p) => `${p.lng},${p.lat}`).join(';');
    fetch(`${OSRM}/${path}?overview=full&geometries=geojson`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('osrm'))))
      .then((data) => {
        const best = data?.routes?.[0];
        if (!best) throw new Error('no route');
        setRoute({ coords: best.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), distanceKm: best.distance / 1000, minutes: best.duration / 60 });
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setRoute({ coords: stops, distanceKm: null, minutes: null, approximate: true });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  useEffect(() => {
    if (onRoute) onRoute(route);
  }, [route, onRoute]);

  const fitted = useMemo(() => {
    const all = route?.coords?.length ? [...route.coords, ...points] : points;
    if (!all.length || !size.w) return null;
    const lats = all.map((p) => p.lat);
    const lngs = all.map((p) => p.lng);
    const bounds = { n: Math.max(...lats), s: Math.min(...lats), e: Math.max(...lngs), w: Math.min(...lngs) };
    let zoom = MAX_ZOOM;
    for (; zoom > MIN_ZOOM; zoom -= 1) {
      const a = project(bounds.n, bounds.w, zoom);
      const b = project(bounds.s, bounds.e, zoom);
      if (Math.abs(b.x - a.x) <= size.w - 140 && Math.abs(b.y - a.y) <= size.h - 140) break;
    }
    return { lat: (bounds.n + bounds.s) / 2, lng: (bounds.e + bounds.w) / 2, zoom: Math.min(zoom, 16) };
  }, [points, route, size]);

  const current = view || fitted;

  const layout = useMemo(() => {
    if (!current || !size.w) return null;
    const c = project(current.lat, current.lng, current.zoom);
    const left = c.x - size.w / 2;
    const top = c.y - size.h / 2;
    const toScreen = (p) => {
      const q = project(p.lat, p.lng, current.zoom);
      return { x: q.x - left, y: q.y - top };
    };
    const n = 2 ** current.zoom;
    const tiles = [];
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty += 1) {
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx += 1) {
        if (ty < 0 || ty >= n) continue;
        const wrapped = ((tx % n) + n) % n;
        tiles.push({ key: `${current.zoom}-${tx}-${ty}`, src: `https://tile.openstreetmap.org/${current.zoom}/${wrapped}/${ty}.png`, x: tx * TILE - left, y: ty * TILE - top });
      }
    }
    return { tiles, toScreen };
  }, [current, size]);

  const setZoom = useCallback((delta) => {
    if (!current) return;
    setView({ ...current, zoom: clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM) });
  }, [current]);

  const onPointerDown = (e) => {
    if (!current) return;
    drag.current = { x: e.clientX, y: e.clientY, view: current };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const c = project(d.view.lat, d.view.lng, d.view.zoom);
    const next = unproject(c.x - (e.clientX - d.x), c.y - (e.clientY - d.y), d.view.zoom);
    setView({ ...d.view, lat: clamp(next.lat, -85, 85), lng: next.lng });
  };
  const onPointerUp = () => { drag.current = null; };

  const routePath = useMemo(() => {
    if (!layout || !route?.coords?.length) return '';
    return route.coords.map((p, i) => {
      const s = layout.toScreen(p);
      return `${i ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
    }).join(' ');
  }, [layout, route]);

  const mk = (p, props) => {
    if (!p || !layout) return null;
    const s = layout.toScreen(p);
    return React.createElement(Marker, { ...props, x: s.x, y: s.y });
  };

  return React.createElement(
    'div',
    {
      ref: boxRef,
      role: 'application',
      'aria-label': labels.aria || 'Carte de livraison',
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp,
      onWheel: (e) => setZoom(e.deltaY < 0 ? 1 : -1),
      style: { position: 'relative', overflow: 'hidden', background: '#06120C', borderRadius: 20, minHeight: 360, width: '100%', height: '100%', touchAction: 'none', cursor: 'grab', userSelect: 'none', ...style },
    },
    layout && React.createElement('div', { style: { position: 'absolute', inset: 0, filter: 'invert(1) hue-rotate(150deg) brightness(.78) contrast(.95) saturate(.55)' } },
      layout.tiles.map((t) => React.createElement('img', { key: t.key, src: t.src, alt: '', draggable: false, style: { position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE } }))),
    layout && React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(2,10,6,.65) 100%)', pointerEvents: 'none' } }),
    layout && routePath && React.createElement('svg', { width: size.w, height: size.h, style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 } },
      React.createElement('path', { d: routePath, fill: 'none', stroke: 'rgba(0,255,170,.22)', strokeWidth: 12, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      React.createElement('path', { d: routePath, className: 'af-route', fill: 'none', stroke: '#2CFFB0', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' })),
    mk(pickup, { color: '#FFB020', glyph: '⌂', label: labels.pickup }),
    mk(dropoff, { color: '#FF4D6D', glyph: '⚑', label: labels.dropoff }),
    mk(driver, { color: '#2CFFB0', glyph: '➤', label: labels.driver, pulse: true }),
    React.createElement('div', { style: { position: 'absolute', right: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 6 } },
      React.createElement('button', { className: 'af-btn', type: 'button', 'aria-label': 'Zoom +', onPointerDown: (e) => e.stopPropagation(), onClick: () => setZoom(1) }, '+'),
      React.createElement('button', { className: 'af-btn', type: 'button', 'aria-label': 'Zoom −', onPointerDown: (e) => e.stopPropagation(), onClick: () => setZoom(-1) }, '−'),
      React.createElement('button', { className: 'af-btn', type: 'button', 'aria-label': labels.recenter || 'Recentrer', onPointerDown: (e) => e.stopPropagation(), onClick: () => setView(null) }, '◎')),
    React.createElement('div', { style: { position: 'absolute', left: 8, bottom: 6, zIndex: 6, font: '11px system-ui', color: 'rgba(232,255,243,.7)' } },
      '© ', React.createElement('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noreferrer', style: { color: 'inherit' } }, 'OpenStreetMap'), ' · OSRM')
  );
}
