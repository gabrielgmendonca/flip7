# Flip7 QoE Roadmap

Quality of Experience features for the game round screen.

## High Impact / Low Effort

- [x] **Turn timer** - Visual countdown bar using `turnTimeoutSeconds` (already in settings but not displayed)
- [x] **Highlight newest card** - Animate/glow the most recently drawn card so it stands out (`isNew` flag already exists in state)
- [x] **Keyboard shortcuts** - `H` for Hit, `P` for Pass when it's your turn
- [x] **Bust risk indicator** - Show which numbers in the deck would cause a bust (grayed-out numbers you already have)
- [x] **Reconnection toast** - Notify player when they've reconnected ("Connection restored")
- [x] **Leave game confirmation** - Modal to prevent accidental exits
- [x] **Card hover effects** - Scale/glow on hover for interactive feel
- [x] **Card tooltips** - Hover to see what special cards (x2, +10, Second Chance, Freeze) do

## Medium Effort

- [x] **Target score progress** - Progress bar showing how close each player is to winning (200 points)
- [x] **Flip 7 glow effect** - Pulse/glow the "Unique: 6/7" indicator when one card away from the bonus
- [x] **Activity log** - Small feed showing recent actions ("Alice drew 5", "Bob passed", "Carol busted!")
- [x] **Score change animation** - Floating "+15" when getting bonuses, show round score delta
- [x] **Toast notification system** - Replace static error messages with dismissible toasts for all events
- [x] **In-game help modal** - Quick rules reference accessible during gameplay
- [x] **Pending action indicator** - Spinner on Hit/Pass buttons while server processes
- [x] **Round summary modal** - Brief recap at round end showing who gained/lost what
- [x] **Rematch button** - Quick restart with same players after game ends

## Higher Effort / Polish

- [ ] **Round end celebration** - Confetti or visual effect for round winners
- [ ] **Sound effects** - Audio cues for draw, bust, pass, win
- [ ] **Player turn order** - Visual indicator showing turn sequence
- [ ] **Mobile landscape mode** - Optimize layout for horizontal phone orientation

## Technical Debt

- [ ] **Error boundary component** - Graceful fallback if app crashes
- [ ] **Form validation feedback** - Real-time validation on inputs
- [ ] **Scoreboard overlap fix** - Prevent overlap on smaller screens
