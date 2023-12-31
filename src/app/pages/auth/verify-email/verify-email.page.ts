import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

import { verifyEmailConfirmationRequestInterface } from 'src/app/models/types/requests/verifyEmailConfirmationRequest.interface';
import { verifyEmailConfirmationAction } from 'src/app/store/actions/auth.action';
import {
  verifyEmailConfirmationErrorSelector,
  verifyEmailConfirmationSuccessSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
})
export class VerifyEmailPage implements OnInit {
  subscription: Subscription;
  second: number = 3;

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.initValues();
    this.countDown();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Present Toast if error
    this.subscription.add(
      this.store
        .pipe(select(verifyEmailConfirmationErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          }
        })
    );

    // Present Toast if verifyEmailConfirmationSuccess
    this.subscription.add(
      this.store
        .pipe(select(verifyEmailConfirmationSuccessSelector))
        .subscribe((verifyEmailConfirmationSuccess: boolean) => {
          if (verifyEmailConfirmationSuccess) {
            this.presentToast(
              'Email has been successfully verified!',
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

  initValues() {
    const params = this.route.snapshot.queryParamMap;

    if (!params.get('userId') || !params.get('secret')) {
      // Present Toast if error
      this.presentToast('Invalid URL', 'danger');
      setTimeout(() => {
        window.location.href = '/home';
      }, 3000);
      return;
    }

    const request: verifyEmailConfirmationRequestInterface = {
      userId: params.get('userId'),
      secret: params.get('secret'),
    };

    this.store.dispatch(verifyEmailConfirmationAction({ request }));
  }

  //
  // Count Down
  //

  countDown() {
    const interval = setInterval(() => {
      this.second--;

      if (this.second === 0) {
        clearInterval(interval);
      }
    }, 1000);
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
