# Afroeat mobile app

Expo Router client for Afroeat. The shared API and project-wide setup guide are in `../backend` and `../README.md`.

## Development

1. Copy `.env.example` to `.env`. In development, leave `EXPO_PUBLIC_API_URL` empty to let the app detect the Expo/Metro host automatically. If detection is unavailable, set `EXPO_PUBLIC_API_HOST` to the development computer's LAN IP (for example `192.168.1.22`), or set `EXPO_PUBLIC_API_URL` to the full backend URL ending in `/api`. For a physical phone, never use `localhost` or the Android-emulator-only address `10.0.2.2`.
2. Set `EXPO_PUBLIC_STRIPE_KEY` to a Stripe test publishable key to exercise card checkout.
3. Run `npm ci`, then `npx expo start`.

For an Android emulator, the fallback is `10.0.2.2`; for a physical device, the app attempts to use the Expo/Metro host. Every preview or production build requires `EXPO_PUBLIC_API_URL`; set it in the EAS environment to the real HTTPS API before building.

## EAS

Build profiles are in `eas.json`. The app uses native location, maps, notifications, image picking, and Stripe modules, so test with development or store builds rather than relying on Expo Go. Configure EAS signing credentials, push credentials, the production API URL, and Stripe publishable key before a release build.
