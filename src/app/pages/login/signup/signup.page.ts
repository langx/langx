import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from '@angular/fire/auth';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})

export class SignupPage implements OnInit {

  formData: FormGroup;

  constructor(public navCntrl: NavController, private auth: Auth) { }

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.formData = new FormGroup({
      name: new FormControl('', 
        {validators: [Validators.required, Validators.minLength(5)]}
      ),
      email: new FormControl('', 
        {validators: [Validators.required, Validators.email]}
      ),
      password: new FormControl('', 
        {validators: [Validators.required, Validators.minLength(8)]}
      ),
    });
  }

  async onSubmit(){
    console.log(this.formData.value);
      const user = await createUserWithEmailAndPassword(
        this.auth,
        this.formData.value.email,
        this.formData.value.password
      );
      console.log(user)
      return user;
  }

  gotoLogin() {
    this.navCntrl.navigateBack('login');
  }

}