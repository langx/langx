import { Component } from '@angular/core';
import { StorageService } from './services/storage/storage.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private storageService: StorageService,
  ) {}

  async ngOnInit() {
    await this.checkStorageForDarkMode();
  }

  async checkStorageForDarkMode() {
    await this.storageService.initStorage();
    let darkMode = await this.storageService.get('darkMode')
    console.log('darkMode: ', darkMode);

    if(darkMode == null) {
      this.initDarkMode();
    } else if (darkMode) {
      this.toggleDarkTheme(true);
    } else { 
      this.toggleDarkTheme(false);
    }
  }

  async getValue(key: string) {
    return await this.storageService.get(key);
  }

  initDarkMode() {
    console.log('initDarkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    console.log('prefersDark: ', prefersDark);
    this.toggleDarkTheme(prefersDark.matches);

    // Listen for changes to the prefers-color-scheme media query
    prefersDark.addEventListener('change', (mediaQuery) => this.toggleDarkTheme(mediaQuery.matches));
  }

  toggleDarkTheme(shouldAdd) {
      document.body.classList.toggle('dark', shouldAdd);
  }

}