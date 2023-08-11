import { Component, OnInit, ViewChild } from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';
import { PopoverController } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat/chat.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {

  @ViewChild('popover') popover: PopoverController;

  currentUser: any;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private auth: AuthService,
    private chatService: ChatService,
  ) { }

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //TODO: showLoader();
    this.isLoading = true;
    let id = this.auth.getId();
    this.auth.getUserData(id).then(user => {
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
      this.popover.dismiss();
      await this.chatService.auth.logout();
      this.router.navigateByUrl('/login', {replaceUrl: true});
      //TODO: hideLoader();
      this.isLoading = false;
    } catch(e) {
      console.log(e);
    }
  }

}