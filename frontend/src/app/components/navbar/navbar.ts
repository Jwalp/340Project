import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class NavbarComponent implements OnInit {
  isLoggedIn = false;
  username = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to auth state
    this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user;
      this.username = user?.username || '';
    });

    // Check initial state
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.isLoggedIn = true;
      this.username = user.username;
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}