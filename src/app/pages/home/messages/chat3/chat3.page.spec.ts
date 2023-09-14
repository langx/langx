import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chat3Page } from './chat3.page';

describe('Chat3Page', () => {
  let component: Chat3Page;
  let fixture: ComponentFixture<Chat3Page>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(Chat3Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
