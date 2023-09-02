import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-next',
  templateUrl: './next.page.html',
  styleUrls: ['./next.page.scss'],
})
export class NextPage implements OnInit {

  currentUser: any;

  isLoading: boolean = false;
  selectedLanguage: any;

  constructor(
    private router: Router,
    private toastController: ToastController,
    private authService: AuthService
  ) { }

  ngOnInit() {
    const selectedLanguage: any = this.router.getCurrentNavigation().extras.state;
    this.selectedLanguage = selectedLanguage;
    console.log('selectedLanguage:' + selectedLanguage.code);

    this.getProfileInfo();
  }

  getProfileInfo() {
    this.authService.getUserData().then(user => {
      this.currentUser = user;
    });
  }



  radioChecked(event, selectedLanguage) {
    this.selectedLanguage.level = event.detail.value;
    console.log('radioChecked:' + selectedLanguage);

  }
  
  onSubmit() {
    console.log('submit:' + this.selectedLanguage);
    if(!this.selectedLanguage.level) {
      this.presentToast('Please select a level.');
      return;
    }

    this.currentUser.studyLanguages.push(this.selectedLanguage);
    this.currentUser.languagesArray.push(this.selectedLanguage.code);
    // SAVE TO DB

    this.authService.updateUserStudyLanguagesData(this.currentUser);

    this.presentToast('Language added.');
    this.router.navigate(['/home/profile/edit']);
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