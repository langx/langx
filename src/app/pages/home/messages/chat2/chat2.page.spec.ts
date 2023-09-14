import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chat2Page } from './chat2.page';

describe('Chat2Page', () => {
  let component: Chat2Page;
  let fixture: ComponentFixture<Chat2Page>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(Chat2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
