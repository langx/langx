import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

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
          Validators.minLength(5),
          Validators.maxLength(20),
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
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
