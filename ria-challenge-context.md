# Ria Design Challenge — Context

## The Brief

Design and build a wallet experience for **mobile** covering three flows. The wallet should feel like it belongs within the Ria product ecosystem but should push the experience forward. Ria is one of the world's largest money transfer companies helping people send money across borders.

Deliverables:
- Public GitHub repo + deployed URL
- Decision log covering 4-6 key decisions (gaps filled, interaction reasoning, what you'd do differently with more time)

---

## What They're Evaluating

- **Design judgment** — visual system feels considered, states are complete (loading, empty, error)
- **Craft and execution** — micro-interactions, transitions, spacing, typography feel intentional
- **Handling ambiguity** — the brief has intentional gaps; how you handle them matters
- **Communication** — trade-offs explained clearly and concisely

---

## Screens & Content Inventory

### Flow 1 — Card Management

**Card List**
- Cards displayed with: last 4 digits, card network (Visa/Mastercard), expiry, frozen state indicator
- Actions accessible per card: freeze/unfreeze, view PIN, remove card
- Add card CTA
- Empty state (no cards added yet)

**Card Detail View**
- Full card face: cardholder name, masked card number, expiry, CVV
- Tap to reveal full card number
- View PIN action
- Freeze/unfreeze toggle with visible frozen state

**Add Card**
- Manual entry: card number, expiry, CVV, name on card

**Remove Card**
- Confirmation step before deletion (destructive action)

---

### Flow 2 — Wallet Home

- Single screen: wallet balance, recent activity, primary action
- Recent activity list: merchant/recipient name, amount, date, status (pending / completed / failed)
- Primary CTA: Send Money

---

### Flow 3 — Send Money P2P

**Recipient Selection**
- Recent/frequent contacts shown
- Search for a new recipient by name or phone number

**Amount Entry**
- Sender's currency
- Exchange rate shown
- Fee shown

**Confirmation**
- Summary: recipient, amount, fee, total deducted from wallet
- Option to edit before confirming

**Success State**
- Transfer confirmed, delivery ETA shown

**Error States**
- Insufficient funds
- Transfer failed
- Each error shows what happened and what the user can do next

---

## Gaps & Decisions Made

| Gap | Decision |
|-----|----------|
| Wallet type undefined | Treated as a stored-balance wallet, not just a card manager |
| Currency unspecified | Single currency, USD |
| Authentication not mentioned | Assumed user is already authenticated, no gate in scope |
| Add card scope unclear | Full manual entry form included |
| Number of cards per user | Multiple cards supported |