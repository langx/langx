import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';

import { updatePasswordRequestInterface } from 'src/app/models/types/requests/updatePasswordRequest.interface';
import { updatePasswordAction } from 'src/app/store/actions/auth.action';

@Component({
  selector: 'app-update-password',
  templateUrl: './update-password.page.html',
  styleUrls: ['./update-password.page.scss'],
})
export class UpdatePasswordPage implements OnInit {
  form: FormGroup;

  current_password_type: string = 'password';
  password_type: string = 'password';
  password2_type: string = 'password';

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = new FormGroup({
      current_password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
      password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
      password2: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.presentToast(
        'Password requires a minimum of 8 characters',
        'danger'
      );
      return;
    } else if (this.form.value.password !== this.form.value.password2) {
      this.presentToast('The passwords you entered do not match.', 'danger');
      return;
    }

    // Dispatch Update Password Action
    const request: updatePasswordRequestInterface = {
      password: this.form.value.password,
      oldPassword: this.form.value.current_password,
    };

    this.store.dispatch(updatePasswordAction({ request }));
  }

  //
  // Password visibility
  //

  showCurrentPassword() {
    this.current_password_type =
      this.current_password_type === 'text' ? 'password' : 'text';
  }

  showPassword() {
    this.password_type = this.password_type === 'text' ? 'password' : 'text';
  }

  showPassword2() {
    this.password2_type = this.password2_type === 'text' ? 'password' : 'text';
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
