import { Component, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-about-us',
  templateUrl: './about-us.page.html',
  styleUrls: ['./about-us.page.scss'],
})
export class AboutUsPage implements OnInit {
  public aboutUsPages = [
    {
      title: '🏠 Landing Page',
      url: environment.ext.WEBSITE_URL,
      detail: true,
    },
    {
      title: '👨‍💻 Github Page',
      url: environment.ext.GITHUB_URL,
      detail: true,
    },
    {
      title: '🟢 Status Page',
      url: environment.ext.STATUS_PAGE,
      detail: true,
    },
  ];

  constructor() {}

  ngOnInit() {}

  async openAboutUsPage(page: any) {
    await Browser.open({ url: page.url });
  }
}
