import { Component, NgZone } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { BundleInfo, CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen } from '@capacitor/splash-screen';
import { Store } from '@ngrx/store';

import { environment } from 'src/environments/environment';
import { StorageService } from 'src/app/services/storage/storage.service';
import { FcmService } from 'src/app/services/fcm/fcm.service';
import {
  listCountriesAction,
  listLanguagesAction,
} from 'src/app/store/actions/locale.action';

register();

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private store: Store,
    private storageService: StorageService,
    private fcmService: FcmService,
    private router: Router,
    private zone: NgZone
  ) {}

  async ngOnInit() {
    await this.initValues();
  }

  async initValues() {
    // Check theme
    await this.checkTheme();

    // Init App Update
    this.initAppUpdate();

    // Init Deep Link
    this.initDeepLink();

    // Init Locale
    this.store.dispatch(listCountriesAction());
    this.store.dispatch(listLanguagesAction());

    // FCM Service listener
    this.fcmService.listenerPush();
  }

  async checkTheme() {
    let theme = await this.storageService.getValue('theme');
    if (theme == null) {
      await this.storageService.setValue('theme', 'auto');
      theme = 'auto';
    }

    if (theme == 'auto') {
      this.initAutoMode();
    } else if (theme == 'night') {
      this.toggleDarkTheme(true);
    } else if (theme == 'day') {
      this.toggleDarkTheme(false);
    }

    // console.log('Theme: ', theme);
  }

  initAutoMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.toggleDarkTheme(prefersDark.matches);

    // Listen for changes to the prefers-color-scheme media query
    prefersDark.addEventListener('change', (mediaQuery) =>
      this.toggleDarkTheme(mediaQuery.matches)
    );
  }

  toggleDarkTheme(shouldAdd: boolean) {
    document.body.classList.toggle('dark', shouldAdd);
  }

  //
  // App Update
  //

  initAppUpdate() {
    CapacitorUpdater.notifyAppReady();

    let data: BundleInfo | null = null;

    App.addListener('appStateChange', async (state: any) => {
      console.log('appStateChange', state);
      if (state.isActive) {
        console.log('getLatest');
        // Do the download during user active app time to prevent failed download
        const latest = await CapacitorUpdater.getLatest();
        console.log('latest', latest);
        if (latest.url) {
          data = await CapacitorUpdater.download({
            url: latest.url,
            version: latest.version,
          });
          console.log('download', data);
        }
      }
      if (!state.isActive && data) {
        console.log('set');
        // Do the switch when user leave app or when you want
        SplashScreen.show();
        try {
          await CapacitorUpdater.set({ id: data.id });
        } catch (err) {
          console.log(err);
          SplashScreen.hide(); // in case the set fail, otherwise the new app will have to hide it
        }
      }
    });
  }

  //
  // Deep Link
  //

  initDeepLink() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(() => {
        console.log('appUrlOpen', event);
        const slug = event.url.split(environment.url.HOMEPAGE_URL).pop();
        console.log('slug: ', slug);
        // TODO; First redirect page to check auth status (auth/oauth2/..) and redirect to slug
        this.router.navigateByUrl(slug);
      });
    });
  }
}
