// frontend/src/app/app.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { ToastComponent } from './components/toast/toast.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ToastComponent],
  template: `
    <app-navbar></app-navbar>
    <app-toast></app-toast>
    <router-outlet></router-outlet>
  `,
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  title = 'FileVerse';
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

ngOnInit() {
    // Check for OAuth callback with token from Google immediately on init
    this.route.queryParams.subscribe(params => {
      console.log('Query Params:', params); // Debug log
      
      if (params['token'] && params['user']) {
        console.log('Google OAuth detected - processing authentication');
        const token = params['token'];
        
        try {
          const user = JSON.parse(decodeURIComponent(params['user']));
          
          // Store token and user in localStorage
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
          // Notify AuthService to trigger navbar update
          this.authService.setCurrentUser(user);
          
          console.log('Authentication successful, redirecting to dashboard');
          
          // Clean URL and redirect to dashboard
          // Use setTimeout to ensure the redirect happens after the current digest cycle
          setTimeout(() => {
            this.router.navigate(['/dashboard'], { 
              replaceUrl: true,
              queryParams: {} // Clear query params
            });
          }, 0);
        } catch (error) {
          console.error('Error parsing user data:', error);
          this.router.navigate(['/login'], { 
            replaceUrl: true,
            queryParams: { error: 'auth_failed' }
          });
        }
      }
    });
  }
}