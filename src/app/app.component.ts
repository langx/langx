import { Component, NgZone } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Store } from '@ngrx/store';

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

    console.log('theme in storage: ', theme);
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

  // Deep Link
  initDeepLink() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(() => {
        console.log('appUrlOpen', event);
        const slug = event.url.split('app.languagexchange.net').pop();
        console.log('slug: ', slug);
        if (slug) {
          if (slug.startsWith('tech.newchapter.languagexchange:/')) {
            const newSlug = slug
              .split('tech.newchapter.languagexchange:')
              .pop();
            console.log('newSlug: ', newSlug);
            this.router.navigateByUrl(newSlug);
          } else {
            this.router.navigateByUrl(slug);
          }
        }
      });
    });
  }
}
