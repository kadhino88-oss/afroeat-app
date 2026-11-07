import React, { createContext, useContext, useMemo, useState } from 'react';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);

  const isFavorite = (id, type) => {
    if (!id || !type) return false;
    return favorites.some(
      (item) => item?.favoriteId === id && item?.favoriteType === type
    );
  };

  const toggleFavorite = (item, type) => {
    if (!item?._id || !type) return;

    setFavorites((prev) => {
      const exists = prev.some(
        (fav) => fav?.favoriteId === item._id && fav?.favoriteType === type
      );

      if (exists) {
        return prev.filter(
          (fav) => !(fav?.favoriteId === item._id && fav?.favoriteType === type)
        );
      }

      return [
        ...prev,
        {
          ...item,
          favoriteId: item._id,
          favoriteType: type,
        },
      ];
    });
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  const favoriteRestaurants = useMemo(
    () => favorites.filter((item) => item?.favoriteType === 'restaurant'),
    [favorites]
  );

  const favoriteMenuItems = useMemo(
    () => favorites.filter((item) => item?.favoriteType === 'menuItem'),
    [favorites]
  );

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        favoriteRestaurants,
        favoriteMenuItems,
        isFavorite,
        toggleFavorite,
        clearFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error(
      'useFavorites doit être utilisé à l’intérieur de FavoritesProvider'
    );
  }

  return context;
}