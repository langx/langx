import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.scss'],
})
export class NewPage implements OnInit {
  id: string;
  secret: string;
  expire: Date;

  form: FormGroup;

  isLoading: boolean = false;

  password_type: string = 'password';
  password2_type: string = 'password';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initValidation();
    this.initForm();
  }

  initValidation() {
    const id = this.route.snapshot.queryParamMap.get('userId');
    const secret = this.route.snapshot.queryParamMap.get('secret');
    const expire = this.route.snapshot.queryParamMap.get('expire');

    if (!id || !secret || !expire) {
      this.presentToast('Invalid URL', 'danger');
      this.router.navigateByUrl('/login');
      return;
    } else if (Date.now() < new Date(expire).getTime()) {
      // The verification link sent to the user's email address is valid for 1 hour.
      this.presentToast('Link Expired', 'danger');
      this.router.navigateByUrl('/login');
      return;
    } else {
      this.id = id;
      this.secret = secret;
      this.expire = new Date(expire);
      console.log(this.id, this.secret, this.expire);
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
      this.presentToast('Invalid Form', 'danger');
      return;
    } else if (this.form.value.password !== this.form.value.password2) {
      this.presentToast('Passwords do not match', 'danger');
      return;
    }

    this.authService
      .updateRecovery(this.id, this.secret, this.form.value.password)
      .then((response) => {
        console.log(response);
        this.presentToast('Password Updated', 'success');
        this.form.reset();
        this.router.navigateByUrl('/login');
      })
      .catch((error) => {
        console.log('error:', error.message);
        this.presentToast(
          'Link is expired or invalid. Please try again.',
          'danger'
        );
        this.router.navigateByUrl('/login');
        return;
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
