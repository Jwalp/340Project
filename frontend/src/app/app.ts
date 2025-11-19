import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
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
    // Check for OAuth callback with token from Google
    // Only process if we're on the root route with BOTH token and user params
    this.router.events.subscribe(() => {
      // Only check query params when we're on the root path
      if (this.router.url.startsWith('/?') || this.router.url === '/') {
        this.route.queryParams.subscribe(params => {
          console.log('Root URL Query Params:', params); // Debug log
          
          if (params['token'] && params['user']) {
            console.log('Google OAuth detected - redirecting to dashboard');
            const token = params['token'];
            const user = JSON.parse(decodeURIComponent(params['user']));
            
            // Store token and user in localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            // Notify AuthService to trigger navbar update
            this.authService.setCurrentUser(user);
            
            // Clean URL and redirect to dashboard
            this.router.navigate(['/dashboard'], { replaceUrl: true });
          }
        });
      }
    });
  }
}