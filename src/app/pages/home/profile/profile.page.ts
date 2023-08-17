import { Component, OnInit, ViewChild } from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';
import { Router } from '@angular/router';
import { IonModal } from '@ionic/angular';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {

  @ViewChild(IonModal) modal: IonModal;

  public appPages = [
    { title: 'Account', url: 'account', icon: 'person-circle-outline' },
    { title: 'Notifications', url: 'notifications', icon: 'notifications-outline' },
    { title: 'Privacy', url: 'privacy', icon: 'shield-checkmark-outline' },
    { title: 'Appearance', url: 'appearance', icon: 'contrast-outline' },
    { title: 'Logout', url: '', icon: 'log-out-outline' },
  ];

  currentUser: any;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private chatService: ChatService,
  ) { }

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //TODO: showLoader();
    this.isLoading = true;
    let id = this.authService.getId();
    this.authService.getUserData(id).then(user => {
      this.currentUser = user;
      console.log(this.currentUser);
      //TODO: hideLoader();
      this.isLoading = false;
    })
  } 

  async logout(){
    try {
      //TODO: showLoader();
      this.isLoading = true;
      await this.chatService.auth.logout();
      this.router.navigateByUrl('/login', {replaceUrl: true});
      //TODO: hideLoader();
      this.isLoading = false;
    } catch(e) {
      console.log(e);
    }
  }

  dismissModal() {
    this.modal.dismiss();
  }
}