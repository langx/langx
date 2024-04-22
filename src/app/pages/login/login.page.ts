import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { IntroComponent } from 'src/app/components/intro/intro.component';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { LoginRequestInterface } from 'src/app/models/types/requests/loginRequest.interface';
import {
  clearErrorsAction,
  isLoggedInAction,
  loginAction,
} from 'src/app/store/actions/auth.action';
import {
  isLoadingSelector,
  loginValidationErrorSelector,
  unauthorizedErrorSelector,
} from 'src/app/store/selectors/auth.selector';

const INTRO_SEEN = 'introSeen';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  form: FormGroup;

  subscription: Subscription;
  isLoading$: Observable<boolean>;

  value: any = '';

  introSeen: boolean = false;
  password_type: string = 'password';

  // Web3 Public Key
  publicKey: string = null;

  constructor(
    private store: Store,
    private toastController: ToastController,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    this.initValues();
    this.initForm();

    // Init Intro
    await this.checkIntroSeen();
    await this.initIntro();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Login Validation Error
    this.subscription.add(
      this.store
        .pipe(select(loginValidationErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error && error.message) {
            this.presentToast(error.message, 'danger');
            this.form.enable();
            this.store.dispatch(clearErrorsAction());
          }
        })
    );

    // Unauthorized Error
    this.subscription.add(
      this.store
        .pipe(select(unauthorizedErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error && error.message) {
            this.presentToast(error.message, 'warning');
            this.store.dispatch(clearErrorsAction());
          }
        })
    );
  }

  ionViewDidEnter() {
    this.store.dispatch(isLoggedInAction());
  }

  ionViewWillLeave() {
    // Enable form if redirect here later
    this.form.reset();
    this.form.enable();

    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    // Values from Store
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
  }

  initForm() {
    this.form = new FormGroup({
      email: new FormControl('', {
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(6)],
      }),
    });
  }

  async initIntro() {
    if (this.introSeen) return;
    const modal = await this.modalCtrl.create({
      component: IntroComponent,
      componentProps: {
        onFinish: async () => {
          await this.setIntroSeen(true);
          modal.dismiss();
        },
      },
    });

    return await modal.present();
  }

  async showIntro() {
    await this.setIntroSeen(false);
    await this.initIntro();
  }

  onSubmit() {
    if (!this.form.valid) {
      this.presentToast('Please fill out all fields.', 'danger');
      return;
    }

    // Login Request
    const request: LoginRequestInterface = this.form.value;
    this.store.dispatch(loginAction({ request }));
    this.form.disable();
  }

  //
  // Utils
  //

  async checkIntroSeen() {
    await Preferences.get({ key: INTRO_SEEN }).then((res) => {
      res && res.value
        ? (this.introSeen = JSON.parse(res.value))
        : (this.introSeen = false);
    });
  }

  async setIntroSeen(value: boolean) {
    await Preferences.set({ key: INTRO_SEEN, value: JSON.stringify(value) });
    this.introSeen = value;
  }

  showPassword() {
    this.password_type = this.password_type === 'text' ? 'password' : 'text';
  }

  //
  // Web3
  //

  /*
  async connectWallet() {
    if ('solana' in window) {
      let provider = (window as any).solana;
      if (provider.isPhantom) {
        console.log('Phantom is installed!');
        // Connect to the wallet
        await provider.connect();
        // After connecting, check if publicKey is null
        if (!this.publicKey) {
          console.log('Wallet address:', provider.publicKey.toString());

          // New code starts here
          const message = new TextEncoder().encode(
            'By signing this message, I acknowledge that I am the owner of this wallet.'
          );
          try {
            const signedMessage = await provider.signMessage(message, 'utf8');
            console.log('Signed message:', signedMessage.signature);
            // Set the public key only if the message is successfully signed
            this.publicKey = provider.publicKey.toString();
            console.log('Wallet address:', this.publicKey);
          } catch (error) {
            console.error('Failed to sign the message:', error);
          }
          // New code ends here
        } else {
          // If publicKey is null, disconnect from the wallet
          await provider.disconnect();
          this.publicKey = null;
          console.log('Disconnected from wallet!');
        }
      }
    } else {
      // If Phantom is not installed, redirect the user to the Phantom page
      window.open('https://phantom.app/', '_blank');
    }
  }
  */

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
