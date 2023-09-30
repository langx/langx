import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Auth2Service } from 'src/app/services/auth/auth2.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  form: FormGroup;
  isLoading: boolean = false;

  value: any = '';

  constructor(
    private router: Router,
    private auth2Service: Auth2Service,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = new FormGroup({
      email: new FormControl('', {
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(6)],
      }),
    });
  }

  onSubmit() {
    if (!this.form.valid) return;
    this.login(this.form);
  }

  login(form: FormGroup) {
    this.isLoading = true;

    this.auth2Service
      .login(form.value.email, form.value.password)
      .subscribe((user: any) => {
        console.log('user:', user);
        this.auth2Service.isLoggedIn().then((isLoggedIn) => {
          if (isLoggedIn) {
            this.router.navigateByUrl('/home');
          } else {
            // TODO: show error toasts message
            console.log('error:', 'Could not sign you up, please try again.');
          }
        });
        //hideLoader();
        form.reset();
        this.isLoading = false;
      });
  }

  // TODO: Appwrite uses a secure cookie and localstorage fallback for storing the session key.
  // Some browsers like Firefox and Safari don't respect 3rd party cookies for privacy reasons.
  // Appwrite -> appwrite.mydomain.com
  // Website -> mydomain.com or myapp.mydomain.com
  // More: https://github.com/appwrite/appwrite/issues/1203
  signInWithGoogle() {
    this.auth2Service.signInWithGoogle().then((userId: any) => {
      console.log('userId:', userId);
      /*
      this.auth2Service.isLoggedIn().then((isLoggedIn) => {
        if (isLoggedIn) {
          this.router.navigateByUrl('/home');
        } else {
          console.log('error:', 'Could not sign you up, please try again.');
        }
      });
      */
    });
  }

  /*
  signInWithGoogle() {
    this.authService.signInWithGoogle().then((userId: any) => {
      this.authService.getUserData().then((user) => {
        if (user.completeProfile) {
          if (user.completeLanguages) {
            this.router.navigateByUrl('/home');
          } else {
            this.router.navigateByUrl('/login/signup/language');
          }
        } else {
          this.router.navigateByUrl('/login/signup/complete');
        }
      });
    });
  }
  */

  // TODO: Replace with toast message
  async showAlert(msg: string) {
    const alert = await this.alertController.create({
      header: 'Alert',
      //subHeader: 'Important message',
      message: msg,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
