import { Component, OnInit } from '@angular/core';
import { StorageService } from 'src/app/services/storage/storage.service';

@Component({
  selector: 'app-appearance',
  templateUrl: './appearance.page.html',
  styleUrls: ['./appearance.page.scss'],
})
export class AppearancePage implements OnInit {
  theme: string;
  themes: string[] = ['day', 'night'];

  constructor(private storageService: StorageService) {}

  async ngOnInit() {
    await this.checkTheme();
  }

  async checkTheme() {
    this.theme = await this.getValue('theme');
    if (this.theme == null || !this.themes.includes(this.theme)) {
      await this.setValue('auto');
      this.theme = 'auto';
    }
    console.log('theme in storage: ', this.theme);
  }

  // This is for the radio buttons event
  modeChange = (event: any) => {
    let val = event.detail.value;
    console.log(val);
    this.setValue(val);
    if (val == 'auto') {
      this.initAutoMode();
    } else if (val == 'night') {
      this.toggleDarkTheme(true);
    } else if (val == 'day') {
      this.toggleDarkTheme(false);
    }
  };

  initAutoMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.toggleDarkTheme(prefersDark.matches);
  }

  toggleDarkTheme(shouldAdd) {
    document.body.classList.toggle('dark', shouldAdd);
  }

  async setValue(theme: string) {
    await this.storageService.setValue('theme', theme);
  }

  async getValue(theme: string) {
    return this.storageService.getValue(theme);
  }
}
