import { Component, Input, OnInit } from '@angular/core';
import { Language } from 'src/app/models/Language';

@Component({
  selector: 'app-languages-card',
  templateUrl: './languages-card.component.html',
  styleUrls: ['./languages-card.component.scss'],
})
export class LanguagesCardComponent implements OnInit {
  @Input() languages: Language[];

  studyLanguages: Language[];
  motherLanguages: Language[];

  constructor() {}

  ngOnInit() {
    console.log(this.languages);

    this.studyLanguages = this.languages?.filter(
      (lang) => !lang.motherLanguage
    );
    this.motherLanguages = this.languages?.filter(
      (lang) => lang.motherLanguage
    );
  }
}
