import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Auth2Service } from 'src/app/services/auth/auth2.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
})
export class ResetPasswordPage implements OnInit {
  form: FormGroup;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private auth2Service: Auth2Service,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initForm();
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
    // showLoader();
    this.isLoading = true;
    console.log(form.value);
    this.auth2Service
      .resetPassword(form.value.email)
      .then((data: any) => {
        // hideLoader();
        this.isLoading = false;
        form.reset();
        let msg: string = 'Please check your email';
        this.presentToast(msg);
        this.router.navigateByUrl('/login');
      })
      .catch((e) => {
        console.log('error:', e);
        // hideLoader();
        this.isLoading = false;
        let msg: string = 'Could not send reset email, please try again.';
        this.presentToast(msg, 'danger');
      });
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
