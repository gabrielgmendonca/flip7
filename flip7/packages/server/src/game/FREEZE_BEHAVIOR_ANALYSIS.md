# FREEZE Card Behavior Analysis

This document compares the current implementation of FREEZE card behavior against official Flip 7 rules.

## Official FREEZE Card Rules

Based on research from official rules sources ([Geeky Hobbies](https://www.geekyhobbies.com/flip-7-rules/), [Happy Piranha](https://happypiranha.com/blogs/board-game-rules/how-to-play-flip-7-the-greatest-card-game-of-all-time-board-game-rules-instructions), [Dized Rules FAQ](https://rules.dized.com/game/dPDRM857TU-BFRF7LzGE0g/faq)):

### Core Rules
1. **Target Selection**: When you draw a Freeze card, you choose an active player (including yourself) to freeze. That player banks their points and sits out the round.
2. **Eligible Targets**: Only active players (not busted, not stayed/frozen)
3. **Self-Freeze**: Allowed - can freeze yourself strategically
4. **Solo Player**: If you're the only active player, you must freeze yourself

### Special Scenarios

**During Initial Deal:**
- Player who drew Freeze chooses target immediately
- Can target ANY player, even those not yet dealt their first card

**During Flip Three:**
- Freeze is SET ASIDE until Flip Three completes
- If player busts or achieves Flip 7 during Flip Three, the Freeze is DISCARDED
- Otherwise, player assigns Freeze to any active player after Flip Three

---

## Implementation Status

### All Features Working Correctly

| Feature | Status | Location |
|---------|--------|----------|
| Target selection with multiple active players | ✅ | `Game.ts:331-352` |
| Can select another player as freeze target | ✅ | `Game.ts:502-542` |
| Validation that only freeze card holder can select target | ✅ | `Game.ts:507-508` |
| Solo player auto-freeze (only one eligible target) | ✅ | `Game.ts:337-344` |
| Scoring when frozen | ✅ | `Game.ts:342, 522` |
| Self-freeze allowed | ✅ | Included in eligible targets |
| **Initial Deal Freeze - Target Selection** | ✅ | `Game.ts:151-178` |
| **Flip Three Freeze - Set Aside Behavior** | ✅ | `Game.ts:392-414, 441-474` |

---

## Implemented Fixes

### Fix 1: Initial Deal Freeze (COMPLETED)

**Location:** `Game.ts:151-178`

**Implementation:**
During initial deal, if a Freeze card is drawn and there are multiple active players:
1. Game enters `AWAITING_FREEZE_TARGET` phase
2. Deal is paused at current player index (`pendingDealIndex`)
3. Player can select any eligible target (including self)
4. After selection, deal continues from where it left off

**Key Code:**
```typescript
if (result.triggersFreeze) {
  const eligibleTargets = this.players
    .filter((p) => p.status === 'active' && p.isConnected)
    .map((p) => p.id);

  if (eligibleTargets.length > 1) {
    // Multiple targets - pause deal for selection
    this.pendingFreezeTarget = { playerId: player.id, eligibleTargets };
    this.pendingDealIndex = playerIndex + 1;
    this.phase = 'AWAITING_FREEZE_TARGET';
    return true; // Pause the deal
  }
}
```

---

### Fix 2: Flip Three Freeze Handling (COMPLETED)

**Location:** `Game.ts:392-414, 441-474`

**Implementation:**
When Freeze is drawn during Flip Three:
1. Freeze is tracked in `pendingFlipThreeFreeze` but NOT resolved immediately
2. Flip Three continues drawing all 3 cards (or until bust/Flip 7)
3. After Flip Three completes:
   - If player **busted**: Freeze is DISCARDED
   - If player achieved **Flip 7** (passed): Freeze is DISCARDED
   - Otherwise: Freeze is resolved (target selection or auto-freeze)

**Key Code:**
```typescript
} else if (result.triggersFreeze) {
  // Per official rules: Freeze is SET ASIDE during Flip Three
  this.pendingFlipThreeFreeze = { playerId: player.id };
  // Continue Flip Three - don't interrupt
}

// After Flip Three completes...
if (this.pendingFlipThreeFreeze && this.pendingFlipThreeFreeze.playerId === player.id) {
  if (player.status === 'busted' || player.status === 'passed') {
    // Per official rules: Freeze is DISCARDED
    this.pendingFlipThreeFreeze = undefined;
  } else if (player.status === 'active') {
    // Player didn't bust/Flip7 - resolve the freeze
    // ... target selection logic
  }
}
```

---

## Test Coverage

Tests have been updated in `Game.test.ts` to handle the new freeze target selection behavior:
- Helper functions `resolveInitialDealFreezes()` and `startGameAndResolve()` handle freeze selections during initial deal
- Tests that use `startGame()` followed by gameplay operations use these helpers to ensure proper game state

New behavior tested:
- Freeze target selection during initial deal with multiple players
- Freeze set aside during Flip Three, discarded if busted
- Freeze resolved after Flip Three if player still active

---

## Summary

The implementation now fully matches official Flip 7 rules for Freeze card behavior:
1. ✅ Players can choose ANY active player as freeze target (including self)
2. ✅ During initial deal, freeze target selection pauses the deal and allows full choice
3. ✅ During Flip Three, freeze is set aside and only resolved after Flip Three completes
4. ✅ If player busts or achieves Flip 7 during Flip Three, the freeze is discarded
