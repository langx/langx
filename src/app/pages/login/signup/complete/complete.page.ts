import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { countryData, birthdateData, genderData } from '../data'

@Component({
  selector: 'app-complete',
  templateUrl: './complete.page.html',
  styleUrls: ['./complete.page.scss'],
})
export class CompletePage implements OnInit {

  public progress: number = 0.7;

  form: FormGroup;
  isLoading: boolean = false;

  constructor() { }

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

  async onSubmit(){
    if(!this.form.valid) return;
    console.log('form.value:', this.form.value);
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

}
