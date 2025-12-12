// frontend/src/app/components/login/login.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  showPassword = false;
  showPasswordIcon = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private toastService: ToastService
  ) {}

  onLogin(): void {
    this.errorMessage = '';
    
    this.authService.login(this.email, this.password).subscribe({
      next: (response: any) => {
        console.log('Login response:', response);
        
        // Check if email verification is required
        if (response.requiresVerification) {
          this.errorMessage = response.message || 'Please verify your email address to continue.';
          this.toastService.warning('Please verify your email address to continue.', 5000);
          // Store email for resend verification page
          localStorage.setItem('pendingVerificationEmail', this.email);
          return;
        }
        
        // Email is verified, proceed to dashboard
        this.toastService.success('Login successful!', 3000);
        this.router.navigate(['/dashboard']);
      },
      error: (error: any) => {
        const message = error.error?.message || 'Login failed';
        this.errorMessage = message;
        this.toastService.error(message);
      }
    });
  }

  goToResendVerification(): void {
    localStorage.setItem('pendingVerificationEmail', this.email);
    this.router.navigate(['/resend-verification']);
  }

  onGoogleLogin(): void {
    window.location.href = `${environment.apiUrl.replace('/api', '')}/api/auth/google`;
    }
}