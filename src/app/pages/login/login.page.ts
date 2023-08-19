import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  form: FormGroup;  
  isLoading: boolean = false;

  value: any = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private alertController: AlertController,
  ) { }

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form= new FormGroup({
      email: new FormControl('', 
        {validators: [Validators.required, Validators.email]}
      ),
      password: new FormControl('', 
        {validators: [Validators.required, Validators.minLength(6)]}
      ),
    });
  }

  onSubmit() {
    if(!this.form.valid) return;
    this.login(this.form);
  }

  login(form: FormGroup) {
    //showLoader();
    this.isLoading = true;
    console.log('form.value:', form.value);
    this.authService.login(form.value.email, form.value.password).then((userId: any) => {
      this.authService.getUserData(userId).then(user => {
        if(user.completeProfile) {
          if(user.completeLanguages) {
            this.router.navigateByUrl('/home');
          } else {
            this.router.navigateByUrl('/login/signup/language');
          }
        } else {
          this.router.navigateByUrl('/login/signup/complete');
        }
      });
      //hideLoader();
      form.reset();
      this.isLoading = false;
    })
    .catch(e => {
      console.log("error:", e);
      //hideLoader();
      this.isLoading = false;
      let msg: string; 
      switch (e.code) {
        case "auth/user-not-found": {
          msg = "Email address could not be found"; break;
        }
        case "auth/wrong-password": {
          msg = "Please enter a correct password"; break;
        }
        default: {
          msg = 'Could not sign you up, please try again.'
        }
      }
      this.showAlert(msg);
    });
  }

  signInWithGoogle() {
    this.authService.signInWithGoogle().then((userId: any) => {
      this.authService.getUserData(userId).then(user => {
        if(user.completeProfile) {
          if(user.completeLanguages) {
            this.router.navigateByUrl('/home');
          } else {
            this.router.navigateByUrl('/login/signup/language');
          }
        } else {
          this.router.navigateByUrl('/login/signup/complete');
        }
      });
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