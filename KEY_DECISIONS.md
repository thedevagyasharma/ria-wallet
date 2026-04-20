# Key Decisions

The brief covers three flows (card management, wallet home, send money P2P) and is intentionally sparse on the product model. This is how I filled the gaps and why.

## Assumptions

1. **Users hold multiple currencies.** Ria is cross-border. Users keep money in different currencies for use abroad or at home. One wallet per currency.
2. **Cards are issued by the wallet.** Cards draw from a wallet balance. "Add card" is issuance, not linking an external card.
3. **Recipients are registered users, identified by phone number.**
4. **Per-transaction fees shown explicitly.** Inline fees over folding into the rate. Creates trust and allows for promo opportunities.
5. **Existing user perspective.** The brief asks for core flows, so I skipped login, registration, and onboarding.
6. **Native mobile app.** React Native / Expo, not a responsive web app.

---

## Decisions

### Motion

**1. Digit drum as a shared motion language.**
Wherever numbers change or are revealed, each digit rolls independently to its new value. Used for wallet balances on swipe, card number and CVV reveal, PIN reveal, and send amounts. One interaction pattern for "this number is being recalculated or revealed" across the entire app.
**Why:** In a finance app, numbers changing should feel deliberate. Using the same motion everywhere reinforces that meaning.

### Wallet home

**2. Two wallet layouts (Quick / Classic).**
Quick is denser, familiar for finance apps. Classic prioritizes the primary action (Send) and moves customization to the header.
**Trade-off:** Quick is the more familiar pattern but has no clear CTA priority. Classic gives Send clear priority but is a less common pattern in finance apps. Included both to show the thinking.

### Send flow

**3. Bidirectional amount entry.**
Both send and receive fields are editable. Quick amount chips flip currency based on active field.
**Trade-off:** More complex input area, but senders often know the receive amount ("she needs 3,000 pesos").

**4. Receiver currency visibility.**
Dropdown shows wallets the receiver has chosen to make visible.
**Trade-off:** Exposes what currencies the receiver holds, but the sender likely knows them personally (remittance, not marketplace), and the receiver controls visibility via privacy settings.

**5. Inline fees.**
Fee always visible on the amount entry screen with tiered breakdown on tap. Localized to sender's currency.
**Trade-off:** Takes up space on a dense screen, but prevents surprise at the confirm step.

**6. Confirm button as a state machine.**
I didn't have a strong idea for a celebration screen, so I kept the user on the confirm screen and let the button carry the feedback: idle, processing, success (green gradient + checkmark), failure (red + X). Each state has a distinct haptic signature.
**Trade-off:** The success moment might not feel as rewarding as a dedicated screen. The haptics and gradient carry the emotional weight, but there's less room to celebrate the completion.

### Cards

**7. Three card types (physical, virtual, single-use).**
Physical for everyday spending, virtual for online purchases, single-use for one-time payments where you don't want to share your real card details. Single-use regenerates its details per transaction instead of creating disposable card records.
**Trade-off:** Three types could confuse users when adding a card. The add card screen tries to address this by explaining the use case for each type.

**8. Sensitive data behind gates.**
Card number and CVV are hidden by default. Revealing one hides the other. PIN requires biometric auth and auto-hides after 15 seconds with a countdown ring.
**Trade-off:** If a user needs both card number and CVV at the same time (e.g. filling out a payment form), they can't see both. But reducing the risk of a bad actor seeing all the information at once is worth the friction.

**9. Spending limits on the card screen.**
Progress bars on the card detail view.
**Why:** Users check spending limits often, usually right before making a purchase. Keeping them on the card screen means they're visible at the moment the user is already looking at their card details.

---

## Non-functional actions

Present in the UI to show placement, but only trigger a haptic tap:

- Top Up (wallet screen)
- Share Receipt (transaction detail)
- Help (transaction detail)
- Help center, Privacy policy, Terms of service (profile)

---

## With more time

**Features**
- **Exchange between own wallets.** Transfer funds from one currency to another within your own account, without sending to another person.
- **Hot and cold wallets.** Split funds into spending (hot) and savings (cold) wallets.
- **Per-merchant blocking.** Block specific merchants from charging a card. Cancelling subscriptions on platforms can be difficult, so a kill switch at the card level puts the user in control.
- **PDF export and dispute flow** on transaction details.

**Craft**
- **Smooth card switching transition.** When swiping between cards in the carousel, the content below (card details, spending limits, actions) swaps without a transition. I tested animating this content to match the card swipe, but each approach had a flaw (usability, visual, performance). Kept it as a simple swap.
