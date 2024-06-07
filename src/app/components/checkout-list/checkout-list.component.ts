import { Component, Input, OnInit } from '@angular/core';
import { Checkout } from 'src/app/models/Checkout';

@Component({
  selector: 'app-checkout-list',
  templateUrl: './checkout-list.component.html',
  styleUrls: ['./checkout-list.component.scss'],
})
export class CheckoutListComponent implements OnInit {
  @Input() item: Checkout;

  constructor() {}

  ngOnInit() {}

  getDistributionPercentage(distribution: number): string {
    return (distribution * 100).toFixed(2) + '%';
  }
}
