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

  async openDetailModal(item: Checkout) {
    const modal = await this.modalController.create({
      component: DetailedCheckoutModalComponent,
      componentProps: {
        item,
      },
      breakpoints: [0, 0.5, 1],
      initialBreakpoint: 0.5,
      backdropBreakpoint: 0.5,
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
  }

  //
  // Utils
  //

  getPercentage(distribution: number): string {
    return (distribution * 100).toFixed(2) + '%';
  }

  exactDateAndTime(d: any) {
    if (!d) return null;
    return exactDateAndTime(d);
  }
}
