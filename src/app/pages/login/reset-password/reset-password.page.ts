import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { AuthService } from 'src/app/services/auth/auth.service';
import { resetPasswordAction } from 'src/app/store/actions/auth.action';
import { isLoadingSelector } from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage implements OnInit {
  form: FormGroup;
  isLoading$: Observable<boolean>;

  constructor(
    private store: Store,
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValues();
    this.initForm();
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
    console.log(form.value);
    this.store.dispatch(resetPasswordAction({ request: form.value }));
    // this.authService
    //   .resetPassword(form.value.email)
    //   .then((data: any) => {
    //     form.reset();
    //     let msg: string = 'Please check your email';
    //     this.presentToast(msg);
    //     this.router.navigateByUrl('/login');
    //   })
    //   .catch((e) => {
    //     console.log('error:', e);
    //     let msg: string = 'Could not send reset email, please try again.';
    //     this.presentToast(msg, 'danger');
    //   });
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
