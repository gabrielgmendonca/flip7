# Flip 7

A real-time multiplayer implementation of the Flip 7 card game.

## Tech Stack

- **Client**: React, TypeScript, Vite, Socket.IO
- **Server**: Node.js, Express, TypeScript, Socket.IO
- **Shared**: TypeScript types and game logic

## Project Structure

```
flip7/
├── packages/
│   ├── client/    # React frontend
│   ├── server/    # Express + Socket.IO backend
│   └── shared/    # Shared types and utilities
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd flip7
npm install
```

### Development

Run both client and server in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:server  # Start server on port 3001
npm run dev:client  # Start client on port 5173
```

### Testing

```bash
npm test           # Run tests once
npm run test:watch # Run tests in watch mode
```

### Build

```bash
npm run build
```

## Game Rules

Flip 7 is a push-your-luck card game where players try to collect cards without getting duplicates.

- Draw cards to add to your hand and score points
- Number cards (1-10) add their face value to your score
- Collect 7 unique numbers for a +15 bonus
- Special cards: X2 (doubles your number total), +5/+10 modifiers, Second Chance, Flip 3
- If you draw a duplicate number, you bust and lose all points for the round
- Pass to lock in your score before risking a bust
- First player to reach 200 points wins

## License

MIT
