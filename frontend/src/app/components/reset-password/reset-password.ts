import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css']
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;
  isValidatingToken = true;
  tokenIsValid = false;
  token = '';
  showPasswordRequirements = false;
  showPassword = false;
  showConfirmPassword = false;
  showPasswordIcon = false;
  showConfirmPasswordIcon = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Get token from query params
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      console.log('Reset token received:', this.token);
      
      if (!this.token) {
        this.errorMessage = 'Invalid or missing reset token';
        this.isValidatingToken = false;
        this.tokenIsValid = false;
      } else {
        // Validate the token by attempting to check it with backend
        this.validateToken();
      }
    });
  }

  validateToken(): void {
    // Validate the token with the backend
    this.authService.validateResetToken(this.token).subscribe({
      next: (response: any) => {
        console.log('Token is valid');
        this.isValidatingToken = false;
        this.tokenIsValid = true;
      },
      error: (error: any) => {
        console.error('Token validation failed:', error);
        this.errorMessage = error.error?.message || 'This password reset link is invalid or has expired.';
        this.isValidatingToken = false;
        this.tokenIsValid = false;
      }
    });
  }

  hasUpperCase(): boolean {
    return /[A-Z]/.test(this.password);
  }

  hasLowerCase(): boolean {
    return /[a-z]/.test(this.password);
  }

  hasNumber(): boolean {
    return /[0-9]/.test(this.password);
  }

  isPasswordValid(): boolean {
    return this.password.length >= 8 && 
           this.hasUpperCase() && 
           this.hasLowerCase() && 
           this.hasNumber();
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    
    if (!this.token) {
      this.errorMessage = 'Invalid or missing reset token';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    if (!this.isPasswordValid()) {
      this.errorMessage = 'Password does not meet requirements';
      return;
    }

    this.isSubmitting = true;

    this.authService.resetPassword(this.token, this.password).subscribe({
      next: (response: any) => {
        this.successMessage = 'Password reset successful! Redirecting to dashboard...';
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 2000);
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Failed to reset password. The link may be invalid or expired.';
        this.isSubmitting = false;
        this.tokenIsValid = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }
}