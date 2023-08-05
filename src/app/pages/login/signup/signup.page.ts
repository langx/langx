import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { FormControl, FormGroup } from '@angular/forms';

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
  
  //name: string = "";
  //email: string = "behicsakar@gmail.com";
  //password: string = "aaa123";

  constructor(public navCntrl: NavController, private auth: Auth) { }

  ngOnInit() {
    this.formData = new FormGroup({
      name: new FormControl(),
      email: new FormControl(),
      password: new FormControl(),
    })
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