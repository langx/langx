import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { AuthService } from 'src/app/services/auth/auth.service';
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
    private router: Router,
    private store: Store,
    private authService: AuthService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.initForm();
    this.initValues();
  }

  initValues(): void {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.validationError$ = this.store.pipe(select(validationErrorSelector));
    this.validationError$.subscribe((error: ErrorInterface) => {
      if (error) this.showAlert(error.message);
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
      this.showAlert('Please fill all required fields');
      return;
    }
    this.register2(this.form);
  }

  register2(form: FormGroup) {
    const request: RegisterRequestInterface = form.value;
    this.store.dispatch(registerAction({ request }));
  }

  register(form: FormGroup) {
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
