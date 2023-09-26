import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { countryData, birthdateData, genderData } from 'src/app/extras/data';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { getAge } from 'src/app/extras/utils';
import { Auth2Service } from 'src/app/services/auth/auth2.service';
import { UserService } from 'src/app/services/user/user.service';

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
    private auth2Service: Auth2Service,
    private userService: UserService
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
    this.completeRegisterWithAuth2(this.form);
  }

  completeRegisterWithAuth2(form: FormGroup) {
    console.log('form.value:', form.value);
    const data = {
      name: '',
      birthdate: form.value.birthdateWithDateFormat,
      country: form.value.country,
      countryCode: form.value.countryCode,
      gender: form.value.genderValue,
    };
    console.log('data:', data);

    let user: any;
    this.auth2Service
      .getUser()
      .subscribe((u) => {
        user = u;
        const nameParts = user.name.split(' ');
        if (nameParts.length > 1) {
          data.name =
            nameParts[0] +
            ' ' +
            nameParts[nameParts.length - 1].charAt(0) +
            '.';
        } else {
          data.name = user.name;
        }
      })
      .unsubscribe();
    // console.log('user:', user);

    this.userService.createUserDoc(user.$id, data).then((userDoc: any) => {
      console.log('userDoc:', userDoc);
      this.auth2Service.isLoggedIn().then((isLoggedIn) => {
        if (isLoggedIn) {
          this.router.navigateByUrl('/login/signup/language');
          // TODO: to make form empty, it has to be tested
          this.initForm();
        } else {
          // TODO: show error toasts message
          console.log('error:', 'Could not sign you up, please try again.');
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
