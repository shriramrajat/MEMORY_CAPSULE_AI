# Memory Capsule - Minimal

A simple time capsule application where you can create encrypted memories that unlock on future dates.

## Features

- Create time-locked memory capsules
- Secure client-side encryption
- Firebase authentication and storage
- Simple, clean interface

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure Firebase credentials
4. Run: `npm run dev`

## Environment Variables

Required Firebase configuration in `.env`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

## Tech Stack

- React + TypeScript
- Vite
- Firebase (Auth, Firestore, Storage)
- Tailwind CSS
- shadcn/ui components

## License

MIT
