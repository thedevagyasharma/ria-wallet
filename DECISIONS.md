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

### 31. Lucide icons everywhere — no emoji UI icons

**Decision:** All navigation icons (back button `‹`, forward chevron `›`), action icons (freeze/unfreeze, add, send, receive, cards), and status icons (check, copy, delete, search, clear) use `lucide-react-native` components. Emoji are retained only for currency flags, category labels in AddCardCategories, and the inline `💡` tip text in the error screen.

**Why:** Text-based navigation characters (`‹`, `›`) render at different optical weights on different fonts and operating systems — they look misaligned on Android particularly. Emoji icons in action buttons (`❄️`, `🗑️`, `🔢`) have inconsistent sizes and padding across platforms and cannot be reliably tinted to match the design system's colour tokens. Lucide icons have consistent `strokeWidth`, predictable `size`, and accept a `color` prop — making them directly themeable and cross-platform reliable.

**Exceptions kept as emoji:** Currency flags (universal standard, no Lucide equivalent), spending category icons in AddCardCategories (🛒, 🍽️, etc. — no close Lucide equivalents, and the emoji add visual warmth to a functional list), and the inline `💡` tip text in SendErrorScreen (inline emoji in a text paragraph, not a pressable UI element).
