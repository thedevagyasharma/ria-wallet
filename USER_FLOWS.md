# User Flows

How to reach every screen in the app.

---

## Tabs

The bottom tab bar has four tabs: **Wallets**, **Cards**, **Activity**, **Profile**. A branded **Send** button sits in the center and is accessible from any tab.

---

## Wallets (home)

Swipe left/right to switch between wallets. Each wallet shows its currency, balance, and recent transactions.

- **Send money** — Tap the Send button (center of tab bar) or the Send action on the wallet screen
- **Receive money** — Tap Receive on the wallet screen. Shows a QR code and payment link with currency picker
- **Add a wallet** — Tap "+ Add wallet" at the bottom of the wallet screen. Flow: pick currency, name it, review, done
- **Wallet settings** — Tap Customize on the wallet screen. Rename, change accent color, set as primary
- **See wallet activity** — Tap "See Wallet Activity" below the recent transactions. Opens the Activity tab pre-filtered to that wallet
- **View a transaction** — Tap any transaction row
- **View cards** — Tap a card in the card stack, or tap "View all" / "Add card" in the cards section
- **Switch layout** — Scroll to the bottom of the wallet screen to find prototype settings. Switch between Quick and Classic

---

## Send money

Accessible from the Send button on any tab, or from the Send action on the wallet screen.

1. **Pick a recipient** — Search by name or phone, or pick from recent contacts
2. **Enter amount** — Type in either the send or receive field. The other updates automatically. Tap the receive currency to change it
3. **Review** — Tap Continue to see the confirmation screen with fee breakdown, exchange rate, and ETA
4. **Confirm** — Tap Confirm and Send. The button shows processing, then success or failure
5. **After success** — Tap "View transfer" to see the transaction receipt with tracking timeline

---

## Cards tab

Shows all cards grouped by wallet. Tap a wallet header or card to go to that wallet's card list.

---

## Card list

Swipe between cards in a wallet. Below each card: card details, spending limits, and recent card transactions.

- **Add a card** — Tap "+ Add card". Flow: pick type (physical, virtual, single-use), name it, pick a color, review, done. Single-use cards skip name and color
- **Reveal card number** — Tap "Show number". Tap "Show CVV" (number hides)
- **View PIN** — Tap "View PIN". Requires biometric auth. Auto-hides after 15 seconds
- **Card settings** — Tap the gear icon. Freeze/unfreeze, change PIN, contactless toggle, spending limits, remove card
- **View spending limits** — Tap the limits icon, or scroll down on the card detail view

---

## Activity tab

Shows all transactions across all wallets. Filter by wallet or transaction type using the chips at the top.

- **View a transaction** — Tap any row. Card transactions show merchant, category, and card used. Wallet (P2P) transactions show recipient/sender, exchange rate, and tracking timeline

---

## Profile

- **Set primary wallet** — Tap "Set primary" next to any wallet
- **Hide balances by default** — Toggle in the Privacy section
- **Discoverability** — Tap to choose who can find you (everyone, contacts only, nobody)
- **Visible currencies** — Toggle which wallets others can see when sending to you
