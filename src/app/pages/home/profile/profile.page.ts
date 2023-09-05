import { Component, OnInit, ViewChild } from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';
import { Router } from '@angular/router';
import { IonModal, ModalController } from '@ionic/angular';
import { lastSeen, getAge } from 'src/app/extras/utils';
import { Subscription } from 'rxjs';
import { PreviewPhotoPage } from './preview-photo/preview-photo.page';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {

  @ViewChild(IonModal) modal: IonModal;

  public appPages = [
    { title: 'Account', url: 'account', icon: 'person-circle-outline',detail: true },
    { title: 'Notifications', url: 'notifications', icon: 'notifications-outline', detail: true },
    { title: 'Privacy', url: 'privacy', icon: 'shield-checkmark-outline', detail: true },
    { title: 'Appearance', url: 'appearance', icon: 'contrast-outline', detail: true },
    { title: 'Logout', url: 'logout', icon: 'log-out-outline', detail: false },
  ];

  currentUser: any;
  isLoading: boolean = false;

  cUser: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private chatService: ChatService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    this.getProfileInfo();
  }

  async getProfileInfo() {
    //showLoader();
    this.isLoading = true;
    await this.authService.getUserData();

    this.cUser = this.authService._cUser.subscribe(cUser => {
      if(cUser) {
        console.log(cUser.uid)
        this.currentUser = cUser;
      }
    });

    //hideLoader();
    this.isLoading = false;

  }

  ngOnDestroy() {
    this.cUser.unsubscribe();
  }

  async openPreview(photos) {
    console.log(photos);
    const modal = await this.modalCtrl.create({
      component: PreviewPhotoPage,
      // cssClass: 'photo-preview-modal',
      componentProps: {
        photos: photos
      }
    });
    modal.present(); 
  }

  async logout(){
    try {
      //showLoader();
      this.isLoading = true;
      await this.chatService.auth.logout();
      this.router.navigateByUrl('/login', {replaceUrl: true});
      //hideLoader();
      this.isLoading = false;
    } catch(e) {
      console.log(e);
    }
  }

  getAccountPage(page) {
      if (page?.url == 'logout') {
        this.logout();
        this.dismissModal();
        return;
      }
      this.dismissModal();
      this.router.navigate(['/', 'home', 'profile', page?.url]);
  };

  editProfile() {
    this.router.navigate(['/', 'home', 'profile', 'edit']);
  }
  
  dismissModal() {
    this.modal.dismiss();
  }

  lastSeen(d: any) { 
    if (!d) return null;
    let a = new Date(d.seconds * 1000)
    return lastSeen(a);
   }

  getAge(d: any) {
    if (!d) return null;
    let a = new Date(d.seconds * 1000)
    return getAge(a);
  }

  handleRefresh(event) {
    this.getProfileInfo();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }
}