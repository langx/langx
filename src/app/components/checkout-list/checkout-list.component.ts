import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

import { DetailedCheckoutModalComponent } from 'src/app/components//detailed-checkout-modal/detailed-checkout-modal.component';
import { exactDateAndTime } from 'src/app/extras/utils';
import { Checkout } from 'src/app/models/Checkout';

@Component({
  selector: 'app-checkout-list',
  templateUrl: './checkout-list.component.html',
  styleUrls: ['./checkout-list.component.scss'],
})
export class CheckoutListComponent implements OnInit {
  @Input() item: Checkout;

  constructor(private modalController: ModalController) {}

  ngOnInit() {}

  async openDetailModal() {
    const modal = await this.modalController.create({
      component: DetailedCheckoutModalComponent,
      componentProps: {
        // You can pass data to the modal component here
      },
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    console.log('Modal data:', data);
  }
  getPercentage(distribution: number): string {
    return (distribution * 100).toFixed(2) + '%';
  }

  exactDateAndTime(d: any) {
    if (!d) return null;
    return exactDateAndTime(d);
  }
}
