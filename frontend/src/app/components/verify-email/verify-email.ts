// frontend/src/app/components/verify-email/verify-email.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.css']
})
export class VerifyEmailComponent implements OnInit {
  isVerifying = true;
  verificationSuccess = false;
  errorMessage = '';
  token = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    // Get token from query params
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      console.log('Verification token received:', this.token);
      
      if (!this.token) {
        this.errorMessage = 'Invalid or missing verification token';
        this.isVerifying = false;
        this.verificationSuccess = false;
        this.toastService.error('Invalid or missing verification token');
      } else {
        this.verifyEmail();
      }
    });
  }

  verifyEmail(): void {
    this.authService.verifyEmail(this.token).subscribe({
      next: (response: any) => {
        console.log('Email verified successfully');
        this.isVerifying = false;
        this.verificationSuccess = true;
        this.toastService.success('Email verified successfully! Redirecting to dashboard...', 3000);
        
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 3000);
      },
      error: (error: any) => {
        console.error('Email verification failed:', error);
        const message = error.error?.message || 'Email verification failed. The link may be invalid or expired.';
        this.errorMessage = message;
        this.isVerifying = false;
        this.verificationSuccess = false;
        this.toastService.error(message);
      }
    });
  }

  resendVerification(): void {
    this.router.navigate(['/resend-verification']);
  }
}