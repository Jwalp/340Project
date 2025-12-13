// frontend/src/app/components/register/register.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent implements OnInit {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  showPasswordRequirements = false;
  showPassword = false;
  showConfirmPassword = false;
  showPasswordIcon = false;
  showConfirmPasswordIcon = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // If user is already logged in, redirect to dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
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

  onRegister(): void {
    this.errorMessage = '';
    
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    if (!this.isPasswordValid()) {
      this.errorMessage = 'Password does not meet requirements';
      return;
    }

    this.authService.register(this.username, this.email, this.password).subscribe({
      next: (response: any) => {
        console.log('Registration successful!', response);
        this.toastService.success('Registration successful! Please check your email to verify your account.', 7000);
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Registration failed';
        this.toastService.error(this.errorMessage);
      }
    });
  }
}