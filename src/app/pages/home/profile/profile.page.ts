import { Component, OnInit, ViewChild } from '@angular/core';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { Router } from '@angular/router';
import { IonModal, ModalController } from '@ionic/angular';
import { lastSeen, getAge } from 'src/app/extras/utils';
import { PreviewPhotoComponent } from 'src/app/components/preview-photo/preview-photo.component';
import { UserService } from 'src/app/services/user/user.service';

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

  cUserSession: any;
  cUserDoc: any;

  isLoading: boolean = false;

  constructor(
    private router: Router,
    private auth2Service: Auth2Service,
    private userService: UserService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.getProfileInfo();
  }

  async getProfileInfo() {
    //showLoader();
    this.isLoading = true;

    this.auth2Service
      .getUser()
      .subscribe((cUser) => {
        if (cUser) {
          console.log(cUser);
          this.cUserSession = cUser;
        }
      })
      .unsubscribe();
    // TODO: Unsubscribe may not be necessary to update the user info

    this.userService.getUserDoc(this.cUserSession.$id).then((user) => {
      this.cUserDoc = user;
      console.log(user);
    });

    //hideLoader();
    this.isLoading = false;
  }

  ngOnDestroy() {
    // this.cUser.unsubscribe();
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
      //showLoader();
      this.isLoading = true;
      await this.auth2Service.logout();
      this.router.navigateByUrl('/login', { replaceUrl: true });
      //hideLoader();
      this.isLoading = false;
    } catch (e) {
      console.log(e);
    }
  }

  editProfile() {
    this.router.navigate(['/', 'home', 'profile', 'edit']);
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

  dismissModal() {
    this.modal.dismiss();
  }

  getStudyLanguages() {
    return this.cUserDoc?.languages.filter((lang) => !lang.motherLanguage);
  }

  getMotherLanguage() {
    return this.cUserDoc?.languages.filter((lang) => lang.motherLanguage);
  }

  getGender(): string {
    return (
      this.cUserDoc?.gender.charAt(0).toUpperCase() +
      this.cUserDoc?.gender.slice(1)
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

  handleRefresh(event) {
    this.getProfileInfo();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }
}
