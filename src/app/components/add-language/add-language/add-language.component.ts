import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-add-language',
  templateUrl: './add-language.component.html',
  styleUrls: ['./add-language.component.scss'],
})
export class AddLanguageComponent implements OnInit {
  @Input() languages: any;
  @Output() onClick: EventEmitter<any> = new EventEmitter();
  constructor() {}

  ngOnInit() {}
}
