 <h1 align="center"> languageXchange | Practice, Learn, Succeed!</h1>
<p align="center">
  <a href="https://status.languageXchange.net/" target="_blank"><img src="https://uptime.betterstack.com/status-badges/v1/monitor/vrew.svg" alt="Better Stack Badge"></a>
  <a href="https://discord.gg/CpDZ3kg2rJ" target="_blank"><img src="https://badgen.net/badge/icon/discord?icon=discord&label" alt="Discord"></a>
  <a href="https://github.com/languageXchange/languageXchange/releases" target="_blank"><img src="https://img.shields.io/github/release/languageXchange/languageXchange.svg" alt="GitHub release"></a>
  <a href="https://github.com/badges/languageXchange/languageXchange" target="_blank"><img src="https://img.shields.io/github/commit-activity/m/languageXchange/languageXchange" alt="Activity"></a>
  <a href="https://github.com/langaugeXchange/languageXchange/graphs/contributors" target="_blank"><img src="https://img.shields.io/github/contributors/languageXchange/languageXchange.svg" alt="GitHub contributors"></a>
  <a href="https://github.com/languageXchange/languageXchange/issues" target="_blank"><img src="https://img.shields.io/github/issues/languageXchange/languageXchange.svg" alt="GitHub issues"></a>
  <a href="https://github.com/languageXchange/languageXchange/blob/main/LICENSE" target="_blank"><img src="https://img.shields.io/github/license/languageXchange/languageXchange.svg" alt="GitHub license"></a>
</p>
<p align="center">
  <a href="https://discord.gg/CpDZ3kg2rJ" target="_blank"><img src="https://img.shields.io/badge/-Discord-blue?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://x.com/languageXapp" target="_blank"><img src="https://img.shields.io/badge/-Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white" alt="Twitter"></a>
  <a href="https://t.me/languageXapp" target="_blank"><img src="https://img.shields.io/badge/-Telegram-2CA5E0?style=flat-square&logo=telegram&logoColor=white" alt="Telegram"></a>
  <a href="https://instagram.com/languageXapp" target="_blank"><img src="https://img.shields.io/badge/-Instagram-E4405F?style=flat-square&logo=instagram&logoColor=white" alt="Instagram"></a>
  <a href="https://tiktok.com/@languageXapp" target="_blank"><img src="https://img.shields.io/badge/-TikTok-000000?style=flat-square&logo=tiktok&logoColor=white" alt="TikTok"></a>
  <a href="https://www.facebook.com/languageXapp" target="_blank"><img src="https://img.shields.io/badge/-Facebook-1877F2?style=flat-square&logo=facebook&logoColor=white" alt="Facebook"></a>
  <a href="https://www.youtube.com/@languageXchange" target="_blank"><img src="https://img.shields.io/badge/-YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube"></a>
  <a href="https://bsky.app/profile/languagexapp.bsky.social" target="_blank"><img src="https://img.shields.io/badge/-Bluesky-1DA1F2?style=flat-square&logo=twitter&logoColor=white" alt="Bluesky"></a>
  <a href="https://www.linkedin.com/products/new-chapter-technology-limited-liability-company-languagexchange-practice-learn-succeed/" target="_blank"><img src="https://img.shields.io/badge/-LinkedIn-0077B5?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
</p>
<p align="center">
  <a href="https://discord.gg/CpDZ3kg2rJ" target="_blank"><img src="https://img.shields.io/discord/1211339989967970375?logo=discord" alt="chat on Discord"></a>
  <a href="https://discord.gg/CpDZ3kg2rJ" target="_blank"><img src="https://dcbadge.vercel.app/api/server/CpDZ3kg2rJ?style=flat" alt="Join us on Discord"></a>
</p>

