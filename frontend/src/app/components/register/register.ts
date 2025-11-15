import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  onRegister(): void {
    this.errorMessage = '';
    
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.authService.register(this.username, this.email, this.password).subscribe({
      next: (response: any) => {
        console.log('Registration successful!', response);
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Registration failed';
      }
    });
  }
}
