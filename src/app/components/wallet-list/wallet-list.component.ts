import { Component, Input, OnInit } from '@angular/core';
import { Wallet } from 'src/app/models/Wallet';

@Component({
  selector: 'app-wallet-list',
  templateUrl: './wallet-list.component.html',
  styleUrls: ['./wallet-list.component.scss'],
})
export class WalletListComponent implements OnInit {
  @Input() item: Wallet;
  @Input() order: number;

  constructor() {}

  ngOnInit() {}
}
