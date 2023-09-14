import { TestBed } from '@angular/core/testing';

import { Chat3Service } from './chat3.service';

describe('Chat3Service', () => {
  let service: Chat3Service;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Chat3Service);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
