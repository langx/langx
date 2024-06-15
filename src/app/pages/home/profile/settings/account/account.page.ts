import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { Observable, Subscription, combineLatest, map } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { Router } from '@angular/router';
import { Models, OAuthProvider } from 'appwrite';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { IonModal, ToastController, AlertController } from '@ionic/angular';

import { lastSeen } from 'src/app/extras/utils';
import { environment } from 'src/environments/environment';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

import { OAuth2Service } from 'src/app/services/auth/oauth2.service';

import {
  clearErrorsAction,
  deleteAccountAction,
  deleteIdentityAction,
  deleteSessionAction,
  listIdentitiesAction,
  listSessionsAction,
  syncDiscordRolesAction,
  verifyEmailAction,
} from 'src/app/store/actions/auth.action';
import {
  accountSelector,
  currentUserSelector,
  identitiesSelector,
  sessionsSelector,
  isLoadingSelector,
  accountDetailErrorSelector,
  verifyEmailErrorSelector,
  verifyEmailSuccessSelector,
  isLoadingDeleteAccountSelector,
  deleteAccountErrorSelector,
  newBadgesSelector,
  newRolesSelector,
  syncDiscordErrorSelector,
} from 'src/app/store/selectors/auth.selector';

interface ProviderStatus {
  provider: string;
  connected: boolean;
  id?: string;
}

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {
  @ViewChild('deleteUserModal') deleteUserModal: IonModal;

  allProviders: string[] = [
    OAuthProvider.Discord,
    OAuthProvider.Google,
    OAuthProvider.Facebook,
    OAuthProvider.Apple,
  ];
  providerStatuses: ProviderStatus[] = [];

  appVersion: string;

  subscription: Subscription;

  account$: Observable<Account | null> = null;
  currentUser$: Observable<User> = null;
  sessions$: Observable<Models.Session[]> = null;
  isLoading$: Observable<boolean> = null;
  verifyEmailSuccess$: Observable<boolean> = null;
  isLoadingDeleteAccount$: Observable<boolean> = null;

  verifyButtonDisabled = false; // to control the button's state
  verifyButtonText = 'Verify'; // to hold the button's text

  identities: Models.Identity[] = [];

  isSyncing: boolean = false;

  constructor(
    private store: Store,
    private router: Router,
    private OAuth2Service: OAuth2Service,
    private toastController: ToastController,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Present Toast if error
    this.subscription.add(
      this.store
        .pipe(select(accountDetailErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
            // Error Cleanup
            this.store.dispatch(clearErrorsAction());
          }
        })
    );
    this.subscription.add(
      this.store
        .pipe(select(verifyEmailErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
            // Error Cleanup
            this.store.dispatch(clearErrorsAction());
          }
        })
    );
    this.subscription.add(
      this.store
        .pipe(select(deleteAccountErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
            this.presentErrorAlertAfterDelete();
            // Error Cleanup
            this.store.dispatch(clearErrorsAction());
          }
        })
    );

    // Identifiers
    this.subscription.add(
      this.store
        .pipe(select(identitiesSelector))
        .subscribe((identities: Models.Identity[]) => {
          this.providerStatuses = this.allProviders.map((provider) => {
            let identity: Models.Identity | undefined;
            if (identities) {
              identity = identities.find(
                (identity) => identity.provider === provider
              );
            }
            return {
              provider,
              connected: !!identity,
              id: identity ? identity.$id : undefined,
            };
          });

          // Update UI
          // console.log(this.providerStatuses);
          this.cdr.detectChanges();
        })
    );

    // Sync Discord Roles and App Badges Error

    // Sync Discord Roles and App Badges Error

    this.subscription.add(
      combineLatest([
        this.store.pipe(select(syncDiscordErrorSelector)),
        this.store.pipe(select(newBadgesSelector)),
        this.store.pipe(select(newRolesSelector)),
      ])
        .pipe(
          map(([error, newBadges, newRoles]) => ({
            error,
            newBadges,
            newRoles,
          }))
        )
        .subscribe(({ error, newBadges, newRoles }) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          } else if (newBadges.length === 0 && newRoles.length === 0) {
            this.presentToast('No new badges or roles to sync.', 'warning');
          } else {
            if (newBadges.length > 0) {
              this.presentToast(
                `${newBadges.join(', ')} Badges Added.`,
                'success'
              );
              // Error Cleanup
              this.store.dispatch(clearErrorsAction());
            }
            if (newRoles.length > 0) {
              this.presentToast(
                `${newRoles.join(', ')} Discord Role(s) Added.`,
                'success'
              );
              // Error Cleanup
              this.store.dispatch(clearErrorsAction());
            }
          }

          // Error Cleanup
          this.store.dispatch(clearErrorsAction());
          this.isSyncing = false;
        })
    );

    // Present Toast if verifyEmailSuccess
    this.subscription.add(
      this.store
        .pipe(select(verifyEmailSuccessSelector))
        .subscribe((verifyEmailSuccess: boolean) => {
          if (verifyEmailSuccess) {
            this.presentToast('Email has been successfully sent.', 'success');
            // Error Cleanup
            this.store.dispatch(clearErrorsAction());
          }
        })
    );

    // isLoadingDeleteAccount
    this.subscription.add(
      this.store
        .pipe(select(isLoadingDeleteAccountSelector))
        .subscribe((isLoadingDeleteAccount: boolean) => {
          if (isLoadingDeleteAccount) {
            this.presentToast('Deleting account, please wait', 'warning');
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  async initValues() {
    // Dispatch the action to list identities
    this.store.dispatch(listIdentitiesAction());
    this.store.dispatch(listSessionsAction());

    // Get Selectors
    this.account$ = this.store.pipe(select(accountSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.sessions$ = this.store.pipe(select(sessionsSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector)); // TODO: Unused yet

    if (Capacitor.getPlatform() === 'web') {
      // this.appVersion = 'Web App (pwa)';
      this.appVersion = `v${environment.version}`;
    } else {
      const info = await App.getInfo();
      this.appVersion = `v${info.version}`;
    }
  }

  verifyEmail() {
    this.store.dispatch(verifyEmailAction());

    this.verifyButtonDisabled = true; // disable the button
    let countdown = 30; // start the countdown

    // update the button's text and decrease the countdown value every second
    const intervalId = setInterval(() => {
      this.verifyButtonText = `${countdown} sec`;
      countdown--;

      // when the countdown reaches 0, re-enable the button and clear the interval
      if (countdown < 0) {
        this.verifyButtonDisabled = false;
        this.verifyButtonText = 'Verify';
        clearInterval(intervalId);
      }
    }, 1000);
  }

  //
  // Identities and Sessions
  //

  connectIdentity(provider: string) {
    switch (provider) {
      case OAuthProvider.Discord:
        this.OAuth2Service.signInWithDiscord();
        break;
      case OAuthProvider.Google:
        this.OAuth2Service.signInWithGoogle();
        break;
      case OAuthProvider.Facebook:
        this.OAuth2Service.signInWithFacebook();
        break;
      case OAuthProvider.Apple:
        this.OAuth2Service.signInWithApple();
        break;
      default:
        console.error('Unknown provider');
    }
  }

  deleteIdentity($id: string) {
    this.store.dispatch(deleteIdentityAction({ request: { $id } }));
  }

  deleteSession($id: string) {
    console.log('deleteSession', $id);
    this.store.dispatch(deleteSessionAction({ request: { $id } }));
  }

  //
  // Sync Badges
  //

  syncBadges(identifierId: string) {
    console.log('Sync Badges', identifierId);
    this.isSyncing = true;
    // Dispatch the action to sync discord roles
    this.store.dispatch(syncDiscordRolesAction());
    setTimeout(() => {
      this.isSyncing = false;
    }, 3 * 1000); // 3 seconds
  }

  //
  // Others and Delete Account
  //

  updatePasswordPage() {
    this.router.navigateByUrl('/home/account/update-password');
  }

  async openDataDeletionLink() {
    await Browser.open({ url: environment.ext.DATA_DELETION_URL });
  }

  async openDeleteUserModal() {
    try {
      await this.deleteUserModal.present();
    } catch (error) {
      console.error('Error opening block user modal:', error);
    }
  }

  async deleteAccount() {
    const alert = await this.alertController.create({
      header: 'Confirm!',
      message: 'Are you sure you want to delete your account?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: (blah) => {
            console.log('Confirm Cancel: blah');
          },
        },
        {
          text: 'Delete',
          role: 'destructive', // Use 'destructive' role for danger color
          handler: () => {
            this.deleteUserModal.dismiss();
            this.store.dispatch(deleteAccountAction());
          },
        },
      ],
    });

    await alert.present();
  }

  async presentErrorAlertAfterDelete() {
    const alert = await this.alertController.create({
      header: 'Information',
      message: 'Please send your deletion request via email to hi@langx.io',
      buttons: ['OK'],
    });

    await alert.present();
  }

  //
  // Utils
  //

  lastSeen(d: any) {
    if (!d) return null;

    let result = lastSeen(d);

    // Check 'online'
    if (result === 'online') {
      return 'just now';
    }

    return result;
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 3000,
      position: 'top',
    });

    await toast.present();
  }
}
