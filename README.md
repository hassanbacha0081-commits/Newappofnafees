# Nafees Jeweller's Management System

A full-stack application for managing a jewellery shop, including billing, stock management, karigar records, and more.

## Features

- **Billing System**: Create and print bills with gold rate calculations.
- **Stock Management**: Track gold and item stock.
- **Order Tracking**: Manage customer orders and delivery dates.
- **Karigar Records**: Keep track of work given to and received from karigars.
- **Repairs**: Manage repair jobs and charges.
- **Multi-language Support**: Full support for English and Urdu.
- **Image Capture**: Capture and store images for bills and items.
- **WhatsApp Integration**: Share bills directly via WhatsApp.

## Installation

To run this project locally, follow these steps:

1. **Clone the repository** (or download the ZIP file from AI Studio).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up Firebase**:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
   - Enable Firestore and Authentication (Google Login).
   - Copy your Firebase configuration and update the `firebase-applet-config.json` file in the root directory.
4. **Run the development server**:
   ```bash
   npm run dev
   ```
5. **Build for production**:
   ```bash
   npm run build
   ```

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Printing**: React-to-Print

## Project Structure

- `src/components/`: Reusable UI components and module pages.
- `src/lib/`: Utility functions and helpers.
- `src/translations.ts`: Multi-language translation strings.
- `src/db.ts`: Firebase configuration and database interfaces.

## Mobile Installation (Android)

This project is set up with **Capacitor**, allowing you to run it as a native Android app.

### Prerequisites
- **Node.js & npm** installed on your computer.
- **Android Studio** installed on your computer.
- A physical Android device (with USB debugging enabled) or an Android Emulator.

### Steps to Install on Android

1. **Extract the project ZIP** and open your terminal in the project folder.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Build the web project**:
   ```bash
   npm run build
   ```
4. **Sync with Android**:
   ```bash
   npx cap sync
   ```
5. **Open in Android Studio**:
   ```bash
   npx cap open android
   ```
   *Alternatively, open Android Studio and select the `android` folder in the project root.*
6. **Build and Run**:
   - In Android Studio, wait for the Gradle sync to finish.
   - Select your device/emulator from the top toolbar.
   - Click the **Run** button (green play icon).

### Updating the App
If you make changes to the web code, you must rebuild and sync:
```bash
npm run build
npx cap sync
```
Then run the app again from Android Studio.

## CI/CD (GitHub Actions)

This project features automated integration and software deployment packaging on GitHub Actions:

- **Build Android APK** (`.github/workflows/android-build.yml`): Triggers automatically on code pushes to `main` or `master`. Performs TypeScript linting, integrates Capacitor asset syncing, and outputs a ready-to-test `.apk` artifact.
- **Build Windows EXE** (`.github/workflows/windows-build.yml`): Bundles Electron components for a high-performance, standalone Windows application. Outputs a portable `.exe` execute file.
- **Manual Control**: Both pipelines support `workflow_dispatch` so they can be triggered manually inside your GitHub actions repository tab at any time.

