import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-appearance',
  templateUrl: './appearance.page.html',
  styleUrls: ['./appearance.page.scss'],
})
export class AppearancePage implements OnInit {

  themeToggle = false;

  constructor() { }

  ngOnInit() {
    // Use matchMedia to check the user preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    console.log('prefersDark: ', prefersDark);

    // Initialize the dark theme based on the initial
    // value of the prefers-color-scheme media query
    this.initializeDarkTheme(prefersDark.matches);

    // Listen for changes to the prefers-color-scheme media query
    prefersDark.addEventListener('change', (mediaQuery) => this.initializeDarkTheme(mediaQuery.matches));
  }

  // Check/uncheck the toggle and update the theme based on isDark
  initializeDarkTheme(isDark) {
    this.themeToggle = isDark;
    this.toggleDarkTheme(isDark);
  }

  // Listen for the toggle check/uncheck to toggle the dark theme
  toggleChange(ev) {
    console.log('toggleChange: ', ev.detail.checked);
    this.toggleDarkTheme(ev.detail.checked);
  }

  // Add or remove the "dark" class on the document body
  toggleDarkTheme(shouldAdd) {
      document.body.classList.toggle('dark', shouldAdd);
  }

  modeChange = (event) => {  
    let val = event.detail.value;
    console.log(val);
    //document.body.classList.toggle('dark');
  }

}