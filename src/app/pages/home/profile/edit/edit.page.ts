import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
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
  textAreaDisabled: boolean = true;

  constructor(
    private authService: AuthService,
    private toastController: ToastController
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

  //
  // Edit PP
  //

  deletePP() {
    this.presentToast('At least one profile picture required.');
  }

  //
  // Edit About Me
  //

  ionInputAboutMe(event) {
    if(event.target.value != this.currentUser.aboutMe) {
      this.textAreaDisabled = false;
    } else { this.textAreaDisabled = true; }
    this.currentUser.aboutMe = event.target.value;
  }

  saveAboutMe() {
    this.isLoading = true;
    this.authService.updateUserAboutData(this.currentUser).then(() => {
      this.presentToast('About me saved.');
      this.isLoading = false;
    })
  }

  //
  // Edit Languages
  //

  editLanguages() {
    this.presentToast('Coming soon.');
  }

  //
  // Present Toast
  //

  async presentToast(msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }

}