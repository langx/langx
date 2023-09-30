import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';
import { LanguageService } from 'src/app/services/user/language.service';
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-languages',
  templateUrl: './languages.page.html',
  styleUrls: ['./languages.page.scss'],
})
export class LanguagesPage implements OnInit {
  cUserSession: any;
  cUserDoc: any;

  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private languageService: LanguageService,
    private toastController: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //showLoader();
    this.isLoading = true;

    this.authService
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

    //hideLoader();
    this.isLoading = false;
  }

  getStudyLanguages() {
    return this.cUserDoc?.languages.filter((lang) => !lang.motherLanguage);
  }

  // TODO: Update directly the user document, inform user with toast message
  radioChecked(event, selectedLanguage) {
    selectedLanguage.level = parseInt(event.detail.value);

    this.languageService
      .updateLanguageDoc(selectedLanguage.$id, {
        level: selectedLanguage.level,
      })
      .then(() => {
        console.log('Language updated');
        this.cUserDoc.languages.forEach((lang) => {
          if (lang.code === selectedLanguage.code) {
            lang.level = selectedLanguage.level;
          }
        });
        this.presentToast(`${selectedLanguage?.name} updated`);
      })
      .catch((error) => {
        this.presentToast('Please try again later', 'danger');
        console.log(error);
      });
  }

  newLangBtn() {
    this.router.navigate(['/home/profile/edit/languages/new'], {
      state: this.cUserDoc.languages.map((lang) => lang.code),
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
