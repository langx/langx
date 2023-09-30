import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})
export class SignupPage implements OnInit {
  form: FormGroup;
  isLoading: boolean = false;
  public progress: number = 0.2;

  constructor(
    private router: Router,
    private authService: AuthService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.initForm();
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
      this.showAlert('Please fill all required fields');
      return;
    }

    this.registerWithAuth2(this.form);
  }

  registerWithAuth2(form: FormGroup) {
    this.isLoading = true;

    this.authService
      .register(form.value.email, form.value.password, form.value.name)
      .subscribe((user: any) => {
        console.log('user:', user);
        this.authService
          .isLoggedIn()
          .then((isLoggedIn) => {
            if (isLoggedIn) {
              this.router.navigateByUrl('/login/signup/complete');
            } else {
              // TODO: show error toasts message
              console.log('error:', 'Could not sign you up, please try again.');
            }
          })
          .catch((e) => {
            // TODO: show error toasts message
            console.log('error:', e);
          });
        //hideLoader();
        form.reset();
        this.isLoading = false;
      });
  }

  async showAlert(msg: string) {
    const alert = await this.alertController.create({
      header: 'Alert',
      //subHeader: 'Important message',
      message: msg,
      buttons: ['OK'],
    });

    await alert.present();
  }
}
