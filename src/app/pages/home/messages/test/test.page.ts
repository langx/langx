import { Component, OnInit, ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-test',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
})
export class TestPage implements OnInit {
  
  //@ViewChild("content") content: IonContent;
  @ViewChild(IonContent) content: IonContent;

  constructor() {}

  ngOnInit() {}

  click() {
    console.log("content", this.content);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.content.scrollToBottom(1500);
  }

  handleScrollStart() {
    console.log("startScrolling");
  }
}