languageXchange is an application built with Angular and Ionic that helps users exchange different languages by connecting them with native speakers. Users can join chat rooms with other participants and practice their language skills in a fun and interactive way. The app is available on web, iOS, and Android platforms. It uses <a href="https://github.com/appwrite/appwrite/" target="_blank">@appwrite</a> for the back-end. For a detailed list of technologies used, please refer to the [Tech Stack](#tech-stack) section.

## Table of Contents

- [Project Overview](#languageXchange--practice-learn-succeed)
- [Status](#status)
- [Tech Stack](#tech-stack)
- [Links](#links)
- [Installation](#installation)
  - [Cloud Functions](#cloud-functions)
- [Usage](#usage)
- [Deep Linking](#deep-linking)
  - [Android Deep Linking](#android-deep-linking)
  - [iOS Universal Links](#ios-universal-links)
- [Firebase Messaging Service Worker](#firebase-messaging-service-worker)
- [Contributing](#contributing)
- [Security](#security)
  - [Paths](#paths)
  - [Google Services](#google-services)
- [Stats](#stats)
  - [Stargazers](#stargazers)
  - [Contributors](#contributors)
- [License](#license)

## Status

This project is currently in Beta phase v0.7.x For more information, please refer to the project's GitHub repository.

To check the status of the website, database and CDN, and all clients which are [iOS](https://apps.apple.com/app/languagexchange/id6474187141), [Android](https://play.google.com/store/apps/details?id=tech.newchapter.languageXchange), and [Web App](https://app.languageXchange.net). please visit the following link: https://status.languagexchange.net/

## Tech Stack

- Language: [TypeScript](https://www.typescriptlang.org/)
- Landing Page: [Svelte](https://svelte.dev/)
- Framework: [Ionic Angular](https://ionicframework.com/docs/angular/overview)
- Native: [Capacitor](https://capacitorjs.com/)
- Database: [Appwrite](https://appwrite.io/)
- API: [Expressjs, Nodejs](https://github.com/languagexchange/server)
- Cloud Functions: [Appwrite](https://appwrite.io/)
- Push Notification: [Firebase Cloud Messaging](https://firebase.google.com/products/cloud-messaging)
- Storage: [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces/)
- Analytics: [Google Analytics](https://analytics.google.com/analytics/web/)

## Links

- [App Landing Page](https://languagexchange.net/)
- [iOS App](https://apps.apple.com/us/app/languagexchange/id6474187141)
- [Android App](https://play.google.com/store/apps/details?id=tech.newchapter.languageXchange)
- [Web App](https://app.languagexchange.net/)

## Installation

To install the project locally, follow these steps:

1. Clone the repository to your local machine using the command `git clone https://github.com/newchaptertech/languageXchange.git`
   - Navigate to the project directory using the command `cd languageXchange`
   - Install the Ionic CLI globally using the command `npm install -g @ionic/cli`
   - Install the project dependencies using the command `npm install`
2. Create a new Appwrite project and enable the Authentication and Database services.
   - In the Appwrite console, go to Project Settings and copy the Appwrite endpoint and project ID.
   - Rename the `environment.ts.sample` file in the `src/environments` directory to `environment.ts`
   - Rename the `environment.prod.ts.sample` file in the `src/environments` directory to `environment.prod.ts`
   - Replace the placeholders in the `environment.ts.sample` file with your actual values. For example, replace `<API_URL>` with the actual URL of your API, `<DB_URL>` with your database URL, and so on. Make sure to replace all placeholders in the file.
3. Start the development server using the command `ionic serve`
4. Open your web browser and navigate to `http://localhost:8100`

That's it! You should now be able to see the project running locally on your machine. If you encounter any issues during the installation process, please refer to the project's documentation or open an issue on the projects GitHub repository.

### Cloud Functions

To push Appwrite Cloud Functions, follow these steps:

1. Make sure you have the Appwrite CLI installed on your machine. If you don't have it installed, you can install it using the command `npm install -g appwrite`
2. Navigate to the root directory of your Appwrite project using the command line.
3. Run the command `appwrite login` to log in to your Appwrite account.
4. Run the command `appwrite functions create` to initialize the Appwrite Cloud Functions in your project.
5. Follow the prompts to select your Appwrite project and choose the language you want to use for your functions.
6. Once the initialization is complete, you can check Cloud Functions code in the `appwrite/functions/index.js` file (if you're using JavaScript) or you can convert `appwrite/functions/index.js` to `appwrite/functions/index.ts` file (if you're using TypeScript).
7. Once you've written your Cloud Functions code, run the command `appwrite functions deploy` to deploy your functions to Appwrite.
8. Go to database function console and make sure that right permissions you set for related function.

That's it! You should now be able to push your Appwrite Cloud Functions to Appwrite and use them in your app. If you encounter any issues during the process, please refer to the Appwrite documentation or open an issue on the Appwrite GitHub repository.

## Usage

To use the project, follow these steps:

1. Open your web browser and navigate to the URL where the project is hosted.
2. If you haven't already done so, create an account and log in to the app.
3. Once you're logged in, you'll be taken to the home page where you can see a list of available language exchange sessions.
4. To join a chat room, click on the user you're interested in to open private chat page.
5. Once you've joined a chat room, you'll be able to chat with other participants and practice your language skills.

That's it! You should now be able to use the project to practice your language skills with other users. If you encounter any issues during the usage process, please refer to the project's documentation or open an issue on the project's GitHub repository.

## Deep Linking

Deep linking is a technique that allows an app to be opened to a specific UI or state, using a URL. This is useful for a variety of reasons, such as driving user engagement from web to app, or simply providing a better user experience.

### Android Deep Linking

1. Create a `/src/.well-known` directory in your project's `src` directory.

2. Inside the `/src/.well-known` directory, create a file named `assetlinks.json`

3. In the `assestslinks.json` file, add the following code to it:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.yourapp",
      "sha256_cert_fingerprints": ["14:6D:E9:..."]
    }
  }
]
```

Replace `com.example.yourapp` with your app's package name and replace `14:6D:E9:...` with the SHA-256 fingerprint of your app's signing certificate.

4. Add the `/src/.well-known` directory to the `assets` array in your `angular.json` file.

```json
"assets": [
  "src/favicon.ico",
  "src/assets",
  {
    "glob": "**/*",
    "input": "src/.well-known",
    "output": "/.well-known"
  }
]
```

5. Rebuild your project.

### iOS Universal Links

1. Create a `/src/.well-known` directory in your project's `src` directory.

2. Inside the `/src/.well-known` directory, create a file named `apple-app-site-association`

3. In the `apple-app-site-association` file, add the following code to it:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.BUNDLE_ID",
        "paths": ["*"]
      }
    ]
  }
}
```

Replace `TEAM_ID.BUNDLE_ID` with your app's Team ID and Bundle ID.

4. Add the `/src/.well-known` directory to the `assets` array in your `angular.json` file.

```json
"assets": [
  "src/favicon.ico",
  "src/assets",
  {
    "glob": "**/*",
    "input": "src/.well-known",
    "output": "/.well-known"
  }
]
```

5. Rebuild your project.

After following these steps, your Angular app should be set up to handle deep links on both Android and iOS devices.

For more information: https://capacitorjs.com/docs/guides/deep-links

## Firebase Messaging Service Worker

In your project, you need to create a file named `src/firebase-messaging-sw.js`. This file will be responsible for handling Firebase messaging in the service worker.

Here's a breakdown of the code in this file:

```js
// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js");

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
const firebaseApp = initializeApp({
  apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  projectId: "xxxxxxxxxxxxxxxxxx",
  storageBucket: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  messagingSenderId: "xxxxxxxxxxxx",
  appId: "x:xxxxxxxxxxxx:web:xxxxxxxxxxxxxxxxxxxx",
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();
```

This code initializes your Firebase application with your Firebase configuration. Replace the "xxxxxxx" with your actual Firebase configuration values.

This line retrieves an instance of Firebase Messaging so that it can handle background messages.

## Contributing

We welcome contributions to the project! For detailed instructions on how to contribute, please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Security

### Paths

- `android/app/google-services.json`

- `ios/App/App/GoogleService-info.plist`

### Google Services

#### GoogleService-info.plist and google-services.json

`google-services.json` is a configuration file that contains information about a Firebase project, such as the project's API key, database URL, and storage bucket. It is used by Android apps to connect to Firebase services, such as Firebase Authentication, Firebase Realtime Database, and Firebase Cloud Messaging.

The content of the Firebase config or object can be considered as public, including the app's platform-specific ID (Apple bundle ID or Android package name) and the Firebase project-specific values, like the API Key, project ID, Realtime Database URL, and Cloud Storage bucket name. Given this, use Firebase Security Rules to protect your data and files in Realtime Database, Cloud Firestore, and Cloud Storage.

`GoogleService-info.plist` is a configuration file that contains information about a Firebase project, such as the project's API key, database URL, and storage bucket. It is used by iOS apps to connect to Firebase services, such as Firebase Authentication, Firebase Realtime Database, and Firebase Cloud Messaging.

To secure the `GoogleService-info.plist` file, you can ensure that it is not publicly accessible. This can be done by adding the file to your app's .gitignore file to prevent it from being committed to your repository. Additionally, you can use Firebase Security Rules to restrict access to your Firebase project's resources, such as the Realtime Database and Cloud Storage, to only authorized users.

It is also important to keep your Firebase project's API key and other sensitive information secure. You can use a password manager to securely store your API key and other credentials, and avoid hardcoding them in your app's code.

For more information on how to secure your Firebase project, please refer to the following resources:

- [Config Files Objects](https://firebase.google.com/docs/projects/learn-more#config-files-objects)

## Stats

### Stargazers

[![Stargazers over time](https://starchart.cc/languageXchange/languageXchange.svg)](https://starchart.cc/languageXchange/languageXchange)

### Contributors

[![GitHub Contributor Over Time](https://contributor-overtime-api.git-contributor.com/contributors-svg?chart=contributorOverTime&repo=languageXchange/languageXchange)](https://git-contributor.com?chart=contributorOverTime&repo=languageXchange/languageXchange)

[![GitHub Contributors Image](https://contrib.rocks/image?repo=languageXchange/languageXchange)](https://github.com/languageXchange/languageXchange/graphs/contributors)

## License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](./LICENSE) file for details.

