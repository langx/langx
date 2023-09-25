import { Component, OnInit } from '@angular/core';
import { lastSeen } from 'src/app/extras/utils';
import { Auth2Service } from 'src/app/services/auth/auth2.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {
  cUserSession: any;
  isLoading: boolean = false;

  constructor(private auth2Service: Auth2Service) {}

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //TODO: showLoader();
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

    //TODO: hideLoader();
    this.isLoading = false;
  }

  lastSeen(d: any) {
    if (!d) return null;
    let a = new Date(d.seconds * 1000);
    return lastSeen(a);
  }

  // TODO: implement these methods
  disableAccount() {
    console.warn('disableAccount clicked');
  }
}
