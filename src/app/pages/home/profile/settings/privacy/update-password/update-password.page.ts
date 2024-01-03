import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-update-password',
  templateUrl: './update-password.page.html',
  styleUrls: ['./update-password.page.scss'],
})
export class UpdatePasswordPage implements OnInit {
  form: FormGroup;

  current_password_type: string = 'password';
  password_type: string = 'password';
  password2_type: string = 'password';

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

  onSubmit() {
    console.log(this.form.value);
  }

  //
  // Password visibility
  //

  showCurrentPassword() {
    this.current_password_type =
      this.current_password_type === 'text' ? 'password' : 'text';
  }

  showPassword() {
    this.password_type = this.password_type === 'text' ? 'password' : 'text';
  }

  showPassword2() {
    this.password2_type = this.password2_type === 'text' ? 'password' : 'text';
  }
}
