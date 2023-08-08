import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';

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
    private authService: AuthService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = new FormGroup({
      email: new FormControl('',
      {validators: [Validators.required, Validators.email]}
      )
    })
  }

  onSubmit() {
    if(!this.form.valid) return;
    this.resetPassword(this.form);
  }

  resetPassword(form: FormGroup) {
    // showLoader();
    this.isLoading = true;
    console.log(form.value);
    this.authService.resetPassword(form.value.email).then((data:any) => {
      // hideLoader();
      this.isLoading = false;
      form.reset();
      let msg: string = 'Please check your email'
      this.showAlert(msg);
      this.router.navigateByUrl('/home');
    })
    .catch(e => {
      console.log('error:',e);
      // hideLoader();
      this.isLoading = false;
      let msg: string = 'Could not send reset email, please try again.'
      this.showAlert(msg);
    });
  }
    
  async showAlert(msg: string){
    const alert = await this.alertController.create({
      header: 'Alert',
      message: msg,
      buttons: ['OK']
    });
    await alert.present();
  }

}