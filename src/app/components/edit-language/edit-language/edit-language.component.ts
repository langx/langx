import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-edit-language',
  templateUrl: './edit-language.component.html',
  styleUrls: ['./edit-language.component.scss'],
})
export class EditLanguageComponent implements OnInit {
  @Input() languages: any;
  @Output() onClick: EventEmitter<any> = new EventEmitter();
  cUserSession: any;

  isLoading: boolean = false;

  constructor(private router: Router, private modalCtrl: ModalController) {}

  ngOnInit() {}

  radioChecked(event, selectedLanguage) {
    selectedLanguage.level = parseInt(event.detail.value);
    this.onClick.emit(selectedLanguage);
  }

  // TODO: Focus here #158
  // Test issue link with PR to auto close
  newLangBtn() {
    this.router.navigate(['/home/profile/edit/languages/new'], {
      state: this.languages.map((lang) => lang.code),
    });
  }

  close() {
    // TODO: set modalDirection animate back, not backdown
    this.modalCtrl.dismiss();
  }
}
