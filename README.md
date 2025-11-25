# Memory Capsule AI 🧠⏳

A modern, AI-powered application for securely capturing, storing, and rediscovering personal memories and thoughts over time. Create time-locked capsules that unlock on future dates, with AI-powered insights, sentiment analysis, and comprehensive search capabilities.

## ✨ Features

### Core Functionality
* **Time-Locked Capsules:** Create encrypted memory capsules that unlock on specific future dates
* **Rich Media Support:** Attach photos, videos, documents, and audio recordings to your capsules
* **Client-Side Encryption:** All content is encrypted in your browser before storage for maximum privacy
* **Automatic Unlock Detection:** Capsules automatically unlock when their date arrives

### AI-Powered Features
* **Sentiment Analysis:** AI analyzes the emotional tone of your memories
* **Smart Summaries:** Automatic generation of concise summaries and key themes
* **Audio Transcription:** Convert voice recordings to text automatically
* **Semantic Search:** Natural language search across all your memories
* **AI Reflections:** Discover patterns and insights across your capsule collection

### Organization & Discovery
* **Timeline Visualization:** View your memories on an interactive chronological timeline
* **Advanced Search:** Filter by date range, sentiment, type, and unlock status
* **Color-Coded Sentiment:** Visual indicators for emotional tone
* **Notification System:** Get notified when capsules unlock

### Sharing & Export
* **Secure Sharing:** Generate time-limited sharing links for specific capsules
* **Single & Bulk Export:** Export capsules as JSON or text files
* **ZIP Archives:** Bulk export multiple capsules with all attachments

### User Management
* **Profile Customization:** Manage display name and account settings
* **Theme Support:** Light, dark, and auto theme modes
* **Password Reset:** Secure password recovery via email
* **Email Verification:** Required for new accounts
* **Remember Me:** Persistent sessions across browser restarts

## 🚀 Getting Started

### Prerequisites

To run this project locally, you will need:

* Node.js (version 18+)
* npm or yarn
* A Firebase project with Firestore, Authentication, and Storage enabled
* (Optional) A Google Gemini API key for AI-powered features

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/memory-capsule-ai.git
    cd memory-capsule-ai/MeroryCapsuleAi
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment Variables:**

    The application requires environment variables to be configured before it can run. Follow these steps:

    **a. Copy the example environment file:**
    ```bash
    cp .env.example .env
    ```

    **b. Set up Firebase:**
    - Go to the [Firebase Console](https://console.firebase.google.com/)
    - Create a new project or select an existing one
    - Enable Authentication (Email/Password provider)
    - Enable Firestore Database
    - Enable Storage
    - Go to Project Settings > General > Your apps
    - Copy your Firebase configuration values

    **c. (Optional) Set up Gemini AI:**
    - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
    - Create an API key for Gemini
    - Copy the API key

    **d. Update your `.env` file with your values:**
    ```env
    # Firebase Configuration (Required)
    VITE_FIREBASE_API_KEY=your_firebase_api_key_here
    VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

    # AI Service Configuration (Optional - AI features will be disabled without this)
    VITE_GEMINI_API_KEY=your_gemini_api_key_here

    # Application Configuration (Optional - defaults provided)
    VITE_APP_NAME=Memory Capsule AI
    VITE_APP_ENV=development
    VITE_MAX_FILE_SIZE_MB=50
    VITE_MAX_FILES_PER_CAPSULE=10
    VITE_AI_TIMEOUT_MS=30000
    ```

    **Environment Files:**
    - `.env` - Your local development environment (not committed to git)
    - `.env.development` - Development environment template
    - `.env.staging` - Staging environment configuration
    - `.env.production` - Production environment configuration
    - `.env.example` - Example template with all required variables

4.  **Run the application:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```

    The application will validate your environment configuration on startup. If any required variables are missing, you'll see a clear error message indicating what needs to be configured.

    The application should now be running at `http://localhost:5173` (Vite's default port).

### Building for Production

To build the application for different environments:

```bash
# Build for development
npm run build:dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variable Validation

The application automatically validates all required environment variables on startup. If any required variables are missing, the application will display a helpful error message indicating:
- Which variables are missing
- How to configure them
- Where to find the example configuration

This ensures you never run the application with an incomplete configuration.

## 🛠️ Technology Stack

### Frontend
* **Framework:** React 18 with TypeScript
* **Build Tool:** Vite 5
* **Styling:** Tailwind CSS with shadcn/ui components
* **State Management:** React Context API with hooks
* **Routing:** React Router v6
* **UI Components:** Radix UI primitives
* **Notifications:** Sonner toast library
* **Forms:** React Hook Form with Zod validation

### Backend & Services
* **Database:** Firebase Firestore (NoSQL)
* **Authentication:** Firebase Authentication (Email/Password)
* **Storage:** Firebase Storage (encrypted files)
* **AI/LLM Integration:** Google Gemini API
* **Encryption:** Web Crypto API (AES-GCM, client-side)

### Testing
* **Test Framework:** Vitest
* **Testing Library:** React Testing Library
* **Property-Based Testing:** fast-check
* **Test Environment:** jsdom

### Development Tools
* **Package Manager:** npm
* **Linting:** ESLint 9
* **Type Checking:** TypeScript 5.5
* **Code Quality:** TypeScript ESLint

## 🔧 Troubleshooting

### Environment Configuration Issues

**Problem: "Missing required environment variables" error**
- **Solution:** Ensure you've created a `.env` file by copying `.env.example` and filled in all required Firebase configuration values.

**Problem: Firebase initialization fails**
- **Solution:** Double-check that your Firebase configuration values are correct. You can find them in Firebase Console > Project Settings > General > Your apps.

**Problem: AI features not working**
- **Solution:** AI features require a Gemini API key. If you haven't set `VITE_GEMINI_API_KEY`, AI features will be disabled but the core application will still work.

**Problem: Build fails with environment variable errors**
- **Solution:** Make sure all environment variable names start with `VITE_` prefix (required by Vite). Check that there are no typos in your `.env` file.

### Firebase Setup Issues

**Problem: Authentication not working**
- **Solution:** Ensure Email/Password authentication is enabled in Firebase Console > Authentication > Sign-in method.

**Problem: Database permission errors**
- **Solution:** Check your Firestore security rules. For development, you can use test mode rules (not recommended for production).

**Problem: File upload fails**
- **Solution:** Ensure Firebase Storage is enabled and has appropriate security rules configured.

## 📚 Documentation

For more detailed information, see:

* **[API Documentation](./docs/API.md)** - Complete API reference for all services
* **[Environment Configuration](./ENVIRONMENT.md)** - Detailed environment setup guide
* **[Testing Guide](./docs/TESTING.md)** - How to run and write tests
* **[Deployment Guide](./docs/DEPLOYMENT.md)** - Deploy to various platforms
* **[Contributing Guidelines](./CONTRIBUTING.md)** - How to contribute to the project

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on:

* Code style and standards
* How to submit pull requests
* Testing requirements
* Documentation expectations

Quick start for contributors:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the **MIT License** - see the `LICENSE` file for details.

## 🙏 Acknowledgments

* Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
* UI components from [shadcn/ui](https://ui.shadcn.com/)
* Icons from [Lucide](https://lucide.dev/)
* AI powered by [Google Gemini](https://ai.google.dev/)
* Backend by [Firebase](https://firebase.google.com/)

---

Made with ❤️ for preserving memories
