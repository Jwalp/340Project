import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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
    private route: ActivatedRoute
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
        
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 3000);
      },
      error: (error: any) => {
        console.error('Email verification failed:', error);
        this.errorMessage = error.error?.message || 'Email verification failed. The link may be invalid or expired.';
        this.isVerifying = false;
        this.verificationSuccess = false;
      }
    });
  }

  resendVerification(): void {
    this.router.navigate(['/resend-verification']);
  }
}