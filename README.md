# languageXchange

This project is designed to help users to exchange different languages by connecting them with native speakers.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Installation


To install the project locally, follow these steps:

1. Clone the repository to your local machine using the command ``git clone https://github.com/behicsakar/languageXchange.git``
    - Navigate to the project directory using the command ``cd languageXchange``
    - Install the Ionic CLI globally using the command ``npm install -g @ionic/cli``
    - Install the project dependencies using the command ``npm install``
2. Create a new Firebase project and enable the Authentication and Firestore services.
    - In the Firebase console, go to Project Settings and copy the Firebase config object.
    - Rename the ``environment.ts.sample`` file in the ``src/environments`` directory to ``environment.ts``
    - Replace the ``YOUR_API_KEY``, ``YOUR_AUTH_DOMAIN``, ``YOUR_PROJECT_ID``, ``YOUR_STORAGE_BUCKET``, ``YOUR_MESSAGING_SENDER_ID``, and ``YOUR_APP_ID`` placeholders in the ``environment.ts`` file with the actual values from your Firebase project.
      ``` typescript
        export const environment = {
          production: false,
          firebaseConfig: {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_AUTH_DOMAIN",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_STORAGE_BUCKET",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID"
          }
        };
      ```
3. Start the development server using the command ``ionic serve``
4. Open your web browser and navigate to ``http://localhost:8100``

That's it! You should now be able to see the project running locally on your machine. If you encounter any issues during the installation process, please refer to the project's documentation or open an issue on the project's GitHub repository.



## Usage

Instructions for using the project.

## Contributing

Guidelines for contributing to the project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.