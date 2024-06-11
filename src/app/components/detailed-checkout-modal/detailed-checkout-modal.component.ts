import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-detailed-checkout-modal',
  templateUrl: './detailed-checkout-modal.component.html',
  styleUrls: ['./detailed-checkout-modal.component.scss'],
})
export class DetailedCheckoutModalComponent implements OnInit {
  @Input() data: any;

  ngOnInit() {}

  constructor(private modalController: ModalController) {}

  closeModal() {
    this.modalController.dismiss({
      dismissed: true,
    });
  }
}
