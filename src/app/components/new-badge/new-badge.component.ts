import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-new-badge',
  templateUrl: './new-badge.component.html',
  styleUrls: ['./new-badge.component.scss'],
})
export class NewBadgeComponent implements OnInit {
  @Input() onFinish: () => void;

  constructor() {}

  ngOnInit() {}

  close() {
    this.onFinish();
  }
}
