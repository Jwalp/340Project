import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

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

  constructor(private authService: AuthService, private router: Router) {}

  onLogin(): void {
    this.errorMessage = '';
    
    this.authService.login(this.email, this.password).subscribe({
      next: (response: any) => {
        console.log('Login successful!', response);
        this.router.navigate(['/dashboard']);
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Login failed';
      }
    });
  }

  onGoogleLogin(): void {
    window.location.href = 'http://localhost:3000/api/auth/google';
  }
}