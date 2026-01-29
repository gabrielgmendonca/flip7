# Flip 7 - Development Roadmap

## Completed

### Deck Composition (Fixed)
- [x] Number cards: 79 total (0×1, 1×1, 2×2, ... 12×12)
- [x] Action cards: 9 total (3× Freeze, 3× Flip Three, 3× Second Chance)
- [x] Modifier cards: 6 total (+2, +4, +6, +8, +10, x2)
- [x] Total: 94 cards matching official rules

### Core Game Mechanics (Implemented)
- [x] Hit/Stay gameplay loop
- [x] Bust on duplicate number cards
- [x] Flip 7 bonus (+15 points for 7 unique numbers)
- [x] Score calculation: Sum → x2 multiplier → add modifiers → Flip 7 bonus
- [x] Win condition: First to 200 points

### Action Cards (Implemented)
- [x] Freeze: Banks points and removes player from round
- [x] Flip Three: Forces player to draw 3 cards
- [x] Second Chance: Prevents bust by discarding duplicate
- [x] Second Chance limit: Max 1 per player, extras given to others or discarded
- [x] Freeze during Flip Three: Resolved after all 3 cards drawn

### Infrastructure
- [x] Real-time multiplayer via Socket.io
- [x] Room system with join codes
- [x] Player reconnection handling
- [x] Debug mode for testing with fewer players
- [x] Comprehensive test suite (219 tests)

---

## Needs Verification

### Action Card Edge Cases
- [ ] Verify: Flip Three stops early on Flip 7 achievement
- [ ] Verify: Flip Three stops early on bust (without Second Chance)
- [ ] Verify: Nested Flip Three cards during Flip Three resolution
- [ ] Verify: Second Chance cards drawn during Flip Three are usable

### Dealing Phase
- [ ] Verify: Action cards during initial deal pause and resolve immediately
- [ ] Verify: Deal continues from correct player after action resolution

### Round/Game Flow
- [ ] Verify: Cards are NOT shuffled back between rounds (discard pile separate)
- [ ] Verify: Deck reshuffles only when empty, preserving cards in play
- [ ] Verify: Dealer rotates left each round

---

## Future Enhancements

### Gameplay
- [ ] AI/Bot players for solo play or filling empty seats
- [ ] Spectator mode
- [ ] Game replays / history
- [ ] Statistics tracking (games played, win rate, etc.)

### UI/UX
- [ ] Card animations for draw/discard
- [ ] Sound effects
- [ ] Visual feedback for Flip 7 achievement
- [ ] Better mobile responsiveness
- [ ] Dark mode

### Social Features
- [ ] Player profiles / accounts
- [ ] Friends list
- [ ] Private rooms with passwords
- [ ] Chat during games

### Technical
- [ ] Persistent game state (resume interrupted games)
- [ ] Rate limiting for game actions
- [ ] Better error handling and user feedback
- [ ] Performance optimization for larger player counts

---

## Known Issues

### Action Card Targeting (FIXED)
- [x] **Flip Three**: Now allows player to choose any active player as target
- [x] **Freeze**: Already allowed targeting any active player
- [x] Per official rules: "Action cards can be played on **any active player** including yourself. If you are the only active player in the round, you **must** play the Action card on yourself."

### UI Issues
- [ ] **Target selection modal**: Toast/modal appears to all players, but only the player who drew the action card should see it
- [ ] **Turn timeout**: Turn timeout does not work (timer shows but no auto-action)

### Game Flow Issues
- [ ] **Game ends after 3 rounds**: Game seems to end after 3 rounds instead of when someone reaches 200 points
- [ ] **Deck shuffling**: Deck appears to be shuffled too often (per official rules, cards are not reshuffled between rounds until deck runs out)

---

## References

- [Official Flip 7 Rules (Edition 3.1)](./RULES.md)
- [Freeze Behavior Analysis](./packages/server/src/game/FREEZE_BEHAVIOR_ANALYSIS.md)
