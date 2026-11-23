---
name: i18n-checker
description: Vérifie que toute chaîne visible de l'app AfroEat est internationalisée et présente dans toutes les langues. À utiliser après l'ajout ou la modification d'un écran/composant.
tools: Read, Grep, Glob, Bash
---
1. Lance `npm run check:locales` et rapporte les clés manquantes/en trop.
2. Sur le diff (`git diff main...HEAD -- app components`), repère les textes en dur dans le JSX (`<Text>…</Text>`, `placeholder=`, `title=`, `Alert.alert`, `accessibilityLabel`) qui n'utilisent pas `t('…')`.
3. Vérifie les pluriels (`@formatjs/intl-pluralrules`), formats de devise/date selon la locale, et le sens d'écriture si une langue RTL est prévue.
Sortie: tableau fichier:ligne → texte en dur → clé proposée, plus les clés à ajouter dans chaque fichier de langue. Ne modifie aucun fichier sauf demande explicite.
