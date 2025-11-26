import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  user: any = null;
  showDeleteModal = false;
  confirmText = '';
  errorMessage = '';
  isDeleting = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
    } else {
      this.router.navigate(['/login']);
    }
  }

  openDeleteModal() {
    this.showDeleteModal = true;
    this.confirmText = '';
    this.errorMessage = '';
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.confirmText = '';
    this.errorMessage = '';
  }

  isConfirmValid(): boolean {
    return this.confirmText.toUpperCase() === 'CONFIRM';
  }

  deleteAccount() {
    this.errorMessage = '';

    if (!this.isConfirmValid()) {
      this.errorMessage = 'Please type CONFIRM to proceed';
      return;
    }

    this.isDeleting = true;

    this.authService.deleteAccount(this.confirmText).subscribe({
      next: (response: any) => {
        this.toastService.success('Your account has been deleted successfully');
        this.authService.logout();
        this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Failed to delete account';
        this.toastService.error(this.errorMessage);
        this.isDeleting = false;
      }
    });
  }
}