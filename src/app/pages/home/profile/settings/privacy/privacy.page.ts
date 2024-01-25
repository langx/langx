import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
})
export class PrivacyPage implements OnInit {
  public legacyPages = [
    {
      title: 'Privacy Policy',
      url: 'https://languagexchange.net/privacy-policy',
      detail: true,
    },
    {
      title: 'Terms & Conditions',
      url: 'https://languagexchange.net/terms-conditions',
      detail: true,
    },
    {
      title: 'Cookie Policy',
      url: 'https://languagexchange.net/cookie-policy',
      detail: true,
    },
    {
      title: 'Data Deletion',
      url: 'https://languagexchange.net/data-deletion',
      detail: true,
    },
  ];

  constructor(private router: Router) {}

  ngOnInit() {}

  blockedUsersPage() {
    this.router.navigate(['home/account/blocked-users']);
  }

  profileVisitsState(event) {
    console.log('profileVisits State:', event.detail.checked);
  }

  // External links
  async openLegacyPage(page: any) {
    await Browser.open({ url: page.url });
  }

  async openStatusPage() {
    await Browser.open({ url: environment.ext.STATUS_PAGE });
  }

  async openLandingPage() {
    await Browser.open({ url: environment.ext.WEBSITE_URL});
  }

  async openGithubPage() {
    await Browser.open({ url: environment.ext.GITHUB_URL });
  }
}
