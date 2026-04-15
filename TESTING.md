# Ria Wallet — QA Testing Document

Based on the brief's three required flows and evaluation criteria: design judgment, craft & execution, handling ambiguity, and communication.

---

## Flow 1 — Card Management

> Brief watches for: **information hierarchy, trust cues, state management**

---

### 1a. Card Details View

- [ ] Card visual renders correctly — card number, expiry, cardholder name, network logo all present and legibly typeset
- [ ] Card number defaults to masked state (`•••• •••• •••• 1234`), not fully exposed
- [ ] Active vs. frozen card looks visually different without needing to read text (desaturation, lock icon, label)
- [ ] Transition into screen feels spatial — subtle lift/scale-in from card list, not a flat cut
- [ ] Expired card communicates a distinct state from frozen
- [ ] No nickname set → falls back gracefully to card type + last 4 digits
- [ ] Multiple cards: switching between them is smooth with no flash or layout jump

---

### 1b. Freeze / Unfreeze

- [ ] Tapping "Freeze" surfaces a confirmation step (bottom sheet or modal) before executing
- [ ] In-progress state is visible during the freeze network call (spinner or card animation)
- [ ] Post-freeze: card visually updates immediately — looks frozen, CTA flips to "Unfreeze" without reload
- [ ] Unfreeze: card animates back to active — color restores, lock icon disappears
- [ ] Network failure mid-freeze: UI rolls back visually and shows an explicit error ("Couldn't freeze card. Try again.") — card is never left in an ambiguous state
- [ ] Network failure mid-unfreeze: same rollback behavior

---

### 1c. View PIN

- [ ] PIN defaults to obscured (`• • • •`) — never renders in plaintext passively
- [ ] Reveal requires a deliberate authentication step (biometric prompt, re-auth, or explicit tap-to-reveal)
- [ ] PIN auto-hides after a short duration (~5–10 seconds)
- [ ] PIN hides when the app is backgrounded
- [ ] Re-opening the app after backgrounding mid-PIN-reveal: PIN is hidden on return
- [ ] Screenshot prevention (OS-level if possible); if not, no passive exposure of PIN digits

---

### 1d. Add Card

- [ ] Empty state (no cards): meaningful prompt with illustration and a clear "Add Card" CTA — not a blank screen
- [ ] Card number field: invalid length triggers inline validation (not post-submit)
- [ ] Card number field: non-Luhn number triggers inline validation
- [ ] Expiry field: entering a past date triggers immediate feedback
- [ ] CVV field: input is masked
- [ ] Focus auto-advances from card number → expiry → CVV after each field is complete
- [ ] Number pad keyboard used for all card fields (not full QWERTY)
- [ ] Keyboard does not cover active input fields
- [ ] Submit with all valid data: card appears immediately in list
- [ ] Transition back to card list after adding: new card is visually prominent (briefly highlighted or selected)

---

### 1e. Remove Card

- [ ] Remove action surfaces a destructive confirmation: "Remove card ending in XXXX? This cannot be undone."
- [ ] Confirmation has a clearly styled destructive button (red or high-contrast) and a Cancel option
- [ ] After removal: smooth exit animation from card list
- [ ] Removing the only card: empty state appears correctly
- [ ] Removing the only card mid-send-flow: app handles gracefully (blocks or re-routes, no crash)

---

## Flow 2 — Wallet Home

> Brief watches for: **visual hierarchy, composition, "home" feeling**

---

### 2a. Balance Display

- [ ] Balance is visually dominant — the first thing your eye lands on when squinting at the screen
- [ ] Currency symbol is correctly positioned and legible
- [ ] Balance loading state: skeleton shimmer renders for the duration of the fetch — no blank space or jarring number pop-in
- [ ] Zero balance (`$0.00`): renders without breaking layout; includes a contextual nudge ("Add money to get started")
- [ ] Very large balance (`$99,999.99`): no overflow or truncation
- [ ] Negative balance (if applicable): distinct visual treatment — red tint or warning label
- [ ] Balance visibility toggle (if implemented): hide/show transition is animated (blur or digit scramble), not a hard cut
- [ ] App backgrounded with balance visible → returns hidden (privacy protection)

---

### 2b. Recent Activity

- [ ] Each transaction row shows: name/merchant, amount, date, and status — all scannable at a glance
- [ ] Sent vs. received is color-differentiated (green for received, neutral/red for sent)
- [ ] Timestamps are human-readable ("Today", "Yesterday", "3 days ago") — not raw ISO strings
- [ ] Pending transactions look visually distinct from completed (lighter color, "Pending" label or clock icon)
- [ ] Empty state (no transactions): shows a meaningful prompt, not a blank or silent list
- [ ] Loading state: skeleton rows render during fetch — not a centered spinner over a blank list
- [ ] Error state: if history fails to load, an explicit error message appears with a Retry action — not a silent empty state
- [ ] Tapping a transaction opens a detail view with: status, reference number, date, amount, recipient, fee
- [ ] Transaction detail back navigation returns to Wallet Home cleanly

