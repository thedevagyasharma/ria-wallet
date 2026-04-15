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
