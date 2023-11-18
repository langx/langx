import { Component, OnInit, ViewChild } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Router } from '@angular/router';
import { IonModal, ModalController } from '@ionic/angular';
import { Observable } from 'rxjs';

import { AuthService } from 'src/app/services/auth/auth.service';
import { lastSeen, getAge } from 'src/app/extras/utils';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';
import { Account } from 'src/app/models/Account';
import { getProfileAction } from 'src/app/store/actions/profile.action';
import {
  accountSelector,
  currentUserSelector,
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

  currentUser: User | null = null;
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
    private authService: AuthService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.account$ = this.store.pipe(select(accountSelector));

    // Set currentUser
    this.currentUser$.subscribe((user) => {
      this.currentUser = user;
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
    try {
      await this.authService.logout();
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (e) {
      console.log(e);
    }
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
    this.store.dispatch(getProfileAction({ userId: this.currentUser?.$id }));
    this.initValues();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }
}
