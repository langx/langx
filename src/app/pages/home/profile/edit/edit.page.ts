import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.page.html',
  styleUrls: ['./edit.page.scss'],
})
export class EditPage implements OnInit {

  isLoading: boolean = false;
  currentUser: any;

  textAreaValue: string = '';

  constructor(
    private authService: AuthService,
  ) { }

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //showLoader();
    this.isLoading = true;
    this.authService.getUserData().then(user => {
      this.currentUser = user;
      if(this.currentUser.aboutMe) {
        this.textAreaValue = this.currentUser.aboutMe;
      }
      //console.log(this.currentUser);
      //hideLoader();
      this.isLoading = false;
    })
  }

  onBlurAboutMe(event) {
    this.currentUser.aboutMe = event.target.value;
  }

  saveAboutMe() {
    this.isLoading = true;
    this.authService.updateUserAboutData(this.currentUser).then(() => {
      console.log('About me saved');
      this.isLoading = false;
    })
  }

}