# Mobile dependency security overrides

**Scope:** temporary, tightly scoped mitigations for the Expo SDK 54 toolchain. Keep the Expo SDK at its current major until a separately planned and tested SDK migration is ready.

## Overrides retained in package.json

- `postcss: ^8.5.23`: the installed `@expo/metro-config` version declares `postcss: ~8.4.32`, which prevents npm from selecting the patched 8.5.x line. PostCSS 8.5 is API-compatible with the way Expo Metro config consumes PostCSS, and this repository validates the resulting app through its Expo web export CI job.
- `image-size: npm:image-size-next@1.2.2`: Metro 0.83.x declares `image-size: ^1.0.2`; the upstream version resolved by that range has high-severity denial-of-service advisories in image parsers. This alias keeps the 1.x API line required by Metro while using a community-maintained compatibility fork with those parser fixes. It is not affiliated with the original package maintainer, so the fork should be reviewed during dependency maintenance.

## Evidence and verification

- Expo SDK 54 package compatibility is checked by `npx expo install --check`.
- `npm audit --omit=dev --audit-level=high` must pass on the PR; the complete CI job also validates wallet/API configuration, translations, targeted lint checks, and `npx expo export --platform web`.
- The dependency repair workflow reduced the reported tree from 38 findings (including 2 critical) to 17 findings (14 low, 3 moderate), with no high/critical advisories in the final audit report. Do not use `npm audit fix --force` to cross Expo SDK majors merely to suppress alerts.
- The override for `postcss` should be removed once the Expo-maintained dependency range allows a patched 8.5.x version without overrides.
- Reassess the `image-size-next` alias once Metro/Expo changes its dependency or the original package offers a patched Metro-compatible 1.x version. Do not replace it with `image-size@2.x` without separately validating Metro API compatibility.

## References

- [Expo issue: widen the PostCSS range for patched 8.5.x](https://github.com/expo/expo/issues/45620)
- [Expo issue: image-size advisories in the Metro dependency closure](https://github.com/expo/expo/issues/48670)
- [GitHub advisory: image-size JXL/HEIF denial of service](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)
- [GitHub advisory: image-size ICNS denial of service](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)
- [image-size-next security policy and compatibility details](https://github.com/lcf2212dev/image-size-next/blob/main/SECURITY.md)
