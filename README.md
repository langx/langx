# languageXchange

languageXchange is a web application built with Angular and Ionic that helps users exchange different languages by connecting them with native speakers. Users can join chat rooms with other participants and practice their language skills in a fun and interactive way. The app uses Appwrite for the back-end. <!-- and includes Appwrite Cloud Functions for additional functionality.-->

This project developed by New Chapter Team.

## Table of Contents

- [Status](#status)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Status

This project is currently in development. The current version is 0.1.0. For more information, please refer to the project's GitHub repository.

To check the status of the website, database and CDN, please visit the following link: https://status.languagexchange.net/

## Installation

To install the project locally, follow these steps:

1. Clone the repository to your local machine using the command `git clone https://github.com/newchaptertech/languageXchange.git`
   - Navigate to the project directory using the command `cd languageXchange`
   - Install the Ionic CLI globally using the command `npm install -g @ionic/cli`
   - Install the project dependencies using the command `npm install`
2. Create a new Appwrite project and enable the Authentication and Database services.
   - In the Appwrite console, go to Project Settings and copy the Appwrite endpoint and project ID.
   - Rename the `environment.ts.sample` file in the `src/environments` directory to `environment.ts`
   - Replace the `YOUR_ENDPOINT` and `YOUR_PROJECT_ID` placeholders in the `environment.ts` file with the actual values from your Appwrite project.
     ```typescript
     export const environment = {
       production: false,
       appwrite: {
         endpoint: "YOUR_ENDPOINT",
         projectId: "YOUR_PROJECT_ID",
       },
     };
     ```
3. Start the development server using the command `ionic serve`
4. Open your web browser and navigate to `http://localhost:8100`

That's it! You should now be able to see the project running locally on your machine. If you encounter any issues during the installation process, please refer to the project's documentation or open an issue on the project's GitHub repository.

<!--
### Cloud Functions

To push Appwrite Cloud Functions, follow these steps:

1. Make sure you have the Appwrite CLI installed on your machine. If you don't have it installed, you can install it using the command `npm install -g appwrite`
2. Navigate to the root directory of your Appwrite project using the command line.
3. Run the command `appwrite login` to log in to your Appwrite account.
4. Run the command `appwrite functions create` to initialize the Appwrite Cloud Functions in your project.
5. Follow the prompts to select your Appwrite project and choose the language you want to use for your functions.
6. Once the initialization is complete, you can check Cloud Functions code in the `appwrite/functions/index.js` file (if you're using JavaScript) or you can convert `appwrite/functions/index.js` to `appwrite/functions/index.ts` file (if you're using TypeScript).
7. Once you've written your Cloud Functions code, run the command `appwrite functions deploy` to deploy your functions to Appwrite.
8. Appwrite will provide you with a URL for each of your Cloud Functions that you can use to call them from your app.

That's it! You should now be able to push your Appwrite Cloud Functions to Appwrite and use them in your app. If you encounter any issues during the process, please refer to the Appwrite documentation or open an issue on the Appwrite GitHub repository.
-->

## Usage

To use the project, follow these steps:

1. Open your web browser and navigate to the URL where the project is hosted.
2. If you haven't already done so, create an account and log in to the app.
3. Once you're logged in, you'll be taken to the home page where you can see a list of available language exchange sessions.
4. To join a chat room, click on the user you're interested in to open private chat page.
5. Once you've joined a chat room, you'll be able to chat with other participants and practice your language skills.

That's it! You should now be able to use the project to practice your language skills with other users. If you encounter any issues during the usage process, please refer to the project's documentation or open an issue on the project's GitHub repository.

## Contributing

We welcome contributions to the project! To contribute, follow these steps:

Fork the project repository to your own GitHub account.

1. Clone the forked repository to your local machine using the command `git clone https://github.com/behicsakar/languageXchange`
2. Create a new branch for your changes using the command `git checkout -b my-new-branch`
3. Make your changes to the codebase and commit them using the command `git commit -am "Add some feature"`
4. Push your changes to your forked repository using the command `git push origin my-new-branch`
5. Create a pull request from your forked repository to the original repository.
6. Wait for the project maintainers to review your pull request and provide feedback.
7. Once your pull request has been approved, it will be merged into the main branch of the project.

That's it! You should now be able to contribute to the project and help make it better. If you encounter any issues during the contribution process, please refer to the project's documentation or open an issue on the project's GitHub repository.

## Security

### GoogleService-info.plist

The content of the Firebase config or object can be considered as public, including the app's platform-specific ID (Apple bundle ID or Android package name) and the Firebase project-specific values, like the API Key, project ID, Realtime Database URL, and Cloud Storage bucket name. Given this, use Firebase Security Rules to protect your data and files in Realtime Database, Cloud Firestore, and Cloud Storage.

`GoogleService-info.plist` is a configuration file that contains information about a Firebase project, such as the project's API key, database URL, and storage bucket. It is used by iOS apps to connect to Firebase services, such as Firebase Authentication, Firebase Realtime Database, and Firebase Cloud Messaging.

To secure the `GoogleService-info.plist` file, you can ensure that it is not publicly accessible. This can be done by adding the file to your app's .gitignore file to prevent it from being committed to your repository. Additionally, you can use Firebase Security Rules to restrict access to your Firebase project's resources, such as the Realtime Database and Cloud Storage, to only authorized users.

It is also important to keep your Firebase project's API key and other sensitive information secure. You can use a password manager to securely store your API key and other credentials, and avoid hardcoding them in your app's code.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
