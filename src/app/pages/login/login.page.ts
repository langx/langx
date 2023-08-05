import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  formData: FormGroup;  

  constructor() { }

  ngOnInit() {
    this.formData = new FormGroup({
      email: new FormControl(),
      password: new FormControl()
    })
  }

  onSubmit() {
    console.log(this.formData.value);
  }

}
