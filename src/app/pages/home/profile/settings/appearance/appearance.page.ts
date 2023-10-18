import { Component, OnInit } from '@angular/core';
import { StorageService } from 'src/app/services/storage/storage.service';

@Component({
  selector: 'app-appearance',
  templateUrl: './appearance.page.html',
  styleUrls: ['./appearance.page.scss'],
})
export class AppearancePage implements OnInit {
  defaultValue: string;
  darkMode: boolean;
  prefersDark: boolean;

  constructor(private storageService: StorageService) {}

  async ngOnInit() {
    // await this.checkStorageForDarkMode();
    // await this.storageService.setValue('darkMode', 'true');
    await this.getName();
  }

  async getName() {
    this.storageService.getValue('darkMode');
  }

  async checkStorageForDarkMode() {
    await this.storageService.initStorage();
    let darkMode = await this.getValue('darkMode');

    console.log('darkMode in storage: ', darkMode);

    if (darkMode == null) {
      this.defaultValue = 'auto';
    } else if (darkMode) {
      this.defaultValue = 'dark';
    } else {
      this.defaultValue = 'light';
    }
  }

  // This is for the radio buttons
  modeChange = (event) => {
    let val = event.detail.value;
    console.log(val);
    if (val == 'auto') {
      this.removeValue('darkMode');
      this.initAutoMode();
    } else if (val == 'dark') {
      this.toggleDarkTheme(true);
      this.setValue(true);
    } else if (val == 'light') {
      this.toggleDarkTheme(false);
      this.setValue(false);
    }
  };

  initAutoMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.toggleDarkTheme(prefersDark.matches);
  }

  toggleDarkTheme(shouldAdd) {
    document.body.classList.toggle('dark', shouldAdd);
  }

  async setValue(isDark: boolean) {
    await this.storageService.set('darkMode', isDark);
  }

  async getValue(key: string) {
    return this.storageService.get(key);
  }

  async removeValue(key: string) {
    await this.storageService.remove(key);
  }
}
