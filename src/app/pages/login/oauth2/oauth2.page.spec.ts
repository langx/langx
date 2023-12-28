import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Oauth2Page } from './oauth2.page';

describe('Oauth2Page', () => {
  let component: Oauth2Page;
  let fixture: ComponentFixture<Oauth2Page>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(Oauth2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
