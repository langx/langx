import { Component } from '@angular/core';
import { StorageService } from './services/storage/storage.service';
import { FcmService } from './services/fcm/fcm.service';
import { register } from 'swiper/element/bundle';

register();

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private storageService: StorageService,
    private fcmService: FcmService
  ) {}

  async ngOnInit() {
    await this.checkTheme();
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

  toggleDarkTheme(shouldAdd) {
    document.body.classList.toggle('dark', shouldAdd);
  }
}
