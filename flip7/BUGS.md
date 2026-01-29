# Bugs

## 1. ~~Freeze card behavior~~ (FIXED)

~~The Freeze card is incorrectly forcing the player who draws it to freeze themselves.~~

~~**Expected behavior**: The player should choose an active player (including themselves) to freeze. Only if no other player is active should they be forced to freeze themselves.~~

## 2. ~~Turn structure~~ (FIXED)

~~The game is using Blackjack-style turns where each player draws as many cards as they want during their turn.~~

~~**Expected behavior**: In Flip 7, each player can only draw one card per turn, then passes to the next player.~~

## 3. ~~Deck composition~~ (VERIFIED - Not a bug)

~~The number 4 appeared suspiciously frequent in testing.~~

The deck composition is correct: card quantity equals card value (4 copies of "4", 12 copies of "12", etc.). This is the expected Flip 7 distribution. Verified by tests in `Deck.test.ts`.

## 4. ~~Bust card not shown~~ (FIXED)

~~When a player busts, the duplicate card that caused the bust is not displayed to the user. This makes it confusing for the player to understand why they busted.~~

~~**Expected behavior**: The duplicate card that caused the bust should be shown to the player (and other players) so they understand which card they drew that matched an existing card in their hand.~~
