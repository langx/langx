import { Component, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Router } from '@angular/router';
import { NativeMarket } from '@capacitor-community/native-market';
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

  public contributorsPages = [
    {
      title: 'Contributors',
      url: 'contributors',
      icon: 'people-outline',
      detail: true,
    },
    {
      title: 'Our Sponsors',
      url: 'sponsors',
      icon: 'heart-outline',
      detail: true,
    },
  ];

  public sponsorPages = [
    {
      title: 'Be Our Sponsor ❤️',
      url: environment.ext.SPONSOR,
      icon: 'heart-outline',
      detail: true,
    },
  ];

  public aboutUsPages = [
    {
      title: 'Website',
      url: environment.ext.WEBSITE_URL,
      icon: 'globe-outline',
      detail: true,
    },
    {
      title: 'Github',
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
      title: 'Contributing',
      url: environment.ext.CONTRIBUTING,
      icon: 'git-branch-outline',
      detail: true,
    },
    {
      title: 'Status Page 🟢',
      url: environment.ext.STATUS_PAGE,
      icon: 'server-outline',
      detail: true,
    },
    {
      title: 'Security',
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

  constructor(private router: Router) {}

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

  async openAppStore() {
    let appId: string;
    if (Capacitor.getPlatform() === 'android') {
      appId = environment.bundleId;
    } else if (Capacitor.getPlatform() === 'ios') {
      appId = environment.iosId;
    } else {
      return;
    }
    NativeMarket.openStoreListing({
      appId: appId,
    });
  }

  isNativePlatform() {
    return Capacitor.getPlatform() !== 'web';
  }

  getContributorsPage(page) {
    this.router.navigate(['/', 'home', page?.url]);
  }
}
