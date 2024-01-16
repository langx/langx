import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';

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
    subtitle: '',
    color: 'medium',
    icon: 'shield-checkmark-outline',
  };

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.provider = this.route.snapshot.paramMap.get('name') || null;
    this.title = this.provider.charAt(0).toUpperCase() + this.provider.slice(1);
    this.model.title = 'Redirecting ' + this.title + ' authentication...';

    // Trigger Sign-in with provider
    this.signInWithProvider(this.provider);
  }

  signInWithProvider(provider: string) {
    switch (provider) {
      case 'google':
        this.authService.signInWithGoogle();
        break;
      case 'facebook':
        this.authService.signInWithFacebook();
        break;
      case 'apple':
        this.authService.signInWithApple();
        break;
      default:
        this.model.success = false;
        this.model.title = 'Please close this window.';
        this.model.color = 'danger';
        this.model.icon = 'close-outline';
    }
  }
}
