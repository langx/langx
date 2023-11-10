import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

import { AuthService } from 'src/app/services/auth/auth.service';
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
  loginValidationError$: Observable<ErrorInterface| null>;
  unauthorizedError$: Observable<string | null>;

  // TODO: Delete this property and edit related code by replacing it with the isLoading$ observable
  isLoading: boolean = false;
  value: any = '';

  constructor(
    private store: Store,
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initForm();
    this.initValues();
  }

  initValues() {
    // isLoading
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    
    // Login Validation Error
    this.loginValidationError$ = this.store.pipe(
      select(loginValidationErrorSelector)
    );
    this.loginValidationError$.subscribe((error: ErrorInterface) => {
      if (error) this.presentToast(error.message, 'danger');
    });

    // Unauthorized Error
    this.unauthorizedError$ = this.store.pipe(
      select(unauthorizedErrorSelector)
    );
    this.unauthorizedError$.subscribe((message: string) => {
      if (message) this.presentToast(message, 'danger');
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
    this.isLoading = true;

    this.authService
      .login(form.value.email, form.value.password)
      .subscribe((user: any) => {
        console.log('user:', user);
        this.authService.isLoggedIn().then((isLoggedIn) => {
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
