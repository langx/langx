import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessagesPage } from './messages.page';

describe('MessagesPage', () => {
  let component: MessagesPage;
  let fixture: ComponentFixture<MessagesPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(MessagesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
