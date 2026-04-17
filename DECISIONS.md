# Design & Engineering Decision Log

---

## Snapshot 1 — 2026-04-13
*Covers: project setup, wallet home screen, add wallet flow, theme system*

### 1. Wallet architecture — multiple currency wallets, not a single card manager

**Decision:** Treat the product as a multi-currency stored-balance wallet. Each wallet is scoped to one currency. Users can hold USD, MXN, PHP, etc. in parallel.

**Why:** The brief called it a "wallet experience" and listed card management as one of three flows, not the whole product. Ria's core business is cross-border money transfer, so a user naturally holds value in both a sending currency (e.g. USD) and a receiving currency (e.g. MXN). A flat card manager without balance ownership would make the Send Money flow feel disconnected.

**Trade-off:** More complex data model. Addressed by keeping wallets as lightweight objects (id, currency, balance, isPrimary) and linking cards and transactions to wallet IDs.

**What I'd do with more time:** Support funding a wallet from a bank account or debit card, and show the funding source on the wallet detail screen.

---

### 2. Primary / secondary wallet hierarchy

**Decision:** The first wallet created is designated "primary". Secondary wallets appear as compact chips below the primary hero card. Send Money defaults to the primary wallet as the source.

**Why:** The brief had no concept of wallet priority, but in practice a migrant worker has one main operating currency (USD if working in the US). Making that the visual and functional anchor reduces cognitive load. The primary badge and hero card treatment make the hierarchy legible at a glance without requiring the user to configure anything.

**Trade-off:** Reassigning the primary wallet isn't in the first iteration. A long-press or wallet settings screen could expose this later.

---

### 3. Cards are per-wallet, capped at 3, with types and spend limits

**Decision:** Each wallet supports up to 3 cards. Cards have a type (virtual, physical, travel, category-locked) and independent spend limits (per-transaction, daily, monthly).

**Why:** The brief mentioned adding and removing cards but didn't explain why a user would want multiple cards on the same wallet. Multiple cards only make sense if they serve distinct purposes — e.g. one physical card for everyday POS use, one virtual card locked to online subscriptions with a low limit, one virtual card for a specific category. Spend limits per card are the mechanism that makes the separation meaningful. The 3-card cap keeps the UI manageable and matches common neobank conventions.

**Physical vs virtual:** Physical cards cost a small fee and require delivery time. Virtual cards are issued instantly and free. This distinction surfaces in the Add Card flow so users understand the trade-off before requesting a physical card.

**What I'd do with more time:** Add a "card purpose" field (e.g. "Netflix card", "Groceries card") so the list is self-labelled rather than relying on type alone.

---

### 4. Curated 12-currency list based on Ria's actual corridors

**Decision:** Offer a fixed list of 12 currencies rather than an open picker: USD, MXN, PHP, INR, NGN, GBP, EUR, GTQ, HNL, DOP, COP, MAD.

**Why:** Ria's primary user is a migrant worker sending money home. The US→Mexico corridor is Ria's largest by volume. The rest of the list covers the next-largest remittance corridors (Philippines, India, Nigeria, UK/Europe, Central America, Dominican Republic, Colombia, Morocco). An open currency list would include hundreds of options irrelevant to this demographic and dilute discoverability. Currencies the user already has are greyed out and labelled "Added" in the picker — duplicate wallets per currency are blocked to avoid confusion.

**What I'd do with more time:** Personalise the picker to surface the user's most likely destination currencies based on their profile or prior transfers.

---

### 5. Unified activity feed with per-wallet filter pills

**Decision:** The Wallets screen shows a single chronological activity feed across all wallets. Filter pills (All / USD / MXN / …) let the user scope the view to one wallet.

**Why:** The brief asked for recent activity on the home screen. With multiple wallets, showing only the active wallet's transactions would hide activity the user might be looking for (e.g. "did that MXN transfer go through?") without switching wallets first. A unified feed with filters is the standard pattern for multi-account fintech apps (Revolut, Wise) and feels familiar to the target demographic who may already use one of those products.

**Each transaction row** shows a currency badge so the wallet source is identifiable without filtering.

---

### 6. Dark theme with Tailwind zinc + orange-500 brand

**Decision:** Full dark UI using Tailwind's zinc scale for backgrounds/text and `orange-500` (`#f97316`) as the primary action colour.

**Why:** Ria's brand uses orange. `orange-500` is the closest Tailwind value to their CTA orange and reads well on dark surfaces. Zinc (near-neutral with a slight cool undertone) was chosen over pure black or slate because it feels premium without the blue cast of slate. All colour values are hardcoded hex — Tailwind's oklch values converted — because React Native / Hermes does not parse `oklch()` strings.

**Wallet cards** use per-currency tinted dark gradients (e.g. green tint for MXN, purple for PHP) so each wallet has a distinct identity without relying solely on the flag emoji.

---

### 7. Currency formatting via a custom helper, not `Intl.NumberFormat` with locale

**Decision:** All monetary amounts are formatted with a custom `formatAmount()` helper that uses `'en-US'` for number formatting and prepends the currency symbol from our own lookup table.

