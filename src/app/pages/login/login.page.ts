import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  formData: FormGroup;  

  constructor() { }

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.formData = new FormGroup({
      email: new FormControl('', 
        {validators: [Validators.required, Validators.email]}
      ),
      password: new FormControl('', 
        {validators: [Validators.required, Validators.minLength(6)]}
      ),
    });
  }

  onSubmit() {
    console.log(this.formData.value);
  }

}
