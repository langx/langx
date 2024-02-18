import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { environment } from 'src/environments/environment';
import { User } from 'src/app/models/User';
import { updateCurrentUserAction } from 'src/app/store/actions/user.action';
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

  currentUserId: string;
  privacy: string[];

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

    // Set Values
    this.subscription.add(
      this.currentUser$.subscribe((currentUser) => {
        this.onlineStatus = !currentUser.privacy.includes('onlineStatus');
        this.profileVisits = !currentUser.privacy.includes('profileVisits');
        this.currentUserId = currentUser.$id;
        this.privacy = currentUser.privacy;
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

  //
  // Toggle Switches
  //

  onlieStatusState(event) {
    this.onlineStatus = event.detail.checked;

    const newPrivacyArray = [...this.privacy];

    if (!this.onlineStatus) {
      // If the toggle is off, add 'onlineStatus' to the privacy array
      if (!newPrivacyArray.includes('onlineStatus')) {
        newPrivacyArray.push('onlineStatus');
      }
    } else {
      // If the toggle is on, remove 'onlineStatus' from the privacy array
      const index = newPrivacyArray.indexOf('onlineStatus');
      if (index !== -1) {
        newPrivacyArray.splice(index, 1);
      }
    }

    this.privacy = newPrivacyArray; // Assign the modified array back to this.privacy

    this.updateCurrentUserPrivacy();
  }

  profileVisitsState(event) {
    this.profileVisits = event.detail.checked;

    const newPrivacyArray = [...this.privacy];

    if (!this.profileVisits) {
      // If the toggle is off, add 'profileVisits' to the privacy array
      if (!newPrivacyArray.includes('profileVisits')) {
        newPrivacyArray.push('profileVisits');
      }
    } else {
      // If the toggle is on, remove 'profileVisits' from the privacy array
      const index = newPrivacyArray.indexOf('profileVisits');
      if (index !== -1) {
        newPrivacyArray.splice(index, 1);
      }
    }

    this.privacy = newPrivacyArray; // Assign the modified array back to this.privacy

    this.updateCurrentUserPrivacy();
  }

  updateCurrentUserPrivacy() {
    const request = {
      userId: this.currentUserId,
      data: {
        privacy: this.privacy,
      },
    };

    this.store.dispatch(updateCurrentUserAction({ request }));
  }

  //
  // Links
  //

  // Internal links
  blockedUsersPage() {
    this.router.navigate(['home/account/blocked-users']);
  }

  // External links
  async openLegacyPage(page: any) {
    await Browser.open({ url: page.url });
  }
}
