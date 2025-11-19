import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent {
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

    this.authService.forgotPassword(this.email).subscribe({
      next: (response: any) => {
        this.successMessage = 'Password reset instructions have been sent to your email';
        this.email = '';
        this.isSubmitting = false;
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Failed to send reset email';
        this.isSubmitting = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}