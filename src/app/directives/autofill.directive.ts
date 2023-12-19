import { Directive, ElementRef, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Directive({
  selector: '[appAutofill]'
})
export class AutofillDirective implements OnInit {

  constructor(private el: ElementRef) {
  }

  ngOnInit(): void {
    if (Capacitor.getPlatform() !== 'ios') { return; };
    setTimeout(() => {
      try {
        this.el.nativeElement.children[0].addEventListener('change', (e) => {
          this.el.nativeElement.value = (e.target as any).value;
        });
      } catch { }
    }, 100); // Need some time for the ion-input to create the input element
  }
}