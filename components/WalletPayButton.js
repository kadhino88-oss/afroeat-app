import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { PlatformPay, PlatformPayButton, usePlatformPay } from '@stripe/stripe-react-native';

/**
 * Bouton Apple Pay (iOS) / Google Pay (Android).
 * N'apparaît que si l'appareil sait payer par portefeuille : il est donc caché
 * dans Expo Go et sur un appareil sans carte dans Apple Wallet / Google Wallet.
 */
export default function WalletPayButton({ onPress, disabled }) {
  const { isPlatformPaySupported } = usePlatformPay();
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve(isPlatformPaySupported({ googlePay: { testEnv: __DEV__ } }))
      .then((result) => {
        if (active) setSupported(Boolean(result));
      })
      .catch(() => {
        if (active) setSupported(false);
      });
    return () => {
      active = false;
    };
  }, [isPlatformPaySupported]);

  if (!supported) return null;

  return (
    <View style={styles.wrap}>
      <PlatformPayButton
        type={
          Platform.OS === 'ios'
            ? PlatformPay.ButtonType.Order
            : PlatformPay.ButtonType.Pay
        }
        appearance={PlatformPay.ButtonStyle.Automatic}
        borderRadius={16}
        disabled={disabled}
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  button: { width: '100%', height: 52 },
});
