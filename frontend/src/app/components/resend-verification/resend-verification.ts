// frontend/src/app/components/resend-verification/resend-verification.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-resend-verification',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './resend-verification.html',
  styleUrls: ['./resend-verification.css']
})
export class ResendVerificationComponent implements OnInit {
  email = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    // Check if there's a pending verification email
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    if (pendingEmail) {
      this.email = pendingEmail;
      localStorage.removeItem('pendingVerificationEmail');
    }
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    
    if (!this.email) {
      this.errorMessage = 'Please enter your email address';
      this.toastService.error('Please enter your email address');
      return;
    }

    this.isSubmitting = true;

    this.authService.resendVerification(this.email).subscribe({
      next: (response: any) => {
        this.successMessage = 'Verification email sent! Please check your inbox.';
        this.toastService.success('Verification email sent! Please check your inbox.', 7000);
        this.email = '';
        this.isSubmitting = false;
      },
      error: (error: any) => {
        const message = error.error?.message || 'Failed to send verification email';
        this.errorMessage = message;
        this.toastService.error(message);
        this.isSubmitting = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}