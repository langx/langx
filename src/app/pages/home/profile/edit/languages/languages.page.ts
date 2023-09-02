import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-languages',
  templateUrl: './languages.page.html',
  styleUrls: ['./languages.page.scss'],
})
export class LanguagesPage implements OnInit {

  currentUser: any;
  studyLanguages: any;

  constructor(
    private authService: AuthService,
  ) { }

  ngOnInit() {
    this.getProfileInfo();
  }

  getProfileInfo() {
    this.authService.getUserData().then(user => {
      this.currentUser = user;
      this.studyLanguages = this.currentUser.studyLanguages;
    });
  }
}