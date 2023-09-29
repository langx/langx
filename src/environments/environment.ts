// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  firebase: {
    apiKey: 'AIzaSyAreigjnx4DTOkcZ4pV4ZoMf44kYzIIHdg',
    authDomain: 'firechat-3b654.firebaseapp.com',
    databaseURL:
      'https://firechat-3b654-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'firechat-3b654',
    storageBucket: 'firechat-3b654.appspot.com',
    messagingSenderId: '273644625627',
    appId: '1:273644625627:web:e1ae7d00a3e70bd937f6fe',
    measurementId: 'G-DJGSVHN3CW',
  },
  appwrite: {
    APP_ENDPOINT: 'https://db.languagexchange.net/v1',
    APP_PROJECT: '650750d21e4a6a589be3',
    APP_DATABASE: '650750f16cd0c482bb83',
    USERS_COLLECTION: '65103e2d3a6b4d9494c8',
    ROOMS_COLLECTION: '6507510fc71f989d5d1c',
    MESSAGES_COLLECTION: '65075108a4025a4f5bd7',
    LANGUAGES_COLLECTION: '6511599e2bf0bb1b4d2c',
    USER_BUCKET: '6515f94d20becd47cb40',
  },
  production: false,
  url: {
    HOMEPAGE_URL: 'http://localhost:8100/',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
