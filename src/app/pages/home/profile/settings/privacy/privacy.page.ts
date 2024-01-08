import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';

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

  async openLegacyPage(page: any) {
    await Browser.open({ url: page.url });
  }

  blockedUsersPage() {
    this.router.navigate(['home/account/blocked-users']);
  }
}
