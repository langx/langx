import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import 'hammerjs';

import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { BundleInfo, CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.log(err));

// Call the element loader after the platform has been bootstrapped
defineCustomElements(window);

CapacitorUpdater.notifyAppReady();
let data: BundleInfo | null = null;

App.addListener('appStateChange', async (state: any) => {
  console.log('appStateChange', state);
  if (state.isActive) {
    console.log('getLatest');
    // Do the download during user active app time to prevent failed download
    try {
      const latest = await CapacitorUpdater.getLatest();
      console.log('latest', latest);
      if (latest.url) {
        try {
          data = await CapacitorUpdater.download({
            url: latest.url,
            version: latest.version,
          });
          console.log('download', data);

          // if (!state.isActive && data) {
          //   console.log('set');
          //   // Do the switch when user leave app or when you want
          //   SplashScreen.show();
          //   try {
          //     await CapacitorUpdater.set({ id: data.id });
          //   } catch (err) {
          //     console.log(err);
          //     SplashScreen.hide(); // in case the set fail, otherwise the new app will have to hide it
          //   }
          // }
        } catch (downloadError) {
          console.error('Error downloading the latest update:', downloadError);
        }
      }
    } catch (getLatestError) {
      console.error('Error getting the latest update:', getLatestError);
    }
  }
});
