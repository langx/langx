import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';
import { verifyEmailConfirmationRequestInterface } from 'src/app/models/types/requests/verifyEmailConfirmationRequest.interface';
import { verifyEmailConfirmationAction } from 'src/app/store/actions/auth.action';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
})
export class VerifyEmailPage implements OnInit {
  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    const params = this.route.snapshot.queryParamMap;

    if (!params.get('userId') || !params.get('secret')) {
      // Present Toast if error
      this.presentToast('Invalid URL', 'danger');
      return;
    }

    const request: verifyEmailConfirmationRequestInterface = {
      userId: params.get('userId'),
      secret: params.get('secret'),
    };

    this.store.dispatch(verifyEmailConfirmationAction({ request }));
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
