import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { countryData, birthdateData, genderData } from 'src/app/extras/data';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth/auth.service';
import { getAge } from 'src/app/extras/utils';
import { Auth2Service } from 'src/app/services/auth/auth2.service';

@Component({
  selector: 'app-complete',
  templateUrl: './complete.page.html',
  styleUrls: ['./complete.page.scss'],
})
export class CompletePage implements OnInit {
  public progress: number = 0.7;

  form: FormGroup;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private alertController: AlertController,
    private authService: AuthService,
    private auth2Service: Auth2Service
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = new FormGroup({
      birthdate: new FormControl('', { validators: [Validators.required] }),
      birthdateWithDateFormat: new FormControl('', {
        validators: [Validators.required],
      }),
      gender: new FormControl('', { validators: [Validators.required] }),
      genderValue: new FormControl('', { validators: [Validators.required] }),
      country: new FormControl('', { validators: [Validators.required] }),
      countryCode: new FormControl('', { validators: [Validators.required] }),
    });
  }

  public birthdatePickerColumns = [
    {
      name: 'day',
      options: birthdateData.day,
    },
    {
      name: 'month',
      options: birthdateData.month,
    },
    {
      name: 'year',
      options: birthdateData.year,
    },
  ];

  public birthdatePickerButtons = [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Confirm',
      handler: (value) => {
        let val =
          value.day.text + '/' + value.month.value + '/' + value.year.text;
        let newDate = new Date(val);
        if (getAge(newDate) < 13) {
          this.showAlert('You must be at least 13 years old to use this app');
        } else {
          this.form.controls['birthdate'].setValue(val);
          this.form.controls['birthdateWithDateFormat'].setValue(newDate);
        }
      },
    },
  ];

  public genderPickerColumns = [
    {
      name: 'gender',
      options: genderData,
    },
  ];

  public genderPickerButtons = [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Confirm',
      handler: (value) => {
        this.form.controls['genderValue'].setValue(value.gender.value);
        this.form.controls['gender'].setValue(value.gender.text);
      },
    },
  ];

  public countryPickerColumns = [
    {
      name: 'country',
      options: countryData,
    },
  ];

  public countryPickerButtons = [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Confirm',
      handler: (value) => {
        this.form.controls['country'].setValue(value.country.text);
        this.form.controls['countryCode'].setValue(value.country.value);
      },
    },
  ];

  async onSubmit() {
    console.log('form.value:', this.form.value);
    if (!this.form.valid) {
      this.showAlert('Please fill all the required fields');
      return;
    }
    this.completeRegister(this.form);
  }

  completeRegister(form: FormGroup) {
    //showLoader();
    this.isLoading = true;
    try {
      this.authService.updateUserProfileData(form.value).then(() => {
        console.log('updateUserData setted in DB');
        this.router.navigateByUrl('/login/signup/language');
        //hideLoader();
        this.isLoading = false;
        form.reset();
      });
    } catch (error) {
      console.log('error:', error);
      this.isLoading = false;
      this.showAlert('Please try again later.');
    }
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
