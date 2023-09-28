import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { LanguageService } from 'src/app/services/user/language.service';
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-next',
  templateUrl: './next.page.html',
  styleUrls: ['./next.page.scss'],
})
export class NextPage implements OnInit {
  cUserSession: any;
  cUserDoc: any;

  isLoading: boolean = false;
  selectedLanguage: any;

  constructor(
    private router: Router,
    private toastController: ToastController,
    private auth2Service: Auth2Service,
    private userService: UserService,
    private languageService: LanguageService
  ) {}

  ngOnInit() {
    const selectedLanguage: any =
      this.router.getCurrentNavigation().extras.state;
    this.selectedLanguage = selectedLanguage;
    console.log('selectedLanguage:' + selectedLanguage.code);

    this.getProfileInfo();
  }

  getProfileInfo() {
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

    this.userService.getUserDoc(this.cUserSession.$id).then((user) => {
      this.cUserDoc = user;
      console.log(user);
    });
  }

  radioChecked(event) {
    this.selectedLanguage.level = parseInt(event.detail.value);
    console.log('radioChecked:' + this.selectedLanguage.level);
  }

  onSubmit() {
    if (!this.selectedLanguage.level) {
      this.presentToast('Please select a level.', 'danger');
      return;
    }

    let data = {
      userId: this.cUserSession.$id,
      name: this.selectedLanguage.name,
      nativeName: this.selectedLanguage.nativeName,
      code: this.selectedLanguage.code,
      level: this.selectedLanguage.level,
      motherLanguage: false,
    };

    // If it length is 6, then don't let the user to add one more study language.
    if (this.cUserDoc.languages.length >= 6) {
      this.presentToast(
        'You can add max 5 Study Languages. Please remove at least one and try again.',
        'danger'
      );
      this.isLoading = false;
      return;
    }

    this.languageService
      .createLanguageDoc(data)
      .then((res) => {
        // Push the language data to the array
        this.cUserDoc.languages.push(data);

        // Update languageArray
        if (!this.cUserDoc.languageArray.includes(data.name)) {
          this.cUserDoc.languageArray.push(data.name);
        }

        // Update user doc with new languageArray
        this.userService
          .updateUserDoc(this.cUserSession.$id, {
            languageArray: this.cUserDoc.languageArray,
          })
          .then(() => {
            console.log('Language Array Updated');
          })
          .catch((error) => {
            console.log(error);
          });

        this.presentToast('Language added.');
        this.router.navigate(['/home/profile/edit']);
      })
      .catch((error) => {
        console.log(error);
        this.presentToast('Please try again later.', 'danger');
      });
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
