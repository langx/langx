import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {

  currentUser: any;
  isLoading: boolean = false;

  constructor(
    private auth: AuthService,
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
}
