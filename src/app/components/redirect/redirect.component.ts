import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-redirect',
  templateUrl: './redirect.component.html',
  styleUrls: ['./redirect.component.scss'],
})
export class RedirectComponent implements OnInit {
  @Input() model: any;
  second: number = 3;

  constructor() {}

  ngOnInit() {
    this.countDown();
  }

  //
  // Count Down
  //

  countDown() {
    const interval = setInterval(() => {
      this.second--;

      if (this.second === 0) {
        clearInterval(interval);
      }
    }, 1000);
  }
}
