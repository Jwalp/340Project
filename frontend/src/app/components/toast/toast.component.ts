// frontend/src/app/components/toast/toast.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let toast of toasts" 
           class="toast toast-{{ toast.type }}">
        <div class="toast-icon">
          <i *ngIf="toast.type === 'success'" class="fa-solid fa-circle-check"></i>
          <i *ngIf="toast.type === 'error'" class="fa-solid fa-circle-exclamation"></i>
          <i *ngIf="toast.type === 'warning'" class="fa-solid fa-triangle-exclamation"></i>
          <i *ngIf="toast.type === 'info'" class="fa-solid fa-circle-info"></i>
        </div>
        <div class="toast-content">
          <p>{{ toast.message }}</p>
        </div>
        <button class="toast-close" (click)="close(toast.id)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 12px;
      backdrop-filter: blur(20px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease-out;
      border: 2px solid;
      min-width: 300px;
    }

    @keyframes slideIn {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(100%);
        opacity: 0;
      }
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    }

    .toast.hiding {
      animation: slideOut 0.3s ease-out;
    }
    .toast-success {
      background: rgba(0, 255, 136, 0.15);
      border-color: #00ff88;
      color: #00ff88;
    }

    .toast-error {
      background: rgba(255, 77, 77, 0.15);
      border-color: #ff6b6b;
      color: #ff6b6b;
    }

    .toast-warning {
      background: rgba(255, 165, 0, 0.15);
      border-color: #ffa500;
      color: #ffa500;
    }

    .toast-info {
      background: rgba(100, 149, 237, 0.15);
      border-color: #6495ed;
      color: #6495ed;
    }

    .toast-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .toast-content {
      flex: 1;
    }

    .toast-content p {
      margin: 0;
      color: #fff;
      font-size: 0.95rem;
      line-height: 1.4;
    }

    .toast-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      padding: 4px;
      font-size: 1.2rem;
      transition: color 0.2s;
      flex-shrink: 0;
    }

    .toast-close:hover {
      color: #fff;
    }

    @media (max-width: 768px) {
      .toast-container {
        right: 10px;
        left: 10px;
        max-width: none;
      }

      .toast {
        min-width: auto;
      }
    }
  `]
})
export class ToastComponent implements OnInit {
  toasts: Toast[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.toastService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
  }

  close(id: number) {
    this.toastService.remove(id);
  }
}