import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import { Store, select } from '@ngrx/store';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { IntroComponent } from 'src/app/components/intro/intro.component';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { LoginRequestInterface } from 'src/app/models/types/requests/loginRequest.interface';
import { loginAction } from 'src/app/store/actions/auth.action';
import {
  isLoadingSelector,
  loginValidationErrorSelector,
  unauthorizedErrorSelector,
} from 'src/app/store/selectors/auth.selector';

const INTRO_SEEN = 'introSeen';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  form: FormGroup;
  isLoading$: Observable<boolean>;

  value: any = '';

  introSeen: boolean = false;
  password_type: string = 'password';

  constructor(
    private store: Store,
    private router: Router,
    private toastController: ToastController,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    this.initValues();
    this.initForm();

    // Check user is logged in in mobile
    await this.checkUserLoggedIn();

    // Init Intro
    await this.checkIntroSeen();
    await this.initIntro();
  }

  ionViewWillLeave() {
    this.form.reset();

    // Enable form if redirect here later
    this.form.enable();
  }

  initValues() {
    // isLoading
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));

    // Login Validation Error
    this.store
      .pipe(select(loginValidationErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error) {
          this.presentToast(error.message, 'danger');
          this.form.enable();
        }
      });
    // Unauthorized Error
    this.store
      .pipe(select(unauthorizedErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error && error.message) this.presentToast(error.message, 'warning');
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

  async initIntro() {
    if (this.introSeen) return;
    const modal = await this.modalCtrl.create({
      component: IntroComponent,
      componentProps: {
        onFinish: async () => {
          await this.setIntroSeen(true);
          modal.dismiss();
        },
      },
    });

    return await modal.present();
  }

  async showIntro() {
    await this.setIntroSeen(false);
    await this.initIntro();
  }

  onSubmit() {
    if (!this.form.valid) {
      this.presentToast('Please fill out all fields.', 'danger');
      return;
    }

    // Login Request
    const request: LoginRequestInterface = this.form.value;
    this.store.dispatch(loginAction({ request }));
    this.form.disable();
  }

  //
  // Utils
  //

  async checkIntroSeen() {
    await Preferences.get({ key: INTRO_SEEN }).then((res) => {
      res && res.value
        ? (this.introSeen = JSON.parse(res.value))
        : (this.introSeen = false);
    });
  }

  async setIntroSeen(value: boolean) {
    await Preferences.set({ key: INTRO_SEEN, value: JSON.stringify(value) });
    this.introSeen = value;
  }

  showPassword() {
    this.password_type = this.password_type === 'text' ? 'password' : 'text';
  }

  async checkUserLoggedIn() {
    const cookieFallback = localStorage.getItem('cookieFallback');
    if (
      cookieFallback &&
      cookieFallback !== '' &&
      cookieFallback !== '[]' &&
      Object.keys(cookieFallback).length !== 0
    ) {
      this.router.navigateByUrl('/home');
    }
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
