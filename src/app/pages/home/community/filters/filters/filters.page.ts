import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { LanguageLevelModalComponent } from 'src/app/components/language-level-modal/language-level-modal.component';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-filters',
  templateUrl: './filters.page.html',
  styleUrls: ['./filters.page.scss'],
})
export class FiltersPage implements OnInit {

  isLoading: boolean = false;
  form: FormGroup;
  model: any = {};
  currentUserData: any;
  
  selectedLanguage: string;

  constructor(
    private authService: AuthService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    this.initForm();
    this.getUserData();
  }

  initForm() {
    this.form = new FormGroup({
      name: new FormControl('', 
        {validators: [Validators.required, Validators.minLength(5), Validators.maxLength(20)]}
      ),
      email: new FormControl('', 
        {validators: [Validators.required, Validators.email]}
      ),
      password: new FormControl('', 
        {validators: [Validators.required, Validators.minLength(8)]}
      ),
    });
  }

  onSubmit() { 
    if (!this.form.valid) {
      return;
    }
    this.model = this.form.value;
    console.log(this.model);
  }

  getUserData() {
    this.authService.getUserData().then((currentUserData) => {
      this.currentUserData = currentUserData;
      console.log('currentUserData: ', currentUserData);
    }).catch((error) => {
      console.log('error: ', error);
    });
  }

  async openLanguageModal(lang) {
    this.selectedLanguage = lang;
    console.log(lang);
    console.log('openLanguageModal: ', this.selectedLanguage);

  }


  message = 'This modal example uses the modalController to present and dismiss modals.';
  async openModal() {
    const modal = await this.modalCtrl.create({
      component: LanguageLevelModalComponent,
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      this.message = `Hello, ${data}!`;
    }
  }

}