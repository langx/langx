import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Browser } from '@capacitor/browser';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { getAge, lastSeen } from 'src/app/extras/utils';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';
import { Language } from 'src/app/models/Language';
import { User } from 'src/app/models/User';
import { getUserByIdAction } from 'src/app/store/actions/user.action';
import { userSelector } from 'src/app/store/selectors/user.selector';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
})
export class UserPage implements OnInit {
  userId: string;
  user$: Observable<User>;

  studyLanguages: Language[] = [];
  motherLanguages: Language[] = [];
  gender: string = null;
  profilePhoto: URL = null;
  otherPhotos: URL[] = [];
  badges: string[] = [];

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    this.initValues();
  }

  initValues() {
    this.userId = this.route.snapshot.paramMap.get('id') || null;
    this.user$ = this.store.pipe(select(userSelector));

    // Get User By userId
    this.store.dispatch(getUserByIdAction({ userId: this.userId }));

    // Set User
    this.user$.subscribe((user) => {
      this.studyLanguages = user?.languages.filter(
        (lang) => !lang.motherLanguage
      );
      this.motherLanguages = user?.languages.filter(
        (lang) => lang.motherLanguage
      );
      this.gender =
        user?.gender.charAt(0).toUpperCase() + user?.gender.slice(1);
      this.profilePhoto = user?.profilePhoto;
      this.otherPhotos = user?.otherPhotos;
      this.badges = user?.badges.map(
        (badge) => `/assets/image/badges/${badge}.png`
      );
    });
  }

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

  //
  // Block User
  //

  blockUser() {
    console.log('Block User');
  }

  async openTermsAndPolicyLink() {
    await Browser.open({ url: environment.web.TERMS_AND_CONDITIONS_URL });
  }

  //
  // Utils
  //

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  getAge(d: any) {
    if (!d) return null;
    return getAge(d);
  }
}
