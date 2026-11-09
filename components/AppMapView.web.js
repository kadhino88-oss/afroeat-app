import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const project = (latitude, longitude, zoom) => {
  const scale = TILE_SIZE * 2 ** zoom;
  const safeLatitude = clamp(latitude, -85.0511, 85.0511);
  const sinLatitude = Math.sin((safeLatitude * Math.PI) / 180);

  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      scale,
  };
};

const getChildCallout = (marker) =>
  React.Children.toArray(marker?.props?.children).find(
    (child) => React.isValidElement(child) && typeof child.props?.onPress === 'function'
  );

export default function AppMapViewWeb({
  style,
  initialRegion,
  showsUserLocation,
  children,
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selectedMarker, setSelectedMarker] = useState(null);
  const center = {
    latitude: initialRegion?.latitude ?? 48.8566,
    longitude: initialRegion?.longitude ?? 2.3522,
  };
  const zoom = clamp(
    Math.round(
      Math.log2(
        (360 * Math.max(size.width, 320)) /
          (TILE_SIZE * (initialRegion?.longitudeDelta || 0.08))
      )
    ),
    MIN_ZOOM,
    MAX_ZOOM
  );

  const mapData = useMemo(() => {
    if (!size.width || !size.height) {
      return { tiles: [], markers: [], userPoint: null };
    }

    const centerPoint = project(center.latitude, center.longitude, zoom);
    const left = centerPoint.x - size.width / 2;
    const top = centerPoint.y - size.height / 2;
    const firstTileX = Math.floor(left / TILE_SIZE);
    const lastTileX = Math.floor((left + size.width) / TILE_SIZE);
    const firstTileY = Math.floor(top / TILE_SIZE);
    const lastTileY = Math.floor((top + size.height) / TILE_SIZE);
    const tileCount = 2 ** zoom;
    const tiles = [];

    for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
      if (tileY < 0 || tileY >= tileCount) continue;
      for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${zoom}/${wrappedX}/${tileY}`,
          uri: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
          left: tileX * TILE_SIZE - left,
          top: tileY * TILE_SIZE - top,
        });
      }
    }

    const markers = React.Children.toArray(children)
      .filter(
        (child) =>
          React.isValidElement(child) &&
          Number.isFinite(child.props?.coordinate?.latitude) &&
          Number.isFinite(child.props?.coordinate?.longitude)
      )
      .map((marker) => {
        const point = project(
          marker.props.coordinate.latitude,
          marker.props.coordinate.longitude,
          zoom
        );
        return {
          key: marker.key || `${point.x}:${point.y}`,
          x: point.x - left,
          y: point.y - top,
          color: marker.props.pinColor || '#C8331A',
          callout: getChildCallout(marker),
        };
      })
      .filter(
        (marker) =>
          marker.x >= -24 &&
          marker.x <= size.width + 24 &&
          marker.y >= -24 &&
          marker.y <= size.height + 24
      );

    return {
      tiles,
      markers,
      userPoint: showsUserLocation
        ? { x: size.width / 2, y: size.height / 2 }
        : null,
    };
  }, [center.latitude, center.longitude, children, showsUserLocation, size, zoom]);

  return (
    <View
      style={[styles.map, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height }
        );
      }}
    >
      {mapData.tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.uri }}
          resizeMode="stretch"
          style={[styles.tile, { left: tile.left, top: tile.top }]}
        />
      ))}

      {mapData.markers.map((marker) => (
        <React.Fragment key={marker.key}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir ce lieu"
            onPress={() =>
              setSelectedMarker((current) =>
                current === marker.key ? null : marker.key
              )
            }
            style={[
              styles.pin,
              { left: marker.x - 14, top: marker.y - 30 },
            ]}
          >
            <Ionicons name="location" size={30} color={marker.color} />
          </Pressable>

          {selectedMarker === marker.key && marker.callout ? (
            <Pressable
              accessibilityRole="button"
              onPress={marker.callout.props.onPress}
              style={[
                styles.callout,
                {
                  left: clamp(marker.x - 105, 8, Math.max(8, size.width - 218)),
                  top: marker.y > 150 ? marker.y - 145 : marker.y + 18,
                },
              ]}
            >
              {marker.callout.props.children}
            </Pressable>
          ) : null}
        </React.Fragment>
      ))}

      {mapData.userPoint ? (
        <View
          style={[
            styles.userPin,
            { left: mapData.userPoint.x - 8, top: mapData.userPoint.y - 8 },
          ]}
        />
      ) : null}
    </View>
  );
}

export const Marker = () => null;
export const Callout = () => null;
export const Polyline = () => null;

const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 260,
    backgroundColor: '#E7E2D8',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    position: 'absolute',
    pointerEvents: 'none',
  },
  pin: {
    width: 34,
    height: 38,
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    cursor: 'pointer',
  },
  callout: {
    position: 'absolute',
    zIndex: 3,
    width: 210,
    cursor: 'pointer',
  },
  userPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2782E6',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    position: 'absolute',
    zIndex: 1,
  },
});
