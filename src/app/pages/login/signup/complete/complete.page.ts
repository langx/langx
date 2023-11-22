import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  countryData,
  birthdateData,
  genderData,
} from 'src/app/extras/localeData';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { getAge, nameParts } from 'src/app/extras/utils';
import { CompleteRegistrationRequestInterface } from 'src/app/models/types/requests/completeRegistrationRequest.interface';
import { completeRegistrationAction } from 'src/app/store/actions/auth.action';
import { Account } from 'src/app/models/Account';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import {
  accountSelector,
  isLoadingSelector,
  registerValidationErrorSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-complete',
  templateUrl: './complete.page.html',
  styleUrls: ['./complete.page.scss'],
})
export class CompletePage implements OnInit {
  public progress: number = 0.7;
  form: FormGroup;
  account$: Observable<Account | null>;
  isLoading$: Observable<boolean>;

  constructor(
    private store: Store,
    private router: Router,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initForm();
    this.initValues();
  }

  ionViewWillLeave() {
    this.form.reset();
  }

  initValues(): void {
    this.account$ = this.store.pipe(select(accountSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));

    // Disable Form if loading
    this.isLoading$.subscribe((isLoading: boolean) => {
      if (isLoading) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });

    // Present Toast if error
    this.store
      .pipe(select(registerValidationErrorSelector))
      .subscribe((error: ErrorInterface) => {
        if (error) this.presentToast(error.message, 'danger');
      });
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
          this.presentToast(
            'You must be at least 13 years old to use this app',
            'danger'
          );
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
      this.presentToast('Please fill all the required fields', 'danger');
      return;
    }
    this.complete(this.form);
  }

  complete(form: FormGroup) {
    this.account$
      .subscribe((account: Account | null) => {
        // TODO: If guard works fine for the complete page, this should not be needed
        if (!account) {
          this.router.navigate(['/login']);
          this.presentToast('Please login or register again', 'danger');
          return;
        }
        const request: CompleteRegistrationRequestInterface = {
          name: nameParts(account?.name),
          birthdate: form.value.birthdateWithDateFormat,
          country: form.value.country,
          countryCode: form.value.countryCode,
          gender: form.value.genderValue,
          lastSeen: new Date(),
        };
        this.store.dispatch(
          completeRegistrationAction({ request, id: account.$id })
        );
      })
      .unsubscribe();
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
