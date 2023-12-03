import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-intro',
  templateUrl: './intro.component.html',
  styleUrls: ['./intro.component.scss'],
})
export class IntroComponent implements OnInit {
  @Input() onFinish: () => void;

  constructor() {}

  ngOnInit() {}

  close() {
    this.onFinish();
  }
}
