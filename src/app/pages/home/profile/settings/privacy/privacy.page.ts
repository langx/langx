import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { environment } from 'src/environments/environment';
import { User } from 'src/app/models/User';
import {
  currentUserSelector,
  isLoadingSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
})
export class PrivacyPage implements OnInit {
  subscription: Subscription;
  currentUser$: Observable<User>;

  disabledButtons: boolean = false;
  onlineStatus: boolean;
  profileVisits: boolean;

  public legacyPages = [
    {
      title: 'Privacy Policy',
      url: environment.web.PRIVACY_POLICY_URL,
      detail: true,
    },
    {
      title: 'Terms & Conditions',
      url: environment.web.TERMS_AND_CONDITIONS_URL,
      detail: true,
    },
    {
      title: 'Cookie Policy',
      url: environment.web.COOKIES_POLICY_URL,
      detail: true,
    },
    {
      title: 'Data Deletion',
      url: environment.web.DATA_DELETION_URL,
      detail: true,
    },
  ];

  constructor(private store: Store, private router: Router) {}

  ngOnInit() {
    this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Loading
    this.subscription.add(
      this.store.pipe(select(isLoadingSelector)).subscribe((isLoading) => {
        this.disabledButtons = isLoading;
      })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    // TODO: Implement init privacy values
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
  }

  onlieStatusState(event) {
    this.onlineStatus = event.detail.checked;
  }

  profileVisitsState(event) {
    this.profileVisits = event.detail.checked;
  }

  // Internal links

  blockedUsersPage() {
    this.router.navigate(['home/account/blocked-users']);
  }

  // External links
  async openLegacyPage(page: any) {
    await Browser.open({ url: page.url });
  }

  async openStatusPage() {
    await Browser.open({ url: environment.ext.STATUS_PAGE });
  }

  async openLandingPage() {
    await Browser.open({ url: environment.ext.WEBSITE_URL });
  }

  async openGithubPage() {
    await Browser.open({ url: environment.ext.GITHUB_URL });
  }
}
