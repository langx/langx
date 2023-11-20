import { Component, ErrorHandler, OnInit, ViewChild } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  IonModal,
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular';

// Component and utils Imports
import { lastSeen, getAge } from 'src/app/extras/utils';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';

// Interfaces Imports
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';
import { Account } from 'src/app/models/Account';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Actions Imports
import { getCurrentUserAction } from 'src/app/store/actions/user.action';
import { logoutAction } from 'src/app/store/actions/auth.action';

// Selectors Imports
import {
  accountSelector,
  currentUserSelector,
  isLoadingSelector,
  profileErrorSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
  @ViewChild(IonModal) modal: IonModal;

  public appPages = [
    {
      title: 'Account',
      url: 'account',
      icon: 'person-circle-outline',
      detail: true,
    },
    {
      title: 'Notifications',
      url: 'notifications',
      icon: 'notifications-outline',
      detail: true,
    },
    {
      title: 'Privacy',
      url: 'privacy',
      icon: 'shield-checkmark-outline',
      detail: true,
    },
    {
      title: 'Appearance',
      url: 'appearance',
      icon: 'contrast-outline',
      detail: true,
    },
    { title: 'Logout', url: 'logout', icon: 'log-out-outline', detail: false },
  ];

  currentUser$: Observable<User | null> = null;
  account$: Observable<Account | null> = null;

  // TODO: Use currentUser directly
  currentUserId: string | null = null;
  studyLanguages: Language[] = [];
  motherLanguages: Language[] = [];
  gender: string = null;
  lastSeen: string = null;
  age: number = null;
  profilePhoto: URL = null;
  otherPhotos: URL[] = [];

  constructor(
    private store: Store,
    private router: Router,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.account$ = this.store.pipe(select(accountSelector));

    // Set currentUser
    this.currentUser$.subscribe((user) => {
      if (!user) return;
      this.currentUserId = user.$id;
      this.studyLanguages = user?.languages.filter(
        (lang) => !lang.motherLanguage
      );
      this.motherLanguages = user?.languages.filter(
        (lang) => lang.motherLanguage
      );
      this.gender =
        user?.gender.charAt(0).toUpperCase() + user?.gender.slice(1);
      this.lastSeen = lastSeen(user?.lastSeen);
      this.age = getAge(user?.birthdate);
      this.profilePhoto = user?.profilePhoto;
      this.otherPhotos = user?.otherPhotos;
    });

    // isLoading
    this.store.pipe(select(isLoadingSelector)).subscribe((isLoading) => {
      if (isLoading) {
        this.loadingController(true);
      } else {
        this.loadingController(false);
      }
    });

    // profileError Handling
    this.store
      .pipe(select(profileErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error && error.message) this.presentToast(error.message, 'danger');
      });
  }

  getAccountPage(page) {
    if (page?.url == 'logout') {
      this.logout();
      this.dismissModal();
      return;
    }
    this.dismissModal();
    this.router.navigate(['/', 'home', page?.url]);
  }

  async logout() {
    this.store.dispatch(logoutAction());
  }

  editProfile() {
    this.router.navigate(['/', 'home', 'profile', 'edit']);
  }

  // TODO: #168 Start slideshow from selected photo
  async openPreview(photos) {
    console.log(photos);
    const modal = await this.modalCtrl.create({
      component: PreviewPhotoComponent,
      componentProps: {
        photos: photos,
      },
    });
    modal.present();
  }

  dismissModal() {
    this.modal.dismiss();
  }

  // lastSeen(d: any) {
  //   if (!d) return null;
  //   console.log(d);
  //   return lastSeen(d);
  // }

  // getAge(d: any) {
  //   if (!d) return null;
  //   return getAge(d);
  // }

  handleRefresh(event) {
    this.store.dispatch(getCurrentUserAction({ userId: this.currentUserId }));
    this.initValues();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

  //
  // Loading Controller
  //

  loadingOverlay: HTMLIonLoadingElement;
  isLoadingOverlayActive = false;
  async loadingController(isLoading: boolean) {
    if (isLoading) {
      if (!this.loadingOverlay && !this.isLoadingOverlayActive) {
        this.isLoadingOverlayActive = true;
        this.loadingOverlay = await this.loadingCtrl.create({
          message: 'Please wait...',
        });
        await this.loadingOverlay.present();
        this.isLoadingOverlayActive = false;
      }
    } else if (
      this.loadingOverlay &&
      this.loadingOverlay.present &&
      !this.isLoadingOverlayActive
    ) {
      this.isLoadingOverlayActive = true;
      await this.loadingOverlay.dismiss();
      this.loadingOverlay = undefined;
      this.isLoadingOverlayActive = false;
    }
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
