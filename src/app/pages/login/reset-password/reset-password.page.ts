import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

import {
  clearErrorsAction,
  resetPasswordAction,
} from 'src/app/store/actions/auth.action';
import {
  isLoadingSelector,
  resetPasswordErrorSelector,
  resetPasswordSuccessSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage implements OnInit {
  form: FormGroup;
  subscription: Subscription;

  isLoading$: Observable<boolean>;

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initValues();
    this.initForm();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Present Toast if error
    this.subscription.add(
      this.store
        .pipe(select(resetPasswordErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
            // Error Cleanup
            this.store.dispatch(clearErrorsAction());
          }
        })
    );

    // Present Toast if resetPasswordSuccess
    this.subscription.add(
      this.store
        .pipe(select(resetPasswordSuccessSelector))
        .subscribe((response: boolean) => {
          this.form.reset();
          if (response) {
            this.presentToast('Email has been successfully sent.', 'success');
            // Error Cleanup
            this.store.dispatch(clearErrorsAction());
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
  }

  initForm() {
    this.form = new FormGroup({
      email: new FormControl('', {
        validators: [Validators.required, Validators.email],
      }),
    });
  }

  onSubmit() {
    if (!this.form.valid) {
      this.presentToast('Please fill the form with valid email', 'danger');
      return;
    }
    this.resetPassword(this.form);
  }

  resetPassword(form: FormGroup) {
    // console.log(form.value);
    this.store.dispatch(resetPasswordAction({ request: form.value }));
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
