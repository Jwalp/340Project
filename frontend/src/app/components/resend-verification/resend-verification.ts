import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-resend-verification',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './resend-verification.html',
  styleUrls: ['./resend-verification.css']
})
export class ResendVerificationComponent {
  email = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    
    if (!this.email) {
      this.errorMessage = 'Please enter your email address';
      return;
    }

    this.isSubmitting = true;

    this.authService.resendVerification(this.email).subscribe({
      next: (response: any) => {
        this.successMessage = 'Verification email sent! Please check your inbox.';
        this.email = '';
        this.isSubmitting = false;
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Failed to send verification email';
        this.isSubmitting = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}