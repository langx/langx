import { TestBed } from '@angular/core/testing';

import { Storage2Service } from './storage2.service';

describe('Storage2Service', () => {
  let service: Storage2Service;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Storage2Service);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
