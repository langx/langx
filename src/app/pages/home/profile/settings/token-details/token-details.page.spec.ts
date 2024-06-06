import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenDetailsPage } from './token-details.page';

describe('TokenDetailsPage', () => {
  let component: TokenDetailsPage;
  let fixture: ComponentFixture<TokenDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
