import { Component, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-about-us',
  templateUrl: './about-us.page.html',
  styleUrls: ['./about-us.page.scss'],
})
export class AboutUsPage implements OnInit {
  appVersion: string;

  public aboutUsPages = [
    {
      title: 'Landing Page',
      url: environment.ext.WEBSITE_URL,
      icon: 'globe-outline',
      detail: true,
    },
    {
      title: '🟢 Status Page',
      url: environment.ext.STATUS_PAGE,
      icon: 'server-outline',
      detail: true,
    },
    {
      title: 'Github Page',
      url: environment.ext.GITHUB_URL,
      icon: 'logo-github',
      detail: true,
    },
    {
      title: 'Issues',
      url: environment.ext.ISSUES,
      icon: 'bug-outline',
      detail: true,
    },
    {
      title: 'Contributing Page',
      url: environment.ext.CONTRIBUTING,
      icon: 'git-branch-outline',
      detail: true,
    },
    {
      title: 'Security Page',
      url: environment.ext.SECURITY_PAGE,
      icon: 'shield-checkmark-outline',
      detail: true,
    },
  ];

  public releasesPages = [
    {
      title: 'Release Notes',
      url: environment.ext.RELEASES_URL,
      icon: 'document-text-outline',
      detail: true,
    },
  ];

  public licenses = [
    {
      title: 'BSD-3-Clause License',
      url: environment.ext.BSD3_LICENSE_URL,
      icon: 'file-tray-stacked-outline',
      detail: true,
    },
    {
      title: 'MIT License',
      url: environment.ext.MIT_LICENSE_URL,
      icon: 'file-tray-stacked-outline',
      detail: true,
    },
    {
      title: 'Code of Conduct',
      url: environment.ext.CODE_OF_CONDUCT,
      icon: 'heart-outline',
      detail: true,
    },
  ];

  constructor() {}

  async ngOnInit() {
    if (Capacitor.getPlatform() === 'web') {
      this.appVersion = 'Web App (pwa)';
    } else {
      const info = await App.getInfo();
      this.appVersion = `v${info.version}`;
    }
  }

  async openPage(page: any) {
    await Browser.open({ url: page.url });
  }
}
