import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { LoginRequestInterface } from 'src/app/models/types/requests/loginRequest.interface';
import { AuthService } from 'src/app/services/auth/auth.service';
import { loginAction } from 'src/app/store/actions/auth.action';
import {
  isLoadingSelector,
  loginValidationErrorSelector,
  unauthorizedErrorSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  form: FormGroup;
  isLoading$: Observable<boolean>;

  value: any = '';

  constructor(
    private store: Store,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    this.initForm();
  }

  ionViewWillLeave() {
    this.form.reset();
  }

  initValues() {
    // isLoading
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));

    // Login Validation Error
    this.store
      .pipe(select(loginValidationErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error) this.presentToast(error.message, 'danger');
        this.form.enable();
      });
    // Unauthorized Error
    this.store
      .pipe(select(unauthorizedErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error.message) this.presentToast(error.message, 'danger');
      });
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
    const request: LoginRequestInterface = form.value;
    this.store.dispatch(loginAction({ request }));
    form.disable();
  }

  // TODO: Appwrite uses a secure cookie and localstorage fallback for storing the session key.
  // Some browsers like Firefox and Safari don't respect 3rd party cookies for privacy reasons.
  // Appwrite -> appwrite.mydomain.com
  // Website -> mydomain.com or myapp.mydomain.com
  // More: https://github.com/appwrite/appwrite/issues/1203
  signInWithGoogle() {
    this.authService.signInWithGoogle().then((userId: any) => {
      console.log('userId:', userId);
      /*
      this.authService.isLoggedIn().then((isLoggedIn) => {
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
