import { Component, OnInit, ViewChild } from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {

  public appPages = [
    { title: 'Inbox', url: '/folder/inbox', icon: 'mail' },
    { title: 'Outbox', url: '/folder/outbox', icon: 'paper-plane' },
    { title: 'Favorites', url: '/folder/favorites', icon: 'heart' },
    { title: 'Archived', url: '/folder/archived', icon: 'archive' },
    { title: 'Trash', url: '/folder/trash', icon: 'trash' },
    { title: 'Spam', url: '/folder/spam', icon: 'warning' },
  ];
  public labels = ['Family', 'Friends', 'Notes', 'Work', 'Travel', 'Reminders'];

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

}