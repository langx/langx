import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Store, select } from '@ngrx/store';
import { Browser } from '@capacitor/browser';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';
import { RegisterRequestInterface } from 'src/app/models/types/requests/registerRequest.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { registerAction } from 'src/app/store/actions/auth.action';
import {
  isLoadingSelector,
  registerValidationErrorSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})
export class SignupPage implements OnInit {
  form: FormGroup;
  isLoading$: Observable<boolean>;

  public progress: number = 0.2;

  password_type: string = 'password';

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initForm();
    this.initValues();
  }

  ionViewWillLeave() {
    this.form.reset();
  }

  initValues(): void {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));

    // Disable Form if loading
    this.isLoading$.subscribe((isLoading: boolean) => {
      if (isLoading) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });

    // Present Toast if error
    this.store
      .pipe(select(registerValidationErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error) this.presentToast(error.message, 'danger');
      });
  }

  initForm() {
    this.form = new FormGroup({
      name: new FormControl('', {
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(30),
        ],
      }),
      email: new FormControl('', {
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
      terms: new FormControl(false, {
        validators: [Validators.requiredTrue],
      }),
    });
  }

  async onSubmit() {
    // Check name length
    if (this.form.value.name.length < 2) {
      this.presentToast('Name must be at least 2 characters', 'danger');
      return;
    }

    // Check email is valid
    if (!this.form.value.email.includes('@')) {
      this.presentToast('Email must be valid', 'danger');
      return;
    }

    // Check password length
    if (this.form.value.password.length < 8) {
      this.presentToast('Password must be at least 8 characters', 'danger');
      return;
    }

    // Check terms checkbox
    if (this.form.value.terms === false) {
      this.presentToast('Please accept terms and conditions', 'danger');
      return;
    }

    // Check if form is valid
    if (!this.form.valid) {
      this.presentToast('Please fill all required fields', 'danger');
      return;
    }

    // Start register process
    this.register(this.form);
  }

  register(form: FormGroup) {
    const request: RegisterRequestInterface = form.value;
    this.store.dispatch(registerAction({ request }));
  }

  //
  // Utils
  //

  async openTermsAndConditionsLink() {
    await Browser.open({ url: environment.web.TERMS_AND_CONDITIONS_URL });
  }

  showPassword() {
    this.password_type = this.password_type === 'text' ? 'password' : 'text';
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1000,
      position: 'top',
    });

    await toast.present();
  }
}
