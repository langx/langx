import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-provider',
  templateUrl: './provider.page.html',
  styleUrls: ['./provider.page.scss'],
})
export class ProviderPage implements OnInit {
  provider: string;
  title: string;

  model = {
    success: true,
    title: '',
    color: 'medium',
    icon: 'shield-checkmark-outline',
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.provider = this.route.snapshot.paramMap.get('name') || null;
    this.title = this.provider.charAt(0).toUpperCase() + this.provider.slice(1);
    this.model.title = 'Redirecting ' + this.title + ' authentication...';
  }
}
