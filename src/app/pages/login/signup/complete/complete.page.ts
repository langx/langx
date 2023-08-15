import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { countryData, birthdateData, genderData } from '../data'
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

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
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = new FormGroup({
      birthdate: new FormControl('', 
        {validators: [Validators.required]}
      ),
      gender: new FormControl('', 
        {validators: [Validators.required]}
      ),
      country: new FormControl('', 
        {validators: [Validators.required]}
      ),
      countryCode: new FormControl('',
        {validators: [Validators.required]}
      ),
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
        let val = value.day.text + '.' + value.month.value + '.' + value.year.text;
        this.form.controls['birthdate'].setValue(val);
      },
    },
  ];

  public genderPickerColumns = [
    {
      name: 'gender',
      options: genderData,
    }
  ];

  public genderPickerButtons = [
    { text: 'Cancel', role: 'cancel' },
    {
      text: 'Confirm',
      handler: (value) => {
        this.form.controls['gender'].setValue(value.gender.text);
      },
    },
  ];

  public countryPickerColumns = [
    {
      name: 'country',
      options: countryData,
    }
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

  async onSubmit(){
    console.log('form.value:', this.form.value);
    if(!this.form.valid) {
      let msg = "Please fill all the required fields";
      const alert = await this.alertController.create({
        header: 'Alert',
        //subHeader: 'Important message',
        message: msg,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    } else {
      this.isLoading = true;
      setTimeout(() => {
        this.isLoading = false;
        this.router.navigateByUrl('/login/signup/language');
      }, 2000)
    }
  }

}