**Why:** Hermes (React Native's JS engine) implements `Intl.NumberFormat` as a JSI HostFunction backed by a bundled ICU dataset. Locales like `'fil-PH'` (Filipino) and `'ar-MA'` (Arabic Morocco) are not present in Hermes's default ICU build. Passing them throws a bare C++ `std::exception` with no message, surfaced to JS as `Exception in HostFunction: <unknown>` — the same error that would appear completely opaque in production. Using `'en-US'` universally avoids the crash while still rendering the correct currency symbol (₱, ₹, ₦, etc.) from our curated list.

**What I'd do with more time:** Use a locale-aware formatting library (e.g. `currency.js` or `dinero.js`) that doesn't depend on the runtime's ICU bundle.

---

### 8. No authentication gate

**Decision:** The app assumes the user is already authenticated. No login, biometric gate, or session management is in scope.

**Why:** The brief explicitly did not mention authentication. Adding a login screen would consume build time without contributing to the three flows being evaluated. A real production app would gate entry with biometrics or PIN, and would use the auth session to fetch the correct user's wallets and transactions from the backend. For the prototype, a named user ("Carlos Mendez") is hardcoded to make the UI feel grounded.

**What I'd do with more time:** Add a Face ID / Touch ID gate on app launch, and a PIN prompt before revealing card numbers or viewing a card PIN.

---

## Snapshot 2 — 2026-04-13
*Covers: card management flow, send money flow*

### 9. Card detail uses a 3D flip to reveal sensitive data, not a modal or separate screen

**Decision:** Tapping the card face on the detail screen triggers a `rotateY` flip animation (Reanimated) to show the full card number and CVV on the back. The number is never visible without an explicit tap.

**Why:** A physical card has two sides — the metaphor is immediately familiar. Compared to a "tap to reveal" inline expand or a separate modal, the flip is more spatially grounded: the sensitive data feels like it lives behind the card, not floating in an overlay. It also means the card never has to show a truncated and a full number simultaneously, which would look cluttered.

**Trade-off:** The flip animation requires `backfaceVisibility: 'hidden'` on both faces and careful `perspective` setup to look correct. In production this should also require a biometric prompt before the flip completes.

**What I'd do with more time:** Gate the flip behind Face ID / Touch ID. Show a 5-second auto-hide timer with a progress indicator, not just a manual re-tap.

---

### 10. Category-locked card type with a multi-select category screen

**Decision:** The "category-locked" card type adds a dedicated step in the Add Card flow where the user selects which spending categories the card accepts. Transactions outside those categories are declined.

**Why:** Without per-category cards, the only way to control category spend is a single wallet-wide limit. Category-locked cards give power users a way to separate "Netflix card" from "groceries card" without needing multiple wallets. This is the feature that most clearly justifies having 3 cards per wallet rather than just 1.

**Trade-off:** Adds a step to the Add Card flow — justified only for this card type. Virtual and physical cards skip the category screen entirely, keeping those flows short.

---

### 11. Custom numpad on the Amount Entry screen instead of the system keyboard

**Decision:** Amount entry uses a bespoke 12-key numpad rendered in the app rather than invoking the system numeric keyboard.

**Why:** The system keyboard on iOS and Android shifts the layout unpredictably, obscures the exchange rate info card, and introduces a visible keyboard animation that feels disconnected from the financial context. A custom numpad keeps the entire screen visible at all times, allows a larger tap target for each key, and lets us add a subtle scale bounce animation on key press. The layout (3×4, with `.` and `⌫`) mirrors a standard ATM/POS keypad — familiar to the target demographic.

**Trade-off:** Accessibility: the system keyboard has built-in accessibility support (VoiceOver, Switch Control) that the custom numpad needs to replicate manually. Not addressed in the prototype.

---

### 12. Inline insufficient-funds feedback on Amount Entry rather than a separate error screen

**Decision:** When the entered amount (plus fee) exceeds the wallet balance, the amount text turns red, a shake animation fires, and a one-line message appears — all on the Amount Entry screen. The Continue button stays disabled. The dedicated `SendError` screen is only shown for a failed transfer after confirmation.

**Why:** Two different error moments warrant different treatments. An insufficient-funds condition at the entry stage is correctable immediately — the user just needs to type a smaller number. Showing a full error screen at this point would feel heavy and interrupt their flow unnecessarily. A transfer failure after confirmation is different: money may have been in-flight, the user needs reassurance that nothing was deducted, and they need a clear path to retry or go back.

---

### 13. Tiered fee model with live preview

**Decision:** Transfer fees follow a three-tier model: $1.99 flat under $50 equivalent, $2.99 flat $50–$199, 1% (capped at $9.99) for $200+. The fee, exchange rate, converted amount, and total deducted are shown live as the user types.

**Why:** Ria's actual fee structure is tiered and transparent — showing it live matches user expectations from the real product. Hiding the fee until the confirmation screen is a known friction point in remittance apps and erodes trust. Showing it while the user types lets them self-correct (e.g. bump from $49 to $51 to cross a tier) before committing.

**What I'd do with more time:** Show a small "save X by sending Y more" nudge when the user is just below a fee threshold.

---

## Snapshot 3 — 2026-04-13
*Covers: send money flow redesign, confirmation screen IA, success/tracking screen*

### 14. Unified send screen — recipient, wallet, and both amounts on one page

**Decision:** The original three-screen flow (RecipientSelect → AmountEntry → Confirmation) was collapsed into two: a single `SendMoneyScreen` handling all input, followed by the Confirmation screen.

**Why:** The original flow forced the user to commit to a wallet before seeing the recipient, and commit to a recipient before seeing the exchange rate. These choices are interdependent — "who I'm sending to" affects "which currency they receive", which affects "which wallet makes sense to send from". A single screen lets the user see all three together and adjust them in any order before reviewing. This matches how users actually think about a remittance ("I want Maria to get ₱5,000 — which wallet should I use?") rather than following an arbitrary left-to-right sequence.

**Trade-off:** More state on one screen. Managed by keeping the numpad fixed at the bottom and the input fields compact above it.

---

### 15. Wallet dropdown expands full-width with balance on the right

**Decision:** The send-side currency selector is a compact trigger (flag + code + ▾) that opens a full-width modal panel. Each wallet row shows flag and name on the left, available balance on the right. Wallets with zero balance are dimmed and labelled "No funds" — present but not selectable.

**Why:** The trigger needs to be compact to share a row with the amount display. But when choosing a wallet, the user needs to see balances to make an informed decision — a narrow inline picker would truncate this. A full-width modal panel gives each wallet a full row with room for the balance, making the choice clear. Showing zero-balance wallets as disabled (rather than hiding them) avoids confusion about why wallets are missing from the list.

---

### 16. Receive currency locked to recipient's home currency, not user-selectable

**Decision:** The "they receive" currency is automatically set to the recipient's primary currency (derived from their country flag) when a contact is selected. It is displayed but not changeable.

**Why:** In a real remittance corridor, the recipient almost always holds funds in their local currency. Letting the sender pick an arbitrary receive currency introduces complexity (and potential errors) with little real-world benefit — a Mexican recipient expects MXN, not USD transferred to a Mexican account. Locking the currency also removes a step from the flow and eliminates a whole class of "I accidentally sent it in the wrong currency" errors.

**What I'd do with more time:** Allow override for cases where the recipient has a USD or EUR wallet (common for recipients in dollarised economies or with international accounts), shown as a secondary option.

---

### 17. Both amount fields are independently editable; each drives the other

**Decision:** The send and receive amount fields both accept numpad input. The active field (highlighted with an orange border) drives the calculation; the inactive field shows the computed result in muted text. Switching fields pre-populates the new active field with the current computed value.

**Why:** A remittance sender often knows exactly how much the recipient needs ("my mother needs ₱5,000 for rent") and works backwards to the send amount, rather than starting from what they want to send. Supporting both entry directions removes a common friction point where the user has to do division in their head. The visual distinction between the active field (opaque, orange border, blinking caret) and the inactive computed field (muted text, no border) makes it unambiguous which field owns the numpad at any moment.

---

### 18. Blinking caret uses colour toggle, not character insertion

**Decision:** The caret in the active amount field is always present in the text node as `|`, toggling between `colors.brand` and `'transparent'` every 530ms rather than being conditionally inserted.

**Why:** Inserting and removing a character changes the text width on every blink cycle, causing the digits to visually shift left and right. Keeping the character in the layout at all times but toggling its colour to transparent reserves the space permanently — the rendered width never changes, so there is no movement.

---

### 19. Contact selection opens as a full-screen overlay with no keyboard autofocus

**Decision:** Tapping the recipient field expands a full-screen `View` (absolutely positioned over the send screen, `zIndex: 100`) rather than a modal or bottom sheet. The search input does not auto-focus.

**Why:** A bottom sheet is clipped by the keyboard on smaller devices, hiding the lower portion of the contact list. A full-screen overlay avoids this entirely. Auto-focusing the search input was removed because most users tap a recent contact rather than searching — forcing the keyboard open on every entry adds friction and covers the recent contacts row they're most likely to use.

**Recent contacts** are shown as flag-circle avatars with the first name below, providing a one-tap path for the common case of sending to the same person again.

---

### 20. Confirmation screen leads with what the recipient receives, not what the sender pays

**Decision:** The confirmation screen hero is the recipient's converted amount (`₱5,684.00 MXN`), not the sender's amount. The cost breakdown (you send, fee, total) is in a card below. Exchange rate is demoted to a footnote row at the bottom of the breakdown card. ETA is moved up to sit directly under the receive amount.

**Why:** The primary reason a user initiates a remittance is to get money to someone else. Leading with the sender's amount ("You're sending $100") frames the transaction as a cost; leading with the recipient's amount ("Maria receives ₱5,684") frames it as a delivery — which is emotionally more accurate and reassuring. The exchange rate is context that explains the conversion, not a deduction, so it should not appear between "You send" and "Transfer fee" where it implies a cost. Moving it to a footnote separates informational from transactional rows.

---

### 21. "From wallet" row does not show the current balance

**Decision:** The breakdown card on the confirmation screen shows only the wallet flag and currency code (e.g. `🇺🇸 USD`) for the "From wallet" row, with no balance subtitle.

**Why:** Showing a balance on the confirmation screen is ambiguous — is it the balance before or after this transfer? Either answer is potentially confusing. The user already confirmed they have sufficient funds on the send screen (where the balance is shown in context). Repeating an ambiguous number on the confirmation screen adds noise without adding clarity.

---

### 22. Success screen is a transfer receipt with tracking steps, not a celebration screen

**Decision:** After a confirmed transfer, the app shows a receipt-style screen rather than a "Money sent!" celebration. It includes: a status badge (IN PROGRESS / DELIVERED), the recipient's received amount as the hero figure, a transaction reference number with tap-to-copy, an amounts summary card, and a three-step tracking pipeline showing where the transfer is in its lifecycle.

**Why:** "Money sent" is inaccurate when delivery takes minutes or hours — the money has left the sender's wallet but has not yet arrived. A tracking screen sets accurate expectations, mirrors what users are familiar with from Wise and Remitly, and gives the user something actionable (the reference number) if they need to follow up. The step pipeline makes delivery timing concrete: the user can see that step 1 is done and step 3 is still pending, rather than wondering whether anything is happening.

**Step states:** Done (green filled circle + ✓), Active (orange pulsing ring via `withRepeat`), Pending (grey outlined circle). The vertical connector line between steps fills green as steps complete.

---

### 23. Transaction reference number generated at commit time

**Decision:** A short alphanumeric reference (`RIA-XXXXXX`) is generated when the transaction is committed in the Confirmation screen and passed to the Success screen via navigation params.

**Why:** Users expect a reference number they can quote to support. Generating it at commit time (not on the success screen) ties it to the actual transaction object. The format mimics real Ria transfer references. Tap-to-copy is stubbed with haptic feedback for the prototype.

---

### 24. Footer actions: Back to wallets (primary), Share receipt + Send again (secondary)

**Decision:** The success screen footer has three actions: "Back to wallets" as the primary orange button, and a two-up secondary row with "Share receipt" and "Send again" divided by a hairline.

**Why:** The most common next action after a transfer is checking that the wallet balance updated correctly — "Back to wallets" serves this. "Send again" covers the repeat-sender case (e.g. monthly support payments). "Share receipt" is a common expectation from remittance apps where the sender forwards proof to the recipient. Putting the two secondary actions side-by-side as text links keeps the footer compact without burying them.

---

## Snapshot 4 — 2026-04-14
*Covers: wallet home redesign, collapsing header interaction, unified card navigation, Lucide icon system*

### 25. Unified wallet + cards layout — wallets are the primary navigation surface

**Decision:** Removed the separate "Cards" tab from the bottom navigation. Cards are now accessed through the wallet screen via a "Cards" action button, navigating to a per-wallet card list. The wallet carousel is the only home-screen tab.

**Why:** Cards are scoped to a wallet — a card can only be used against its parent wallet's balance. Showing cards in a separate flat list forced the user to mentally map "which card belongs to which wallet". Eliminating the cards tab and surfacing cards through each wallet removes this cognitive overhead and makes the product model (cards are an extension of a wallet, not a standalone product) spatially obvious.

**Trade-off:** Deep-linking directly to a specific card is one step further. Acceptable because the common case is "manage my USD wallet's cards", not "go directly to card 2 of 3".

---

### 26. Full-width wallet carousel with `pagingEnabled`, not `snapToInterval`

**Decision:** Each wallet item is exactly `WINDOW_WIDTH` wide. The carousel uses `pagingEnabled={true}` rather than a fixed `snapToInterval` with a peeking adjacent card.

**Why:** A peeking design (CARD_W = WINDOW_W − 40, peeking 20px of the next card) signals affordance for swiping but visually competes with the balance number — the hero content. Full-width allocation lets the balance, currency name, and card count breathe. Swipeability is communicated by the dot indicator row below the carousel instead, which is the conventional alternative for full-width carousels. `pagingEnabled` is also simpler than `snapToInterval` and avoids off-by-one snap miscalculations on screens that are not integer multiples of the card width.

---

### 27. Actions row is in the scroll content, not in the fixed header

**Decision:** The four action buttons (Send, Receive, Add, Cards) live at the top of the `Animated.ScrollView` content, not in the fixed wallet header. They naturally scroll out of view under the header as the user scrolls into the activity list.

**Why:** Making actions part of the scroll content gives the activity feed more vertical space when scrolled, without any JS-driven show/hide logic. The collapse is driven entirely by the user's finger — there is no threshold, timer, or discrete animation event. The actions become the content that triggers the collapse, which is intuitive: "scrolling past the buttons to see the list" maps directly to "the wallet detail compresses to give the list more room". Placing actions in the header (fixed) would mean they never go away, reducing activity list space permanently.

---

### 28. Collapsing header driven by continuous UI-thread mapping, not discrete JS threshold

**Decision:** The header height interpolates between `EXPANDED_H` (204px) and `COLLAPSED_H` (52px) as a direct function of `scrollY / ACTIONS_H`. This runs entirely on the UI thread via `useAnimatedScrollHandler`. No springs, no JS callbacks, no programmatic `scrollTo` during gesture.

**Why:** Earlier iterations used discrete `withSpring` calls triggered from JS-thread `onScroll` handlers. These caused two problems: (1) the spring fired mid-gesture, producing a visible stutter because the animation competed with the user's finger, and (2) the threshold check meant the collapse only started after a non-obvious scroll depth, giving the impression of "two steps". 

The continuous direct mapping (`collapsed.value = clamp(y / ACTIONS_H, 0, 1)`) tracks the finger exactly — the header is exactly as collapsed as the user has scrolled, with no lag and no competing animation. Native `snapToOffsets={[0, ACTIONS_H]}` handles the post-release snap to either fully expanded or fully collapsed, with no JS involvement.

**Key invariant:** `minHeight: scrollViewH + ACTIONS_H` ensures the scroll content is always tall enough to reach `ACTIONS_H` even when there are zero transactions, so the snap point is always reachable.

---

### 29. Seamless design: no border containers on wallet details or action buttons

**Decision:** Wallet identity, balance, and action buttons are unstyled — raw text and icon elements with only whitespace and typography providing structure. No `backgroundColor`, `borderWidth`, or `borderRadius` on any wallet-detail or action-button container.

**Why:** Box containers on home screen elements create visual weight that competes with the balance number, which should be the single hero element. Removing all boxes makes the balance visually dominant and gives the screen a lighter, more modern feel. Structure is communicated through hierarchy (size, weight, colour, spacing) rather than borders. The only exceptions are the bottom sheet in the Remove Card modal and the summary cards on the Confirmation / Detail screens, where containment is semantically meaningful (they are discrete data units, not hero content).

---

### 30. Per-currency accent colours via a curated lookup table, not dynamic derivation

**Decision:** Each currency has a hardcoded Tailwind -400 tint (`WALLET_ACCENTS`) used for the primary chip border/text, the compact balance in the collapsed header, and icon fill on action buttons. Colours are applied via a hex-to-rgba `alpha()` helper.

**Why:** Dynamic colour derivation from a flag emoji or currency code is not reliable — there is no bijection between currency codes and a visually consistent colour space. The curated list guarantees visual coherence (no two adjacent wallets clash) and matches the Tailwind palette used everywhere else in the theme. Tailwind -400 values were chosen specifically: they are saturated enough to be legible on the dark background without being harsh.

**`alpha()` helper** converts a hex colour + opacity float to `rgba()`. This was necessary because Reanimated 4 / Hermes does not support CSS `oklch()` strings at runtime, which the theme colour functions would otherwise produce.

---

---

## Snapshot 5 — 2026-04-14
*Covers: light mode migration, wallet card redesign, send flow restructure, phone number entry*

### 32. Switched to light mode — matches Ria's existing product

**Decision:** Flipped the entire theme from dark (zinc-950 backgrounds) to light (white background, zinc-100/200/300 surfaces and borders, zinc-900/500/400 text hierarchy). StatusBar switched from `style="light"` to `style="dark"`. Wallet accent colours promoted from Tailwind -400 to -600/-700 for sufficient contrast on white.

**Why:** Ria's current production app is light mode. A dark prototype would feel like a different product to evaluators familiar with the real app. The card faces (CardFace component) intentionally stay dark — they represent physical/virtual cards and dark card art is the industry standard regardless of app theme.

**CVV text colour fix:** CardFace used `colors.bg` as the CVV text colour (which was near-black in dark mode). In light mode `colors.bg` is white, making the text invisible against the white CVV box. Fixed to hardcoded `#18181b`.

---

### 33. Revolut-style centred wallet item layout

**Decision:** Redesigned the wallet carousel item: removed the "Available balance" label, centred all content, placed the "Primary" chip above the flag + currency code row, and reduced balance font size from 52 → 44. Non-primary wallets use an invisible placeholder with the same height as the chip to keep all items the same height.

**Why:** The "Available balance" label added no information — balance is the only number on the card. Centring the content (Revolut/Wise pattern) gives the balance more visual authority. Moving "Primary" above the currency creates a clearer top-to-bottom reading order: status → identity → amount → metadata.

---

### 34. Removed collapsing scroll header — static wallet header

**Decision:** Removed the `Animated.ScrollView` scroll handler, `collapsed` shared value, snap-to-offsets, and the compact collapsed bar. The wallet header is now a plain static `View`. The activity section is a regular `ScrollView` with no snap behaviour.

**Why:** The scroll-linked collapse added interaction complexity without enough usability benefit on a screen that already has limited content. The static layout is simpler to reason about, easier to extend, and removes a potential source of animation jank.

---

### 35. Send flow split into two steps within one screen component

**Decision:** `SendMoneyScreen` now manages a `step` state (`'recipient' | 'amount'`). The recipient picker is step 1; the amount entry (numpad, exchange fields, CTA) is step 2. Both are rendered from the same component with no additional navigation screens or params.

**Why:** The original single-screen design with the recipient picker as an absolute overlay (`zIndex: 100`) was technically equivalent but harder to reason about — the "main" content and the "overlay" content were siblings in the same tree with no clear separation of concerns. Two explicit step renders make the flow state machine legible. Keeping both in one component avoids passing selected-contact state through navigation params and preserves all amount state (send/receive raw values, active field) when swapping recipients.

**Back button behaviour:**
- Recipient step, no prior contact → `navigation.goBack()` (exit flow)
- Recipient step, prior contact exists (came via swap) → `setStep('amount')` (return to amount)
- Amount step → `navigation.goBack()` (cancel send, exit flow)

---

### 36. Swap recipient replaces the X/remove button

**Decision:** On the amount step, the selected recipient chip shows an `ArrowLeftRight` icon instead of an X. Tapping it returns to the recipient picker with the contact preserved. If the previous selection was an ad-hoc phone number, that number is restored to the search bar for editing.

**Why:** "Remove" implies the user needs to re-enter from scratch, which is wrong — they most likely want to change who they're sending to, not cancel and restart. "Swap" correctly frames the action as a substitution. Restoring the phone number to the search bar on swap is especially important for ad-hoc entries where the user may want to correct a typo rather than retype the entire number.

---

### 37. Ad-hoc phone number entry in the recipient picker

**Decision:** When the search query contains 4+ digits, a "Send to this number" row appears at the top of the contact list. Selecting it creates a temporary `Contact` object with `id: adhoc-{phone}`. Country and receive currency are inferred from the international dialling prefix (`+52` → MXN, `+44` → GBP, etc.). If no prefix is present, the primary wallet's currency is used as the default and the local calling code is prepended to the number with digit-group spacing (e.g. `5551234567` → `+1 555 123 4567`).

**Why:** Remittance senders frequently send to people who are not saved contacts — new recipients, one-time transfers. Blocking this behind "you must save a contact first" is a critical flow failure for a money transfer product. The phone number is the natural identifier for a recipient in this demographic.

**Formatting:** Digit spacing uses a 3-3-4 pattern for 10-digit numbers and 4-3-4 for 11-digit, matching the most common formats in Ria's top corridors (US, Mexico). The calling code is only prepended when the user did not supply one (no `+` prefix detected), avoiding double-prefixing.

---

---

## Snapshot 6 — 2026-04-14
*Covers: card system redesign, card stack UI, card surface visual treatment*

### 38. Simplified card types — physical / virtual / single-use only

**Decision:** Removed the "travel" and "category-locked" card types. The type set is now: `physical`, `virtual`, `single-use`.

**Why:** Travel and category-locked cards introduced a multi-select categories step and a spend-limit configuration step that added complexity to the Add Card flow without clear product differentiation. Single-use cards replace both special types for the prototype — they represent the "controlled-spend" use case cleanly without requiring a category screen. Spend limits were also removed from the Card data model entirely.

**Trade-off:** Category-locked cards are a meaningful feature for power users. Removed for now; would re-introduce with a dedicated categories management screen rather than inlining it into the add flow.

---

### 39. Cards tab restored as a per-wallet grouped view

**Decision:** Re-added a "Cards" bottom tab (`AllCardsScreen`). It shows one section per wallet — a header row (flag, currency name, card count) above a `CardStackPreview`. Tapping anywhere navigates to `WalletCardListScreen` for that wallet.

**Why:** Decision 25 (previous snapshot) removed the Cards tab to force cards through the wallet. In practice, users who manage cards across multiple wallets still want a single place to survey all of them without carousel-surfing through each wallet. The grouped layout preserves the wallet ownership model (cards are clearly under their currency) while giving the tab a meaningful purpose distinct from the wallet screen.

---

### 40. Add Card flow: type → name → color → review

**Decision:** The Add Card flow is four screens: `AddCardType` (virtual / physical / single-use) → `AddCardName` (text input + suggestion chips) → `AddCardColor` (10-colour palette with live preview) → `AddCardReview` (final summary).

**Why:** Name and colour are the two personalisation attributes that make individual cards distinguishable on a stack. Collecting them early in the flow (before the review screen) means the review screen shows a fully rendered card rather than a placeholder. The live `CardFront` preview on the colour screen gives immediate feedback and reduces the number of users who change their mind on the review screen.

---

### 41. CardStackPreview — back cards at top, front card anchored at bottom

**Decision:** In the stacked card preview, cards render with the frontmost card at the bottom of the stack and background cards stacked above it, each offset upward by 56px. Background cards are fully opaque, scaled 2% smaller per level of depth.

**Why:** The initial implementation put the top card at the top (natural document order) — the front card was partially hidden under the cards above it. The reversed layout exposes the front card fully and lets the name/type badge on each background card peek above it, giving the stack a "fanned" feel that communicates the quantity of cards without needing a count label. 2% scale per level provides just enough perceived depth without the background cards appearing too small.

**No horizontal inset:** Earlier iterations shrunk background cards horizontally. Horizontal inset was removed because it made the stack look irregular and misaligned at the edges. Scale transform provides depth cue without the misalignment.

---

### 42. Card surface visual treatment — sheen, noise, highlight/shadow, ring

**Decision:** Every card surface (both `CardFace` full cards and `CardStackPreview` stack items) gets four layered effects:
1. **Ring** — 1–2px outer border at `card.color @ 6%` opacity, on a separate wrapper view.
2. **Sheen** — `expo-linear-gradient` from `white @ 10%` (top-left) to transparent (bottom-right), `absoluteFillObject`.
3. **Noise** — SVG `feTurbulence` (`fractalNoise`, frequency 0.65, 3 octaves) piped through `feColorMatrix` to produce monochrome grain at 10% opacity.
4. **Highlight/shadow** — SVG `Rect` with a gradient stroke: `white @ 10%` at top fading to transparent at 35%, then transparent at 65% darkening to `black @ 15%` at the bottom.

**Why:** Flat colour cards look cheap. The sheen + noise combination mimics the micro-texture of a physical card material (matte plastic or soft-touch coating). The highlight and shadow give the card a subtle sense of three-dimensionality — a light source from above whitens the top edge and casts a faint shadow at the bottom — matching how real cards reflect ambient light.

**Ring on a separate wrapper:** Putting the ring border on the same view as the SVG overlay caused a visible gap between the border and the SVG stroke. The ring lives on an outer wrapper; the inner view owns the background colour, `overflow: hidden`, and all overlay content.

---

### 43. SVG gradient stroke for specular highlights, not per-side View borders

**Decision:** The top highlight and bottom shadow are rendered as a single SVG `Rect` with a gradient stroke (`gradientUnits="userSpaceOnUse"`). Earlier attempts used `View` per-side border colours (e.g. `borderTopColor: rgba(255,255,255,0.10)`).

**Why:** Per-side borders in React Native produce one of two unacceptable corner behaviours: (a) if adjacent sides have `borderWidth: 0`, corner arcs are not drawn and the highlight ends abruptly at the point where the rectangle starts curving; (b) if adjacent sides use `transparent`, React Native renders a straight diagonal colour miter at each corner rather than a smooth taper. The SVG `Rect` with `rx`/`ry` draws the border using the browser/Skia rounded-rect primitive, so the stroke follows the corner arc exactly with no manual path math required.

**`gradientUnits="userSpaceOnUse"`** with pixel `y2={height}` was necessary because the default `objectBoundingBox` units behave unexpectedly when applied to a stroke rather than a fill — the highlight and shadow were invisible until this was set.

---

### 44. `CardOverlay` shared component — single source for all card surface effects

**Decision:** The sheen gradient, noise filter, and highlight/shadow stroke were extracted into a single `CardOverlay` component accepting `{ id, width, height, borderRadius, strokeWidth }`. Both `CardFace` and `CardStackPreview` use it.

**Why:** The effects were being duplicated inline. `CardOverlay` takes explicit pixel dimensions rather than measuring via `onLayout` — dimensions are known at module load time from screen width constants, the same pattern `CardFace` already used for `CARD_WIDTH`/`CARD_HEIGHT`. This eliminates the render-delay that caused effects to flash in after the first paint when `onLayout` was used. The `strokeWidth` prop lets full cards use 2px and stack preview cards use 1px without forking the component.

**SVG def ID collision:** Multiple `CardOverlay` instances in the same render tree would share `id="edgeGrad"` / `id="noise"` defs, causing the gradient to resolve to the wrong definition. Fixed by namespacing defs with the card's unique `id` prop (`edge-${id}`, `noise-${id}`).

---

---

## Snapshot 7 — 2026-04-14
*Covers: custom tab navigator, send flow transitions, FAB positioning, scroll-to-top, sharing infrastructure*

### 45. Custom Reanimated tab navigator — replaced @react-navigation/bottom-tabs

**Decision:** Removed `createBottomTabNavigator` entirely. Replaced with a custom `TabNavigator` component: a side-by-side `Animated.View` row of all four tab screens, clipped by an `overflow: 'hidden'` container. Switching tabs animates `translateX` with `withTiming(duration: 280, Easing.out(Easing.cubic))`.

**Why:** React Navigation's bottom tabs use a JS-driven `display: none` / `display: flex` toggle to unmount hidden tabs, not a position-based transition. There is no first-class API to animate between tabs with a slide. Overriding this via a custom `tabBarButton` or `sceneContainerStyle` produces visual artifacts. A fully custom navigator gives complete control over the animation — the same `translateX` pattern used for the SendMoney step transition — with no special-casing needed.

**Trade-off:** All four tab screens are mounted simultaneously and never unmounted. Memory cost is fixed and low for this app's screen count. The scroll position of each tab is preserved automatically as a result.

---

### 46. SendMoney opens from bottom, dismisses to the right — transparentModal + Reanimated

**Decision:** `SendMoney` is registered as `presentation: 'transparentModal', animation: 'none'`. Entry is a Reanimated `translateY` from `screenHeight → 0`. Dismiss (back button or swipe) is a `translateX` from `0 → screenWidth`, then `navigation.goBack()` via `runOnJS`.

**Why:** The native `slide_from_bottom` animation unmounts the background screen during the return transition, producing a white flash. `transparentModal` keeps the background mounted and visible through both entry and exit. `animation: 'none'` is required permanently (not set via `setOptions`) because `setOptions` is async — calling `goBack()` in the same JS tick still sees the old animation value. The dismiss-to-right direction communicates "cancelled" rather than "backed out downward", which matches the X button intent.

**`contentStyle: { backgroundColor: 'transparent' }`** is required on the SendMoney screen options because the global `screenOptions.contentStyle` paints a solid background over the transparent modal. Per-screen override wins.

**`useSafeAreaInsets()` instead of `SafeAreaView`:** Inside a `transparentModal`, `SafeAreaView` with `edges={['top']}` cannot measure insets correctly. Replaced with a plain `View` + `paddingTop: insets.top`.

---

### 47. Side-by-side row with overflow clipping for step transitions inside SendMoney

**Decision:** The recipient and amount steps are two full-width `View`s inside a single `Animated.View` row (`width: screenWidth * 2`). Step transitions animate `translateX` between `0` and `-screenWidth`. The outer container has `overflow: 'hidden'`.

**Why:** The original implementation used two `absoluteFill` views switching visibility. When dismissing from the amount step (`dismissX: 0 → screenWidth`), the recipient view at `translateX: -screenWidth` would travel to `0` — sliding into view as the wrong background during the dismiss. The row approach ties both panels to the same translate space, so they move together during dismiss and neither bleeds into view.

---

### 48. Send FAB absolutely positioned above the tab bar — does not set bar height

**Decision:** The Send FAB (`SendCTAButton`) is rendered outside the tab bar flex row as a `position: 'absolute', top: -30` sibling. A `View` spacer with `flex: 1` holds the center slot in the flex row so the four tab items don't collapse inward. The outer wrapper has `pointerEvents="box-none"` so touches pass through to the tab items; only the circle and label are interactive.

**Why:** Placing the FAB in the flex row made it a flex child whose height (60px circle + label + padding) set the tab bar height, making the bar taller than intended. Absolute positioning decouples the FAB's visual size from the bar layout. `top: -30` centers the 60px circle on the tab bar's top border line — the same visual treatment used in the original React Navigation implementation. `pointerEvents="box-none"` on the overlay is essential; without it the full `left: 0, right: 0` overlay intercepts all taps across the bar width.

---

### 49. Double-tap tab to scroll to top via TabScrollContext

**Decision:** Tapping an already-active tab increments a per-tab reset counter stored in `useState`. Each tab screen is wrapped in its own `TabScrollContext.Provider` keyed to that counter. Screens consume `useTabScrollReset()` and call `scrollTo` / `scrollToLocation` in a `useEffect` when the count increments.

**Why:** React Navigation's `useScrollToTop` hook works by listening for a `tabPress` event emitted by the native tab navigator. The custom navigator does not emit this event. A context counter is the equivalent mechanism — a signal that increments rather than a callback that fires, which integrates cleanly with `useEffect` dependency arrays.

**`TabScrollContext` extracted to its own file** (`src/navigation/TabScrollContext.ts`) to break a require cycle: `RootNavigator` imports the screens, and the screens would have imported from `RootNavigator`. A standalone context file has no imports from the project, so nothing can cycle through it.

---

### 50. EAS Update for over-the-air distribution via Expo Go

**Decision:** The app is published via EAS Update (`branch: main`, `runtimeVersion: exposdk:54.0.0`) to Expo's CDN. A static HTML landing page hosted on Vercel shows a QR code pointing to `exp://u.expo.dev/{projectId}?channel-name=main`.

**Why:** Running `expo start --tunnel` requires the developer's machine to be on and produces a new URL every session. EAS Update gives a permanent URL that resolves to the latest bundle on the `main` branch automatically — reviewers always get the current version without any action from the developer. `runtimeVersion: exposdk:54.0.0` is required for Expo Go compatibility; the default `appVersion` policy sets it to `1.0.0` which Expo Go does not recognise as a compatible runtime.

**Vercel landing page** at `ria-wallet-preview.vercel.app` uses `api.qrserver.com` to render the QR code inline — no JS framework, single `index.html`, zero build step.

---

### 31. Lucide icons everywhere — no emoji UI icons

**Decision:** All navigation icons (back button `‹`, forward chevron `›`), action icons (freeze/unfreeze, add, send, receive, cards), and status icons (check, copy, delete, search, clear) use `lucide-react-native` components. Emoji are retained only for currency flags, category labels in AddCardCategories, and the inline `💡` tip text in the error screen.

**Why:** Text-based navigation characters (`‹`, `›`) render at different optical weights on different fonts and operating systems — they look misaligned on Android particularly. Emoji icons in action buttons (`❄️`, `🗑️`, `🔢`) have inconsistent sizes and padding across platforms and cannot be reliably tinted to match the design system's colour tokens. Lucide icons have consistent `strokeWidth`, predictable `size`, and accept a `color` prop — making them directly themeable and cross-platform reliable.

**Exceptions kept as emoji:** Currency flags (universal standard, no Lucide equivalent), spending category icons in AddCardCategories (🛒, 🍽️, etc. — no close Lucide equivalents, and the emoji add visual warmth to a functional list), and the inline `💡` tip text in SendErrorScreen (inline emoji in a text paragraph, not a pressable UI element).

---

## Snapshot 8 — 2026-04-14
*Covers: card detail screen, card face reveal interactions, bottom sheet animation, card face layout*

### 51. Removed card flip animation — replaced with inline slot-machine reveal

**Decision:** The `rotateY` flip animation (Decision 9) was removed entirely. `CardFront` is now the only rendered face. Sensitive digits reveal in-place using a slot-machine (`translateY`) animation: the masked dot exits upward out of a clipped cell while the actual digit rolls up from below.

**Why:** The flip animation requires both faces to exist in the same view stack simultaneously, using `backfaceVisibility: 'hidden'` to suppress whichever face is currently away from the viewer. This technique is unreliable in React Native — both faces were rendering visibly on some Android configurations, producing the duplicate "Frozen" badge bug. Beyond correctness, the flip metaphor is aesthetically cliché and the motion is heavy for a UI that's otherwise subtle. The slot-machine animation is lighter, scoped to exactly the digits that are changing, and reads as a security reveal rather than a page turn.

**Implementation:** Each `FlipChar` has two `Animated.View`s — front (masked `•`) and back (actual digit) — clipped by `overflow: 'hidden'` on a `CHAR_W × CHAR_H` cell. `progress` drives `translateY` from `[0, -CHAR_H]` (front) and `[CHAR_H, 0]` (back) simultaneously. Each character gets a staggered `withDelay(i * 38ms)` so the number reads left to right.

---

### 52. Last 4 digits always visible regardless of reveal state

**Decision:** Positions 12–15 of the card number (`FlipChar` indices ≥ 12) receive `revealed={true}` unconditionally. The reveal toggle only unmasks the first 12 digits.

**Why:** The last 4 digits are already present on every bank statement, receipt, and card-linked account screen. They are not sensitive in isolation. Keeping them visible provides a constant identity anchor — the user can confirm "this is the right card" before initiating a reveal — without requiring a security interaction. It also makes the masked card number feel deliberate (partial obscuring) rather than completely redacted, which reads as paranoid.

---

### 53. Separate reveal toggles for card number and CVV

**Decision:** Card number and CVV have independent revealed states (`numberRevealed`, `cvvRevealed`) and separate toggle handlers. The reveal buttons live outside the card face in `CardDetailScreen` — two equal-width labelled pills ("Show number" / "Show CVV") in a dedicated row between the card and the action buttons.

**Why:** Number and CVV serve different purposes. The number is needed to make online purchases; the CVV is the second factor that authorises a transaction. Revealing both together when only one is needed unnecessarily exposes the other. Separating them also makes the reveal interaction unambiguous — each button has a single, legible purpose — compared to a single "Reveal" toggle that changes the entire card face state at once.

**Reveal buttons outside the card:** Earlier iterations embedded the eye icons directly on the card face (first inside the digit row, then inside the bottom row label). Both placements were too small and hard to tap accurately. Moving them outside the card as full-width labelled buttons makes them obviously interactive, consistent in size, and readable without requiring the user to hunt around the card surface.

---

### 54. Copy interactions on the card face, not the reveal buttons

**Decision:** Tapping the card number or CVV area on the card face copies to clipboard (when revealed). The reveal buttons only toggle visibility. The two interactions are never conflated.

**Why:** Merging reveal and copy onto a single button creates ambiguous state — the first tap reveals, the second copies, but there is no way to distinguish these states visually before tapping. By separating them spatially (reveal = external button, copy = card face tap), each surface has a single, consistent meaning. The card number area shows a copy icon at matching text height (17px) when revealed to confirm that tapping will copy. A centred "Number copied" / "CVV copied" tooltip fades in over the card to confirm the action.

---

### 55. Bottom sheet overlay fades independently of the sheet slide

**Decision:** `BottomSheet` uses `animationType="none"` on the `Modal` and runs two independent Reanimated animations: `overlayOpacity` (`withTiming`, 240ms fade) for the dark backdrop and `sheetY` (`withTiming`, 340ms ease-out cubic) for the sheet slide. On close, the overlay fades out (200ms) while the sheet slides out (260ms ease-in quad), then `runOnJS(setMounted)(false)` unmounts after the animation completes.

**Why:** Using `animationType="slide"` on the Modal animates the entire modal container — including the dark overlay — from the bottom of the screen, making the backdrop appear to rise up rather than fade in. This reads as physically incorrect (overlays don't emerge from under the content). Independent animations allow the backdrop to behave like a darkening of the scene (fade) while the sheet behaves like a surface arriving from off-screen (slide), which matches the established pattern in iOS and Android system sheets.

---

### 56. CardFront layout — padding 18px, chip at spacing.lg, number at spacing.xxl below chip

**Decision:** Card inner padding is 18px (reduced from `spacing.xl = 24px`). The EMV chip sits `spacing.lg (16px)` below the card name. The card number sits `spacing.xxl (32px)` below the chip. The bottom row (EXPIRES + CVV + network logo) uses `marginTop: 'auto'` to float to the card bottom.

**Why:** At 24px padding, the vertical content budget (inner height ≈ 168px) left only ~4px of auto-margin above the bottom row, making the layout feel top-heavy with no breathing room below the number. Reducing to 18px (inner ≈ 180px) and using 32px below the chip gives a balanced vertical distribution: name at top, chip+number in the upper-middle, bottom row anchored to the foot. The `marginTop: 'auto'` pattern is preferred over fixed gap values because it self-adjusts if any content above the number changes height.

**Alignment rule:** `fieldValue` (EXPIRES) uses `fontSize: 17, lineHeight: CHAR_H (22)` to exactly match the height of a `FlipCvv` character cell. With `alignItems: 'flex-end'` on the bottom row, their baselines align without any per-platform hacks.

**Duplicate style bug:** A `cvvValue` key was defined twice in the same `StyleSheet.create` call — once for the card front (white text) and once for `CardBack` (dark text on a white box). JavaScript object literals take the last value for duplicate keys, so the back face's `color: '#18181b'` silently overwrote the front face definition, making CVV text appear dark on the card. Fixed by renaming the back-face styles to `backCvvBox` / `backCvvValue`.

---

## Snapshot 9 — 2026-04-14
*Covers: send flow completion — confirmation embedded in modal, morphing CTA button, drawer-to-tracking reveal*

### 57. Confirmation step merged into SendMoneyScreen — ConfirmationScreen eliminated

**Decision:** The separate `ConfirmationScreen` navigation screen was removed. The confirmation UI (recipient summary, breakdown card, MorphButton) is now an `absoluteFill` overlay inside `SendMoneyScreen`, sliding in from the right via `confirmSlideX` when the user taps "Next". `step` state becomes `'recipient' | 'amount' | 'confirm'`. `ConfirmationScreen` is unregistered from the navigator and its file is now dead code.

**Why:** The original flow navigated to `ConfirmationScreen` as a separate stack screen. When the user tapped "View transfer", the intended effect was: drawer closes, revealing the already-present `SendSuccessScreen` behind it. With `ConfirmationScreen` as a separate screen, any attempt to reset the navigation stack to `[Main, SendSuccess]` while the drawer was animating caused `ConfirmationScreen` to briefly re-mount or its transition to play, producing a visible flash. The root problem was that the `SendMoney` modal needed to own the full lifecycle from input → confirmation → success transition, with only one navigation event (`reset`) at the very end. Embedding confirmation inside the modal achieves this — the single `transparentModal` is on screen for the entire flow, and only the drawer's `translateY` out + `navigation.reset` fires at the end.

**Back gesture:** `panGesture.enabled(step !== 'confirm')` disables the swipe-to-dismiss gesture during confirmation so the pan recogniser doesn't compete with the confirmation scroll. Android `BackHandler` is updated to handle the confirm step: pressing back closes confirmation if not processing, otherwise exits the modal.

---

### 58. MorphButton — slot machine flip with RGB component animation

**Decision:** The "Confirm and send" CTA morphs through five phases: `idle → processing → success → viewTransfer` (and `failed` on error). Each phase transition animates the icon and text out upward (`translateY: -SLOT_H` in 110ms ease-in) then enters from below (`translateY: SLOT_H → 0` in 190ms ease-out), with a 50ms exit stagger and 40ms enter stagger between icon and text. Background colour transitions between phases using three independent `useSharedValue`s (`bgR`, `bgG`, `bgB`) animated directly to the target RGB components.

**Why — slot machine over other animations:** Springs were rejected (too bouncy for a financial action). Opacity-only was rejected (same background colour, no sense of content changing). The slot machine exit-up / enter-below matches ATM receipt metaphors and reads as a clean "state replacing state" transition rather than a crossfade.

**Why — RGB component interpolation over `interpolateColor`:** Reanimated's `interpolateColor` with multi-stop arrays bleeds intermediate hues between non-adjacent stops (e.g. orange → grey → green produced a brown intermediate). Direct `bgR/bgG/bgB` shared values eliminate any colour bleed — each component transitions independently on a straight line, producing accurate in-between colours.

**Phase colour choices:**
- `processing`: snap to `colors.surfaceHigh` (`#e4e4e7`) — grey, no animation, communicates "disabled"
- `success`: animate to `colors.successSubtle` (`#dcfce7`) with dark green text — light green feels celebratory without being garish
- `failed`: animate to `colors.failedSubtle` (`#fee2e2`) with dark red text — mirrors success pattern
- `viewTransfer`: animate back to brand orange (`#f97316`) — same as `idle`, signals interactivity has returned

---

### 59. No opacity animations anywhere in the UI

**Decision:** All transitions in the app use `translateX` / `translateY` and `scale` only. No `withTiming` or `withSpring` calls targeting `opacity`.

**Why:** Opacity animations tend to look like the app is "fading out" rather than content leaving purposefully. Scale and translation animations communicate spatial relationships — content slides in from a direction, or shrinks away — which is more appropriate for a navigation-heavy mobile UI. The one visual exception that needed fading (the dark backdrop in `BottomSheet`) uses a `Modal` overlay rather than an opacity-animated in-tree `View`.

---

### 60. "Back to wallets" as a plain text secondary button

**Decision:** The footer on `SendSuccessScreen` has a plain text "Back to wallets" link (`alignSelf: 'center'`, no border, no background), with only a `scale: 0.96` pressed state. The full-width primary orange button was removed.

**Why:** After a successful transfer, the screen is informational — the user's task is complete. A large primary CTA at the bottom implies there is another action required. Demoting it to a quiet text link reduces visual noise and prevents the footer from competing with the tracking content above it. The "Share receipt / Send again" secondary row remains as the two peer actions, divided by a hairline, at the same visual weight.

---

### 61. SendSuccessContent extracted as a presentational component — used as drawer background layer

**Decision:** `SendSuccessScreen.tsx` exports `SendSuccessContent({ params, onBack, onSendAgain, animated })` — a pure presentational component with no navigation hooks. `SendSuccessScreen` is a thin wrapper that reads `route.params` and wires up navigation callbacks. In `SendMoneyScreen`, when the transfer is committed (`handleConfirm`), a `successBgParams` state is set immediately. The background layer behind the modal renders `<SendSuccessContent params={successBgParams} animated={false} />` instead of a plain white view.

**Why:** When "View transfer" is tapped, `enterY` animates from `0 → screenHeight` (the drawer slides down). At the end of the animation, `navigation.reset([Main, SendSuccess])` fires. The problem: before this fix, the background behind the departing drawer was a plain `colors.bg` white view. The user sees a white blank for ~320ms before the reset fires and `SendSuccessScreen` renders. With `SendSuccessContent` as the background, the actual tracking screen content is painted behind the drawer before the animation starts — the drawer slides down to reveal it, with no white flash and no navigation pop visible to the user.

**`animated={false}`:** When rendered as background, the shared values are initialised to `0` (final positions) and the entrance `withSpring` calls are skipped. The background appears fully settled. When `navigation.reset` fires and the real `SendSuccessScreen` mounts in its place, `animated={true}` (default) triggers the entrance springs — the user sees a subtle spring settle that confirms the screen is "live", not a frozen snapshot.

---

## Snapshot 10 — 2026-04-14
*Covers: profile/settings screen, hide-balances toggle, slot-machine balance animation, eye toggle pill, app lock feature, mock authentication*

---

### 57. Profile screen structure — four iOS-style sections

**Decision:** The Profile screen is organised into four grouped-card sections: **Wallets** (wallet list with rename and set-primary), **Preferences** (hide balances, default send currency), **Security** (app lock toggle, Change PIN stub), **Support** (help centre, privacy policy, terms). Each section sits inside a rounded card with dividers between rows and no divider on the last row. A user block (avatar initials, name, member since) anchors the top.

**Why:** The iOS Settings / grouped-table pattern is the most legible approach for a list of independent settings. Grouping under labelled sections reduces cognitive load — a user hunting for the PIN option knows to look under "Security" rather than scanning all rows. A footer version label ("Ria Wallet v1.0.0") closes the scroll, following the established convention in mobile apps.

**Wallet rows inline in Profile:** Rather than a separate "Wallet Management" screen, wallets are listed directly in Profile. The set is small (max 12) and most users will have 2–4. Inline avoids an extra navigation hop for the common case of renaming a wallet or switching primary.

**Trade-off:** Alert.prompt for rename (iOS only). Android would need a custom modal. Acceptable for the prototype stage; a cross-platform rename sheet would be the production fix.

---

### 58. Hide-balances mask — always `$•••.••`, never variable-width

**Decision:** When `hideBalances` is true the balance is always rendered as `$•••.••` (fixed 7 characters, 3 masked integer digits, 2 masked decimal digits) regardless of the actual amount. On the Profile screen wallet rows, the format is `{symbol}•••.••` using the wallet's own currency symbol.

**Why:** Showing the real number of digits (e.g. `$•••,•••.••` for a 7-digit balance) reveals order-of-magnitude information — an observer can still tell whether the balance is hundreds or millions. Using a fixed-width mask (`$•••.••`) provides no information about magnitude, which is what "hiding" a balance is actually supposed to accomplish. The trade-off is that the reveal animation must add characters rather than simply swapping symbols — see decision 59.

---

### 59. Per-digit slot-machine balance animation with expanding extra digits

**Decision:** The `FlipBalance` component in `WalletsScreen` decomposes the formatted balance string into three zones:
1. **Symbol** — static, never animated (e.g. `$`)
2. **Extra chars** — all digits/separators to the left of the rightmost 3 integer digits; width-animated from 0 → totalWidth via `ExtraExpand`
3. **Core chars** — the rightmost 3 integer digits plus any separators between them, plus 2 fractional digits; each char gets a vertical `BalanceFlipChar` slot-machine flip

`BalanceFlipChar` is a fixed 27×54px `overflow:hidden` cell. The masked char (`•`) exits upward while the real char enters from below, using `withDelay(delay, withTiming(...))` to stagger each digit by 45ms (mirroring `FlipChar` in `CardFace`).

`ExtraExpand` wraps the extra chars in an animated `width: 0 → totalWidth` container with `overflow:hidden`, creating the effect of extra digits sliding out from behind the currency symbol as the balance reveals.

**Why:** A character-count-preserving swap animation (flip every `•` to its real digit in place) would still reveal magnitude. The expanding-width approach keeps the mask at a fixed 3 integer digits and only materialises additional digits at reveal time. It also produces a more interesting visual: the amount "grows" out of the compact masked form, reinforcing the reveal metaphor.

**Character width constants:** Digits are `27px` wide, separators (`,` and `.`) are `14px` wide. These values were chosen to match the `CHAR_W = 27` / `CHAR_H = 54` constants already used in `CardFace.tsx`, so the two slot-machine animations feel visually consistent.

---

### 60. Eye toggle as pill button inside the wallet carousel card

**Decision:** The show/hide balance control is a full-width pill button (`Eye`/`EyeOff` icon + "Show balance"/"Hide balance" label) placed directly below the balance row inside each wallet carousel card, separated by `marginTop: 20px`. The button uses the surface background colour with a subtle border.

**Why:** Earlier iterations put the eye icon in the greeting row header (too crowded, too small), and then as a bare icon inside the carousel (still too small, not obviously a button). The pill treatment makes the control clearly tappable, large enough for reliable finger targeting, and self-labelled so there is no ambiguity about what the button does. Placing it inside the card ties the control visually to the balance it affects.

**Spacing:** `currencyRow.marginBottom: 20` (space above balance) and `eyeToggle.marginTop: 20` (space below balance, above toggle) are equal, centering the balance amount between the currency label and the toggle button.

---

### 61. App lock via `AppLockGate` overlay — preserves navigation state

**Decision:** `AppLockGate` wraps the entire React tree in `App.tsx`. When `appLockEnabled && locked` is true, it renders a `StyleSheet.absoluteFill` `View` over the app — the navigator and all screens remain mounted underneath. The lock overlay re-appears when `AppState` transitions from `background` to `active`.

**Why:** Unmounting the navigator on lock would reset navigation state (active tab, scroll positions, stack depth). Users returning to the app after Face ID would land on the home tab regardless of where they were. The overlay pattern keeps all navigation state intact; the lock screen is purely a presentation layer. `absoluteFill` is simpler than a dedicated auth navigator level and avoids transition animations between lock and app.

**Auto-prompt on mount:** When the lock screen appears it immediately calls `authenticate()` so the system biometric prompt appears without the user needing to tap anything. The manual "Unlock with Face ID" button is a fallback for when the prompt is dismissed or times out.

---

### 62. Auth-gate on app lock toggle (both enable and disable require authentication)

**Decision:** The App Lock toggle in Profile calls `authenticate()` before calling `toggleAppLock()`. The toggle is only changed if authentication succeeds. This applies to both enabling and disabling app lock.

**Why:** Requiring auth to disable app lock prevents a physical attacker from simply opening Settings and turning off the lock before the session re-locks. Requiring auth to enable app lock is consistent (and guards against accidental toggling). If auth fails or is cancelled the toggle state is unchanged and an error haptic fires.

---

---

## Snapshot 11 — 2026-04-14
*Covers: transaction detail / tracking screen, activity list navigation, shared step components*

### 64. Every activity row navigates to a dedicated transaction detail screen

**Decision:** Each row in `UnifiedActivityScreen` is a `Pressable` that pushes `TransactionDetailScreen` with the transaction ID. The detail screen shows a hero amount, status badge, details card (date, reference, wallet, note/reason), and a three-step tracking timeline.

**Why:** The activity list is a summary view — it shows status and amount but gives no context about *why* something is pending or failed, no reference number, and no delivery timeline. For a money transfer product these are the three most common support triggers ("when will it arrive?", "what's my reference?", "why did it fail?"). Linking every row to a detail screen answers all three without requiring the user to contact support in the normal case.

---

### 65. Transaction detail reuses the same tracking timeline as SendSuccessScreen

**Decision:** The step icons (`DoneIcon`, `ActiveIcon`, `FailedIcon`, `PendingIcon`) and `StepRow` were extracted from `SendSuccessScreen` into `src/components/TransferSteps.tsx`. Both screens import from there.

**Why:** The tracking timeline is the same UI regardless of whether you're viewing it immediately after sending or opening a historical transaction. Duplicating the components would mean maintaining two copies of the pulse animation, connector logic, and step styles. The shared file is the single source of truth — a visual change to the timeline (new colour, new icon size) propagates to both screens automatically.

**`FailedIcon` added:** `SendSuccessScreen` only ever shows `done`, `active`, and `pending` states. The detail screen adds `failed` (red filled circle with X) to represent a step that was attempted and rejected. Adding it to the shared file keeps all five icon variants together.

---

### 66. Failed transaction timeline shows failure at step 2 (Processing), not step 1 or 3

**Decision:** For `status: 'failed'` transactions, step 1 ("Transfer initiated") is `done`, step 2 ("Processing transfer") is `failed`, and step 3 ("Recipient receives funds") is `pending`.

**Why:** Step 1 always completes — the app has recorded the transfer intent and reserved the funds. The failure occurs during network processing (step 2), which is where payment network rejections, compliance checks, and insufficient-liquidity errors actually happen. Step 3 never fires if step 2 fails, so it stays pending. This reflects the real failure topology of a remittance pipeline and sets accurate expectations for the user ("the money left my wallet briefly but was returned — it didn't reach the recipient").

---

### 67. Failed transactions use `tx.note` as the failure reason, not a hardcoded message

**Decision:** The "Reason" row in the details card shows `tx.note` when present, otherwise falls back to "Transfer rejected by payment network". The "Note" row is suppressed for failed transactions — the note *is* the reason.

**Why:** Some mock transactions (and real future transactions) carry a note that describes the failure cause (e.g. "Insufficient funds"). Showing both a "Note" row and a separate hardcoded "Reason" row produced two rows with related but inconsistent content on the same screen. Treating the note as the canonical reason for failed transactions removes the duplication and uses the most specific information available. The fallback covers failures where no reason was recorded.

---

### 68. "Contact support" is a sticky footer, not scroll content — refund notice is at the top

**Decision:** For failed transactions, a "Contact support" `SecondaryButton` sits in a sticky footer outside the `ScrollView`, visible immediately without scrolling. The refund notice ("Your funds were not deducted…") moved from the bottom of the scroll to just below the hero, before the details card.

**Why:** Both pieces of content are most useful at the moment the user understands the transaction failed — which is immediately on opening the screen, not after reading all the detail rows. The refund notice answers the first anxiety ("did I lose money?") and should appear before any other detail. The support button is an action, not content — burying it at the bottom of a scrollable list means users who need it most (confused or frustrated users) are least likely to find it. A sticky footer is permanently reachable regardless of scroll position, matching the pattern used for CTAs on confirmation and success screens.

**SecondaryButton styling:** The support button uses the same `SecondaryButton` component as "Back to wallets" on `SendSuccessScreen` — zinc surface, pill shape, no colour. Red was rejected because it implies destructive action; the button is a help request, not a warning.

---

**Decision:** `src/utils/auth.ts` exports a single `authenticate(promptMessage)` function that shows a native `Alert` with "Cancel" and "Authenticate" buttons instead of calling `expo-local-authentication`. Both `AppLockGate` and `ProfileScreen` import from this utility rather than calling `LocalAuthentication` directly.

**Why:** `expo-local-authentication` requires a native development build (not Expo Go) and prompts for the reviewer's real device PIN or Face ID. This makes the prototype awkward to review and can feel invasive. The mock lets any reviewer tap "Authenticate" to proceed through the flow without entering real credentials. The utility is the single source of truth for auth — swapping in real biometrics for production only requires changing this one file.

---

## Snapshot 12 — 2026-04-14
*Covers: balance digit animation, wallet carousel interaction*

### 69. Balance re-flips on wallet swipe — one element, not one per wallet

**Decision:** `FlipBalance` is rendered once at the screen level in `WalletsScreen`, not inside each `WalletItem`. It receives the active wallet's balance as a prop (`real`) and the global `hideBalances` flag (`revealed`). Switching wallets changes `real`, which triggers each digit drum's animation independently.

**Why:** The original approach rendered a balance inside each `WalletItem`. Swiping to a new wallet mounted a fresh balance component which always started in the masked (dots) state before animating in — a visible flash of dots even when balances were already revealed. Lifting the balance to screen level means there is one persistent drum per digit position. When the wallet changes, each drum animates from its current digit to the new one with no reset — a true value-to-value transition with no intermediate masked state.

---

### 70. Slot-drum architecture replaces two-layer flip for digit animation

**Decision:** `BalanceDrumChar` renders a vertical column of 11 items (`• 0 1 2 3 4 5 6 7 8 9`) inside a clipping cell. A single `translateY` shared value selects which item is visible: `y = 0` shows `•`, `y = -(d+1) * BALANCE_DIGIT_H` shows digit `d`. Animating `y` transitions directly from one visible item to another.

**Why:** The previous `BalanceFlipChar` used two layers (front = dot, back = digit) and swapped text content via React state. React state updates are asynchronous — `progress.value = 0` (Reanimated, synchronous on the UI thread) and `setLeaving/setArriving` (React, scheduled) would desync, producing one-frame flashes of wrong content during rapid swipes. The slot drum has no React state in the animation path at all: `translateY` is a single number on the UI thread, and changing `actual` (a prop) simply re-runs the `useEffect` to animate to the new Y target. No state, no race.

---

### 71. `onScroll` midpoint detection instead of `onMomentumScrollEnd` for wallet switch

**Decision:** `handleScroll` fires on every scroll frame (`scrollEventThrottle={16}`) and computes `nearest = Math.round(x / W)`. When `nearest !== pendingIdx.current` the active wallet and balance are updated immediately. `onMomentumScrollEnd` is kept as a safety reconciliation pass only.

**Why:** `onMomentumScrollEnd` fires after the FlatList has fully snapped to a page — typically 200–400ms after the user crosses the midpoint. This made the digit flip feel disconnected from the physical swipe gesture: the swipe would complete, pause, then the numbers would change. `Math.round(x / W)` crosses the threshold exactly at 50% between pages, so the drum animation starts while the user is still mid-swipe. `pendingIdx` ref prevents the handler from re-firing for the same index on subsequent frames.

---

### 72. FlatList height extended to cover balance region — swipe works over digits

**Decision:** `carousel` style sets `height: ITEM_H + BALANCE_H`. The `WalletItem` render function only fills `ITEM_H`; the remaining `BALANCE_H` is empty FlatList space. The balance overlay sits absolutely on top of that space with `pointerEvents="box-none"` (digits are `pointerEvents="none"`; the eye toggle is a tappable `Pressable`).

**Why:** With the balance in a separate `View` below the FlatList, touch events over the digits were consumed by that View and never reached the FlatList — the user could not swipe when their finger started on the numbers. Extending the FlatList to cover the full region makes it the gesture responder for the entire carousel area. The `box-none` overlay means swipes pass through to the FlatList while the toggle still intercepts taps.

---

### 73. Removed "N cards linked" from wallet item header

**Decision:** The wallet item in the carousel no longer shows a "N cards linked" subtitle. Only the primary badge and currency row (flag + code) are rendered.

**Why:** The cards linked to the active wallet are already visible in the `CardStackPreview` section immediately below the carousel. Repeating the count in the carousel header was redundant — it added visual noise without adding information the user didn't already have on screen.

---

### 74. Equal flex spacers above and below the balance amount — toggle pinned at bottom

**Decision:** The `balanceOverlay` contains: a `flex: 1` spacer, the `FlipBalance` digits, another `flex: 1` spacer, then the eye toggle `Pressable`. The overlay has a fixed `height: BALANCE_H` and `paddingBottom: 16`.

**Why:** Earlier approaches used `paddingTop` + `gap` to position the digits, which meant changing the top padding shifted the toggle as a side effect. Equal flex spacers distribute all remaining height symmetrically above and below the digits regardless of the toggle's intrinsic height. The toggle is pinned to the bottom of the overlay by being the last non-flex child. `BALANCE_H` is now the single knob that controls overall breathing room; the spacing around the digits adjusts automatically.

---

## Snapshot 13 — 2026-04-14
*Covers: send flow transition polish, failure state UI, unified confirm screen*

### 75. `useSafeAreaInsets` instead of `SafeAreaView` in `SendSuccessContent`

**Decision:** `SendSuccessContent` uses `useSafeAreaInsets()` and applies `paddingTop`/`paddingBottom` manually to a plain `View`, rather than wrapping in `SafeAreaView`.

**Why:** `SafeAreaView` fires a native measurement pass after the first render to determine its padding. When the component is mounted inside a `transparentModal` container (as the background layer in `SendMoneyScreen`), the native measurement context differs from a regular screen — the first render paints with no padding, then jumps to the correct value on the next frame. This produced the "content at top then jitters into place" symptom. `useSafeAreaInsets()` reads directly from the React context provided by `SafeAreaProvider` at the app root — the correct value is available synchronously on the first render, so there is no layout update after mount.

---

### 76. `contentStyle: { backgroundColor: 'transparent' }` on `SendSuccess` navigation screen

**Decision:** `SendSuccessScreen` is registered with `contentStyle: { backgroundColor: 'transparent' }` in the navigator, identical to `SendMoney`.

**Why:** `SendSuccessContent` wraps its content in an `Animated.View` with `backgroundColor: colors.bg` — solid while on screen. When "Back to wallets" slides it down via `translateY`, the native screen container was opaque, so the area above the departing content showed the container's white background rather than the `Main` screen behind it. Making the native container transparent lets the already-mounted `Main` screen show through as the content slides down — the same technique used for `SendMoney`.

---

### 77. `showSuccessBg` flag separates "reveal tracking screen" from "reveal wallets" on dismiss

**Decision:** A `showSuccessBg` boolean state (separate from `successBgParams`) controls whether `SendSuccessContent` is rendered as the background layer in `SendMoneyScreen`. It is set `true` when a transfer succeeds and `false` before `handleCloseToWallets` animates (for the "Close" path after success/failure).

**Why:** `successBgParams` tells us *if* tracking data exists but not *which screen* should show behind the departing drawer. "View transfer" should reveal the tracking screen. "Close" after success/failure should reveal wallets (the `Main` screen via native modal transparency). Using a single background layer for both would require knowing the user's intent before the animation starts. `showSuccessBg = false` before `handleCloseToWallets` hides the tracking content, so the native transparency of the `transparentModal` shows through to wallets — no extra screen, no white flash. The white fallback `<View bg={colors.bg}>` was removed entirely; all dismiss paths either use `SendSuccessContent` (for View transfer) or native transparency (for everything else).

---

### 78. `retryReady` phase — slot machine flip from "Transfer failed" to "Try again"

**Decision:** After a failed transfer, `phase` auto-transitions `'failed' → 'retryReady'` after 2 seconds. `MorphButton` slot-machine flips from the red "Transfer failed" state to an orange "Try again" button — identical animation mechanics to `'success' → 'viewTransfer'`. Tapping "Try again" calls `setPhase('idle')`, resetting the confirm screen so the user can re-attempt without re-entering amounts.

**Why:** The `'failed'` state is non-interactive — it confirms what happened. It should not stay there permanently because the user has no obvious next step. Auto-transitioning to `'retryReady'` gives them a clear primary action with the same motion they saw on success, making the two outcomes feel like a unified system. The slot machine flip communicates that the button state has changed and a new action is available. Resetting to `'idle'` (rather than directly re-triggering) lets the user review the breakdown and change the outcome or delay settings before retrying.

---

### 79. Failure banner replaces the hero section in the confirm overlay — persists through `retryReady`

**Decision:** When `phase === 'failed' || phase === 'retryReady'`, the hero section (recipient flag, amount, ETA chip) is replaced by a centred failure banner: a red-tinted circle with an X icon, "Transfer failed" heading, and "No funds were deducted from your wallet." subtext. The breakdown cards remain visible and scrollable. The banner stays visible for the full `failed → retryReady` lifecycle.

**Why:** The hero amount is no longer meaningful after a failure — no money moved. Showing it alongside an error message creates a confusing read ("Maria receives ₱5,684 … Transfer failed"). Replacing it with explicit failure feedback is clearer. The reassurance copy ("No funds were deducted") answers the user's first anxiety before they read anything else. The banner persists through `retryReady` because the failure context is still relevant — the user is about to retry, and removing the banner too early would make "Try again" feel contextless.

---

### 80. Prototype settings hidden during active transfer phases

**Decision:** The prototype outcome/delay controls are gated behind `phase === 'idle'` and disappear as soon as the user taps "Confirm and send".

**Why:** The controls exist to simulate different backend responses. Once a transfer attempt is in progress they are irrelevant — the outcome has already been captured. Leaving them visible during processing, success, or failure states made the prototype UI look unfinished and was distracting during the transition animations.


---

## Snapshot 14 — 2026-04-15
*Covers: add card flow redesign, Ria Edition card customisation, metallic gradient, Ria logo overlay, adaptive text colours*

### 81. Add Card review step removed — card created on the colour screen

**Decision:** The `AddCardReview` screen no longer receives full card data as navigation params. The card is created (via `addCard`) directly inside `handleAddCard` on `AddCardColorScreen`, then navigated to `AddCardReview` with only `{ cardId }`. `AddCardReview` looks up the card from the store and acts as a pure success + wallet-provisioning screen.

**Why:** Showing a preview of the card on the colour screen and then a near-identical preview on the review screen was redundant and felt like an extra step with no new information. Creating the card at the colour-confirm point and navigating directly to success is the same pattern used for wallet creation (`WalletReview` → card created → `WalletSuccess`). `AddCardReview` now has a distinct role: success confirmation + "Add to Apple/Google Wallet" entry point.

---

### 82. Ria Edition palette — 4 named options, finish baked in, no user toggle

**Decision:** The colour screen has two sections: "Ria Edition" (4 fixed options) and "Color" (11 solid options). Ria Edition options are defined in `RIA_PALETTE` with their finish baked in:

| Label   | Hex       | Finish    |
|---------|-----------|-----------|
| Classic | `#f97316` | plastic   |
| Metal   | `#71717a` | metallic  |
| Green   | `#14532d` | plastic   |
| Black   | `#09090b` | plastic   |

The old "Finish" section (plastic / metallic toggle) was removed entirely. Metal is the only card that gets metallic finish and it is the only way to get it.

**Why:** Exposing finish as a user-selectable toggle invited nonsensical combinations (a bright orange metallic card). Baking finish into the palette entry enforces correct pairings and eliminates a UI section without removing capability.

---

### 83. Metallic card gradient — static 5-stop diagonal, no animation

**Decision:** The Metal Ria Edition card uses a `LinearGradient` (`expo-linear-gradient`) with 5 stops:

```
colors:    ['#181818', '#404040', '#707070', '#404040', '#181818']
locations: [0, 0.15, 0.5, 0.85, 1]
start:     { x: 0, y: 0 }
end:       { x: 1, y: 1 }
```

**Why — static:** Reanimated shimmer animations (`withRepeat` / `withSequence`) crashed Expo Go approximately 3 seconds after selecting the Metal card. Multiple workarounds (duration: 16, `runOnJS` recursive callback) all crashed. A third-party metal shader was rejected (user preference). Static gradient was accepted as the stable solution.

**Why — 5 stops, not 11:** An earlier 11-stop symmetric gradient produced 3 visible streaks because too many stops were clustered at similar brightness values. Reducing to 5 stops with a single peak and wide location spread (15% dark zones at each edge) gives one smooth sheen across the full card face.

**Why — these specific values:** Corners `#181818` (near-black) + peak `#707070` (mid-grey). Avoids the card looking overly light or silvery — the dominant read is dark gunmetal with a single diagonal light catch.

**Metallic always uses white text.** `card.finish === 'metallic'` forces `light = false` in `CardFront`, bypassing the luminance check. The gradient peak is mid-grey, not near-white, so the luminance formula would otherwise incorrectly flag it as a light card.

**Border:** `rgba(200,200,200,0.25)` for metallic vs. `card.color @ 6%` for plastic — subtle silver rim vs. colour-tinted rim.

---

### 84. Ria logo overlay — `ria-card-overlay.png` with soft-light blend mode

**Decision:** Branded (Ria Edition) cards render a `<Image>` overlay using `assets/ria-card-overlay.png` (294×196 RGBA PNG) with `mixBlendMode: 'soft-light'` (cast as `any` — React Native doesn't type this). The image is left-aligned within the card's 18px content padding, not edge-to-edge.

**Dimensions:**
```
CARD_PADDING = 18
OVERLAY_H = CARD_HEIGHT - 4 - CARD_PADDING * 2   // content-area height
OVERLAY_W = OVERLAY_H * (294 / 196)               // preserve source aspect ratio
```

`resizeMode="stretch"` with explicit pixel dimensions — required because Metro can't reliably apply `mixBlendMode` to auto-sized images.

**Why soft-light:** Soft-light is additive on light areas and subtractive on dark areas, so the overlay tints the card surface rather than painting over it. The logo reads as a subtle texture rather than an opaque stamp.

**Why left-aligned:** Matches the reference image the user provided. The right side of the card is reserved for the network logo and expiry/CVV data in the bottom row.

**`branded` flag on `Card`:** Only cards with `branded: true` render the watermark. Solid-colour cards skip it.

---

### 85. Adaptive card text colours — luminance-based, metallic always white

**Decision:** `isLightColor(hex)` computes perceived luminance: `(r*299 + g*587 + b*114)/1000 > 128`. `cardTextColors(light)` returns four RGBA values (primary, secondary, muted, icon) for dark-on-light or white-on-dark use. In `CardFront`, metallic cards hardcode `light = false` before the check.

**Why:** Orange (`#f97316`) has luminance ≈ 145 → `light = true` → dark text. This was the trigger: brand orange was added as a card colour and the white text was illegible. The luminance formula covers all future palette additions automatically.

**Metallic override:** The gradient peak is mid-grey (`#707070`, luminance ≈ 112 → `light = false` anyway), but the diagonal spread means some areas are near-black. Forcing `light = false` unconditionally ensures white text regardless of which part of the gradient underlies any given text element.

---

### 86. Card number fullNumber generation fix — always exactly 16 digits

**Decision:** The first group (`g1`) is generated as `prefix + 3 random digits` (not 4). `fullNumber = g1 (4 chars) + g2 (4) + g3 (4) + last4 (4) = 16 digits`.

**Why:** The original `g1 = prefix + Math.random().toString().slice(2, 6)` produced 5 characters in the first group (1 prefix + 4 random), giving a 17-digit full number. The card list rendered last4 from the store; the card detail screen derived last4 from `fullNumber.slice(-4)`. With 17 digits, `slice(-4)` matched but the displayed number was wrong — the mismatch surfaced visually when comparing the list card to the detail card.

---

### 87. Three-tier button system — Primary, Secondary, Flat

**Decision:** The app uses exactly three button variants: `PrimaryButton` (orange/brand CTA), `SecondaryButton` (white/surface fill, bordered), and `FlatButton` (no chrome, opacity-press only). A fourth "ghost" variant (border only, no fill) was considered and rejected.

**Why:** The UI had accumulated ad-hoc `Pressable` styling for low-priority actions — the "Hide balance" eye toggle had a custom surface background + border that duplicated SecondaryButton visually but wasn't using the component, and "Set primary" in ProfileScreen had its own ghost-like bordered style. This created visual inconsistency and no shared press feedback behaviour.

**Variant semantics:**
- **Primary** — forward-momentum action, one per screen, always bottom. "Confirm", "Send", "Add card".
- **Secondary** — supporting action with chrome. "Add Wallet", "See all activity", "Contact support".
- **Flat** — inline, subordinate, no chrome. "Hide balance" toggle, "Set primary".

**Ghost rejected:** A border-only button only earns its place when sitting on a coloured or image background where white fill would look wrong. No such surface exists in this app. Both use cases were absorbed into Secondary or Flat.

**Hierarchy rule:** On any given screen, Secondary is the supporting action and Flat is subordinate to it — never two Secondaries for actions of different weight. Example: WalletsScreen has "Add Wallet" as Secondary and "Hide balance" as Flat.

**Quick action buttons excluded:** The Send / Receive / Add / Cards row uses a local `ActionBtn` component (vertical layout, animated coloured circle, label below). These are icon shortcuts, not CTA buttons, and don't belong in the three-tier family. `ActionBtn` stays local to WalletsScreen unless the pattern appears elsewhere.

---

### 88. Card stack animation — scroll-driven collapse, no timers, no state

**Decision:** `WalletsScreen` renders one `AnimatedCardStack` per wallet, all absolutely layered in a `position: relative` container. Animation is driven entirely by `scrollX` via `useAnimatedStyle` worklets — no `useState`, `useEffect`, `setTimeout`, or `useLayoutEffect` inside the component.

**Collapse formula:**
```
st = scrollX.value / W - walletIndex   // signed distance from this wallet's centre
p  = clamp(|st| * 2, 0, 1)            // stagger progress: 0 = full stagger, 1 = collapsed
```
- `translateY[i] = slotTargetY(i, n) * (1 - p)` — cards slide to ty=0 as p→1
- `scale[i]      = 1 - i * 0.02 * (1 - p)` — all scales converge to 1:1 at p=1
- `opacity       = st > -0.5 && st < 0.5 ? 1 : 0` — **binary, not scroll-linked**

**Why binary opacity:** At p=1 (the midpoint), all cards are at ty=0 and scale=1 — the stack looks like a single flat card. A hard-cut at that instant is invisible because the outgoing and incoming front cards occupy the same pixels. Linking opacity to scroll progress (the first two implementations) meant cards were visibly semi-transparent mid-swipe, and async JS state swaps introduced a frame of wrong content at low opacity.

**Why no state/timers:** Previous timer-based approach (`setTimeout(COLLAPSE_MS + FADE_MS)`) had a race: the new card data (from React `setState`) wasn't always committed before the first visible opacity frame of the fade-in, causing a flash of empty/wrong content. With all stacks always rendered at ty=0 underneath, the incoming wallet's front card is already in the right position — no data swap needed.

**Touch routing:** Wrapper `View` around each stack uses `pointerEvents="box-none"` for the active wallet and `"none"` for all others, so only the visible stack is tappable.

**`slotTargetY` must be a worklet:** Reanimated 4 uses `react-native-worklets`, which throws if a plain JS function is captured in a worklet closure during serialization. Any helper called from inside `useAnimatedStyle` needs the `'worklet'` directive. Functions only called from JSX or `useEffect` (JS thread) do not.

**Container height:** `height: stackH(Math.min(activeCards.length, CARD_SLOTS))` from React state. The jump when `currentIndex` changes happens at the midpoint where both stacks are invisible — no visible layout shift.

---

### 89. Card stack container height — RNAnimated.Value reserved at switch point

**Decision:** The card stack container uses `RNAnimated.Value` (React Native core `Animated`, not Reanimated) for its height. `cardStackHeightAnim.setValue(stackH(n))` is called once inside `handleScrollJS` exactly when `pendingIdx` changes — i.e., at the wallet midpoint. The `RNAnimated.View` container height updates immediately to the new wallet's full stagger height at that instant.

**Why this approach after ruling out alternatives:**

| Approach | Problem |
|---|---|
| `useAnimatedStyle` on `height` | Bypasses React's layout engine — `ScrollView` never sees intermediate values, activity section jumps |
| Reanimated `LinearTransition` | Documented limitation: layout animations don't work inside a scrollable `ScrollView` |
| React Native `LayoutAnimation` | Conflicts with Reanimated; both try to own the native animation system simultaneously |
| `useAnimatedReaction` → `RNAnimated.timing` | `useEffect` fires after paint — one frame where layout already snapped before animation starts |
| `useAnimatedReaction` → `setValue` per frame | `runOnJS` latency causes container to lag 1–2 frames behind the card stagger on fast swipes, producing visible overflow and jitter |

**Why `setValue` at the midpoint is invisible:** At the wallet crossover point (`Math.round(scrollX / W)` changes), stagger progress `p = 1` for both stacks — every card is fully collapsed to `translateY = 0`. The visual height is `STACK_CARD_H` regardless of card count. Jumping `cardStackHeightAnim` to `stackH(n_new)` at this instant only adds or removes empty space *below* invisible collapsed cards. As the user continues swiping toward the new wallet, `p` decreases from 1 → 0 and the cards stagger downward into the already-reserved space. No overflow is possible.

**Why `RNAnimated` (not Reanimated):** `RNAnimated.Value` with `useNativeDriver: false` propagates through React Native's Yoga layout engine on the JS thread. The `ScrollView` sees each layout update and repositions the activity section accordingly. Reanimated's `useAnimatedStyle` writes directly to the native view, bypassing Yoga — the `ScrollView` sees nothing until a full React render cycle.

**One `setValue` call per wallet switch** — not per frame. No per-frame bridge traffic, no jitter.

---

### 91. Send screen — quick amount chips

**Decision:** Added a row of 4 quick-amount chips above the numpad on the amount entry step. Chip amounts are defined per currency (`QUICK_AMOUNTS` map) rather than derived dynamically from exchange rates.

**Why per-currency presets over rate-derived values:** Computing chip amounts as `sendPreset × rate` produces awkward numbers (e.g. ₱1,743) that look strange as presets and erode trust. Round, culturally familiar amounts (₱500, ₱1,000, ₱2,500, ₱5,000) are faster to read and more likely to match what the user actually wants to send. The presets are sized to the realistic remittance range for each currency — NGN amounts are in the tens of thousands, COP in the hundreds of thousands, USD in the tens.

**Chips track the active field:** When the send field is active the chips show send-currency amounts; when the receive field is active they flip to receive-currency amounts and tap sets `receiveRaw`. Affordability for receive-side chips is back-calculated through the rate + fee.

**Trade-off:** The presets need manual maintenance if new currencies are added.

---

### 92. Recipient swap resets the amount form

**Decision:** Tapping the swap-recipient button (`ArrowLeftRight`) or selecting a new contact after a swap resets `sendRaw`, `receiveRaw`, and `activeField` to their initial state.

**Why:** The previous amount is bound to the previous recipient's currency and relationship context. Carrying it forward to a different recipient (potentially a different currency entirely) is misleading — the user would see a stale number that doesn't correspond to anything they've chosen yet. Resetting on swap makes the fresh start explicit and avoids confusion.

**Why not reset on first contact selection:** `isSwap` guards the reset so it only fires when `selectedContact !== null` at selection time — the very first pick in a new flow is unaffected.

---

### 90. Cards section "View all" / "Add card" — wrapped in Pressable

**Decision:** The `cardViewAll` `Text` element is wrapped in a `Pressable` with `onPress={handleCards}` and `hitSlop={8}`.

**Why:** The text was rendering with the correct label and colour but had no gesture handler — tapping it did nothing. `handleCards` already existed (used by the card stack tap and the Cards action button) and navigates to `WalletCardList`. The `hitSlop` compensates for the small tap target of the inline text.

---

### 93. Card detail screen — full management UI replacing minimal action buttons

**Decision:** Replaced the original freeze / view PIN / remove action tray with a structured full-screen layout: quick action row (Freeze, View PIN) → Card settings section (Change PIN, Online transactions toggle) → Spending limits section → Card info section → Danger zone (Report, Remove).

**Why:** The original three buttons had no room for settings like online transaction control, PIN change, or per-period spend limits. Grouping by semantic category (security, spending, info, danger) makes the page scannable and avoids a flat list of unrelated actions.

---

### 94. Spending limits — three independent per-period limits (daily / weekly / monthly)

**Decision:** The `Card` type stores `spendingLimits: { daily?: number; weekly?: number; monthly?: number }` instead of a single `spendingLimit + spendingLimitPeriod`. Each period is set and cleared independently. The card detail screen shows three separate rows (Daily / Weekly / Monthly), each opening its own focused drawer.

**Why:** A single active limit with a period selector forced a false choice — the user can only have one limit at a time. Real spending control means capping per day AND per week AND per month simultaneously. Three independent rows make it obvious which limits are set (value shown inline) and let the user edit one without disturbing the others.

**Store action:** `setSpendingLimit(cardId, period, limit | null)` updates one period atomically. `replaceSpendingLimits(cardId, limits)` replaces the whole object (available for bulk operations).

---

### 95. Four-button system — Primary / Secondary / Destructive / Flat

**Decision:** All interactive buttons use one of four components. Raw `Pressable` is never used as a button.

| Component | Appearance | When |
|---|---|---|
| `PrimaryButton` | Orange gradient | Main CTA — one per sheet/screen |
| `SecondaryButton` | White bordered, gradient sheen | Secondary / neutral actions; `shape="rect"` only for icon+text action grids |
| `DestructiveButton` | Red, same structure as Primary | Irreversible harm only (remove card, report card) |
| `FlatButton` | No background, opacity on press | Dismiss / cancel / skip |

All four accept a `label` prop that renders text internally with correct weight, size, and disabled colour (`colors.textMuted`). External `<Text>` children and button text styles outside the component are prohibited. `style` prop is layout-only (width, padding, margin) — never background or text colour overrides.

**Why:** Previous iterations accumulated raw `Pressable` buttons with ad-hoc colours (freeze = dark blue, report = amber) that violated brand guidelines. Centralising text rendering inside the components ensures disabled states, press feedback, and typography are consistent everywhere without caller-side logic.

---

### 96. BottomSheet — swipe-to-dismiss opt-in via `swipeToDismiss` prop

**Decision:** The shared `BottomSheet` component has a `swipeToDismiss` prop (default `false`). When enabled, dragging the handle down past 100px or at velocity > 600 animates the sheet out from its current drag position and calls `onClose`. Currently only the spending limit sheet enables it.

**Why:** Swipe-to-dismiss is not universally appropriate — confirmation sheets intentionally require an explicit tap to prevent accidental dismissal. The limit sheet benefits from it because it is a tall input sheet (not a quick confirm) where the user may want to cancel mid-entry without reaching for the Cancel button.

**Implementation:** A `dragY` shared value is added on top of the existing `sheetY` open/close animation value. The pan gesture runs on the handle area only to avoid conflicting with interactive children (numpad keys, toggles).

---

### 97. "Customize" replaces "Cards" quick action on WalletsScreen

**Decision:** The fourth quick action button on WalletsScreen changed from "Cards" (`CreditCard` icon → `WalletCardList`) to "Customize" (`SlidersHorizontal` icon → `WalletSettings`). Cards remain accessible via the "View all →" / "Add card →" link in the Cards section directly below.

**Why:** The "Cards" action was redundant — the animated card stack with its own header link already covers navigation to cards. "Customize" surfaces per-wallet settings that had no entry point from the wallet view itself.

---

### 98. WalletSettings modal — rename, accent color, set primary

**Decision:** A `WalletSettings` screen (slide-from-bottom modal, `walletId` param) provides three controls for the active wallet: rename (via `Alert.prompt`), accent color (16-swatch grid of preset hex colors), and set-as-primary (with a styled `ConfirmSheet` confirmation). The screen is reached from the "Customize" quick action on WalletsScreen.

**Why:** Wallet customization had no dedicated surface — rename and set-primary were buried in Profile, and accent-color override didn't exist at all. Grouping them in a focused modal keeps the wallet carousel screen clean while making per-wallet settings discoverable in context.

**Type change:** `Wallet` gains `accentColor?: string`. `walletAccent(currency, override?)` checks the override first, falling back to the currency default map. The override propagates to the carousel gradient, liquid dots, card stack accent, and ProfileScreen wallet rows.

---

### 99. Native Alert replaced with ConfirmSheet for set-primary confirmation

**Decision:** Confirming "set as primary wallet" uses the styled `ConfirmSheet` component rather than `Alert.alert`. Both `WalletSettingsScreen` and `ProfileScreen` use the same `SetPrimarySheet` wrapper (which delegates to `ConfirmSheet`).

**Why:** Native dialogs break the visual language — they render outside the app's theme, ignore the dark/light surface, and don't support the branded `PrimaryButton`. `ConfirmSheet` provides the same semantic (icon + title + body + confirm + cancel) with consistent typography and animation.

**Rule:** Native `Alert.alert` is prohibited for confirmations. `Alert.prompt` remains acceptable for single-line text input (rename) until a custom inline text field is designed.

---

### 100. BottomSheet, ConfirmSheet, SetPrimarySheet as shared components

**Decision:** `BottomSheet`, `ConfirmSheet`, and `SetPrimarySheet` live in `src/components/` and are imported by any screen that needs them. Inline sheet definitions inside screen files are prohibited.

**Why:** The animated sheet logic (`overlayOpacity`, `sheetY`, mount/unmount guard) was copy-pasted into `CardDetailScreen`, `WalletSettingsScreen`, and `ProfileScreen` — three identical ~50-line blocks. Extracting to a single component means animation tweaks, safe-area handling, and gesture behaviour are fixed once everywhere.

---

## Snapshot 15 — 2026-04-15
*Covers: prototype state simulator, card face badge system, badgeTheme palette annotation*

### 101. Prototype state simulator — expired card and freeze failure on CardDetailScreen

**Decision:** A "Prototype" section at the bottom of `CardDetailScreen` (after Danger zone, separated by a top border) exposes two `SegControl` rows: "Card status" (Active / Expired) and "Freeze action" (Success / Fail). These write `expired` and `freezeSimulateError` flags directly to the card in the store. The expired flag shows an "Expired" badge on the card face and disables the Freeze action button. The freeze-failure flag causes the 1.8s freeze animation to complete but then show an error sheet ("Freeze failed" / "Unfreeze failed") instead of committing the state change. The same `SegControl` + `protoWrap`/`protoTitle` pattern used in the send flow (Decision 80) is used here for visual consistency.

**Why:** Reviewers need to see expired and error states without adding special-case mock data. Two flags cover the two most meaningful card lifecycle states that affect user behaviour — expired (card unusable, UI should communicate clearly) and freeze failure (common action, error handling must be clear). Adding more failure states (suspend, network decline) would start to feel like a QA harness rather than a prototype reviewer tool.

**`ConfirmSheet` additions:** A `secondary` prop (renders `SecondaryButton` instead of `PrimaryButton`) and `hideCancelButton` prop were added to support the single-button dismiss sheet for the freeze error — no cancel needed on a pure-informational error alert.

---

### 102. Prototype seg controls on the Design Your Card screen

**Decision:** The same `SegControl` pattern was added to `AddCardColorScreen` as a proto section after the solid colour palette. A single three-way control ("Card status: Active / Frozen / Expired") updates local `previewFrozen` / `previewExpired` state, which is wired into the live `CardFront` preview immediately. This lets a reviewer verify all three badge states against all colour options before the card is created.

**Why:** Verifying badge contrast requires seeing the badge on the actual card face. Doing that from `CardDetailScreen` requires first creating the card, then navigating to its detail screen, then toggling the state — three steps. Putting the controls on the colour screen collapses this to one toggle while the palette is still in view, which is the right moment to check contrast.

**Three-way instead of two toggles:** A single segmented control (Active / Frozen / Expired) is cleaner than two independent toggles — the states are mutually exclusive anyway, and the three-way control makes that explicit.

---

### 103. Card face badge system — near-opaque fills, outline type badge, Lucide icons

**Decision:** The three badge types on the card face use distinct visual treatments:

- **Type badge** (Physical / Virtual / Single-use) — outline only, no fill. `borderColor` and text adapt to card lightness: `rgba(0,0,0,0.40)` / `rgba(0,0,0,0.72)` on light cards, `rgba(255,255,255,0.38)` / `rgba(255,255,255,0.65)` on dark. The badge communicates metadata, not urgency.
- **Frozen badge** — near-opaque dark blue fill (`rgba(30,64,175,0.88)`) + `#bfdbfe` text + `Snowflake` icon (size 9, strokeWidth 2.5). Inverted to white (`rgba(255,255,255,0.88)`) with dark navy text on cards where `badgeTheme = 'inverted'`.
- **Expired badge** — near-opaque dark red fill (`rgba(153,27,27,0.88)`) + `#fecaca` text + `Clock` icon (size 9, strokeWidth 2.5). Fixed — no light/dark inversion. Dark maroon over any card hue (including orange) reads as clearly distinct and communicates danger without ambiguity.

**Why near-opaque instead of semi-transparent tints:** Semi-transparent fills blend into same-hue card backgrounds — blue frozen badge disappears on blue cards, amber expired badge disappears on orange cards. Near-opaque fills guarantee sufficient contrast on any background at the cost of a slightly heavier badge. The trade-off is acceptable: state badges (especially expired) need to be immediately readable at a glance.

**Why Lucide icons instead of emoji:** `❄️` and similar emoji cannot accept a `color` prop, size inconsistently across platforms, and don't optically match the badge text size. `Snowflake` and `Clock` at size 9 match the 10px badge text optically and inherit the correct colour without platform variance.

**Expired fixed, frozen adaptive:** Expired uses a fixed dark red with no inversion because red-on-orange and red-on-dark are both clearly distinct (maroon reads as different from orange; maroon shows on dark cards). Frozen uses inversion because dark-blue-on-blue is genuinely hard to distinguish regardless of opacity.

---

### 104. `badgeTheme` field on Card — palette-declared, not runtime-computed

**Decision:** `Card` gains a `badgeTheme?: 'default' | 'inverted'` field. Every entry in `RIA_PALETTE` and `SOLID_PALETTE` in `AddCardColorScreen` declares its own `badgeTheme`. `'inverted'` means the frozen badge renders as a white pill with dark navy text (high contrast on dark/blue cards). When a card is created, `badgeTheme` is written to the store alongside `color` and `finish`. `CardFront` reads `card.badgeTheme === 'inverted'` directly — no heuristic checks at render time.

**Why not runtime heuristics:** Earlier iterations used `isLightColor` (luminance check) and `isBluish` (blue-channel dominance check) computed per render. These required two separate checks and still failed for edge cases — orange is classified as "light" by luminance so the frozen badge got the faint low-opacity treatment, not the near-opaque one. Every new card colour required verifying the heuristic produced the right result. Declaring `badgeTheme` in the palette makes the decision explicit and auditable: a new colour is added with a deliberate annotation, and the renderer asks no questions.

**Current annotation:** All palette entries are `'inverted'` except Classic (`#f97316`) and Blaze (`#f97316`) — the only warm/light card colours. Orange is the one case where the dark blue frozen badge reads clearly. All dark, blue, and neutral cards use `'inverted'` (white pill).

**Mock cards** (`mockData.ts`) annotated manually with `badgeTheme: 'inverted'` — all three are dark colours (Midnight, Ocean, Plum).

---

## Snapshot 16 — 2026-04-15
*Covers: StackCardFace extraction, WalletsScreen inline renderer unification*

### 106. `StackCardFace` — single source of truth for stack card rendering

**Decision:** All card face rendering logic (colored background, `CardOverlay`, name, type badge, frozen/expired badges with icons, last4 text) is extracted into `src/components/StackCardFace.tsx`. `StackCardFace` also owns the shared constants `STACK_CARD_H`, `STACK_V_OFFSET`, `SVG_W`, `SVG_H`, `SVG_R`. Both `CardStackPreview` and `WalletsScreen`'s `AnimatedCardStack` import and render `StackCardFace` inside their own outer shells.

**Why:** After the badge system (`badgeTheme`, expired/frozen icons) was added to `CardStackPreview`, the `WalletsScreen` had its own separate inline card renderer (`AnimatedCardStack`) that diverged — it retained hardcoded white text and had no badge support. The fix required duplicating all the badge logic into WalletsScreen. Extracting to `StackCardFace` means any future change to card face appearance — new badge type, colour tweak, layout adjustment — is made once and reflected in both the wallet home stack and the static stack in `AllCardsScreen`.

**Split of responsibility:**
- `StackCardFace` — face content and the colored container. Stateless, no animation.
- `CardStackPreview` outer shell — absolute positioning, border, scale transform, container height. Used in static contexts (`AllCardsScreen`).
- `AnimatedCardStack` outer shell — `Animated.View` with three hardcoded animated styles driven by `scrollX: SharedValue`. Not extractable (violates Rules of Hooks if made dynamic). Used only on the wallet home carousel.

**What was wrong before:** `WalletsScreen` imported `STACK_CARD_H` / `STACK_V_OFFSET` from `CardStackPreview` (layout constants) but rendered its own card face with entirely separate, hardcoded styles. Adding badging to `CardStackPreview` had no effect on the wallet home screen.

---

### 105. No enforced card limit per wallet

**Decision:** No hard cap on cards per wallet. `CARD_SLOTS = 3` in `WalletsScreen` and `MAX_STACK = 3` in `CardStackPreview` are purely rendering constants — they control how many cards the stack UI fans out, not how many can exist. The wallet review screen no longer advertises "Up to 3 per wallet".

**Why:** No product justification for the limit. A user might hold a travel card, everyday card, and per-family-member cards in a single wallet — 3 is too low without a business rule behind it. If an issuer constraint exists, it belongs as a server-side rejection, not a client-side gate.

**Trade-off:** The stack visually shows only the first 3 cards. Cards beyond that exist in the store and are accessible via the card list, but aren't visible in the wallet home stack. Acceptable for now.

---

## Snapshot 17 — 2026-04-15
*Covers: Replace flag emoji with SVG flag icons*

### 107. Flag icons via `country-flag-icons` + `SvgXml` instead of emoji

**Decision:** All flag emoji strings (e.g. `'🇺🇸'`) are replaced with ISO 3166-1 alpha-2 country codes (e.g. `'US'`). A `FlagIcon` component renders them using `SvgXml` from the already-installed `react-native-svg`, sourcing SVG strings from `country-flag-icons/string/3x2`. The `flag` field on `Currency` and `Contact` now holds the ISO code. `FlagIcon` accepts `code` and `size` (height in dp; width auto-derived at 3:2 ratio).

**Why not emoji:** Flag emoji render inconsistently across Android versions and don't render at all on some older devices. On Android 13 and below, many OEM skins strip or blank flag emoji. `country-flag-icons` SVGs are pixel-identical on every platform.

**Why `SvgXml` over image assets or CDN:** `react-native-svg` was already a dependency. `country-flag-icons/string/3x2` exports plain SVG XML strings — no bundler transform needed, fully offline, no network dependency. Importing PNG assets per flag would add ~400 KB of binary assets and require a static require map. CDN images add latency and don't work offline, which is unacceptable for a fintech app.

**Why `string/3x2` over `react/3x2`:** The `react/3x2` exports use web SVG elements (`<svg>`, `<path>`) which are not valid React Native components. `string/3x2` returns raw SVG XML that `SvgXml` renders correctly via the native SVG bridge.

**`FlagIcon` sizing:** `size` prop = height in dp. Width = `Math.round(size * 1.5)` to maintain the 3:2 aspect ratio. A `borderRadius: 2` clip gives flags with straight edges (e.g. NG) a subtle rounded rect.

**String-concatenated flag cases** (filter chips, row values): components updated with an optional `flagCode` prop that renders `FlagIcon` inline before the text value rather than embedding the flag in the string. Affected: `FilterChip` (UnifiedActivityScreen), `Row` (SendMoneyScreen, ConfirmationScreen), `DetailRow` (TransactionDetailScreen). `CardDetailScreen`'s `InfoRow` uses its existing `right` prop. `WalletCardListScreen` header restructured from a single `Text` to a `View` row.

### 108. `Contact.flag` and `Currency.flag` hold ISO country codes, not emoji

**Decision:** The `flag` field is documented as an ISO 3166-1 alpha-2 code (`'US'`, `'MX'`, `'EU'`, etc.), not an emoji or display string. `detectFromPhone` in `SendMoneyScreen` returns ISO codes. `PRIMARY_CURRENCY_BY_ISO` and `RECEIVE_CURRENCIES_BY_ISO` are keyed by ISO code. The old `flagToISO()` emoji-to-code converter is deleted.

**Why:** Storing the display representation in the data model couples rendering to data. ISO codes are stable identifiers; the rendering choice (emoji vs. SVG vs. text abbreviation) can change independently. The `FlagIcon` component is the single place that maps code → visual.

---

## Snapshot 3 — 2026-04-16

### 109. `Avatar` component with `AvatarSize` variants

**Decision:** Extracted a reusable `Avatar` component (`src/components/Avatar.tsx`) with size variants `sm | md | lg | xl` driven by a `SIZE` record. Renders initials via `getInitials()` from `utils/strings`. Replaces four separate inline avatar implementations in `SendMoneyScreen` and `RecentCircle`.

**Why:** Single source of truth for avatar styling. Diameter, font size, and border all scale consistently from one record. Avoids drift between call sites.

### 110. `SecondaryButton` used for "Change" recipient action in send flow

**Decision:** The "Change" recipient button in `SendMoneyScreen` uses `SecondaryButton` with children (icon + label) rather than a raw `Pressable`. Pattern matches `+Wallet` and `+Add Card` actions elsewhere.

**Why:** Consistent button system — every secondary/tertiary action uses the same component. Avoids ad-hoc pressable styling that drifts over time.

### 111. Exchange card — unified single card with floating rate badge

**Decision:** "You send" and "They receive" are two sections of a single `Animated.View` card with `overflow: 'hidden'`. A floating `exchangeBadgeZone` with `marginVertical: -13` and `zIndex: 2` straddles the hairline divider. The rate pill is centered over the input area (not the full card width) via `paddingLeft: spacing.md + 80` so `alignItems: 'center'` references the right-side column only.

**Why:** One card communicates that send/receive are two sides of the same transaction rather than two independent fields. The floating badge makes the exchange rate feel like the bridge between the two amounts.

### 112. Receive field dark-text and zero-placeholder fixes

**Decision:** Receive `TextInput` value is forced to `''` when `receiveDisplayText` is `'0'` or `'0.00'`. Inactive style applied when `activeField !== 'receive' || parseFloat(receiveRaw) === 0` — ensures placeholder grey is shown when the field is active but empty.

**Why:** Without the `|| parseFloat(receiveRaw) === 0` guard, a focused-but-empty receive field would render dark text on the invisible `0` value, looking like a filled field.

### 113. Always-fresh refs pattern to prevent stale closures

**Decision:** `sendRawRef.current = sendRaw` and `receiveRawRef.current = receiveRaw` are assigned on every render before effects run. Focus handlers read from refs, not the closed-over state variable.

**Why:** `useCallback` with a deps array captures stale state. The always-fresh ref guarantees handlers read the current value without being added to every callback's dep array (which would cause excessive re-creation).

### 114. `receiveUserEditedRef` — distinguishes user-typed vs auto-computed receive values

**Decision:** `receiveUserEditedRef` is set `true` on any user keystroke or quick-chip selection in the receive field, and reset `false` whenever the receive value is auto-computed from the send field. `handleSendFocus` only back-computes `sendRaw` from `receiveRaw` if the ref is `true`.

**Why:** Without this guard, tabbing back to the send field would replace whatever the user typed with a reverse-computed value, even when they never edited the receive field. Quick-chip selection now also sets the ref so switching back from receive correctly updates the send amount.

### 115. Decimal formatting: `toFixed(2)` on blur only, never on field switch

**Decision:** `handleSendBlur` / `handleReceiveBlur` call `.toFixed(2)` on the raw string when focus is lost. Focus handlers do NOT add decimals. `sendDisplayText` uses `sendAmountNum.toFixed(2)` (not `String(parseFloat(...))`) to preserve trailing zeros in the inactive display.

**Why:** Adding decimals on field switch caused "26" → "26.00" unexpectedly mid-interaction. The user sees clean integers while typing and formatted decimals only after leaving a field.

### 116. Auto-focus send field on step entry via `useEffect`, not Reanimated callback

**Decision:** `useEffect` watching `step === 'amount'` fires a 300ms `setTimeout(() => sendInputRef.current?.focus())`. The earlier approach of calling `runOnJS` inside a `withTiming` animation completion was removed.

**Why:** Reanimated's Babel plugin serializes worklet closures. Inline arrow functions that capture React refs (like `sendInputRef`) cannot be serialized and crash the app. A `useEffect` runs on the JS thread after the render is committed — safe, no worklet involved.

### 117. `Keyboard.dismiss()` before navigation transitions

**Decision:** `handleReview` calls `Keyboard.dismiss()` before `openConfirm()`. The confirmation dismiss path also calls `Keyboard.dismiss()`.

**Why:** Without explicit dismiss, the keyboard stays up as the modal transitions to the confirm step, then abruptly drops — jarring. Dismissing first makes the transition feel intentional.

### 118. Section Pressable for full tap area on exchange card inputs

**Decision:** Each exchange section (`View`) was converted to a `Pressable` whose `onPress` calls `.focus()` on the relevant `TextInput` and immediately follows with `setTimeout(() => setNativeProps({ selection: { start: 999, end: 999 } }), 0)`.

**Why:** TextInput tap area is only the input element itself. Tapping the label row, padding, or gap near the rate badge did nothing. Wrapping the whole section makes the card feel like a contiguous tap target. The `setNativeProps` in `onPress` re-forces caret to end because the section Pressable fires *after* the TextInput's own touch handler and can reset the caret position.

### 119. Horizontal divider and badge zone absorb touches via `onStartShouldSetResponder`

**Decision:** The vertical `amountDivider` between the currency dropdown and the text input, and the `exchangeBadgeZone` (the rate pill row), both set `onStartShouldSetResponder={() => true}`.

**Why:** These views sit inside the section Pressable. Without consuming the touch themselves, taps on the divider or rate pill would bubble up and trigger the section's focus handler — visually confusing because nothing editable was tapped.

### 120. `DrumChip` slot-machine animation for quick amount chips

**Decision:** The quick amount chip row uses a `DrumChip` function component instead of inline `Pressable`. Each chip holds a single `flip` shared value (0 = rest, 0→1 = exit upward, −1→0 = enter from below) and an `activeProgress` shared value (0→1) for background/border/text colour via `interpolateColor`. Label swap deferred via `displayLabel` state + `runOnJS(setDisplayLabel)(nextLabel)` fired from the `withTiming` completion callback when text is invisible.

**Why separate flip value:** Two separate shared values (`translateY` + `textOpacity`) encoded one semantic concept (flip phase). A single `flip` value with `translateY = −flip × 10` and `opacity = 1 − |flip|` reduces shared value count from 3 to 2 and the animation setup from two `withTiming` calls to one.

**Why defer label swap:** React re-renders `DrumChip` with the new `label` prop synchronously before the animation runs. Without deferral, the new amount appears during the exit phase (wrong direction). `displayLabel` state is only updated inside the `withTiming` completion callback when `flip === 1` (text invisible), so the old label exits and the new label enters.

**Why `prevAnimKey` ref:** Distinguishes field-switch (flip + delayed colour change) from direct chip tap (immediate colour change, no flip) within a single `useEffect([animKey, isActive, label])`. Both `animKey` and `isActive` can change simultaneously on a field switch; merging into one effect prevents two competing animations.

### 121. Native iOS keyboard key layout is outside app control

**Decision:** No code change made to affect keyboard key padding/positioning. The iOS decimal-pad keyboard on iOS 16+ shows letters under digits and positions keys flush to screen edges — this is Apple's native layout, not app behaviour.

**Why:** `keyboardType`, `textAlign`, `returnKeyType`, and `KeyboardAvoidingView` props do not affect where iOS draws keyboard keys within its panel. Adjusting chip row padding to visually match the keyboard would be cosmetic only and was not pursued.

### 122. Utility modules: `strings.ts`, `color.ts`, `cardCategories.ts`

**Decision:** Three small utility modules extracted to `src/utils/`:
- `strings.ts` — `getInitials(name)`: returns up to two initials (first + last word). Used by `Avatar`.
- `color.ts` — `alpha(hex, opacity)`: converts a hex colour + opacity float to an `rgba()` string. Used by `BottomSheet` overlay.
- `cardCategories.ts` — `CATEGORY_META`: a `Record<CardCategory, { label, Icon, iconColor, bgColor }>` mapping every spending category to a Lucide icon and colour pair. Used by `CardTransactionRow` and `TransactionDetailScreen`.

**Why separate files:** Each utility has a single, clearly scoped responsibility. Keeping them out of component files prevents component files from becoming utility dumps and makes the helpers independently testable and reusable.

### 123. `CardTransactionRow` component — category icon + status chip

**Decision:** Card-specific transaction rows (`src/components/CardTransactionRow.tsx`) use a coloured square icon badge (from `CATEGORY_META`) instead of the generic arrow icon used by `TransactionRow`. Failed transactions show a `StatusChip` alongside the date. Merchant name, date/time, and amount all stay in the same layout slots as `TransactionRow`.

**Why separate component:** Card transactions have a category (groceries, fuel, streaming, etc.) that warrants a distinct visual treatment. Merging this into `TransactionRow` would add a conditional branch; a dedicated component keeps both clean.

### 124. `ViewPinSheet` — auto-hiding PIN reveal with countdown

**Decision:** `ViewPinSheet` renders the card PIN as individual digit boxes inside a `BottomSheet`. An interval-based countdown auto-closes the sheet after 15 seconds. The timer resets each time `visible` goes `true`.

**Why 15s auto-hide:** Long enough to be useful (user can read and memorise), short enough to limit exposure if the user forgets to close it. The countdown text makes the auto-close predictable rather than surprising.

### 125. `ConfirmSheet` additions: `secondary` flag and `hideCancelButton` prop

**Decision:** `ConfirmSheet` gains two new optional props:
- `secondary?: boolean` — renders the confirm action as a `SecondaryButton` instead of `PrimaryButton` (for neutral confirmations that aren't primary CTAs).
- `hideCancelButton?: boolean` — suppresses the flat cancel button for single-action informational sheets.

**Why:** Some confirmation flows (e.g. "Set as primary") have a non-destructive, non-primary confirm action. Using `PrimaryButton` overstates the urgency; `SecondaryButton` matches the visual weight. Hiding the cancel button is needed for sheets where the only action is "OK / dismiss."

### 126. `BottomSheet` pan gesture wrapped in `useMemo`

**Decision:** The `Gesture.Pan()` definition inside `BottomSheet` is wrapped in `useMemo` with `[onClose]` as the dependency.

**Why:** `Gesture.Pan()` creates a new gesture object on every render. Without memoisation, the `GestureDetector` tears down and recreates the gesture recogniser on every parent re-render, causing dropped swipes and flicker. `useMemo` ensures the gesture object is stable as long as `onClose` doesn't change.

### 127. Send-money error state: top row stable, bottom feeHint diagnostic

**Decision:** The "You send" label row is a *pure reference* — label and balance hint stay gray in all states, never turn red. Error diagnosis lives in the `feeHint` line below the card: when `!hasFunds`, the hint turns red and appends `· over by ${total − balance}` onto the existing `Fee · Total` string.

**Why:** Earlier iterations turned the label red, the hint red (swapping "Balance: X" for "Max X after fee"), the section background red, *and* the card border red — a disconnect emerged because "Balance" and "Max" felt like different concepts. Splitting responsibilities cleanly (top = "what you have," bottom = "what this transfer costs") eliminates the vocabulary swap. Amount input still turns red and the shake still fires — those are intrinsic to the wrong value itself, not the reference row.

### 128. Shake animation scoped to the amount `TextInput`, not the whole card

**Decision:** The `amountStyle` (shake translateX) is applied to an `Animated.View` wrapping just the send `TextInput`, not the `exchangeCard`. The card is a plain `View`.

**Why:** Shaking the entire exchange card felt heavy and visually overstated the error. Wrapping the input alone keeps the motion localised to "the number that's wrong." The wrapper uses `{ flex: 1, alignSelf: 'stretch' }` so the TextInput's `flex: 1` behaves the same inside the row.

### 129. Shake + error haptic fires on type, not just on Next press

**Decision:** A `useEffect` watching `[hasFunds, sendAmountNum]` with a `prevHasFundsRef` fires `shake()` and `Haptics.notificationAsync(Error)` the moment `hasFunds` transitions from `true` → `false` while `sendAmountNum > 0`. The existing `handleReview` shake is preserved for the Next-button case.

**Why:** Before, users could exceed their balance and receive no feedback until they hit Next. Firing on the transition (not on every keystroke) gives immediate feedback without spamming — one shake per time the user crosses the insufficient threshold.

### 130. Half-cent tolerance in `hasFunds` to absorb FX round-trip rounding

**Decision:** `hasFunds` is computed as `total <= sendWallet.balance + 0.005` rather than strict `<=`.

**Why:** When the user switches between send/receive fields, `handleSendFocus` / `handleReceiveFocus` recompute the other side via `(sendRaw * rate).toFixed(2)` or `(receiveRaw / rate).toFixed(2)`. `.toFixed()` rounds, which can nudge `sendAmountNum` above `maxSendable` by fractions of a cent, producing "over by $0.00" messages. The 0.005 tolerance absorbs anything that would display as $0.00 anyway (because `formatAmount` rounds to cents). Real insufficient-funds cases always exceed by full cents.

### 131. Max chip always anchors on send side

**Decision:** Tapping Max *always* sets `sendRaw = Math.floor(maxSendable * 100) / 100` and `receiveRaw = Math.floor(maxSendable * rate * 100) / 100` regardless of which field was active. `receiveUserEditedRef.current = false` is also set so subsequent focus changes don't recompute. The `activeField` is *not* changed, so focus stays where the user tapped.

**Why:** Previously, Max tapped on the receive side anchored on receive and produced a `sendAmountNum` ≈ 1¢ below Max tapped on send — because the round-trip through `rate` lost precision. Anchoring on send side always makes the debit numerically identical to `maxSendable`. Flooring both values (not rounding) guarantees `sendAmountNum ≤ maxSendable` even when active field is receive, so the 0.005 `hasFunds` tolerance isn't stressed. `Max`'s `isActive` check uses `sendAmountNum` (the derived source of truth), not `sendRaw`, so tapping a different preset later correctly deselects Max.

### 132. FX penny-diff convention: operator absorbs sub-cent discrepancy

**Decision:** No UI is added to disclose or reconcile sub-cent discrepancies between `sendAmount × rate` and `receiveAmount`. The debit equals `sendAmountNum` exactly; the recipient receives the displayed `receiveDisplayText` exactly. Any mathematical residue is implicitly covered by the spread baked into the quoted rate.

**Why:** This matches industry standard (Wise, Remitly, Ria, MoneyGram). Rates like 17.3456789 can't produce clean cent-pairs in both currencies; the operator's FX P&L absorbs the penny. Surfacing this to the user would be noise — no one cares about reconciling 0.3¢.

### 133. Empty-string state model for `sendRaw` / `receiveRaw`

**Decision:** `sendRaw` and `receiveRaw` use `''` as the "no value entered" state, not `'0'`. `sanitizeAmount` returns `''` for empty input (formerly `'0'`). `sendDisplayText` / `receiveDisplayText` fall back to `''`. The `TextInput` `value` prop is the raw display string directly — no `=== '0' ? ''` mapping. Focus handlers reset to `''` when no valid amount exists.

**Why:** The old `'0'`-as-empty sentinel required mapping `'0' → ''` in the `value` prop so the placeholder would show. That mapping caused a visible flash when the user actually typed `0`: native showed the typed `'0'` briefly, then React rendered `value=''`, and the character appeared to "go back to gray." Using `''` for empty removes the mapping — typed `'0'` stays as `'0'`, rendered as-is.

### 134. Dynamic `maxLength` blocks illegal keystrokes at the native layer

**Decision:** A `maxLengthFor(raw: string)` helper computes a per-keystroke `maxLength`:
- No decimal point: `11` (8 int + `.` + 2 dec) if int digits < 8, otherwise `raw.length + 3`.
- Has decimal point: `raw.length` if already 2 decimals, otherwise `raw.length + (2 − decLen)`.

Both `TextInput`s pass `maxLength={maxLengthFor(sendRaw)}` / `maxLength={maxLengthFor(receiveRaw)}`.

**Why:** Before, typing a 3rd decimal caused the native input to briefly show the rejected char before `sanitizeAmount` truncated it — because React bailed out of re-rendering (state same as previous sanitize result) and `setNativeProps` ran too late. Blocking at `maxLength` prevents the native input from accepting the char at all, so there's no flash. Safe because the existing "cursor always at end" behaviour means users only append chars.

### 135. Accept the 1-frame native-paint flash for in-place sanitization rejections

**Decision:** `handleSendChange` / `handleReceiveChange` call `setNativeProps({ text, selection })` unconditionally when `sanitized !== text`, before `setState`. No further native-layer work is done to eliminate the brief iOS `UITextField` render of rejected chars (e.g., lone `'0'` typed into an empty field that gets stripped by leading-zero logic).

**Why:** iOS's `UITextField` paints typed characters before the JS bridge fires `onChangeText` — an inherent ~16ms window that can't be closed from JS. Eliminating the flash entirely would require a native TextInput module or a custom keypad view — disproportionate effort for a single-frame paint. `setNativeProps({ text, selection })` clears the character as fast as JS allows; the residual flash is accepted as standard RN behaviour.

### 136. Unified header hierarchy — four tiers

**Decision:** All page and section headers conform to one of four tiers:

- **Tier 1 — Tab-root index titles (`xxl` / bold):** Left-aligned at `paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12`. Used on `AllCardsScreen` ("Cards") and `UnifiedActivityScreen` tab-mode ("Activity").
- **Tier 1b — Tab-root branded headers (primary text `xl` / bold):** Used on `WalletsScreen` (greeting-name pattern with an 11px eyebrow above) and `ProfileScreen` (avatar above, user-name below). The primary text is one step down from Tier 1 because the surrounding element — eyebrow or avatar — carries additional weight.
- **Tier 2 — Sub-screen nav titles (`md` / semibold):** Centered between a `ChevronLeft` back button and a 36px right spacer/action. Used on every pushed stack screen (`WalletCardListScreen`, `CardDetailScreen`, `TransactionDetailScreen`, `CurrencyPickerScreen`, `WalletReviewScreen`, the `AddCard*` flow, `SendMoneyScreen`, scoped `UnifiedActivityScreen`). `WalletSettingsScreen` is the one intentional exception — it's a modal with a compound icon + title + subtitle + X-close header, so it uses `md` / bold.
- **Tier 3 — Section eyebrow labels (`11px` / semibold / `textSecondary` / uppercase / `letterSpacing: 0.8`):** Every uppercase section or card-title label uses this single specification. `textSecondary` (zinc-500) was chosen over `textMuted` (zinc-400) — the lighter zinc-400 reads too faded against the white background at 11px. Applies across `WalletsScreen` (greeting eyebrow, Cards, Activity section labels), `ProfileScreen`, `WalletSettingsScreen`, `UnifiedActivityScreen` (month groups + filter sheet), `WalletCardListScreen`, `AddCardColorScreen`, `CardDetailScreen`, `TransactionDetailScreen` card titles, `SendSuccessScreen` card titles, and the `fieldLabel` / `protoTitle` labels across send flow.

**Why:** Before this pass, Cards used `xxl` bold but Activity used `md` bold (the same size as a sub-screen back-header), Wallets' greeting name was `md` while Profile's user name was `lg`, TransactionDetail's nav title was `base` (15) instead of `md` (17), and section eyebrows drifted across three different sizes (10 / 11 / `typography.xs`) and two letter-spacing values (0.8 / 1.1) and two colors (`textMuted` / `textSecondary`). The new hierarchy gives each role one canonical spec: the global-nav root reads at a glance, sub-screens feel consistent when pushed, and every eyebrow matches every other eyebrow.

### 137. Newest-first card ordering

**Decision:** `useCardStore.addCard` prepends (`[card, ...state.cards]`) so newly-added cards sit at index 0 in the shared `cards` array. All downstream views render in the same order: Wallets stack preview → newest on top, `AllCardsScreen` wallet-group preview → newest on top, `WalletCardListScreen` horizontal carousel → newest is the first page you see.

**Why:** The default fintech convention (Revolut, Wise, Monzo, N26) and the physical-wallet metaphor both put a newly-added card front-of-stack. Apple Wallet does the opposite (new cards go to the back), but Apple Wallet has a separate "default card" concept for Apple Pay that justifies that ordering — this app has no such abstraction, so the Apple convention doesn't carry. Prepending is also the one consistent rule that works across a stack preview AND a horizontal carousel: both surfaces show index 0 first, so "newest first" means one thing everywhere, and the "just-added" entrance animation targets index 0 on every screen without special-casing.

### 138. AddCardReview polish — entrance animation, Apple Wallet badge, and CTAs

**Decision:** The add-card success screen (`AddCardReviewScreen`) is restructured along three axes:

1. **Entrance animation:** Replaced the spring-bounce (`withSpring(1)` on scale) with a timing settle that matches `WalletCardListScreen`'s card-intro — `introProgress` from 1 → 0 over `withDelay(160, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }))`, with the card animating translateY 28 → 0 + scale 1.08 → 1, and the text + Apple Wallet badge sliding the same 28px so they arrive together.
2. **CTAs:** "Done" is replaced by a two-button footer — `PrimaryButton` labelled "View card details" that resets nav to `Main → WalletCardList → CardDetail` (so back from details lands naturally on the wallet's card list), plus a secondary `FlatButton` labelled "Done" that jumps to the Wallets tab and pops to the tabs root.
3. **Apple Wallet badge placement:** Sits inside `textWrap` directly under the "is ready to use" line (with `marginTop: spacing.xl`), so it moves with the card+text group during entrance. It is NOT a third footer button.

**Why:** The spring bounce read as amateurish compared to the rest of the app's motion language — the card already uses a smooth settle on `WalletCardListScreen`, so success should feel like the same motion continuing. The CTA split reflects the two real user intents after seeing "Card added!": (a) inspect the card in full detail, or (b) get back to the wallet. A single generic "Done" button forced the user to navigate manually to see the new card. Placing the Apple Wallet badge with the text (not in the footer) keeps the footer reserved for app-level actions and lets the badge inherit the entrance slide.

### 139. Official Apple Wallet badge via `react-native-svg-transformer`

**Decision:** Added `react-native-svg-transformer` as a dev dep, a `metro.config.js` that registers it, and a root `declarations.d.ts` that types `*.svg` imports. Apple's official badge (`assets/US-UK_Add_to_Apple_Wallet_RGB_101421.svg`) is imported as a React component and rendered via `<AppleWalletBadge width={…} height={48} />`. Android falls back to `assets/enUS_add_to_google_wallet_add-wallet-badge.png` rendered through `<Image>`. Widths derive from each asset's native aspect ratio — 110.739:35.016 for Apple, 199:55 for Google — with a shared 48pt height. The badge artwork is rendered unmodified, per Apple's guidelines.

**Why:** In Expo Go the native `PKAddPassButton` isn't available (requires a custom dev client + PassKit native module), so the official brand artwork is the closest we can get to the real thing. A hand-rebuilt recreation (custom "Add to / Apple Wallet" stacked text with an SVG Apple logo) drifted noticeably from the real badge and violates Apple's "do not alter the artwork" rule. SVG-as-component via the Metro transformer is the standard Expo way to consume vector assets — imported SVG renders crisp at any scale, handles embedded `<style>` + CSS classes (which raw `SvgXml` does not), and keeps the asset as an editable file rather than a blob of XML pasted into source.

### 140. Programmatic tab switching via `useTabStore`

**Decision:** The custom 4-tab navigator in `RootNavigator` previously kept `activeIdx` in local component state. Lifted that into a zustand store at `src/stores/useTabStore.ts` (`activeTabIdx` + `setActiveTabIdx`). `TabNavigator` reads from the store and drives its existing Reanimated slide via a `useEffect` that watches the store value and runs `tabX.value = withTiming(-idx * SCREEN_WIDTH, …)`. Tab taps still route through `goToTab`, which now just calls `setActiveTabIdx`.

**Why:** Several flows need to switch tabs from a non-tab screen (e.g. `AddCardReviewScreen`'s Done button wants to land the user on the Wallets tab regardless of which tab they entered from). The custom tab navigator here doesn't use React Navigation's tab API — all four tabs are rendered side-by-side in a Reanimated row — so `navigation.navigate('Main', { screen: 'Wallets' })` has nothing to attach to. A module-level store is the simplest mechanism any screen can read/write without prop drilling or context wiring. The slide animation stays in `TabNavigator` because the Reanimated shared value needs to live beside the row it animates.

### 141. Land-in animation for newly-added cards on Wallets

**Decision:** When a card is added, `AddCardReviewScreen`'s Done button (a) calls `setActiveTabIdx(0)` to switch to the Wallets tab, (b) calls `markJustAdded(cardId)` to set `justAddedCardId` in the card store, then (c) calls `popToTop()`. `WalletsScreen` watches `justAddedCardId` via a `useEffect`:

1. Vertically scroll the outer `ScrollView` to the card section (`scrollTo({ y: cardSectionY.current − 24 })`, captured via `onLayout`) so the stack is in view.
2. Horizontally scroll the wallet carousel (`flatListRef.current?.scrollToOffset({ offset: idx * W, animated: true })`) to the wallet owning the new card if different from `currentIndex`.
3. Pass `playEntrance={true}` and `onEntranceComplete={clearJustAddedCardId}` to the `AnimatedCardStack` for that wallet.

Inside `AnimatedCardStack`, a new `entranceProgress` shared value starts at 1, then `withDelay(420, withTiming(0, { duration: 540, easing: Easing.out(Easing.cubic) }))` eases it to 0. Slot 0's existing `useAnimatedStyle` folds the entrance into its transform: `translateY -= ev * 40`, `scale *= (1 + ev * 0.06)`. On finish, the completion callback runs `clearJustAddedCardId` via `runOnJS`.

**Crucially, `justAddedCardId` is set by the Done handler, not by `addCard`.** `addCard` is called in `AddCardColorScreen` several seconds before the user reaches Done — if that action set the signal, the `useEffect` in `AnimatedCardStack` would fire during the add-card flow (while Wallets is hidden behind the stack), the delay + settle would run to completion unseen, and by the time the user arrived at Wallets the animation would be over. Setting the signal at Done ensures it fires when the user is about to see the result.

**Why:** Without this, tapping Done dropped the user onto Wallets with zero feedback about where the new card went — especially disorienting if it belonged to a wallet other than the one currently in view. The land-in pattern (appear lifted, hold, settle) communicates both arrival and placement: the hold gives the eye time to lock onto the card, and the settle demonstrates where it rests. The 420ms delay is tuned to cover the native stack-pop transition (~300ms) plus the horizontal carousel scroll (~350ms) — so the visible settle begins after everything else has stopped moving. Newest-first ordering (#137) means slot 0 is always the entrance target, so the animation needs no special case for which slot the new card landed in. `onEntranceComplete → clearJustAddedCardId` guarantees the animation is one-shot; re-entering Wallets later doesn't replay it.

### 142. AppLockGate redesign + shadowed-import bug fix

**Decision:** Three changes to `src/components/AppLockGate.tsx`:

1. **Bug fix — shadowed `authenticate` import.** The component imported `authenticate` from `../utils/auth` and then declared `const authenticate = useCallback(async () => { … await authenticate(…) … })`. Inside the closure, `await authenticate(...)` resolved to the local `const`, not the import — an infinite recursive promise chain that hung silently, so the unlock button (and the auto-prompt effect) did nothing visible. Fixed by aliasing the import as `runAuth` and renaming the local handler to `handleUnlock`.
2. **Replaced raw `Pressable` with `PrimaryButton`.** The previous unlock button was a hand-rolled `Pressable` with `backgroundColor: colors.brand` and `color: '#fff'` text — violated both the "always use existing button components" rule and the "never white text on brand orange — use #441306" rule. Now uses `PrimaryButton` with children-mode (icon + text row), so it inherits the gradient, inset edges, pressed-scale, disabled state, and the correct dark-brown label colour.
3. **Screen redesign.** The "CM" avatar + name + lock-row + button-in-the-middle layout is replaced with a focused unlock flow: a hero glyph (the `ScanFace` / `Fingerprint` / `Lock` icon for the active method, sized 56 inside a brandSubtle 132pt ring with a white 100pt inner disc) → `xl`/bold "Welcome back, Carlos" headline → `base` subtitle in `textSecondary` ("Use Face ID to unlock Ria Wallet" / red `failed` colour with retry copy on error) → tiny "Session locked" badge → footer-pinned `PrimaryButton` with the auth icon next to its label. A `busy` flag guards against double-tapping while the Alert is open.

**Why:** The bug had to be fixed regardless — the screen was non-functional. Once the button worked, the rest was visible: the avatar duplicated identity the user already knows, the centered button had no visual anchor, the `Pressable`/white-text combo was inconsistent with every other CTA in the app, and the error message ("Authentication failed — try again.") didn't tell the user *what* to do. The redesign makes the screen task-focused (one obvious action, one icon that matches what the OS will show, copy that adapts to error state) and the `PrimaryButton` swap restores parity with `WalletSuccessScreen` / `SendErrorScreen` / every other terminal-action footer in the app. Method copy is keyed off `authMethod` (`faceId` / `touchId` / `passcode`) so the icon and verb stay in sync if the demo ever switches biometric type — currently always `faceId` per the existing mock-stub policy.

### 143. AppLockGate — lock on `active`→`inactive`, not `background`→`active`

**Decision:** The `AppState` listener now sets `locked = true` the moment the app leaves the foreground (`prev === 'active' && next !== 'active'`) instead of waiting for the `background → active` transition. A `wentBackgroundRef` distinguishes a true app-switch from a brief `inactive` (notification / control center pull-down): on return to `active`, biometric prompt fires only if `wentBackgroundRef.current === true`; otherwise the overlay auto-dismisses with no auth. The standalone `useEffect(() => { if (locked) handleUnlock() }, [locked])` is removed (the AppState handler now triggers the prompt directly), and `handleUnlock` is mirrored into a `handleUnlockRef` so the AppState `useEffect` stays subscribed to `[appLockEnabled]` only — the listener doesn't tear down/re-add every render when `busy` flips inside the callback.

**Why:** Locking on `background → active` runs *after* React has already painted one frame of the underlying screen, producing a visible flash of the previous content before the lock overlay mounts. Mounting the overlay on `active → inactive` instead means the overlay is already present when the snapshot is taken (covering the App Switcher screenshot — a real privacy benefit) and is already mounted when the app returns to active, so there's nothing to flash. The `wentBackgroundRef` exists because iOS fires `inactive` for *both* directions of the state machine: `active → inactive → background` on the way out and `background → inactive → active` on the way back. Without the ref, a notification-center pull-down would lock the app, then the return-to-active would auto-dismiss it as if nothing happened, BUT a real app-switch return would also pass through `inactive → active` and would also be auto-dismissed — defeating the lock entirely. Flagging on entry to `background` lets the active-return handler tell the two cases apart.

---

## Snapshot 4 — 2026-04-16
*Covers: Flat settings pattern across settings-type screens*

### 144. Flat settings pattern — drop gray-container groupings for edge-to-edge section dividers

**Decision:** Settings-type screens replace the previous grouped gray container (rows inside a `backgroundColor: colors.surface` + `borderRadius: radius.lg` + `borderWidth: 1` + `borderColor: colors.border` card) with a flat recipe built from three rules:

1. **Section wrapper carries horizontal padding + edge-to-edge bottom hairline.** `styles.section` is `{ paddingHorizontal: 24, paddingBottom: spacing.lg, marginBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }`. `styles.sectionLast` zeros the border and extends `marginBottom` to `spacing.xxxl`. The ScrollView's `contentContainerStyle` has **no** horizontal padding — it lives on the section so the bottom hairline reaches both screen edges. This matches `WalletsScreen`'s existing pattern for its top/bottom header and footer hairlines.
2. **Rows have no internal `paddingHorizontal`.** They inherit 24px from the section wrapper, so section label, row icon, and row value share the same left edge. Row `paddingVertical` is standardised at `spacing.lg` (16px). Icon column is a fixed 22px wrap with `spacing.md` (12) gap, so labels always start at 34px regardless of row type. Icons unified at 17px / `colors.textSecondary`.
3. **Inter-row dividers span the full section width.** Row components render as Fragments — `<>Pressable + {!last && <View style={styles.rowDivider} />}</>` — with `rowDivider: { height: 1, backgroundColor: colors.borderSubtle }`. The divider runs under the icon column edge-to-edge within the section's 24px gutter; the row's previous `borderBottomWidth` is removed entirely.

Applied to: `CardDetailScreen` (Card settings, Spending limits, Card info, Danger zone — 4 sections; InfoRow gets a `infoIconWrap` matching settingsRowIcon), `ProfileScreen` (Wallets, Preferences, Security, Support — 4 sections; both `Row` and `WalletRow` converted to Fragment-with-divider), `WalletSettingsScreen` (Wallet name, Accent color, Wallet options — 3 sections; the palette-header inner divider is removed since the grid below provides its own visual weight), `TransactionDetailScreen` (Details, Transfer status — 2 sections; scroll loses its `paddingHorizontal`, hero + `refundBanner` gain their own — refundBanner via `marginHorizontal: 24` since it's a contained notice element, not a settings group).

**Why gray containers were removed:** Stacking a `#f4f4f5` card on top of the white surface added a visual container that competed with the content it held. On a phone screen every grouping cue fights for attention; a labelled section with a hairline beneath it is already legible without the background doing double duty. Removing the container also removes the nested-corner appearance where an inner row with its own padding sat inside an outer border with its own `radius.lg` — a stack of three concentric rectangles for every row.

**Why section padding moved from ScrollView to the section wrapper:** If `paddingHorizontal` stays on `contentContainerStyle`, any bottom border on a child renders inset from the screen edges by that padding. `WalletsScreen` already demonstrated the fix — put horizontal padding on each direct child individually, and full-width rules are free. Adopting the same pattern keeps "section boundary = edge-to-edge hairline" consistent across every settings-adjacent screen.

**Why all dividers run edge-to-edge:** An earlier version of this rule inset intra-section dividers past the icon column to let the left icon "run" read as a visual thread. In practice the indent added fussy hairline stubs that competed with the section's bottom border instead of reinforcing it, and it misaligned the moment a row used a differently-sized leading element (the profile wallet row's flag is 27px wide, not 22). Collapsing to a single edge-to-edge rule everywhere — intra- and inter-section — is cleaner, matches modern iOS list styling, and removes the coupling between divider inset and icon-column width. Grouping is carried by the section label, the bottom hairline, and the `marginBottom: spacing.lg` gap; the intra-section rule is now a pure separator without decorative indent.

**Why icon sizing unified at 17px:** Previously `InfoRow` used 14px/`textMuted` icons while `SettingsRow` used 17px/`textSecondary`. Inside a gray container the size difference was absorbed by the card framing; once the container was removed, the mismatch stood out and the smaller icons looked accidentally faded. Unifying to 17px / `textSecondary` in a 22px column with `spacing.md` gap means every row on every settings screen has the same label start position and the same icon weight.

### 145. Frame-drop mitigations for the land-in animation

**Decision:** The land-in settle (#141) on `WalletsScreen` drops visible frames when it overlaps with other work, so three compounding mitigations are applied:

1. **Snap, don't animate, the supporting scrolls.** Both the vertical `ScrollView.scrollTo({ y })` (bringing the card section into view) and the horizontal `FlatList.scrollToOffset({ offset })` (moving to the target wallet's page) are called with `animated: false`. `scrollX.value` is then set directly to `idx * W` so the Reanimated stacks see the new position immediately. The snap happens while `AddCardReview`'s stack-pop transition is still playing, so the user never sees the jump — but the JS thread avoids 350ms of `onScroll` events firing `handleScrollJS` → state-update → re-render at 60Hz.
2. **Memoize `AnimatedCardStack` with stable props.** `AnimatedCardStack` is wrapped in `React.memo`. The parent's `justAddedCardId` effect fires both the scroll snap AND `setCurrentIndex`/`setActiveWallet` — which triggers a *second* render cycle after the child's `useEffect` has already started the entrance. To stop that second render from rebuilding `useAnimatedStyle` closures mid-animation, every prop is reference-stable: `cards` comes from a `useMemo`'d `cardsByWalletId` map keyed on `[wallets, cards]`, `onPress` (`handleCards`) reads the active wallet via an `activeRef` instead of listing `active` in its `useCallback` deps, and a module-level `EMPTY_CARDS: Card[] = []` is used as the no-cards fallback so wallets with zero cards don't allocate a fresh `[]` per render. With stable props, `React.memo` short-circuits the second render and Reanimated doesn't rebind worklets mid-settle.
3. **Defer the withTiming via `InteractionManager.runAfterInteractions`.** Setting `entranceProgress = 1` (the lift) fires immediately so the card is visible at its start position during the stack pop, but the settle's `withTiming(0, …)` is wrapped in `InteractionManager.runAfterInteractions(() => { … })` with a cleanup that cancels the task on unmount. RN registers the native-stack pop as an "interaction," so the settle only begins once it completes — the withTiming has the UI thread largely to itself and doesn't lose frames to the transition.

**Why:** The land-in settle runs concurrently with up to three other animated systems — the native stack pop, the `useTabStore`-driven tab slide, and FlipBalance's per-digit drum (`BalanceDrumChar` × ~15, each with its own `withTiming`) — plus JS-thread work from `setCurrentIndex`/`setActiveWallet` triggering re-renders. Individually each is cheap; together they oversubscribe the UI thread and produce visible hitches on a 540ms settle. Each mitigation targets a different bottleneck: (1) cuts JS-thread scroll-event chatter, (2) stops React's second-render cycle from invalidating Reanimated worklet closures, (3) lets the native pop finish before the settle starts. The one remaining known source of contention is the balance drum when the new card belongs to a non-current wallet (`setCurrentIndex` triggers `real` prop changes that spin up ~15 concurrent `withTiming`s) — that's out of scope here and would need a `skipAnimation` prop plumbed through `FlipBalance`/`BalanceDrumChar` if it becomes necessary.

**What stays boxed:** `refundBanner` in `TransactionDetailScreen` keeps its `borderRadius` + tinted background because it is a notice element, not a settings group — its purpose is to visually interrupt the flow with a warning, which requires a contained shape. It just gains `marginHorizontal: 24` to replace the padding it used to inherit from the ScrollView. Similarly, transaction summary cards in `SendMoneyScreen`, `SendSuccessScreen`, and `ConfirmationScreen` keep their card treatment — they're single summary artefacts, not repeated settings rows.

---

## Snapshot 5 — 2026-04-16
*Covers: transaction view systematization across SendSuccess and TransactionDetail*

### 145. Systematized transaction view — shared sections across SendSuccess and TransactionDetail

**Decision:** `SendSuccessScreen` and `TransactionDetailScreen` now share one set of section primitives (`src/components/TransactionView.tsx`):

- `StatusBadge` — unified status pill, variants `completed` / `pending` / `failed` / `inProgress` (the last exclusive to the post-send ETA-driven state).
- `RefCopyRow` — reference pill with inline copy affordance; lives on both screens now (detail screen previously had no copy).
- `TxSummaryCard` — P2P breakdown (You sent / Transfer fee / Total deducted / X receives + rate footnote). Stays **boxed** per decision 144's "single summary artefact" carve-out.
- `TxDetailsList` — flat rows (date, wallet, card, category, note, reason) with inset hairlines, following decision 144's flat recipe.
- `TxTimeline` — the 3-step transfer progression, shown only when `shouldShowTimeline(tx)` returns true.

`shouldShowTimeline(tx) = !isCardTx(tx) && !isIncoming(tx)`. The timeline is hidden for card transactions (instantaneous authorization, not a multi-step transfer) and for incoming P2P (we never observed the sender's end of the flow, so "Transfer initiated → Processing → you received" reads hollow). Outgoing P2P is the only variant where the journey is meaningful.

**Data model change:** `Transaction` gains five optional P2P-only fields — `fee`, `rate`, `receivedAmount`, `receiveCurrency`, `eta` — persisted at send time by both `ConfirmationScreen` and `SendMoneyScreen`'s inline confirm step. The detail screen now has the data it needs to render the same summary card that `ConfirmationScreen` shows pre-send. Mock/legacy transactions without these fields skip the summary gracefully (the card's null guard returns `null` when any of fee/receivedAmount/receiveCurrency are absent).

**`SendSuccess` param simplified to `{ txId }`:** previously seven ad-hoc fields (recipientName, amount, currency, receivedAmount, receiveCurrency, eta, txRef). Now one. Both the standalone screen and the background layer in `SendMoneyScreen` read the transaction from the wallet store via the id. Single source of truth — no duplication between the navigation param and the persisted transaction.

**Ref format unified:** `RIA-XXXXXX` is generated once at send time, stored on `tx.ref`, and displayed identically by both screens. Legacy/mock transactions without a ref fall back to `RIA-<last 6 digits of id>` via `getTxRef(tx)` so the detail screen never shows an empty pill.

**Hero variants:** the hero on each screen diverges intentionally — `SendSuccess` celebrates the received amount in recipient currency (the "what your friend gets" narrative), while `TransactionDetail` shows the signed amount in wallet currency (the historical debit/credit narrative). Everything below the hero is identical.

**Hero avatar is variant-aware:** card transactions render the category icon (from `CATEGORY_META`) inside the circular avatar instead of the P2P direction arrow. The underlying `heroAvatar` style is shared; only the inner content differs.

**Why not reuse `isP2P`/`isCard` checks inline:** the timeline, the summary card, and the hero avatar each need to reason about the same variant split. Centralising the predicates (`isCardTx`, `isIncoming`, `shouldShowTimeline`) in `TransactionView.tsx` means a single place owns the matrix of (card × p2p) × (in × out) × (completed × pending × failed). Callers read intent, not a cascade of boolean checks.

**Why "X receives" green was removed:** the previous SendSuccess summary tinted the received-amount row green (`colors.success`). Green on a value isn't a status signal — it's a semantic claim that "received = good". The status pill already carries that meaning; duplicating it on the value reads as if the number itself is in a success state, which is noisy when stacked next to a neutral "You sent" row. Neutral `textPrimary` on both rows keeps the breakdown symmetrical, and the rate footnote underneath carries the cross-currency meaning without colour.

### 146. Get-help is available on every transaction, not just failed

**Decision:** The sticky footer on `TransactionDetailScreen` is no longer gated on `tx.status === 'failed'`. It renders on every transaction with the label **"Get help with this transaction"** (previously "Contact support", previously only on failed). The `refundBanner` copy on failed transactions now says "…use the button below to get help" to match.

`SendSuccessScreen` gains a third "Get help" text action in the Share receipt / Send again secondary row (three-way split).

**Why:** a user who wants support doesn't necessarily have a failed transaction — they may be disputing a completed charge, chasing a pending transfer, or questioning a category. Gating the CTA on failure makes it undiscoverable exactly when the user is already frustrated enough to dig. Making it always-available on the detail screen also simplifies the `ScrollView` `paddingBottom` calculation — it now unconditionally reserves space for the sticky footer (`80 + insets.bottom + spacing.lg`) instead of branching on status.

**Why the new label:** "Contact support" is a generic CTA that could belong on any screen. "Get help with this transaction" is scoped — the user arrives at support with the txId already in hand, which should prefill the support thread downstream. The label advertises that scoping, so the user knows they don't have to re-state what they're asking about.

### 147. TransactionDetail spacing — restored rhythm after decision 144 conversion

**Decision:** `TransactionDetailScreen` section padding and section-label margins are increased from `spacing.lg` (16) to `spacing.xl` (24) between sections, and `spacing.xs` (4) to `spacing.sm` (8) under section labels. Hero uses `paddingTop: spacing.md` + `paddingBottom: spacing.xl` instead of symmetric `spacing.xl` padding; the ref pill gains `marginTop: spacing.md` so it sits one beat away from the status badge instead of hugging it.

**Why:** the flat-settings conversion in decision 144 removed the visual weight of gray containers without compensating the surrounding whitespace. With the containers gone, the same margins that felt balanced inside a boxed layout read as cramped on open ground — sections and their labels ran into each other. Bumping vertical rhythm by one step restores the legibility the boxed layout had for free.

**Why asymmetric hero padding:** a symmetric `paddingVertical: spacing.xl` put 24px above the avatar, which duplicated the visual weight of the navbar sitting just above. Dropping the top padding to `spacing.md` while keeping `spacing.xl` at the bottom pulls the hero closer to the navbar (where it belongs — they're both "this screen is about this transaction") and preserves the breathing room above the first section.

### 148. Spending limits visual reinforcement on WalletCardListScreen

**Decision:** `WalletCardListScreen` renders a `Spending limits` section between the quick-actions row and the Activity list for the *active* card in the carousel. The section only appears when the card has at least one `spendingLimits` period configured — cards with no limits set stay clean and don't show an empty block. For each configured period (`daily` / `weekly` / `monthly`), a row shows the period label, `currency X of Y` spend amount, a thin progress bar, and a sub-line with either `Z remaining` or `Z over limit`. The section's top-right affordance is an `Edit  →` FlatButton styled identically to the `N cards  →` label on AllCardsScreen (`typography.sm` semibold brand orange, trailing arrow) — familiar affordance, no icon needed.

**Why:** limits set in `CardDetailScreen`'s settings were previously invisible everywhere else. A user who sets a $100 daily cap gets no feedback on "am I near it?" unless they navigate back into settings. The carousel is where the user spends time with their card day-to-day, so surfacing usage there closes the loop between setting the limit and acting on it. Only showing the section when limits exist keeps the screen uncluttered for cards that don't need that signal (e.g. a dedicated subscriptions card where the single recurring charge is the whole story).

**Why calendar-based periods (not rolling 24h / 7d / 30d):** users read their own spending through a calendar lens — "how much did I spend today?", "what's my week looking like?". Rolling windows are how the card network enforces limits internally, but a rolling 24-hour window means a Friday-night-dinner purchase keeps counting against "today" until Saturday night, which doesn't match how the user thinks about their day. Daily = since midnight, weekly = since Monday 00:00, monthly = since the 1st at 00:00. Computed client-side from the card's debit transactions on each render.

**Why uniform brand-orange fills (no heatmap):** the first pass coloured the fill by utilisation — brand orange under 80%, amber at 80–99%, red at 100%+. Pulled back to uniform brand orange after the design read: the card carousel is already a colourful, branded surface, and stacking three bars that shift colour as thresholds cross introduces noise that competes with the card itself. The "X over limit" sub-line still surfaces overage explicitly in text form, so the information is present without the colour semaphore. Amber/red for genuinely alarming states (failed transactions, errors) stays reserved for those cases so the semantics don't dilute.

**Why `Edit  →` matches `N cards  →`:** there's already an established "drill-in affordance" pattern in the app — small brand-orange text with a trailing arrow, no icon. Reusing that shape here ties the interaction vocabulary together (both are "tap this text to open a deeper view"), and avoids inventing a third style for what's functionally the same affordance.

### 149. Deep-link scroll pattern — route param + `onLayout`-measured Y + delayed `scrollTo`

**Decision:** When one screen needs to open another and land the user on a specific section (rather than the top), the pattern is:
1. Extend the destination screen's route params with a discriminator (e.g. `CardDetail` gained `scrollTo?: 'limits'`).
2. Capture the target section's Y offset via `onLayout` on the section wrapper, stored in local state.
3. In a `useEffect` keyed on `[scrollTo, sectionY]`, when both the param is set and the Y is known, schedule `scrollRef.current?.scrollTo({ y, animated: true })` with a `setTimeout` delay of ~280ms — roughly the length of the native-stack push transition.
4. Gate the effect behind a `useRef<boolean>` "already scrolled" flag so the scroll is one-shot. If the user manually scrolls back up after landing, the effect won't re-fire.

Applied on `CardDetailScreen` for the `Edit limits` affordance on WalletCardListScreen, which navigates with `{ cardId, scrollTo: 'limits' }`.

**Why the delay:** running `scrollTo` during the push transition produces a jerky double-motion — the screen is still sliding in from the right when the scroll animation starts, so the content appears to jump. Waiting until after the transition settles (280ms covers the default native-stack slide) means the scroll plays as its own discrete motion, and the user sees a clear "page arrived → now scrolling to your spot" sequence.

**Why `onLayout` rather than a fixed offset:** the Spending section's position depends on how many rows appear above it (the Card settings section height varies with toggles, the card face height is fixed but the action row below it isn't). Measuring at layout time is robust to future reordering or new rows added above the target section — no magic constants to update later.

**Why a ref guard:** without the one-shot flag, any state change that re-triggers the `useEffect`'s deps (e.g. if the section re-lays out for any reason, `sectionY` could change) would re-scroll. That would feel like the screen is fighting the user. Setting `hasScrolledToLimits.current = true` on the first fire makes the scroll a navigation-time event, not a layout-time event.

**Trade-off:** the param is typed as the literal `'limits'` rather than a generic `string`, so adding a second scroll target (e.g. `scrollTo: 'danger-zone'`) requires both a type change and a matching Y-capture wired up in the screen. That's fine — forcing the explicit shape catches typos and keeps unused scroll targets out of the param type.

---

## Snapshot 6 — 2026-04-16
*Covers: transaction row colouring — semantic direction over wallet theme, failed goes gray, groceries off green*

### 150. P2P transaction rows use semantic direction colours, not wallet theme

**Decision:** `TransactionRow` (the P2P row used by `ActivityItem` and rendered on `WalletsScreen` + `UnifiedActivityScreen`) no longer tints its icon box from the wallet accent. The icon colour + alpha-0.12 background are now driven by direction:

- **Incoming, not failed** → `colors.success` (`#16a34a`) on a 12% success tint
- **Outgoing, not failed** → `colors.failed` (`#dc2626`) on a 12% failed tint
- **Failed (either direction)** → `colors.textMuted` (`#a1a1aa`) on `colors.surfaceHigh` (`#e4e4e7`)

The `accentColor` prop was dropped from `TransactionRow` entirely, and the `walletAccent` plumbing in `ActivityItem` (plus the now-unused `wallets` prop it needed) was deleted so callers on `WalletsScreen` and `UnifiedActivityScreen` no longer thread a wallet list through for colour lookup. `CardTransactionRow` keeps its category-driven tinting (see #151 for the category side) but its failed state now also falls back to the same gray pair (`surfaceHigh` box, `textMuted` icon) instead of `failedSubtle`/`failed` — a red category box was reading as "outgoing" rather than "failed".

**Why semantic over theme:** the wallet accent already shows up on the balance card face, the wallet stack gradient, the section header pill, and the filter chips on UnifiedActivityScreen. Repeating it on every transaction row's icon square added a fifth instance that did no new work — and actively misled, because the same arrow-down-left glyph appeared in teal for a GTQ wallet and blue for a USD wallet, making "incoming" read differently across wallets. Tying direction to colour (green/red) makes the status-at-a-glance scan match the amount column's `+`/`−` sign immediately, with no wallet context needed.

**Why failed is gray, not red:** with outgoing now rendered in red, a red-on-pink-subtle failed row looked identical to a regular debit at a quick scan — both pull the eye the same way. Dropping failed to the neutral gray pair puts failed rows visually *behind* active ones, which is correct: a failed transaction is a closed, non-actionable event, and the row's existing `StatusChip` (plus `textMuted` on the recipient name) already handles the "this needs your attention" signal where needed. The gray icon says "this row is over" without competing for the same attention as a live outgoing debit.

**Why alpha-0.12 tints on the box:** using `colors.successSubtle` (`#dcfce7`) and `colors.failedSubtle` (`#fee2e2`) directly was the first pass, but `failedSubtle` read pinker than the rest of the app's surface tones on a phone screen. `alpha(colors.success, 0.12)` and `alpha(colors.failed, 0.12)` render as desaturated green/red tints that share the same lightness and sit more comfortably next to `surfaceHigh` (the failed box) and the category-coloured boxes on `CardTransactionRow`. Consistent box luminance across all three states (incoming/outgoing/failed) keeps the icon column reading as one visual rail instead of three competing chip colours.

### 151. Categories stay off semantic green/red to avoid colliding with direction

**Decision:** `CATEGORY_META.groceries` swapped from green (`#16a34a` on `#dcfce7`) to teal (`#0d9488` on `#ccfbf1`). The remaining categories already avoid both semantic red (`#dc2626`) and semantic green (`#16a34a`), so only groceries needed moving. Future category additions must not use those two hues.

**Why:** after decision 150, green on a transaction-adjacent surface means "incoming". A grocery run rendered with a green ShoppingCart on `CardTransactionRow` sat one row away from a P2P incoming transaction rendered with a green ArrowDownLeft on `TransactionRow`, and the two icon boxes were indistinguishable at a glance — the user had to read the icon *shape* rather than the colour to tell apart "money came in" from "you bought groceries". Since the categories are rendering on the same `UnifiedActivityScreen` list as P2P rows (card and P2P transactions interleave by date), the collision was real, not theoretical.

**Why teal specifically:** teal (`#0d9488`) sits on the cyan side of green, keeping enough warmth that a grocery icon still reads as "fresh/food" without stepping on semantic green. Alternatives considered — yellow-gold (`#ca8a04`) clashed with fuel's `#d97706` amber when the two rows sat adjacent; rose/pink (`#be185d`) sat too close to semantic red and reintroduced the outgoing-vs-category confusion on the other side; violet (`#7c3aed`) collided with streaming's `#9333ea` purple. Teal was the only hue that was both distinct from every other category and at least two steps removed from both semantic colours. The user called out that teal still reads as green-adjacent; accepted as a known trade-off — every in-palette alternative collided worse.

**Rule for future categories:** semantic red and semantic green are reserved for direction/status. Categories may use any other hue, but the brand-orange family (`#f97316`, `#ea580c`, `#fb923c`) is also reserved so a category icon doesn't get mistaken for a brand affordance. The practical safe-zone for new categories: teal/cyan, blue/sky/indigo, purple/violet/pink (distinct from streaming and music), amber/yellow (distinct from fuel), brown, slate. Check `cardCategories.ts` before picking — two categories sharing a hue is fine if their labels disambiguate, but two categories with identical `iconColor` + `bgColor` pairs will read as a bug.

---

## Snapshot 7 — 2026-04-16
*Covers: activity filter architecture — chip-per-filter pickers, Apply-batching, semantic pruning for Received direction*

### 152. Activity filter architecture — one chip per filter, each opens a dedicated picker

**Decision:** The filter UI on `UnifiedActivityScreen` is rebuilt from a single "filter button → monolithic sheet" into a horizontal row of chips, one per filter category (`Wallet`, `Type`, `Date`, `Status`, `Category`, `Cards`, plus a terminal `Clear` action). Each chip opens its own dedicated `BottomSheet` picker. The chip label is self-documenting — it names the filter when inactive ("Date", "Cards") and reflects the committed value when active ("Last 7 days", "2 cards", wallet nickname + flag). A trailing `ChevronDown` on every filter chip signals that it opens a picker; the `Clear` action chip uses `X` without a chevron because it's terminal, not a dropdown.

The old surfaces — search-row filter button with count badge, active-pill row, dedicated wallet-radio row, dedicated card-chip row — are all removed. One row, one vocabulary, no hidden filters behind a `SlidersHorizontal` icon.

**Apply-batching:** each picker owns local draft state, synced from the parent every time the picker opens. Chip taps mutate the draft only. `Apply filters` flushes to the parent (one state commit → one list re-filter). Swipe/backdrop dismiss discards the draft. `Reset` inside a picker commits an empty state immediately, keeping the sheet open — the user sees pickers clear behind the sheet without waiting for Apply.

A shared `PickerSheet` shell component provides the header + Reset link + Apply button, so all five primary pickers (`WalletPicker`, `TypePicker`, `DatePicker`, `StatusPicker`, `CategoryPicker`) have identical chrome. `CardPicker` deliberately diverges — it renders rows (colour swatch + name + last4 + checkmark) rather than chips, because cards carry richer per-item content that spills awkwardly as wrapping chips.

A small `textOn(color)` helper centralises the "brand orange bg → `#441306` text, non-brand bg → white text" rule (per the memory rule) that both `FilterChip` and `OptionChip` now share, replacing the ad-hoc `activeColor === colors.brand ? '#441306' : '#fff'` ternaries scattered across components.

**Why one chip per filter:** the single-sheet pattern hides state behind an icon — you can't tell which filters are active without opening the sheet, and the count badge is a weak proxy for what. With per-filter chips, the filter row itself is the state display; "Last 7 days" written on the chip says more than "2" written on a badge. Each filter also gets a dedicated picker surface it can grow into — `CategoryPicker` can add grouping if the category list doubles, `CardPicker` can add a search box when a business wallet hits 50 cards, and neither change ripples into the other filters' UX. The shared sheet couldn't offer that without a redesign each time a filter scaled.

**Why Apply-batching even for the prototype:** the immediate performance concern is negligible for a mock dataset, but the API shape matters more than the CPU savings. When the backend lands, each committed filter change becomes a network request — and we want one request per Apply, not five while the user is toggling statuses. Wiring the draft/commit seam now means the prototype's state flow already matches what the production pattern needs, so the API swap later doesn't drag UX shape-changes with it. The one concession: `Reset` commits immediately, because "clear everything" reads as a single user intent, not a draft-in-progress — and flushing it keeps the list behaviour behind the sheet consistent with the chip-level `Clear` action.

**Why the Clear chip is terminal:** the per-picker Reset clears one category; a global "clear everything" needed to be a single tap, not N sheet-opens. Putting it at the end of the chip row — same vocabulary as the filters, different icon (`X`, no chevron), no dropdown affordance — gives it the nuke-button role without introducing a new UI element type. It only renders when `hasAnyFilter` is true, so it's discoverable exactly when useful.

**Why no "All wallets" option in the Wallet picker:** the picker's Reset link already clears the filter, and tapping an already-active wallet also deselects it (same pattern as Type's toggle-back-to-`all`). Keeping an "All" chip would have been a third way to do the same thing, and it read awkwardly as a chip that represents the *absence* of a filter. Removed for consistency with how every other picker expresses "nothing selected".

**Why the search bar + chips share `radius.full`:** with the filter button gone, the search input sits alone on its row and can commit to a fully-rounded pill shape that matches the chips below it. The previous `radius.lg` (16) search bar read as a rectangle next to a row of pills — minor but visible seam. Unifying the radius threads the search and filter affordances as one interaction zone.

### 153. Received direction disables Status and Category — mute, don't hide

**Decision:** When `direction === 'receive'` is committed, both the `Status` and `Category` chips on the filter row render at 40% opacity and stop responding to taps. Inside the pickers, every option chip gets the same `disabled` treatment. Flipping direction to `receive` via `TypePicker` also clears any previously-applied status/category selections in the same render pass — the parent's `handleApplyType` wipes both sets when the new direction is `receive`.

The Status and Category chips are **muted but still rendered** — hiding them would cause the chip row to snap shorter and push the `Clear` chip leftward, producing visible reflow every time the user toggled direction.

**Why:** in the current data model, received transactions always land as `status: 'completed'` and never carry a `category` (categories are outgoing-card-only per the `// spending category (card transactions only)` comment on `Transaction.category`). So:
- `direction: receive` + `status: pending | failed` → guaranteed 0 results (impossible combination).
- `direction: receive` + `status: completed` → redundant (receive already implies completed).
- `direction: receive` + any category → guaranteed 0 results (received txs have no category).

Every combination is either impossible or redundant, so the whole Status section is meaningless under receive — not just the non-completed rows. Disabling all three status chips (not just two) communicates "status filtering isn't a concept here" more cleanly than leaving Completed tappable while greying the others.

**Why mute the chip rather than hide the section:** hiding the Status/Category chips on the main row would shift the Clear chip left every time direction flipped, and hiding sections inside the pickers would make the sheet snap shorter and push the Apply button up. Both reflow patterns read as the UI being unstable rather than expressing a constraint. Muting preserves layout and communicates "not applicable right now" through opacity alone, which is the pattern users already understand from other form controls.

**Why prune existing selections on the switch:** if the user had Status: `pending` selected under direction `all`, then flipped to `receive`, we could either (a) keep the selection dormant and restore it when they flipped back, or (b) drop it outright. We drop it because the intent-preservation model has a subtle failure mode — if the user changes filters across sessions, stale state that the chip doesn't display is surprising. Dropping on the switch is explicit: the chip's label reverts to the default "Status"/"Category" word, matching the muted state, so there's no hidden state anywhere.

**If the data model changes later:** the rule "receive → no status/category" is a product choice about this prototype's mock data. If incoming transfers later gain pending states (wire holds, settlement delays) or categories (payroll, refund), the chip-disable logic needs to become more nuanced — probably per-status rather than blanket-disable. The per-chip `disabled` prop on `OptionChip` already exists as the seam for that, so only the predicate moves, not the component shape.

---

## Snapshot 8 — 2026-04-16
*Covers: create-wallet flow — flat review, calm success, landing spotlight*

### 154. WalletReviewScreen flattened per decision 144

**Decision:** `WalletReviewScreen` drops both of its gray-container treatments. The `currencyCard` hero — previously a `surface + radius.xl + border` box around the flag/name/code — becomes an unboxed centred block with `paddingVertical: spacing.xl`. The `detailsCard` — previously a `surface + radius.lg + border + overflow: hidden` wrapper around three rows — becomes a flat `section` using the decision-144 recipe: `paddingHorizontal: 24 + paddingBottom: spacing.lg + edge-to-edge borderBottom` on the section wrapper, rows with no internal `paddingHorizontal`, and inset `rowDivider` hairlines (`height: 1, backgroundColor: colors.borderSubtle`) between row Fragments. The outer `ScrollView` carries no `paddingHorizontal` so the section's bottom hairline reaches both screen edges if ever extended.

The section label reads `DETAILS` (11px semibold uppercase, `letterSpacing: 0.8`, `colors.textSecondary`) to match the convention used on every other flat-settings screen (CardDetail, Profile, WalletSettings, TransactionDetail).

**Why the hero unboxed:** the flag + name + code is a single-artefact display, not a group of settings. Inside a gray-container card it was doing the "contain a list" job for a single item, which is exactly the nested-rectangle stack that decision 144 called out. Removed, the hero reads as a header — which is what it is semantically.

**Why the details section flattened:** the three rows (starting balance, fee, cards) are a classic settings-style list — name on the left, value on the right. Decision 144's exact use case. Keeping them in a gray container here would have left this screen as the only settings-shaped list in the app still using the old pattern.

### 155. WalletSuccessScreen — calm entrance, SecondaryButton Done

**Decision:** Three changes land together because they're one coherent moment:

1. **Animation:** the spring-bounce on the flag container is replaced with a staggered fade + 8–10px rise on three layers — flag (0ms delay), title (120ms), subtitle (260ms) — each a 420ms `Easing.out(Easing.cubic)`. The `withSpring` + `checkScale` secondary pop is removed entirely. The circle surround (`radius.full` surface + border + 120×120 frame) is gone; the flag sits at 72×72 directly on the gradient background.
2. **Copy:** `Wallet created!` becomes `{CODE} Wallet Created.` (e.g. `MXN Wallet Created.`) so the screen names the specific thing that just happened. Subtitle is `Your {currency.name} wallet is ready to use.`
3. **CTA:** Done is a `SecondaryButton` (not `PrimaryButton`). On press, the screen calls `markJustAddedWallet(walletId)` then `navigation.popToTop()`. `walletId` was added to the route param type — `WalletReview` generates the id, persists it via `addWallet`, and threads it through so `Success` has the same id the store holds.

**Why calm over celebratory:** the previous spring-bounce + scale check read as "big deal event" — the right tone for money-leaving-your-hands flows (send money, confirm transfer), but wrong for "you added a container". Adding a wallet to a multi-wallet app is closer to adding a filter than completing a transaction; the existing celebration weight was miscalibrated and made the moment feel heavier than it is. Fade + rise feels like arrival, not fanfare.

**Why no circle around the flag:** the circle was a frame doing no work — the flag icon is already a self-contained rounded visual, and the 120×120 framed container inflated it past the hero treatment used on TransactionDetail and SendSuccess (which show a bare avatar on the gradient). Removing the frame matches those screens' hero conventions and lets the flag sit at its natural size (72px) without fighting a surrounding ring.

**Why SecondaryButton for Done:** PrimaryButton is reserved for the single highest-weight action on a screen — Create/Send/Confirm — and its brand-orange fill commands "this is the thing". But `Done` on a success screen is ceremonial, not the action that did the work (the wallet was already created on the previous screen's Confirm). Downgrading to Secondary signals "this screen is a confirmation, not an action" and visually cools the footer so the celebration stays in the content area.

**Why `walletId` in the route params instead of looking it up by currency:** currency codes happen to be unique today (CurrencyPickerScreen blocks already-owned codes), but that's a rule of the picker flow, not a property of the `Wallet` type. Threading the id through the route types means if we ever add a "duplicate this wallet" or "rename and re-add" flow, `WalletSuccess` still targets exactly the wallet that was just created — no ambiguity, no by-currency lookup that silently grabs the wrong one.

### 156. `justAddedWalletId` — one-shot store signal + carousel scroll-to-new on Wallets

**Decision:** `useWalletStore` gains `justAddedWalletId: string | null`, `markJustAddedWallet(id)`, and `clearJustAddedWalletId()` — mirroring the `justAddedCardId` pattern already in `useCardStore`. `WalletsScreen` reads the signal in two places:

1. **`initialIdx`** — if the signal is set at mount, the carousel initial index prefers the just-added wallet (falls back to just-added-card's wallet, then primary). Covers the edge case of Wallets first-mounting after a wallet add, though normally Wallets is tab-mounted continuously.
2. **Effect keyed on `justAddedWalletId`** — on change, `scrollRef.current?.scrollTo({ y: 0, animated: false })` snaps the page to top and `flatListRef.current?.scrollToOffset({ offset: idx * W, animated: true })` slides the carousel to the new wallet. Then `setHighlightWalletId(justAddedWalletId)` + `clearJustAddedWalletId()` — the highlight handoff happens in the same tick as consumption so the carousel chip (see #157) starts its own lifecycle independently.

**Why a store signal instead of a route param through `popToTop`:** `popToTop` can't carry params back to the tab screen underneath — the tab is already mounted and isn't being navigated to. A store flag is the established pattern (cards already use it) and decouples the producer (`WalletSuccess`'s Done button) from the consumer (`WalletsScreen`'s effect) so neither has to know about the other's lifecycle.

**Why `animated: true` on the horizontal scroll but `animated: false` on the vertical reset:** the card flow uses `animated: false` on both because the native-stack pop transition hides the snap. For wallets, the pop is a fade (`options={{ animation: 'fade' }}` on the `WalletSuccess` screen), not a slide — the user sees Wallets crossfade in with the carousel in motion, which reads as "we're taking you to your new wallet." The vertical reset stays `animated: false` because the user wasn't scrolling that axis; animating it would be a motion for no reason.

**Why the signal is cleared immediately, not after the animation settles:** unlike `justAddedCardId`, which gates a land-in animation on the new card face and needs to stay set until that animation completes, `justAddedWalletId` doesn't gate anything downstream of the scroll — the scroll call itself is synchronous, and the highlight chip (see #157) owns its own state. Clearing eagerly means a subsequent wallet add (rare but possible mid-lifecycle) re-triggers the effect cleanly.

### 157. "Wallet Created" spotlight chip on the carousel item

**Decision:** The new wallet's `WalletItem` in the carousel renders a one-shot `Wallet Created` chip in the Primary-chip slot (same pill shape, brand-orange fill on `alpha(colors.brand, 0.12)` + `alpha(colors.brand, 0.34)` border, `colors.brand` text + a `shadowColor: colors.brand / shadowOpacity: 0.22 / shadowRadius: 6` drop shadow for weight). The chip is kept **mounted on every non-primary wallet** — visibility is driven purely by `opacity` + `transform: scale`, both layout-free, so flipping the highlight on/off never shifts the rows below.

Animation:
- **Entry:** 450ms `withDelay` → `withTiming` opacity 0→1 (280ms, cubic-out) + `withSpring` scale 0.5→1 (`damping: 9, stiffness: 170, mass: 0.7`, slight overshoot).
- **Exit:** `withTiming` opacity 1→0 (280ms). Scale stays at 1 so the chip doesn't shrink on the way out.
- **Hold:** parent `WalletsScreen` tracks `highlightWalletId` local state, set when the store signal is consumed and cleared after 3200ms (450ms entry delay + ~300ms entry + ~2.2s visible + ~280ms exit).

The previous `primaryChipPlaceholder` style (`height: 22, marginBottom: 10`) is removed — the always-mounted chip now reserves the slot.

**Why kept mounted instead of conditionally rendered:** the first version toggled between `<primaryChipPlaceholder />` and `<Animated.View chip />` based on `justCreated`. Even with their heights nominally matching, the chip's `borderWidth: 1` + text line-height gave it a ~1–2px difference from the placeholder, which pushed the currency name up when the chip appeared and back down on exit — a visible layout shift. Always-mounted removes the branch entirely: the chip's footprint is always present on non-primary wallets, and non-just-created wallets simply render it at opacity 0.

**Why a 450ms entry delay:** the horizontal `flatListRef.current?.scrollToOffset({ animated: true })` settles in ~350–400ms. Popping the chip mid-scroll would mean the user reads "Wallet Created" while the carousel is still in motion — split attention between "where are we going" and "what is this label". Delaying until after the scroll lands means the user first registers "I've arrived at my new wallet", *then* the chip pops to label it.

**Why spring scale with overshoot (not pure fade):** a linear fade reads as "this text faded in", which is passive. A spring-scale pop reads as "look here" — the motion itself is a signal, not just the text arriving. The overshoot is small (~3–5%) so it feels bouncy-but-not-cartoonish; `damping: 9` specifically prevents multiple oscillations so the chip settles on the second beat.

**Why exit is fade-only (scale stays at 1):** shrinking the chip on exit would read as "this is going away forever" with a diminishing-weight signal. But the meaning is "your attention is no longer needed here" — the chip did its job, the user has now seen it. A clean fade is the right verb; the pill dissolves rather than retreats.

**Why brand-orange and not wallet accent:** the Primary chip uses the wallet's own accent (teal for GTQ, blue for USD, etc.) so it reads as "this wallet's meta state." The Wallet Created chip is a cross-wallet, app-level signal — "the user just did a thing" — which is a brand affordance, not a per-wallet property. Brand orange also keeps the chip visually distinct from any future Primary chip shown on the same wallet (they never occupy the same wallet simultaneously today, but the semantic separation is worth preserving).

### 158. Single-use cards skip customization and land directly on CardDetail

**Decision:** Tapping **Single-use** on `AddCardTypeScreen` navigates to `SingleUseCreatingScreen` — a brief interstitial that auto-creates the card, shows a materializing animation with a "Creating your card…" → checkmark transition (~1.7s), then resets the stack to `[Main, CardList, CardSettings]`. Virtual and Physical continue through the full four-screen flow (`AddCardName → AddCardColor → AddCardReview`) unchanged. This supersedes the part of #39 that said the four-screen flow applies uniformly to all three types.

**Why skip the customization flow:** a single-use card is ephemeral — it exists for one transaction and auto-deletes on use. Letting the user name it "Groceries" and pick a color invests effort in a thing that disappears minutes later; the labor-to-lifespan ratio is wrong. Virtual and physical cards live on the account for months or years, so the customization pays back every time the user scans the carousel and recognises their card. Single-use doesn't get that payoff.

**Why an interstitial instead of instant navigation:** jumping from the type picker directly to CardSettings felt abrupt — the user taps a card type and lands on a dense settings screen with no acknowledgement that anything was created. The interstitial provides a brief moment of confirmation: the card face materialises (fade + rise), a "Creating your card…" label transitions to a green checkmark + "Card created", and then the screen auto-navigates. Total dwell time is ~1.7s — long enough to register the creation, short enough to feel instant. The pattern mirrors the cadence of a real card issuance (request → processing → issued) compressed to prototype speed.

**Why the interstitial auto-navigates instead of requiring a tap:** the single-use flow is optimised for speed — the user wants a disposable card number as fast as possible. Adding a "Continue" button would re-introduce the tap the entire skip was designed to eliminate. Auto-navigation after the checkmark settles means the user's hands are free and the card details appear without further input.

**Why land on CardSettings instead of the usual `AddCardReview` celebration:** the celebratory "Card added!" screen is built around the metaphor of a card you'll keep — it offers "Add to Apple Wallet" and "View card details" as parallel next steps, and the Done button returns to Wallets with a land-in animation on the new card face in the stack. For single-use, the user's next step is almost always "grab the number and paste it into a checkout form" — which is exactly what CardSettings supports (reveal number, reveal CVV). Skipping straight there puts the user in the tool they actually need.

**Why `navigation.dispatch(reset(...))` and not `navigate('CardSettings')`:** `navigate` would stack `AddCardType → SingleUseCreating → CardSettings` and leave dead screens behind. `reset` rebuilds the stack as `[Main, CardList, CardSettings]` so back lands on the wallet's card list (the natural home for the just-issued card) and a second back returns to the tabs. Same pattern the existing `handleViewDetails` in `AddCardReviewScreen` uses.

**What I'd do with more time:** append a short identifier to the default name when multiple single-use cards coexist on one wallet (e.g. `Single-use · 4821` using the last4) so they're distinguishable in the carousel without requiring the user to open each one.

### 159. Freeze card moved from quick-action button to settings toggle

**Decision:** Removed the standalone "quick actions" row (which contained only a Freeze button) from `CardSettingsScreen` and replaced it with a toggle row inside the Card settings section. The new row order is: **Freeze card** (toggle) → **Online transactions** (toggle) → **Change PIN** (action). The frost overlay animation on the card face and the confirmation modal are preserved.

**Why a toggle instead of a button:** the freeze/unfreeze action is a reversible on/off state, identical in shape to Online transactions. A toggle communicates this better than a standalone button — it makes the current state immediately visible (on = frozen) and groups it with the other card-level controls. The old quick-actions row existed for a single button, which looked orphaned.

**Why the label stays fixed as "Freeze card":** toggle rows communicate state through the switch position and sublabel, not the label. Changing the label to "Unfreeze card" when frozen doubles the state signal and makes the row feel like it belongs to a different control entirely. The sublabel handles state ("Card is frozen" / "Card is active" / "Freezing…" / "Unfreezing…").

**Why the toggle opens a confirmation modal instead of toggling directly:** freezing blocks all transactions on the card — a heavier consequence than toggling online-transactions. The confirmation step prevents accidental freezes from a stray thumb tap while scrolling. The Switch is controlled (`value={card.frozen}`), so it doesn't visually flip until the store actually updates after confirmation + processing animation.

### 163. CardList peek carousel — adjacent cards visible during scroll

**Decision:** The card carousel on `CardListScreen` shows ~28px of the previous/next card on each side, with a 12px gap between cards. Uses `snapToInterval` instead of `pagingEnabled`, with `CardFront` accepting an optional `width` prop to size down from the default full-width.

**Why:** Full-width paging gave no visual hint that more cards exist. The peek pattern is a standard affordance for "swipe for more" without needing an explicit label or arrow.

### 164. CardList content pager — limits + activity scroll with the cards

**Decision:** The content below quick actions (spending limits + activity) lives in a second horizontal `FlatList` (`scrollEnabled={false}`, `pagingEnabled`) that is programmatically synced to the card carousel's scroll offset on every frame via `scrollToOffset`. Each card gets its own vertical `ScrollView` page with its own limits and transactions.

**Why previous approaches failed:**
- *Animated height on limits section* — layout pop when limits appear/disappear; unreliable in ScrollView.
- *Fade/slide content tied to scrollX* — data swap (React state update) couldn't be timed to the fade; fast swipes still flashed.
- *`runOnJS(setActiveIndex)` mid-scroll* — every React re-render during scroll caused frame drops.

The synced-pager approach avoids all React state updates during scroll. The content pager receives a native `scrollToOffset` call (no re-render), so limits/activity slide in lockstep with the cards at 60fps.

### 165. Quick action targeting via liveIndex ref

**Decision:** Quick actions (show number, show CVV, view PIN, settings) read the current card from a `liveIndex` ref updated on every scroll frame, not from `activeIndex` React state. `activeIndex` only updates on `onMomentumEnd` to avoid mid-scroll re-renders.

**Why:** Updating React state mid-scroll for action targeting caused frame drops. But deferring state updates to momentum-end meant actions briefly targeted the wrong card after a swipe. The ref splits the difference: scroll-driven reads with zero re-render cost, state updates only when the scroll settles (for renderItem/extraData that needs it).

### 160. Card screen renames — AllCards / CardList / CardSettings

**Decision:** Renamed the three card screens to match their actual roles:

| Old name | New name | Route |
|---|---|---|
| `AllCardsScreen` | `AllCardsScreen` (unchanged) | — (tab) |
| `WalletCardListScreen` | `CardListScreen` | `CardList` |
| `CardDetailScreen` | `CardSettingsScreen` | `CardSettings` |

The old stub `CardListScreen.tsx` (which returned `null`) was deleted to free the filename.

**Why rename:** the original names mixed metaphors — `CardDetailScreen` was actually a settings screen (titled "Card settings" in the header), and `WalletCardListScreen` was the only card list scoped to a wallet, making the `Wallet` prefix redundant. The new names match what the screens do: `CardList` lists cards for a wallet, `CardSettings` configures a single card.

### 159. Single-use cards use Blaze (solid orange), not Classic Ria Edition

**Decision:** The auto-created single-use card uses Blaze (`#f97316`, `branded: false`) from the solid palette instead of Classic Ria Edition (`#f97316`, `branded: true`).

**Why:** Classic Ria Edition applies the full branded card treatment — Ria logo, metallic sheen overlay, premium badge styling. That treatment is designed for cards the user keeps and identifies with; it signals "this is your card" the same way a branded physical card does. A single-use card is disposable infrastructure — it exists to hold a number for one checkout. Giving it the full branded treatment would be like embossing a gift card. Blaze is the same orange but rendered as a plain solid fill, which reads as "functional, not precious" and visually distinguishes single-use cards from the user's curated virtual/physical cards in the carousel.

### 166. Matcha replaces Green in the Ria Edition palette

**Decision:** Renamed and recoloured the third Ria Edition swatch from Green (`#14532d`) to Matcha (`#CDE896`). Badge theme set to `default` (dark text) since it's a light colour.

**Why:** The dark forest green was too close in value to Black and Metal. Matcha is a distinctive light tone that gives the Ria Edition palette a wider range — one warm (Classic orange), two neutrals (Metal, Black), and now one fresh/light option.

### 167. Official network logo PNGs replace text/CSS Visa and Mastercard marks

**Decision:** `VisaLogo` now renders `Visa_Brandmark_White_RGB_2021.png` with explicit `tintColor` (`#fff` on dark cards, `#1a1a5e` on light). `MastercardLogo` renders `ma_symbol_opt_73_3x.png` inside a clipping container (scale 1.2×, height ratio 0.7) to crop the transparent padding baked into the asset. Both share a `LOGO_SIZES` map for sm/md/lg.

**Why:** The text-based Visa and overlapping-circle Mastercard were placeholders. Real brand assets improve visual fidelity. The Mastercard PNG has significant transparent padding, so the overflow-clip approach trims it without re-exporting the asset.

### 168. Deterministic card network — physical → Mastercard, virtual/single-use → Visa

**Decision:** Card network is assigned deterministically based on card type instead of random coin flip. Physical cards get Mastercard, virtual and single-use get Visa. The preview card on the colour screen shows the correct network before creation.

**Why:** Real issuers assign networks based on card program, not randomly. Deterministic assignment means the preview is accurate — what you see is what you get. A prototype toggle in the "⚙ Prototype" section lets designers test both logo treatments without affecting the default assignment.

### 169. Mastercard logo visibility on orange cards — accepted as-is

**Decision:** The Mastercard symbol's red/orange circles lose contrast on the Classic orange (`#f97316`) card face. Decided not to add a background rectangle or frosted pill behind the logo.

**Why:** Couldn't confirm that placing the Mastercard symbol on a dark rectangle is permitted by brand guidelines for card faces. Adding an unauthorised treatment risks being worse than the contrast issue. The orange card is one of several options, and users who pick it accept the visual trade-off.

### 170. EMVCo contactless indicator on physical cards

**Decision:** Physical cards show the EMVCo contactless indicator SVG next to the chip. Virtual and single-use cards don't show it — they have no NFC antenna. The indicator uses `tc.primary` (same color as card number and expiry) for visual consistency.

**Why:** The contactless symbol is a standard feature of physical payment cards. Including it adds realism to the card face prototype.

### 171. Contactless toggle in card settings — dims indicator, doesn't hide it

**Decision:** Physical cards have a "Contactless payments" toggle in card settings. When disabled, the contactless indicator on the card face dims to 25% opacity rather than disappearing. A `contactless` boolean field on the Card type (defaulting to `true` via `!== false`) backs the toggle.

**Why:** Hiding the indicator entirely suggests the physical antenna was removed, which isn't how it works. Dimming communicates "present but disabled" — the same pattern most banking apps use. A diagonal strikethrough was tried but rejected: it's a custom treatment not used by real banking apps, and the line clipped awkwardly at the SVG bounds.

### 172. Custom EMV chip design from Figma SVG (Card Chip.svg)

**Decision:** The card chip is rendered as an inline `SvgXml` using the custom `assets/Card Chip.svg` design. It features a gold-to-orange linear gradient fill with groove lines cut into a single surface (not separate pad shapes). A 2pt rounded stroke outlines the chip, with internal groove strokes also at 2pt. The background rect is inset 1px with its own stroke to cleanly frame the grooves clipped at the edges.

**Why:** The standard 6-segment EMV chip was studied (ISO 7816-2 defines 8 contacts that visually appear as 6 pads). Multiple ASCII layouts were explored — separate shapes looked artificial; lines carved into a single surface looked authentic. A custom SVG was designed in Figma to match, with a gold-to-orange gradient matching the Ria brand palette.

### 173. Chip hidden on virtual and single-use cards

**Decision:** The chip + contactless indicator only render for `card.type === 'physical'`. Virtual and single-use cards show a 28px spacer in the chip row's place so the card number position stays consistent across all card types.

**Why:** Virtual cards have no physical chip. Hiding it reinforces the visual distinction between physical and digital cards without changing the overall card layout.

### 174. Chip placement — ISO 7816-2 inspired positioning

**Decision:** The chip row uses `marginTop: 24, marginLeft: 10` positioning, placing it visually centered between the card name and card number, offset slightly right from the content edge. The card number's `marginTop` was reduced from 32px to 24px to compensate for the chip's increased top margin, keeping the number at the same absolute position.

**Why:** ISO 7816-2 specifies chip placement at ~10% from left and ~47% from top of a standard card. The exact spec position is too low for our compact UI card, so a compromise was struck: centered between name and number (~35% from top), with ~10px right offset. Multiple iterations tested — pure spec placement crowded the bottom, original placement was too high and flush-left compared to physical cards.
