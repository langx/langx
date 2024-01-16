import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-provider',
  templateUrl: './provider.page.html',
  styleUrls: ['./provider.page.scss'],
})
export class ProviderPage implements OnInit {
  provider: string;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.provider = this.route.snapshot.paramMap.get('name') || null;
  }
}
