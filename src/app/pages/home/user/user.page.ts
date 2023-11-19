import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular';

import { getAge, lastSeen } from 'src/app/extras/utils';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
})
export class UserPage implements OnInit {
  userId: string;
  user: any;

  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    //TODO: this.userID may be used in nowhere
    const id: string = this.route.snapshot.paramMap.get('id');
    if (id) this.userId = id;
    // this.getUserData();
  }

  // async getUserData() {
  //   await this.userService
  //     .getUserDoc2(this.userId)
  //     .then((user) => {
  //       this.user = user;
  //     })
  //     .catch((error) => {
  //       console.log(error);
  //     });
  // }

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

  getStudyLanguages() {
    return this.user?.languages.filter((lang) => !lang.motherLanguage);
  }

  getMotherLanguage() {
    return this.user?.languages.filter((lang) => lang.motherLanguage);
  }

  getGender(): string {
    return (
      this.user?.gender.charAt(0).toUpperCase() + this.user?.gender.slice(1)
    );
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  getAge(d: any) {
    if (!d) return null;
    return getAge(d);
  }
}
