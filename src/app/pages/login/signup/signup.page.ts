import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { registerAction } from 'src/app/store/actions/register.action';
import {
  isLoadingSelector,
  validationErrorSelector,
} from 'src/app/store/selectors';
import { RegisterRequestInterface } from 'src/app/models/types/requests/registerRequest.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})
export class SignupPage implements OnInit {
  form: FormGroup;
  isLoading$: Observable<boolean>;
  validationError$: Observable<ErrorInterface | null>;

  public progress: number = 0.2;

  constructor(
    private store: Store,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initForm();
    this.initValues();
  }

  ionViewWillLeave() {
    this.form.reset();
  }

  initValues(): void {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.validationError$ = this.store.pipe(select(validationErrorSelector));
    this.validationError$.subscribe((error: ErrorInterface) => {
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
    });
  }

  async onSubmit() {
    if (!this.form.valid) {
      this.presentToast('Please fill all required fields', 'danger');
      return;
    }
    this.register(this.form);
  }

  register(form: FormGroup) {
    const request: RegisterRequestInterface = form.value;
    this.store.dispatch(registerAction({ request }));
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
