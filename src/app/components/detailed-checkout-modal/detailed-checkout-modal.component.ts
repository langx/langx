import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

import { Checkout } from 'src/app/models/Checkout';

@Component({
  selector: 'app-detailed-checkout-modal',
  templateUrl: './detailed-checkout-modal.component.html',
  styleUrls: ['./detailed-checkout-modal.component.scss'],
})
export class DetailedCheckoutModalComponent implements OnInit {
  @Input() item: Checkout;

  ngOnInit() {
    console.log(this.item);
  }

  constructor(private modalController: ModalController) {}

  closeModal() {
    this.modalController.dismiss({
      dismissed: true,
    });
  }
}
