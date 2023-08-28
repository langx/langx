import { Component, OnInit } from '@angular/core';
import { lastSeen } from 'src/app/extras/utils';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {

  currentUser: any;
  isLoading: boolean = false;

  constructor(
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //TODO: showLoader();
    this.isLoading = true;
    this.authService.getUserData().then(user => {
      this.currentUser = user;
      //TODO: hideLoader();
      this.isLoading = false;
    })
  } 

  lastSeen(d: any) { 
    if (!d) return null;
    let a = new Date(d.seconds * 1000)
    return lastSeen(a);
   }

  // TODO: implement these methods
  disableAccount() {
    console.warn('disableAccount clicked');
  }

}