import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
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
    private auth2Service: Auth2Service,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    //showLoader();
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

  radioChecked(event, selectedLanguage) {
    selectedLanguage.level = event.detail.value;
    this.cUserDoc.studyLanguages.forEach((lang) => {
      if (lang.code === selectedLanguage.code) {
        lang.level = selectedLanguage.level;
      }
    });
  }

  save() {
    this.cUserDoc.updateUserStudyLanguagesData(this.cUserDoc);
    this.router.navigate(['/home/profile/edit']);
  }

  newLangBtn() {
    // console.log(this.currentUser.languagesArray);
    this.router.navigate(['/home/profile/edit/languages/new'], {
      state: this.cUserDoc.languagesArray,
    });
  }
}
