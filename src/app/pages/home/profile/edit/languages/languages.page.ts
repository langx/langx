import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-languages',
  templateUrl: './languages.page.html',
  styleUrls: ['./languages.page.scss'],
})
export class LanguagesPage implements OnInit {
  currentUser: any;

  isLoading: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    this.isLoading = true;
    this.authService.getUserData().then((user) => {
      this.currentUser = user;
      this.isLoading = false;
    });
  }

  newLangBtn() {
    // console.log(this.currentUser.languagesArray);
    this.router.navigate(['/home/profile/edit/languages/new'], {
      state: this.currentUser.languagesArray,
    });
  }

  radioChecked(event, selectedLanguage) {
    selectedLanguage.level = event.detail.value;
    this.currentUser.studyLanguages.forEach((lang) => {
      if (lang.code === selectedLanguage.code) {
        lang.level = selectedLanguage.level;
      }
    });
  }

  save() {
    this.authService.updateUserStudyLanguagesData(this.currentUser);
    this.router.navigate(['/home/profile/edit']);
  }
}
