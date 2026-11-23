# Mobile dependency security overrides

**Scope:** temporary, tightly scoped mitigations for the Expo SDK 58 toolchain (`expo ~58.0.x`). Keep the Expo SDK at its current major until a separately planned and tested SDK migration is ready.

## Overrides retained in package.json

- `@expo/fingerprint` → `minimatch: 11.0.8`: pins the patched `minimatch` for the fingerprint tooling used by Expo/EAS builds (build-time only, not shipped in the app). Remove it once the Expo-maintained dependency range resolves a patched `minimatch` without an override.

The earlier `postcss` and `image-size` (`image-size-next`) overrides are no longer present in `package.json` and must not be re-added without a new, documented advisory.

## Evidence and verification

- Expo package compatibility is checked by `npx expo install --check`.
- `node scripts/audit-gate.cjs` (CI) runs `npm audit --omit=dev --json` and fails on any high/critical advisory. It also fails if the audit output is empty or has no `metadata`. It currently has no documented exceptions (`IGNORED` is empty); any future exception must be justified, dated and approved in that file.
- Do not use `npm audit fix --force` to cross Expo SDK majors merely to suppress alerts.