---

### 2c. Primary Action

- [ ] Primary CTA is visible without scrolling (above the fold, fixed or prominently placed)
- [ ] Button label is unambiguous ("Send Money" not "Transfer")
- [ ] Pressed state is visible and responsive (scale-down or opacity change — no dead tap)
- [ ] Transition into the send flow feels like launching a focused task, not a flat navigation push

---

## Flow 3 — Send Money P2P

> Brief watches for: **core interaction, motion, micro-interactions, edge cases**

---

### 3a. Recipient Selection

- [ ] Recent/frequent recipients surface immediately — not buried below a search field
- [ ] Search: exact name match works
- [ ] Search: partial name match works
- [ ] Search: phone number search works
- [ ] Search: no results state is explicit ("No contacts found") — not a blank list
- [ ] New recipient path is clearly discoverable (by phone, email, or wallet ID)
- [ ] No contacts at all (first-time user): empty state is encouraging, not clinical
- [ ] Selecting a recipient produces clear visual confirmation (highlight, checkmark, name in "To:" field)

---

### 3b. Amount Entry

- [ ] Custom numeric keypad is used — not the system keyboard
- [ ] Currency denomination is immediately visible next to the input field
- [ ] Amount renders in real-time, large and center-stage, as digits are entered
- [ ] Amount exceeding available balance: blocked with clear inline error ("Insufficient balance") — continue button disabled
- [ ] Zero amount: continue/next button is disabled or shows "Enter an amount"
- [ ] Decimal entry: `10` → `.` → `5` produces `10.50` cleanly
- [ ] `.` entered as first character: auto-prefixes to `0.`
- [ ] Amount below minimum threshold: validates and blocks with a message
- [ ] Fee is displayed before the confirmation screen — no surprise fees at the last step
- [ ] If cross-currency: converted amount updates in real-time as user types

---

### 3c. Confirmation Screen

- [ ] All details visible: sender, recipient, amount, fee, estimated arrival, currency
- [ ] Layout is calm and deliberate — sufficient whitespace, clear type hierarchy
- [ ] Confirm action is a prominent, unambiguous button ("Confirm" or "Send $X") — not "Next"
- [ ] Biometric / PIN auth triggers before final send
- [ ] Denying biometrics blocks the send (does not proceed)
- [ ] Tapping back to edit amount returns to amount entry with previous value pre-filled — not blanked
- [ ] Confirmation screen cannot be re-submitted by pressing back and then confirming again (no double-send)

---

### 3d. Success State

- [ ] Success feels like success — animated checkmark, particle burst, or confirmation pulse (not just a static green icon)
- [ ] Confirmation displays: amount sent, recipient, reference/transaction ID, estimated arrival
- [ ] "Done" navigates to Wallet Home — not back to confirmation
- [ ] Wallet Home balance has updated after returning
- [ ] New transaction appears at the top of the recent activity list immediately
- [ ] Hardware/gesture back from success screen goes to Wallet Home — not back to confirmation (preventing re-trigger)
- [ ] Share receipt button (if implemented): opens system share sheet with a formatted summary

---

### 3e. Error / Failure State

- [ ] Network failure mid-send: explicit error screen confirms the transaction did NOT go through ("Transfer failed. Your money has not been sent.")
- [ ] Error state is visually distinct from success — not just a color swap
- [ ] Retry option is available on the error screen
- [ ] Retry is idempotent — no risk of double-sending; UI makes clear the original attempt failed
- [ ] Unconfirmed / queued send: appears in transaction list as "Pending" with a status note — not missing
- [ ] Session timeout mid-flow: app handles re-auth gracefully, flow state preserved (or clearly reset)

---

## Cross-Cutting Concerns

> Applies to all three flows

- [ ] **App lock on re-open:** backgrounding and returning prompts Face ID / PIN. Test mid-flow — flow state is preserved after successful re-auth, not reset
- [ ] **Loading states everywhere:** no screen is ever blank for >100ms without a skeleton or spinner
- [ ] **Back navigation:** every screen has a functional back path. Swipe-back gesture works naturally on all screens
- [ ] **Keyboard avoidance:** on any screen with text input, the keyboard never covers the active input field
- [ ] **Visual system consistency:** colors, type scale, border radii, and elevation/shadow are consistent across all three flows
- [ ] **Motion is spatial and earned:**
  - Push/pop = navigating deeper or back
  - Slide-up = modal/focused task
  - Fade = state change in place
  - No decorative animation that adds latency without orientation
- [ ] **Dark/light mode (if applicable):** all states render correctly in both modes
- [ ] **Accessibility:** tap targets are at minimum 44×44pt; text contrast meets WCAG AA
