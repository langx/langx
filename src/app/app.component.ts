import { Component, NgZone } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Store, select } from '@ngrx/store';

import { environment } from 'src/environments/environment';
import { UpdateService } from './services/update/update.service';
import { StorageService } from 'src/app/services/storage/storage.service';
import { FcmService } from 'src/app/services/fcm/fcm.service';

import { currentUserSelector } from './store/selectors/auth.selector';
import { getRoomsAction } from './store/actions/rooms.action';
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
    private updateService: UpdateService,
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

    // Init App State Change
    this.initAppStateChange();

    // Init Deep Link
    this.initDeepLink();

    // Check for updates
    this.updateService.checkForUpdates();

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
  // App State Change
  //

  initAppStateChange() {
    App.addListener('appStateChange', (state) => {
      // state.isActive contains the active state
      // console.log('App state changed. New state:', state);
      // TODO: It has bug, pull up to page and it will call multiple times
      // List rooms
      // this.store
      //   .pipe(select(currentUserSelector))
      //   .subscribe((user) => {
      //     if (user) {
      //       console.log('List rooms called from app state change');
      //       this.store.dispatch(getRoomsAction());
      //     }
      //   })
      //   .unsubscribe();
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
