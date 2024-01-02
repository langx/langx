import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Store, select } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { AuthService } from 'src/app/services/auth/auth.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { resetPasswordConfirmationRequestInterface } from 'src/app/models/types/requests/resetPasswordConfirmationRequest.interface';
import { resetPasswordConfirmationAction } from 'src/app/store/actions/auth.action';
import {
  resetPasswordConfirmationSuccessSelector,
  resetPasswordErrorSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.scss'],
})
export class NewPage implements OnInit {
  subscription: Subscription;

  id: string;
  secret: string;

  form: FormGroup;

  isLoading: boolean = false;

  password_type: string = 'password';
  password2_type: string = 'password';

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValidation();
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
          }
        })
    );

    // Present Toast if resetPasswordConfirmationSuccess
    this.subscription.add(
      this.store
        .pipe(select(resetPasswordConfirmationSuccessSelector))
        .subscribe((response: boolean) => {
          if (response) {
            this.presentToast(
              'Password has been successfully changed.',
              'success'
            );
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValidation() {
    const id = this.route.snapshot.queryParamMap.get('userId');
    const secret = this.route.snapshot.queryParamMap.get('secret');

    if (!id || !secret) {
      this.presentToast('Invalid URL', 'danger');
      this.router.navigateByUrl('/login');
      return;
    } else {
      this.id = id;
      this.secret = secret;
      console.log(this.id, this.secret);
    }
  }

  initForm() {
    this.form = new FormGroup({
      password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
      password2: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
    });
  }

  showPassword() {
    this.password_type = this.password_type === 'text' ? 'password' : 'text';
  }

  showPassword2() {
    this.password2_type = this.password2_type === 'text' ? 'password' : 'text';
  }

  onSubmit() {
    if (this.form.invalid) {
      this.presentToast(
        'Password requires a minimum of 8 characters',
        'danger'
      );
      return;
    } else if (this.form.value.password !== this.form.value.password2) {
      this.presentToast('Passwords do not match', 'danger');
      return;
    }

    const request: resetPasswordConfirmationRequestInterface = {
      id: this.id,
      secret: this.secret,
      password: this.form.value.password,
      password2: this.form.value.password2,
    };

    this.store.dispatch(resetPasswordConfirmationAction({ request }));
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
