import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-update-password',
  templateUrl: './update-password.page.html',
  styleUrls: ['./update-password.page.scss'],
})
export class UpdatePasswordPage implements OnInit {
  form: FormGroup;

  constructor() {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.form = new FormGroup({
      current_password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
      password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
      password2: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
      }),
    });
  }
}
