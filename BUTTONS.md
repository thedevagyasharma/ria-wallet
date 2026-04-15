# Button System

Four components. Pick the right one — don't use raw `Pressable` for buttons.

---

## PrimaryButton
**Brand orange gradient. One per screen/sheet — the main thing you want the user to do.**

```tsx
<PrimaryButton label="Save limits" onPress={handleSave} style={styles.btn} />
```

- Background: `colors.brand` (orange)
- Label: bold, `#441306`
- Disabled: `colors.surfaceHigh` background, `colors.textMuted` label
- Use for: "Confirm", "Save", "Set limit", "Unfreeze card"
- Never for: destructive actions, secondary/neutral actions

---

## SecondaryButton
**White bordered button. For actions that need presence but aren't the primary CTA.**

```tsx
<SecondaryButton label="Remove limit" shape="rect" onPress={handleRemove} style={styles.btn} />
```

- Background: `colors.surface` with subtle gradient sheen
- Label: semibold, `colors.textPrimary`
- `shape="rect"` only for icon+text action button grids (e.g. Freeze / View PIN row) — default pill everywhere else
- Use for: "Remove limit", "Freeze card", non-destructive secondary actions, icon+text action buttons
- Never for: the main CTA, destructive actions

---

## DestructiveButton
**Red. Only for irreversible actions that cause data loss or permanent state change.**

```tsx
<DestructiveButton label="Remove card" onPress={handleRemove} style={styles.btn} />
```

- Background: `colors.failed` (red-600)
- Label: bold, `#fff`
- Disabled: `colors.surfaceHigh` background, `colors.textMuted` label
- Use for: "Remove card", "Report card", permanent deletes
- Never for: anything reversible — "Remove limit" is `SecondaryButton`, not this

---

## FlatButton
**No background. For dismiss and cancel actions.**

```tsx
<FlatButton label="Cancel" onPress={onClose} style={styles.cancelBtn} />
```

- No background, no border
- Label: medium weight, `colors.textSecondary`
- Pressed: opacity fade
- Use for: "Cancel", "Close", "Skip"

---

## Rules

**Use `label` prop, not `<Text>` children.**
All four buttons render their own text — correct size, weight, and disabled colour built in. Never pass a `<Text>` child or define text styles externally just to label a button.

```tsx
// ✅
<PrimaryButton label="Confirm" onPress={onConfirm} style={styles.btn} />

// ❌
<PrimaryButton onPress={onConfirm} style={styles.btn}>
  <Text style={styles.btnText}>Confirm</Text>
</PrimaryButton>
```

**`children` is for icon+text compositions only.**

```tsx
// ✅ icon alongside text — children is appropriate
<SecondaryButton shape="rect" style={styles.actionBtn}>
  <View style={styles.icon}><Snowflake size={22} /></View>
  <Text style={styles.actionLabel}>Freeze</Text>
</SecondaryButton>
```

**Never use `Pressable` directly for a button.** If none of the four fit, extend one of them.

**`style` is for layout only** — width, padding, borderRadius, margin. Never set `backgroundColor` or text styles via `style`.

---

## Choosing the right button

| Situation | Button |
|---|---|
| Main action in a sheet or screen | `PrimaryButton` |
| Neutral/secondary action | `SecondaryButton` |
| Permanently deletes or blocks something | `DestructiveButton` |
| Dismiss / cancel / skip | `FlatButton` |
| Reversible "remove" (e.g. remove a limit) | `SecondaryButton` |
| Freeze / unfreeze card | `PrimaryButton` (it's the main CTA in that context) |
