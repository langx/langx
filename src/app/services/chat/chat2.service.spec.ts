import { TestBed } from '@angular/core/testing';

import { Chat2Service } from './chat2.service';

describe('Chat2Service', () => {
  let service: Chat2Service;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Chat2Service);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
